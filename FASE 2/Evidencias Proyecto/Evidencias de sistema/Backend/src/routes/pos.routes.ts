import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { defaultPgClient } from '../database/postgres/client';
import { defaultSqliteClient, SqliteClient } from '../database/sqlite/client';
import { defaultPaymentDispatcher } from '../payments/payment-dispatcher.service';
import { defaultPosSyncEngine } from '../sync/pos-sync-engine.service';
import { aplicarRedondeoChileno } from '../utils/pricing';
import { logger } from '../utils/logger';
import { defaultDteEmitter } from '../dte/dte-emitter.service';
import { TipoDTE } from '../dte/types';
import { defaultReplenishmentService } from '../replenishment/replenishment.service';
import { defaultTenantConfigService } from '../config/tenant-config.service';

import { generateChileanBarcode } from '../utils/barcode.utils';

const router = Router();
const sqlite = defaultSqliteClient;

/**
 * GET /api/v1/pos/products
 * Obtiene el catálogo de productos disponibles en el POS local (SQLite)
 */
router.get('/products', (req: Request, res: Response): void => {
  const tenantId = req.query.tenant_id as string;

  try {
    let sql = 'SELECT id, tenant_id, sku, codigo_barra, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, categoria, activo, lote, fecha_vencimiento, impuesto_adicional_codigo, impuesto_adicional_tasa FROM productos WHERE activo = 1';
    const params: unknown[] = [];

    if (tenantId) {
      sql += ' AND tenant_id = ?';
      params.push(tenantId);
    }
    sql += ' ORDER BY nombre ASC';

    const products = sqlite.query(sql, params);
    res.status(200).json({ success: true, count: products.length, data: products });
  } catch (error) {
    logger.error('PosRoutes', 'Error retrieving POS products from local SQLite', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve products from local database',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/v1/pos/products
 * Crea un nuevo producto en el catálogo local (SQLite) y en la nube (PostgreSQL si está en línea).
 * Soporta control de caducidades sanitarias (lote, fecha_vencimiento) e impuesto adicional ILA.
 */
router.post('/products', async (req: Request, res: Response): Promise<void> => {
  const {
    tenant_id = '00000000-0000-0000-0000-000000000001',
    nombre,
    sku,
    codigo_barra,
    precio_compra = 0,
    precio_venta = 0,
    stock_actual = 0,
    stock_minimo = 0,
    categoria = 'General',
    proveedor_id = null,
    lote = null,
    fecha_vencimiento = null,
    impuesto_adicional_codigo = 0,
    impuesto_adicional_tasa = 0
  } = req.body;

  if (!nombre || !sku) {
    res.status(400).json({
      success: false,
      message: 'nombre y sku son requeridos para dar de alta un producto'
    });
    return;
  }

  const productId = uuidv4();
  const finalBarcode = codigo_barra || generateChileanBarcode();

  try {
    // 1. Insertar en SQLite Local envuelto en transacción atómica
    sqlite.withTransaction(() => {
      sqlite.execute(
        `INSERT INTO productos 
         (id, tenant_id, proveedor_id, codigo_barra, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, categoria, activo, lote, fecha_vencimiento, impuesto_adicional_codigo, impuesto_adicional_tasa, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          productId,
          tenant_id,
          proveedor_id ?? null,
          finalBarcode,
          sku,
          nombre,
          Number(stock_actual) || 0,
          Number(stock_minimo) || 0,
          Number(precio_compra) || 0,
          Number(precio_venta) || 0,
          categoria ?? null,
          lote ?? null,
          fecha_vencimiento ?? null,
          impuesto_adicional_codigo || 0,
          impuesto_adicional_tasa || 0
        ]
      );

      // 2. Registrar movimiento de inventario si hay stock inicial (alta_inicial)
      if (Number(stock_actual) > 0) {
        sqlite.execute(
          `INSERT INTO historial_stock 
           (id, tenant_id, producto_id, cambio_anterior, nuevo_stock, cambio, tipo_movimiento, motivo, fecha_movimiento, usuario_registro)
           VALUES (?, ?, ?, 0, ?, ?, 'alta_inicial', 'Alta inicial: Creación manual de producto en catálogo', datetime('now'), 'Sistema POS')`,
          [uuidv4(), tenant_id, productId, stock_actual, stock_actual]
        );
      }
    });

    // 3. Replicar a PostgreSQL si está conectado
    try {
      if (await defaultPgClient.healthCheck()) {
        await defaultPgClient.query(
          `INSERT INTO productos 
           (id, tenant_id, proveedor_id, codigo_barra, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, categoria, activo, lote, fecha_vencimiento, impuesto_adicional_codigo, impuesto_adicional_tasa, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, $12, $13, $14, $15, now(), now())
           ON CONFLICT (tenant_id, sku) DO UPDATE SET 
             nombre = EXCLUDED.nombre,
             precio_venta = EXCLUDED.precio_venta,
             precio_compra = EXCLUDED.precio_compra,
             stock_actual = EXCLUDED.stock_actual,
             lote = EXCLUDED.lote,
             fecha_vencimiento = EXCLUDED.fecha_vencimiento,
             updated_at = now()`,
          [
            productId,
            tenant_id,
            proveedor_id ?? null,
            finalBarcode,
            sku,
            nombre,
            Number(stock_actual) || 0,
            Number(stock_minimo) || 0,
            Number(precio_compra) || 0,
            Number(precio_venta) || 0,
            categoria ?? null,
            lote ?? null,
            fecha_vencimiento ?? null,
            impuesto_adicional_codigo || 0,
            impuesto_adicional_tasa || 0
          ]
        );
      }
    } catch (pgError) {
      logger.warn('PosRoutes', 'PostgreSQL offline; producto creado únicamente en SQLite local', { error: pgError });
    }

    const createdProduct = sqlite.queryOne<any>(
      `SELECT p.*, pr.nombre_proveedores as proveedor_nombre 
       FROM productos p 
       LEFT JOIN proveedores pr ON p.proveedor_id = pr.id 
       WHERE p.id = ?`,
      [productId]
    );

    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      data: createdProduct
    });
  } catch (error) {
    logger.error('PosRoutes', 'Error creando producto', error);
    res.status(500).json({
      success: false,
      message: 'Error al dar de alta el producto',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/v1/pos/products/:id
 * Actualiza los datos de un producto (precios, stock mínimo, categoría, lote, vencimiento, estado).
 */
router.put('/products/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const {
    nombre,
    codigo_barra,
    precio_compra,
    precio_venta,
    stock_minimo,
    categoria,
    proveedor_id,
    lote,
    fecha_vencimiento,
    impuesto_adicional_codigo,
    impuesto_adicional_tasa,
    activo
  } = req.body;

  try {
    const existing = sqlite.queryOne<any>('SELECT * FROM productos WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Producto no encontrado' });
      return;
    }

    sqlite.execute(
      `UPDATE productos 
       SET nombre = COALESCE(?, nombre),
           codigo_barra = COALESCE(?, codigo_barra),
           precio_compra = COALESCE(?, precio_compra),
           precio_venta = COALESCE(?, precio_venta),
           stock_minimo = COALESCE(?, stock_minimo),
           categoria = COALESCE(?, categoria),
           proveedor_id = COALESCE(?, proveedor_id),
           lote = COALESCE(?, lote),
           fecha_vencimiento = COALESCE(?, fecha_vencimiento),
           impuesto_adicional_codigo = COALESCE(?, impuesto_adicional_codigo),
           impuesto_adicional_tasa = COALESCE(?, impuesto_adicional_tasa),
           activo = COALESCE(?, activo),
           updated_at = datetime('now')
       WHERE id = ?`,
      [
        nombre ?? null,
        codigo_barra ?? null,
        precio_compra !== undefined ? Number(precio_compra) : null,
        precio_venta !== undefined ? Number(precio_venta) : null,
        stock_minimo !== undefined ? Number(stock_minimo) : null,
        categoria ?? null,
        proveedor_id ?? null,
        lote ?? null,
        fecha_vencimiento ?? null,
        impuesto_adicional_codigo !== undefined ? Number(impuesto_adicional_codigo) : null,
        impuesto_adicional_tasa !== undefined ? Number(impuesto_adicional_tasa) : null,
        activo !== undefined ? (activo ? 1 : 0) : null,
        id
      ]
    );

    // Replicar a PostgreSQL si está conectado
    try {
      if (await defaultPgClient.healthCheck()) {
        await defaultPgClient.query(
          `UPDATE productos 
           SET nombre = COALESCE($1, nombre),
               codigo_barra = COALESCE($2, codigo_barra),
               precio_compra = COALESCE($3, precio_compra),
               precio_venta = COALESCE($4, precio_venta),
               stock_minimo = COALESCE($5, stock_minimo),
               categoria = COALESCE($6, categoria),
               proveedor_id = COALESCE($7, proveedor_id),
               lote = COALESCE($8, lote),
               fecha_vencimiento = COALESCE($9, fecha_vencimiento),
               impuesto_adicional_codigo = COALESCE($10, impuesto_adicional_codigo),
               impuesto_adicional_tasa = COALESCE($11, impuesto_adicional_tasa),
               activo = COALESCE($12, activo),
               updated_at = now()
           WHERE id = $13`,
          [
            nombre ?? null,
            codigo_barra ?? null,
            precio_compra !== undefined ? Number(precio_compra) : null,
            precio_venta !== undefined ? Number(precio_venta) : null,
            stock_minimo !== undefined ? Number(stock_minimo) : null,
            categoria ?? null,
            proveedor_id ?? null,
            lote ?? null,
            fecha_vencimiento ?? null,
            impuesto_adicional_codigo !== undefined ? Number(impuesto_adicional_codigo) : null,
            impuesto_adicional_tasa !== undefined ? Number(impuesto_adicional_tasa) : null,
            activo !== undefined ? (activo ? 1 : 0) : null,
            id
          ]
        );
      }
    } catch {}

    const updated = sqlite.queryOne<any>(
      `SELECT p.*, pr.nombre_proveedores as proveedor_nombre 
       FROM productos p 
       LEFT JOIN proveedores pr ON p.proveedor_id = pr.id 
       WHERE p.id = ?`,
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Producto actualizado correctamente',
      data: updated
    });
  } catch (error) {
    logger.error('PosRoutes', 'Error actualizando producto', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar producto',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PATCH /api/v1/pos/products/:id/stock
 * Ajuste manual de inventario (Conteo físico / Auditoría express / Mermas)
 */
router.patch('/products/:id/stock', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { tenant_id = '00000000-0000-0000-0000-000000000001', nuevo_stock, motivo = 'Ajuste manual de conteo físico', usuario_id = 'Cajero' } = req.body;

  if (nuevo_stock === undefined || isNaN(Number(nuevo_stock)) || Number(nuevo_stock) < 0) {
    res.status(400).json({ success: false, message: 'nuevo_stock debe ser un número mayor o igual a 0' });
    return;
  }

  try {
    const prod = sqlite.queryOne<any>('SELECT stock_actual FROM productos WHERE id = ?', [id]);
    if (!prod) {
      res.status(404).json({ success: false, message: 'Producto no encontrado' });
      return;
    }

    const prevStock = Number(prod.stock_actual);
    const targetStock = Number(nuevo_stock);
    const delta = targetStock - prevStock;

    // Transacción atómica en SQLite Local
    sqlite.withTransaction(() => {
      sqlite.execute("UPDATE productos SET stock_actual = ?, updated_at = datetime('now') WHERE id = ?", [targetStock, id]);

      sqlite.execute(
        `INSERT INTO historial_stock 
         (id, tenant_id, producto_id, cambio_anterior, nuevo_stock, cambio, tipo_movimiento, motivo, fecha_movimiento, usuario_registro)
         VALUES (?, ?, ?, ?, ?, ?, 'ajuste_manual', ?, datetime('now'), ?)`,
        [uuidv4(), tenant_id, id, prevStock, targetStock, delta, motivo || 'Ajuste manual de inventario', usuario_id]
      );
    });

    res.status(200).json({
      success: true,
      message: 'Stock ajustado exitosamente',
      data: {
        producto_id: id,
        stock_anterior: prevStock,
        stock_nuevo: targetStock,
        diferencia: delta,
        motivo
      }
    });
  } catch (error) {
    logger.error('PosRoutes', 'Error ajustando stock', error);
    res.status(500).json({ success: false, message: 'Error al ajustar stock' });
  }
});

/**
 * POST /api/v1/pos/mermas
 * Registra una merma o pérdida de stock (vencimiento, daño, rotura, merma operativa)
 * y actualiza atómicamente el inventario y el historial de movimientos.
 */
router.post('/mermas', async (req: Request, res: Response): Promise<void> => {
  const {
    tenant_id = '00000000-0000-0000-0000-000000000001',
    producto_id,
    cantidad,
    motivo = 'vencimiento',
    observaciones = '',
    usuario_id = 'Cajero'
  } = req.body;

  if (!producto_id || cantidad === undefined || Number(cantidad) <= 0) {
    res.status(400).json({
      success: false,
      message: 'producto_id y una cantidad positiva son requeridos para registrar una merma'
    });
    return;
  }

  const mermaId = uuidv4();
  const cant = Number(cantidad);

  try {
    // 1. Asegurar tabla de mermas en SQLite local
    sqlite.execute(`
      CREATE TABLE IF NOT EXISTS mermas (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        producto_id TEXT NOT NULL,
        cantidad REAL NOT NULL,
        motivo TEXT NOT NULL,
        observaciones TEXT,
        usuario_id TEXT,
        fecha TEXT NOT NULL,
        FOREIGN KEY (producto_id) REFERENCES productos(id)
      )
    `);

    const prod = sqlite.queryOne<any>('SELECT stock_actual, nombre FROM productos WHERE id = ?', [producto_id]);
    if (!prod) {
      res.status(404).json({ success: false, message: 'Producto no encontrado' });
      return;
    }

    const prevStock = Number(prod.stock_actual);
    const nuevoStock = Math.max(0, prevStock - cant);
    const detalleMotivo = `Merma: ${motivo}${observaciones ? ' - ' + observaciones : ''}`;

    // 2. Registrar merma y actualizar stock en transacción atómica
    sqlite.withTransaction(() => {
      sqlite.execute(
        `INSERT INTO mermas (id, tenant_id, producto_id, cantidad, motivo, observaciones, usuario_id, fecha)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [mermaId, tenant_id, producto_id, cant, motivo, observaciones, usuario_id]
      );

      sqlite.execute("UPDATE productos SET stock_actual = ?, updated_at = datetime('now') WHERE id = ?", [nuevoStock, producto_id]);

      // 3. Registrar en historial de stock (tipo_movimiento 'merma')
      sqlite.execute(
        `INSERT INTO historial_stock 
         (id, tenant_id, producto_id, cambio_anterior, nuevo_stock, cambio, tipo_movimiento, motivo, fecha_movimiento, usuario_registro)
         VALUES (?, ?, ?, ?, ?, ?, 'merma', ?, datetime('now'), ?)`,
        [uuidv4(), tenant_id, producto_id, prevStock, nuevoStock, -cant, detalleMotivo, usuario_id]
      );
    });

    res.status(201).json({
      success: true,
      message: 'Merma registrada exitosamente',
      data: {
        id: mermaId,
        producto_id,
        producto_nombre: prod.nombre,
        cantidad: cant,
        motivo,
        stock_anterior: prevStock,
        stock_actual: nuevoStock,
        fecha: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('PosRoutes', 'Error registrando merma', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar la merma',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/v1/pos/mermas
 * Lista el historial de mermas registradas con detalles de productos.
 */
router.get('/mermas', (req: Request, res: Response): void => {
  const tenantId = req.query.tenant_id as string;

  try {
    sqlite.execute(`
      CREATE TABLE IF NOT EXISTS mermas (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        producto_id TEXT NOT NULL,
        cantidad REAL NOT NULL,
        motivo TEXT NOT NULL,
        observaciones TEXT,
        usuario_id TEXT,
        fecha TEXT NOT NULL,
        FOREIGN KEY (producto_id) REFERENCES productos(id)
      )
    `);

    let query = `
      SELECT m.*, p.nombre as producto_nombre, p.codigo_barra, p.sku
      FROM mermas m
      LEFT JOIN productos p ON m.producto_id = p.id
    `;
    const params: unknown[] = [];
    if (tenantId) {
      query += ' WHERE m.tenant_id = ?';
      params.push(tenantId);
    }
    query += ' ORDER BY m.fecha DESC LIMIT 100';

    const mermas = sqlite.query(query, params);
    res.status(200).json({ success: true, count: mermas.length, data: mermas });
  } catch (error) {
    logger.error('PosRoutes', 'Error consultando mermas', error);
    res.status(500).json({ success: false, message: 'Error al consultar mermas' });
  }
});

/**
 * GET /api/v1/pos/stock-history
 * Consulta el historial de movimientos de inventario con filtros por producto, tipo de movimiento y límites
 */
router.get('/stock-history', (req: Request, res: Response): void => {
  const tenantId = (req.query.tenant_id as string) || '00000000-0000-0000-0000-000000000001';
  const { producto_id, tipo_movimiento, limit = 100 } = req.query;

  try {
    let sql = `
      SELECT h.*, p.nombre as producto_nombre, p.sku, p.codigo_barra
      FROM historial_stock h
      LEFT JOIN productos p ON h.producto_id = p.id
      WHERE h.tenant_id = ?
    `;
    const params: unknown[] = [tenantId];

    if (producto_id) {
      sql += ' AND h.producto_id = ?';
      params.push(producto_id);
    }
    if (tipo_movimiento) {
      sql += ' AND h.tipo_movimiento = ?';
      params.push(tipo_movimiento);
    }

    sql += ' ORDER BY h.fecha_movimiento DESC LIMIT ?';
    params.push(Number(limit) || 100);

    const history = sqlite.query(sql, params);
    res.status(200).json({ success: true, count: history.length, data: history });
  } catch (error) {
    logger.error('PosRoutes', 'Error consultando historial de stock', error);
    res.status(500).json({ success: false, message: 'Error al consultar historial de stock' });
  }
});

/**
 * GET /api/v1/pos/products/:id/history
 * Historial específico de movimientos de un producto por ID
 */
router.get('/products/:id/history', (req: Request, res: Response): void => {
  const { id } = req.params;
  const tenantId = (req.query.tenant_id as string) || '00000000-0000-0000-0000-000000000001';
  const { tipo_movimiento, limit = 50 } = req.query;

  try {
    let sql = `
      SELECT h.*, p.nombre as producto_nombre, p.sku, p.codigo_barra
      FROM historial_stock h
      LEFT JOIN productos p ON h.producto_id = p.id
      WHERE h.tenant_id = ? AND h.producto_id = ?
    `;
    const params: unknown[] = [tenantId, id];

    if (tipo_movimiento) {
      sql += ' AND h.tipo_movimiento = ?';
      params.push(tipo_movimiento);
    }

    sql += ' ORDER BY h.fecha_movimiento DESC LIMIT ?';
    params.push(Number(limit) || 50);

    const history = sqlite.query(sql, params);
    res.status(200).json({ success: true, count: history.length, data: history });
  } catch (error) {
    logger.error('PosRoutes', 'Error consultando historial del producto', error);
    res.status(500).json({ success: false, message: 'Error al consultar historial del producto' });
  }
});

/**
 * GET /api/v1/pos/status
 * Semáforo y estado de sincronización del nodo POS
 */
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  const tenantId = (req.query.tenant_id as string) || 'default-tenant';

  try {
    // 1. Verificar conectividad con Cloud PostgreSQL
    const isCloudOnline = await defaultPgClient.healthCheck();

    // 2. Contar ventas pendientes de sincronización (is_dirty = 1)
    const dirtyCountResult = sqlite.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM transacciones_venta WHERE is_dirty = 1'
    );
    const pendingDirtyCount = dirtyCountResult?.count || 0;

    // 3. Última sincronización registrada
    const lastSyncResult = sqlite.queryOne<{ last_synced_at: string | null }>(
      `SELECT last_synced_at FROM transacciones_venta 
       WHERE sync_status = 'SYNCED' AND last_synced_at IS NOT NULL 
       ORDER BY last_synced_at DESC LIMIT 1`
    );

    res.status(200).json({
      success: true,
      status: isCloudOnline ? (pendingDirtyCount > 0 ? 'SYNC_PENDING' : 'ONLINE') : 'OFFLINE',
      cloud_online: isCloudOnline,
      pending_dirty_count: pendingDirtyCount,
      last_synced_at: lastSyncResult?.last_synced_at || null,
      device_id: 'POS-LOCAL-DEVICE-01',
      tenant_id: tenantId
    });
  } catch (error) {
    logger.error('PosRoutes', 'Error checking POS status', error);
    res.status(500).json({
      success: false,
      message: 'Failed to evaluate POS network status',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/v1/pos/checkout
 * Ejecuta una venta atómica local en SQLite con cálculo de totales, descuento de stock y banderas de sincronización
 */
router.post('/checkout', async (req: Request, res: Response): Promise<void> => {
    const {
      tenant_id,
      usuario_id,
      items,
      metodo_pago = 'EFECTIVO',
      tipo_comprobante = 'BOLETA', // 'BOLETA' | 'FACTURA'
      receptor_empresa, // { rut, razon_social, giro, direccion, comuna, ciudad }
      rut_cliente,
      observaciones
    } = req.body;

  if (!tenant_id || !usuario_id || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({
      success: false,
      message: 'Missing required checkout fields: tenant_id, usuario_id, and non-empty items array'
    });
    return;
  }

  const startTime = Date.now();
  const saleId = uuidv4();
  const folio = `POS-${Date.now()}`;

  try {
    let total = 0;
    let unidades = 0;

    // 1. Ejecutar venta transaccional en SQLite
    const checkoutResult = sqlite.withTransaction(() => {
      // Calcular total y unidades. La Ley N° 20.956 rige exclusivamente para pagos en efectivo
      for (const item of items) {
        total += Number(item.precio_unitario) * Number(item.cantidad);
        unidades += Number(item.cantidad);
      }
      if (metodo_pago && String(metodo_pago).trim().toUpperCase() === 'EFECTIVO') {
        total = aplicarRedondeoChileno(total);
      }

      // Buscar metodo_pago_id o usar un UUID determinista si no existe
      const metodoRow = sqlite.queryOne<{ id: string }>(
        'SELECT id FROM metodos_pago WHERE pasarela = ? LIMIT 1',
        [metodo_pago]
      );
      const metodoPagoId = metodoRow?.id || '11111111-0000-0000-0000-000000000001';

      // Insertar transacciones_venta en SQLite con is_dirty = 1
      sqlite.execute(
        `INSERT INTO transacciones_venta 
         (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, rut_cliente, observaciones, metodo_pago_id, is_dirty, sync_attempts, sync_status, fecha)
         VALUES (?, ?, ?, ?, ?, ?, 'COMPLETADA', ?, ?, ?, 1, 0, 'PENDING', datetime('now'))`,
        [saleId, tenant_id, usuario_id, folio, total, unidades, rut_cliente || null, observaciones || null, metodoPagoId]
      );

      // Procesar cada detalle y actualizar stock
      for (const item of items) {
        const detailId = uuidv4();
        const subtotal = Number(item.precio_unitario) * Number(item.cantidad);

        // Insertar detalle_venta
        sqlite.execute(
          `INSERT INTO detalle_venta 
           (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [detailId, saleId, item.producto_id, item.cantidad, item.precio_unitario, subtotal]
        );

        // Obtener stock previo
        const prod = sqlite.queryOne<{ stock_actual: number }>(
          'SELECT stock_actual FROM productos WHERE id = ?',
          [item.producto_id]
        );
        const prevStock = prod ? Number(prod.stock_actual) : 0;
        const newStock = prevStock - Number(item.cantidad);

        // Actualizar stock local
        sqlite.execute(
          'UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?',
          [item.cantidad, item.producto_id]
        );

        // Registrar en historial_stock
        const historyId = uuidv4();
        sqlite.execute(
          `INSERT INTO historial_stock 
           (id, tenant_id, producto_id, cambio_anterior, nuevo_stock, cambio, tipo_movimiento, id_venta_manual, motivo, fecha_movimiento, usuario_registro)
           VALUES (?, ?, ?, ?, ?, ?, 'venta', ?, 'Venta POS Local', datetime('now'), ?)`,
          [historyId, tenant_id, item.producto_id, prevStock, newStock, -Number(item.cantidad), saleId, usuario_id]
        );
      }

      return { saleId, folio, total, unidades };
    });

    // 2. Procesamiento de pago si es con pasarela de tarjeta
    let paymentStatus = 'APPROVED';
    let paymentTransactionId = null;

    if (metodo_pago !== 'EFECTIVO') {
      try {
        const payRes = await defaultPaymentDispatcher.initiatePayment({
          saleId,
          amount: total,
          gateway: metodo_pago === 'MERCADOPAGO' ? 'MercadoPago' : metodo_pago === 'SUMUP' ? 'SumUp' : metodo_pago === 'RUTPAY' ? 'RutPay' : 'Transbank',
          tenantId: tenant_id
        });

        const confirmRes = await defaultPaymentDispatcher.confirmPayment({
          token: payRes.token,
          saleId,
          tenantId: tenant_id,
          gateway: payRes.gateway
        });

        paymentStatus = confirmRes.status;
        paymentTransactionId = confirmRes.transactionId;
      } catch (payError) {
        // Tolerancia a fallos: emisión de vale offline
        logger.warn('PosRoutes', 'External payment failed during checkout, generating offline voucher', { payError });
        paymentStatus = 'OFFLINE_VOUCHER';
      }
    }

    // 3. Emisión de Documento Tributario (Boleta 39, Factura 33) o Voucher (Res. Ex. N° 176)
    let dteResult = null;
    try {
      const dteItems = items.map((it: any, idx: number) => {
        const prod = sqlite.queryOne<{
          nombre: string;
          sku: string;
          impuesto_adicional_codigo: number;
          impuesto_adicional_tasa: number;
        }>(
          'SELECT nombre, sku, impuesto_adicional_codigo, impuesto_adicional_tasa FROM productos WHERE id = ?',
          [it.producto_id]
        );
        return {
          nroLinea: idx + 1,
          nombre: it.nombre || prod?.nombre || 'Producto',
          sku: it.sku || prod?.sku,
          cantidad: Number(it.cantidad),
          precioUnitario: Number(it.precio_unitario),
          subtotal: Number(it.precio_unitario) * Number(it.cantidad),
          codigoIla: it.codigo_ila || prod?.impuesto_adicional_codigo || undefined,
          tasaIla: it.tasa_ila || prod?.impuesto_adicional_tasa || undefined
        };
      });

      const tipoDteFinal = tipo_comprobante === 'FACTURA' ? TipoDTE.FACTURA_ELECTRONICA : TipoDTE.BOLETA_ELECTRONICA;
      let receptorFinal: any = undefined;

      if (tipo_comprobante === 'FACTURA' && receptor_empresa) {
        receptorFinal = {
          rut: receptor_empresa.rut,
          razonSocial: receptor_empresa.razon_social || 'EMPRESA RECEPTORA',
          giro: receptor_empresa.giro || 'GIRO COMERCIAL',
          direccion: receptor_empresa.direccion || 'DIRECCION CLIENTE',
          comuna: receptor_empresa.comuna || 'SANTIAGO',
          ciudad: receptor_empresa.ciudad || 'SANTIAGO'
        };
      } else if (rut_cliente) {
        receptorFinal = {
          rut: rut_cliente,
          razonSocial: 'CLIENTE IDENTIFICADO'
        };
      }

      dteResult = defaultDteEmitter.emitDocument({
        tenantId: tenant_id,
        ventaId: saleId,
        tipoDte: tipoDteFinal,
        items: dteItems,
        metodoPago: metodo_pago,
        receptor: receptorFinal
      });
    } catch (dteErr) {
      logger.error('PosRoutes', 'Error emitting DTE during checkout', dteErr);
    }

    const soldProductIds = items.map((it: any) => it.producto_id);
    let hasAlcohol = items.some((it: any) => it.codigo_ila === 27 || it.codigo_ila === 28);
    if (!hasAlcohol && soldProductIds.length > 0) {
      try {
        const alcCheck = sqlite.queryOne<{ count: number }>(
          `SELECT COUNT(*) as count FROM productos WHERE id IN (${soldProductIds.map(() => '?').join(',')}) AND impuesto_adicional_codigo IN (27, 28)`,
          soldProductIds
        );
        if (alcCheck && alcCheck.count > 0) hasAlcohol = true;
      } catch {}
    }

    // Disparo asíncrono de reabastecimiento en segundo plano si algún ítem quedó en nivel crítico (ROP)
    setImmediate(async () => {
      try {
        const autoSend = await defaultTenantConfigService.getAutoSendOrders(tenant_id);
        if (!autoSend) return;

        if (soldProductIds.length > 0) {
          const lowStockItems = sqlite.query<any>(
            `SELECT id, nombre, stock_actual, stock_minimo FROM productos WHERE id IN (${soldProductIds.map(() => '?').join(',')}) AND stock_actual <= stock_minimo`,
            soldProductIds
          );

          if (lowStockItems.length > 0) {
            logger.info('PosRoutes', `Triggering background replenishment email for tenant ${tenant_id} (${lowStockItems.length} products reached ROP)`);
            await defaultReplenishmentService.generateSuggestedOrders(tenant_id);
          }
        }
      } catch (err) {
        logger.warn('PosRoutes', 'Background auto-replenishment check failed', { err });
      }
    });

    const duration = Date.now() - startTime;
    logger.info('PosRoutes', `Checkout completed in ${duration}ms for sale ${saleId} (folio ${folio})`);

    res.status(201).json({
      success: true,
      data: {
        ...checkoutResult,
        dte: dteResult,
        contiene_alcohol: hasAlcohol,
        verificacion_edad_alcohol: hasAlcohol,
        payment_method: metodo_pago,
        payment_status: paymentStatus,
        payment_transaction_id: paymentTransactionId,
        is_dirty: 1,
        sync_status: 'PENDING',
        latency_ms: duration
      }
    });
  } catch (error) {
    logger.error('PosRoutes', 'Checkout transaction failed in SQLite', error);
    res.status(500).json({
      success: false,
      message: 'Checkout failed due to transaction error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/v1/pos/sync
 * Sincronización manual o periódica iniciada desde el POS:
 * 1. Push: envía ventas y transacciones pendientes locales (is_dirty = 1) a la nube
 * 2. Pull: descarga actualizaciones del catálogo (precios, stock) desde la nube
 */
router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  const tenantId = (req.body?.tenant_id as string) || (req.query?.tenant_id as string) || '00000000-0000-0000-0000-000000000001';

  try {
    const isCloudOnline = await defaultPgClient.healthCheck();
    if (!isCloudOnline) {
      res.status(503).json({
        success: false,
        message: 'No se puede sincronizar: el servidor en la nube no está disponible (Modo Offline activo)',
        cloud_online: false
      });
      return;
    }

    // 1. Enviar ventas locales pendientes a la nube (Push)
    const result = await defaultPosSyncEngine.syncPush(tenantId);

    // Si falló el push, retornar error estructurado para que el frontend reporte el problema correctamente
    if (!result.success) {
      res.status(500).json({
        success: false,
        message: `Fallo en sincronización: ${result.message}`,
        result
      });
      return;
    }

    // 2. Traer actualizaciones de catálogo desde la nube (Pull)
    let catalogUpdatedCount = 0;
    try {
      catalogUpdatedCount = await defaultPosSyncEngine.syncPullCatalog(tenantId);
    } catch (pullErr) {
      logger.warn('PosRoutes', 'Catalog pull encountered warning during sync', {
        error: pullErr instanceof Error ? pullErr.message : String(pullErr)
      });
    }

    // 3. Obtener conteo actualizado de pendientes
    const dirtyCountResult = sqlite.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM transacciones_venta WHERE is_dirty = 1'
    );

    res.status(200).json({
      success: true,
      message: result.synced_ids.length > 0
        ? `Sincronización completada: ${result.synced_ids.length} ventas respaldadas en la nube.`
        : 'Todos los datos ya se encuentran sincronizados con la nube.',
      synced_sales_count: result.synced_ids.length,
      failed_sales_count: result.failed_ids.length,
      catalog_updated_count: catalogUpdatedCount,
      pending_dirty_count: dirtyCountResult?.count || 0,
      cloud_online: true,
      result
    });
  } catch (error) {
    logger.error('PosRoutes', 'Manual sync push failed', error);
    res.status(500).json({
      success: false,
      message: 'Error interno durante la sincronización',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/v1/pos/inventory
 * Catálogo completo de inventario con todos los campos: ID, SKU, código de barra, nombre, categoría, stocks, costos, venta y estado
 */
router.get('/inventory', (req: Request, res: Response): void => {
  const tenantId = (req.query.tenant_id as string) || '00000000-0000-0000-0000-000000000001';

  try {
    const products = sqlite.query<any>(
      `SELECT p.id, p.tenant_id, p.proveedor_id, p.sku, p.codigo_barra, p.nombre, p.stock_actual, p.stock_minimo, 
              p.precio_compra, p.precio_venta, p.categoria, p.activo, p.updated_at,
              p.origen_creacion, p.factura_origen_folio,
              p.lote, p.fecha_vencimiento, p.impuesto_adicional_codigo, p.impuesto_adicional_tasa,
              pr.nombre_proveedores as proveedor_nombre
       FROM productos p
       LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
       WHERE p.tenant_id = ?
       ORDER BY p.nombre ASC`,
      [tenantId]
    );

    res.status(200).json({ success: true, count: products.length, data: products });
  } catch (error) {
    logger.error('PosRoutes', 'Error retrieving full inventory', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve inventory' });
  }
});

/**
 * GET /api/v1/pos/vencimientos
 * Control de Caducidades Sanitarias bajo el Reglamento Sanitario de los Alimentos (D.S. N° 977/96 MINSAL)
 * Retorna productos vencidos o próximos a vencer clasificados por semáforo de riesgo
 */
router.get('/vencimientos', (req: Request, res: Response): void => {
  const tenantId = (req.query.tenant_id as string) || '00000000-0000-0000-0000-000000000001';

  try {
    const rows = sqlite.query<any>(
      `SELECT id, sku, nombre, stock_actual, precio_compra, precio_venta, lote, fecha_vencimiento,
              ROUND(julianday(fecha_vencimiento) - julianday('now')) as dias_restantes
       FROM productos
       WHERE tenant_id = ? AND fecha_vencimiento IS NOT NULL AND activo = 1
       ORDER BY fecha_vencimiento ASC`,
      [tenantId]
    );

    const clasificados = rows.map(r => {
      const dias = Math.round(Number(r.dias_restantes));
      let estado = 'VIGENTE';
      let nivelRiesgo = 'VERDE';

      if (dias < 0) {
        estado = 'VENCIDO';
        nivelRiesgo = 'ROJO_CRITICO';
      } else if (dias <= 7) {
        estado = 'VENCE_ESTA_SEMANA';
        nivelRiesgo = 'NARANJA_URGENTE';
      } else if (dias <= 15) {
        estado = 'VENCE_EN_15_DIAS';
        nivelRiesgo = 'AMARILLO_ALERTA';
      } else if (dias <= 30) {
        estado = 'VENCE_EN_30_DIAS';
        nivelRiesgo = 'AMARILLO_PREVENTIVO';
      }

      return {
        ...r,
        dias_restantes: dias,
        estado,
        nivel_riesgo: nivelRiesgo
      };
    });

    const resumen = {
      vencidos: clasificados.filter(c => c.dias_restantes < 0).length,
      riesgo_critico_7d: clasificados.filter(c => c.dias_restantes >= 0 && c.dias_restantes <= 7).length,
      riesgo_medio_15d: clasificados.filter(c => c.dias_restantes > 7 && c.dias_restantes <= 15).length,
      vence_30_dias: clasificados.filter(c => c.dias_restantes > 15 && c.dias_restantes <= 30).length,
      total_con_vencimiento: clasificados.length,
      total_en_riesgo: clasificados.filter(c => c.dias_restantes <= 30).length
    };

    res.status(200).json({ success: true, total: clasificados.length, resumen, data: clasificados });
  } catch (error) {
    logger.error('PosRoutes', 'Error retrieving expiration alerts', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve expiration alerts' });
  }
});

/**
 * GET /api/v1/pos/transactions
 * Registro visual de transacciones de venta con fecha, hora, cajero, tipo de pago y detalle de ítems
 */
router.get('/transactions', (req: Request, res: Response): void => {
  const tenantId = (req.query.tenant_id as string) || '00000000-0000-0000-0000-000000000001';

  try {
    const sales = sqlite.query<any>(
      `SELECT v.id, v.folio_local_sqlite as folio, v.fecha, v.total, v.unidades, v.estado, 
              v.sync_status, v.observaciones, v.es_devolucion, v.referencia_venta_id,
              v.rut_cliente, v.tipo_documento_tributario, v.monto_ila,
              u.nombre as cajero_nombre,
              mp.nombre as medio_pago_nombre, mp.pasarela as medio_pago_tipo
       FROM transacciones_venta v
       LEFT JOIN usuarios u ON v.usuario_id = u.id
       LEFT JOIN metodos_pago mp ON v.metodo_pago_id = mp.id
       WHERE v.tenant_id = ?
       ORDER BY v.fecha DESC LIMIT 100`,
      [tenantId]
    );

    const salesWithDetails = sales.map(sale => {
      const details = sqlite.query<any>(
        `SELECT dv.id, dv.producto_id, dv.cantidad, dv.precio_unitario, dv.subtotal, 
                p.nombre as producto_nombre, p.sku, p.codigo_barra
         FROM detalle_venta dv
         LEFT JOIN productos p ON dv.producto_id = p.id
         WHERE dv.venta_id = ?`,
        [sale.id]
      );
      return {
        ...sale,
        items: details
      };
    });

    res.status(200).json({ success: true, count: salesWithDetails.length, data: salesWithDetails });
  } catch (error) {
    logger.error('PosRoutes', 'Error retrieving sales transactions', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve transactions' });
  }
});

/**
 * POST /api/v1/pos/devolucion
 * Procesa la devolución total o parcial de una venta bajo la Ley Pro-Consumidor N° 21.398 (Garantía Legal 6 meses)
 * Emite Nota de Crédito Electrónica (DTE Tipo 61) con nodo <Referencia> y restituye el stock al inventario.
 */
router.post('/devolucion', async (req: Request, res: Response): Promise<void> => {
  const { tenant_id, usuario_id, venta_id, motivo = 'Garantía Legal Ley N° 21.398', items_devolucion } = req.body;

  if (!tenant_id || !usuario_id || !venta_id) {
    res.status(400).json({
      success: false,
      message: 'tenant_id, usuario_id, and venta_id are required'
    });
    return;
  }

  try {
    // 1. Obtener la venta original
    const ventaOriginal = sqlite.queryOne<any>(
      `SELECT * FROM transacciones_venta WHERE id = ? AND tenant_id = ?`,
      [venta_id, tenant_id]
    );

    if (!ventaOriginal) {
      res.status(404).json({ success: false, message: 'Venta original no encontrada' });
      return;
    }

    // 2. Obtener los detalles de la venta original
    const detallesOriginales = sqlite.query<any>(
      `SELECT dv.*, p.nombre, p.sku, p.impuesto_adicional_codigo, p.impuesto_adicional_tasa 
       FROM detalle_venta dv
       JOIN productos p ON dv.producto_id = p.id
       WHERE dv.venta_id = ?`,
      [venta_id]
    );

    if (detallesOriginales.length === 0) {
      res.status(400).json({ success: false, message: 'La venta original no tiene ítems registrados' });
      return;
    }

    // 3. Determinar ítems a devolver
    const itemsADevolver: Array<{
      producto_id: string;
      nombre: string;
      sku: string;
      cantidad: number;
      precio_unitario: number;
      subtotal: number;
      codigoIla?: number;
      tasaIla?: number;
    }> = [];

    if (Array.isArray(items_devolucion) && items_devolucion.length > 0) {
      for (const reqItem of items_devolucion) {
        const match = detallesOriginales.find(d => d.producto_id === reqItem.producto_id);
        if (match) {
          const cant = Math.min(Number(reqItem.cantidad) || 1, match.cantidad);
          itemsADevolver.push({
            producto_id: match.producto_id,
            nombre: match.nombre,
            sku: match.sku,
            cantidad: cant,
            precio_unitario: match.precio_unitario,
            subtotal: match.precio_unitario * cant,
            codigoIla: match.impuesto_adicional_codigo || undefined,
            tasaIla: match.impuesto_adicional_tasa || undefined
          });
        }
      }
    } else {
      // Devolución total
      for (const d of detallesOriginales) {
        itemsADevolver.push({
          producto_id: d.producto_id,
          nombre: d.nombre,
          sku: d.sku,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          subtotal: d.subtotal,
          codigoIla: d.impuesto_adicional_codigo || undefined,
          tasaIla: d.impuesto_adicional_tasa || undefined
        });
      }
    }

    // 4. Buscar DTE original emitido si existe
    const dteOriginal = sqlite.queryOne<any>(
      `SELECT * FROM sii_dte_emitidos WHERE venta_id = ? ORDER BY fecha_emision DESC LIMIT 1`,
      [venta_id]
    );

    const tipoDocRef = dteOriginal?.tipo_dte || (ventaOriginal.tipo_documento_tributario === 'FACTURA' ? 33 : 39);
    const folioRef = dteOriginal?.folio || parseInt((ventaOriginal.folio_local_sqlite || '1').replace(/\D/g, ''), 10) || 1;
    const fechaRef = (dteOriginal?.fecha_emision || ventaOriginal.fecha || new Date().toISOString()).substring(0, 10);

    // 5. Restituir inventario dentro de una transacción
    const returnSaleId = uuidv4();
    let totalDevuelto = 0;

    sqlite.withTransaction(() => {
      // Asegurar tipo de movimiento en SQLite
      sqlite.execute(
        `INSERT OR IGNORE INTO movimientos_inventario_tipos (id, nombre, codigo, descripcion)
         VALUES ('DEVOLUCION_CLIENTE', 'Devolución de Cliente', 'DEVOLUCION_CLIENTE', 'Restitución de mercadería por garantía legal Ley 21.398')`
      );

      for (const item of itemsADevolver) {
        totalDevuelto += item.subtotal;

        const currentProd = sqlite.queryOne<any>(
          'SELECT stock_actual FROM productos WHERE id = ?',
          [item.producto_id]
        );
        const prevStock = currentProd ? Number(currentProd.stock_actual) : 0;
        const newStock = prevStock + item.cantidad;

        // Reponer stock
        sqlite.execute(
          `UPDATE productos 
           SET stock_actual = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [newStock, item.producto_id]
        );

        // Registrar movimiento de inventario
        sqlite.execute(
          `INSERT INTO movimientos_inventario 
           (id, tenant_id, producto_id, tipo_movimiento_id, cantidad, saldo_anterior, nuevo_saldo, id_origen, tipo_origen, usuario_registro, fecha_movimiento)
           VALUES (?, ?, ?, 'DEVOLUCION_CLIENTE', ?, ?, ?, ?, 'DEVOLUCION_VENTA', ?, datetime('now'))`,
          [
            uuidv4(),
            tenant_id,
            item.producto_id,
            item.cantidad,
            prevStock,
            newStock,
            venta_id,
            usuario_id
          ]
        );
      }

      // Registrar transacción de devolución
      sqlite.execute(
        `INSERT INTO transacciones_venta 
         (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, rut_cliente, observaciones, metodo_pago_id, is_dirty, sync_attempts, sync_status, es_devolucion, referencia_venta_id, fecha)
         VALUES (?, ?, ?, ?, ?, ?, 'COMPLETADA', ?, ?, ?, 1, 0, 'PENDING', 1, ?, datetime('now'))`,
        [
          returnSaleId,
          tenant_id,
          usuario_id,
          `DEV-${Date.now()}`,
          -totalDevuelto,
          itemsADevolver.reduce((acc, it) => acc + it.cantidad, 0),
          ventaOriginal.rut_cliente,
          `Devolución / NC: ${motivo}`,
          ventaOriginal.metodo_pago_id,
          venta_id
        ]
      );
    });

    // 6. Emitir Nota de Crédito Electrónica (DTE Tipo 61) con nodo <Referencia>
    const dteItems = itemsADevolver.map((it, idx) => ({
      nroLinea: idx + 1,
      nombre: it.nombre,
      sku: it.sku,
      cantidad: it.cantidad,
      precioUnitario: it.precio_unitario,
      subtotal: it.subtotal,
      codigoIla: it.codigoIla,
      tasaIla: it.tasaIla
    }));

    const ncResponse = defaultDteEmitter.emitDocument({
      tenantId: tenant_id,
      ventaId: returnSaleId,
      tipoDte: TipoDTE.NOTA_CREDITO,
      items: dteItems,
      metodoPago: 'EFECTIVO',
      referencia: {
        nroLineaRef: 1,
        tipoDocRef,
        folioRef,
        fechaRef,
        codigoRef: 1, // 1: Anula Documento de Referencia
        razonRef: motivo
      },
      receptor: dteOriginal?.rut_receptor ? {
        rut: dteOriginal.rut_receptor,
        razonSocial: dteOriginal.razon_social_receptor || 'CLIENTE'
      } : undefined
    });

    logger.info(
      'PosRoutes',
      `Devolución procesada con éxito para venta ${venta_id}. NC Folio ${ncResponse.folio}, Stock restituido.`
    );

    res.status(200).json({
      success: true,
      message: `Devolución procesada exitosamente. Se emitió la Nota de Crédito DTE 61 N° ${ncResponse.folio} y el stock fue restituido.`,
      data: {
        devolucion_id: returnSaleId,
        folio_nc: ncResponse.folio,
        monto_total: totalDevuelto,
        total_devuelto: totalDevuelto,
        nota_credito: ncResponse,
        dte_nc: ncResponse,
        items_devueltos: itemsADevolver
      }
    });
  } catch (error) {
    logger.error('PosRoutes', 'Error processing sale return', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la devolución',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
