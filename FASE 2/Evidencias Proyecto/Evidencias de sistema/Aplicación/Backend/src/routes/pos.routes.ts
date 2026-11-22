import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { defaultPgClient } from '../database/postgres/client';
import { defaultSqliteClient, SqliteClient } from '../database/sqlite/client';
import { defaultPaymentDispatcher } from '../payments/payment-dispatcher.service';
import { PaymentTransactionResult } from '../payments/types';
import { configPagos } from '../payments/pagos.config';
import { defaultPosSyncEngine, TOPE_REINTENTOS_VENTA } from '../sync/pos-sync-engine.service';
import { aplicarRedondeoChileno } from '../utils/pricing';
import { logger } from '../utils/logger';
import { defaultLotesService } from '../inventory/lotes.service';
import {
  clasificarSemaforo,
  diasHastaVencer,
  fechaDeVencimientoParaGuardar,
  reloj,
  unidadesVencidasVendidas
} from '../inventory/vencimiento';
import { codigoValido, consultarCodigo } from '../inventory/open-food-facts.service';
import { motivoImagenInvalida } from '../inventory/imagen-producto';
import { montoLinea, defaultDteEmitter } from '../dte/dte-emitter.service';
import { defaultSiiEnvio } from '../dte/sii-envio.service';
import { TipoDTE } from '../dte/types';
import { defaultReplenishmentService } from '../replenishment/replenishment.service';
import { defaultTenantConfigService } from '../config/tenant-config.service';
import { defaultInvoiceQueue } from '../invoices/invoice-queue.service';
import {
  defaultInvoiceIngestionService,
  ResumenRespaldoDocumentos
} from '../invoices/invoice-ingestion.service';

import { generateChileanBarcode } from '../utils/barcode.utils';
import { detalleError } from '../utils/detalle-error';
import { rutSiiSeguro } from '../utils/sii.utils';

const router = Router();
const sqlite = defaultSqliteClient;

const MEDIOS_DEVOLUCION = ['TARJETA', 'EFECTIVO', 'TRANSFERENCIA'];
const PASARELAS_ELECTRONICAS = ['TRANSBANK', 'MERCADOPAGO', 'SUMUP', 'RUTPAY'];
const PASARELAS_CON_TARJETA = ['TRANSBANK', 'MERCADOPAGO', 'SUMUP'];
const TIPOS_TARJETA = ['CREDITO', 'DEBITO'];

/** Credito o debito segun lo que informa la maquina; null si no lo informa (SumUp solo da la marca). */
export function tipoTarjetaDePasarela(metadata: Record<string, unknown> | undefined): string | null {
  const valor = String(metadata?.card_type ?? '').trim().toUpperCase();
  if (valor === 'CR' || valor === 'CREDIT_CARD') return 'CREDITO';
  if (valor === 'DB' || valor === 'DEBIT_CARD') return 'DEBITO';
  return null;
}
// Una devolucion espera a la maquina antes de registrar: otra de la misma venta en ese lapso
// calcularia lo disponible sin ver la primera y devolveria dos veces
const devolucionesEnCurso = new Set<string>();

/**
 * Modo de cobro y maquinas que el local tiene configuradas, para que la caja muestre solo esas.
 * En modo simulado no se informa ninguna: todas aprueban sin salir del equipo.
 */
function estadoPagos(): { modo: string; modo_pagos: string; pasarelas_configuradas?: string[] } {
  const { modo, mercadoPago, sumUp } = configPagos();
  if (modo === 'simulado') return { modo, modo_pagos: modo };
  const pasarelas = ['TRANSBANK'];
  if (mercadoPago.accessToken && mercadoPago.terminalId) pasarelas.push('MERCADOPAGO');
  if (sumUp.apiKey && sumUp.merchantCode && sumUp.readerId && sumUp.affiliateKey && sumUp.appId) pasarelas.push('SUMUP');
  return { modo, modo_pagos: modo, pasarelas_configuradas: pasarelas };
}

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
      error: detalleError(error)
    });
  }
});

/**
 * GET /api/v1/pos/products/lookup/:codigo
 * Completa el alta de un producto a partir de su codigo de barras real, consultando Open Food Facts.
 * Si el codigo ya esta en el catalogo local lo informa en en_catalogo, para no duplicarlo.
 * Sin internet responde 503 y el alta sigue siendo manual.
 */
router.get('/products/lookup/:codigo', async (req: Request, res: Response): Promise<void> => {
  const tenantId = (req.query.tenant_id as string) || '00000000-0000-0000-0000-000000000001';
  const codigo = String(req.params.codigo).trim();

  if (!codigoValido(codigo)) {
    res.status(400).json({ success: false, message: 'El codigo de barras debe tener entre 8 y 14 digitos' });
    return;
  }

  try {
    const enCatalogo = sqlite.queryOne<{ id: string; nombre: string; sku: string }>(
      'SELECT id, nombre, sku FROM productos WHERE tenant_id = ? AND codigo_barra = ? LIMIT 1',
      [tenantId, codigo]
    ) ?? null;

    const resultado = await consultarCodigo(codigo);
    if (resultado.estado === 'sin_conexion') {
      res.status(503).json({
        success: false,
        en_catalogo: enCatalogo,
        message: 'No se pudo consultar Open Food Facts. El producto se puede ingresar a mano.'
      });
      return;
    }
    if (resultado.estado === 'no_encontrado') {
      res.status(404).json({
        success: false,
        en_catalogo: enCatalogo,
        message: 'El codigo no esta en Open Food Facts. El producto se puede ingresar a mano.'
      });
      return;
    }
    res.status(200).json({ success: true, en_catalogo: enCatalogo, data: resultado.producto });
  } catch (error) {
    logger.error('PosRoutes', 'Error consultando el codigo de barras', error);
    res.status(500).json({ success: false, message: 'Error interno consultando el codigo de barras' });
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
    impuesto_adicional_tasa = 0,
    imagen = null
  } = req.body;

  const motivoImagen = motivoImagenInvalida(imagen);
  if (motivoImagen) {
    res.status(400).json({ success: false, message: motivoImagen });
    return;
  }

  if (!nombre || !sku) {
    res.status(400).json({
      success: false,
      message: 'nombre y sku son requeridos para dar de alta un producto'
    });
    return;
  }

  const fechaVencimiento = fechaDeVencimientoParaGuardar(fecha_vencimiento);
  if (fechaVencimiento === undefined) {
    res.status(400).json({ success: false, message: 'La fecha de vencimiento debe tener el formato AAAA-MM-DD' });
    return;
  }

  const productId = uuidv4();
  const finalBarcode = codigo_barra || generateChileanBarcode();

  try {
    // 1. Insertar en SQLite Local envuelto en transacción atómica
    sqlite.withTransaction(() => {
      sqlite.execute(
        `INSERT INTO productos 
         (id, tenant_id, proveedor_id, codigo_barra, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, categoria, activo, lote, fecha_vencimiento, impuesto_adicional_codigo, impuesto_adicional_tasa, imagen, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
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
          fechaVencimiento,
          impuesto_adicional_codigo || 0,
          impuesto_adicional_tasa || 0,
          imagen
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
           (id, tenant_id, proveedor_id, codigo_barra, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, categoria, activo, lote, fecha_vencimiento, impuesto_adicional_codigo, impuesto_adicional_tasa, imagen, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, $12, $13, $14, $15, $16, now(), now())
           ON CONFLICT (tenant_id, sku) DO UPDATE SET 
             nombre = EXCLUDED.nombre,
             precio_venta = EXCLUDED.precio_venta,
             precio_compra = EXCLUDED.precio_compra,
             stock_actual = EXCLUDED.stock_actual,
             lote = EXCLUDED.lote,
             fecha_vencimiento = EXCLUDED.fecha_vencimiento,
             imagen = COALESCE(EXCLUDED.imagen, productos.imagen),
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
            fechaVencimiento,
            impuesto_adicional_codigo || 0,
            impuesto_adicional_tasa || 0,
            imagen
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
      error: detalleError(error)
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

  const fechaVencimiento = fechaDeVencimientoParaGuardar(fecha_vencimiento);
  if (fechaVencimiento === undefined) {
    res.status(400).json({ success: false, message: 'La fecha de vencimiento debe tener el formato AAAA-MM-DD' });
    return;
  }

  // La imagen no sigue el COALESCE del resto: enviarla en null la quita, omitirla la deja como esta
  const cambiaImagen = req.body && Object.prototype.hasOwnProperty.call(req.body, 'imagen');
  const motivoImagen = cambiaImagen ? motivoImagenInvalida(req.body.imagen) : null;
  if (motivoImagen) {
    res.status(400).json({ success: false, message: motivoImagen });
    return;
  }

  try {
    // Solo productos del comercio de la sesion: el id solo no impedia editar los de otro comercio
    const tenantProducto = (req.body?.tenant_id as string) || (req.query.tenant_id as string) || '00000000-0000-0000-0000-000000000001';
    const existing = sqlite.queryOne<any>('SELECT * FROM productos WHERE id = ? AND tenant_id = ?', [id, tenantProducto]);
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
        fechaVencimiento,
        impuesto_adicional_codigo !== undefined ? Number(impuesto_adicional_codigo) : null,
        impuesto_adicional_tasa !== undefined ? Number(impuesto_adicional_tasa) : null,
        activo !== undefined ? (activo ? 1 : 0) : null,
        id
      ]
    );
    if (cambiaImagen) {
      sqlite.execute("UPDATE productos SET imagen = ?, updated_at = datetime('now') WHERE id = ?", [req.body.imagen ?? null, id]);
    }

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
            fechaVencimiento,
            impuesto_adicional_codigo !== undefined ? Number(impuesto_adicional_codigo) : null,
            impuesto_adicional_tasa !== undefined ? Number(impuesto_adicional_tasa) : null,
            activo !== undefined ? (activo ? 1 : 0) : null,
            id
          ]
        );
        if (cambiaImagen) {
          await defaultPgClient.query('UPDATE productos SET imagen = $1, updated_at = now() WHERE id = $2', [req.body.imagen ?? null, id]);
        }
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
      error: detalleError(error)
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
    const prod = sqlite.queryOne<any>('SELECT stock_actual FROM productos WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
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
        stock_actual: targetStock,
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

      // Una merma suele ser justamente el lote vencido: se descuenta por el mismo orden
      defaultLotesService.consumirFefo(tenant_id, producto_id, Number(cantidad));

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
        stock_nuevo: nuevoStock,
        fecha: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('PosRoutes', 'Error registrando merma', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar la merma',
      error: detalleError(error)
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

    sql += ' ORDER BY h.fecha_movimiento DESC, h.rowid DESC LIMIT ?';
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

    sql += ' ORDER BY h.fecha_movimiento DESC, h.rowid DESC LIMIT ?';
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
      tenant_id: tenantId,
      ...estadoPagos()
    });
  } catch (error) {
    logger.error('PosRoutes', 'Error checking POS status', error);
    res.status(500).json({
      success: false,
      message: 'Failed to evaluate POS network status',
      error: detalleError(error)
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
      observaciones,
      tipo_tarjeta
    } = req.body;

  if (!tenant_id || !usuario_id || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({
      success: false,
      message: 'Missing required checkout fields: tenant_id, usuario_id, and non-empty items array'
    });
    return;
  }

  const tipoTarjetaPedido = tipo_tarjeta === undefined || tipo_tarjeta === null || tipo_tarjeta === ''
    ? null
    : String(tipo_tarjeta).trim().toUpperCase();
  if (tipoTarjetaPedido !== null && !TIPOS_TARJETA.includes(tipoTarjetaPedido)) {
    res.status(400).json({ success: false, error: 'TIPO_TARJETA_INVALIDO', message: 'El tipo de tarjeta debe ser CREDITO o DEBITO.' });
    return;
  }

  // El precio sale del catalogo, no de la peticion, y el producto tiene que ser de este comercio:
  // una peticion armada a mano vendia a cualquier precio, una cantidad negativa sumaba stock, y un
  // id de otro comercio le descontaba existencias a ese comercio.
  const lineas: any[] = [];
  const pedidoPorProducto = new Map<string, { nombre: string; disponible: number; pedida: number }>();
  for (const item of items) {
    const cantidad = Number(item?.cantidad);
    const producto = sqlite.queryOne<{ precio_venta: number; nombre: string; stock_actual: number }>(
      'SELECT precio_venta, nombre, stock_actual FROM productos WHERE id = ? AND tenant_id = ? AND activo = 1',
      [item?.producto_id, tenant_id]
    );
    if (!producto) {
      res.status(400).json({ success: false, message: `El producto ${item?.producto_id} no esta disponible en este comercio` });
      return;
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      res.status(400).json({ success: false, message: 'Cada producto de la venta necesita una cantidad mayor que cero' });
      return;
    }
    lineas.push({ ...item, cantidad, precio_unitario: Number(producto.precio_venta) });
    const pedido = pedidoPorProducto.get(item.producto_id);
    pedidoPorProducto.set(item.producto_id, {
      nombre: producto.nombre,
      disponible: Number(producto.stock_actual),
      pedida: (pedido?.pedida ?? 0) + cantidad
    });
  }

  // La caja no vende lo que no tiene: un stock negativo descuadra el inventario y la reposicion
  const sinStock = [...pedidoPorProducto.entries()]
    .filter(([, pedido]) => pedido.pedida > pedido.disponible)
    .map(([producto_id, pedido]) => ({ producto_id, ...pedido }));
  if (sinStock.length > 0) {
    const detalle = sinStock
      .map((pedido) => `${pedido.nombre} (quedan ${Math.max(0, pedido.disponible)}, se piden ${pedido.pedida})`)
      .join('; ');
    res.status(409).json({
      success: false,
      error: 'STOCK_INSUFICIENTE',
      message: `No hay stock suficiente: ${detalle}. Ajusta la cantidad, o pide al administrador que corrija el stock en Inventario.`,
      productos: sinStock
    });
    return;
  }

  // Sin turno abierto no hay fondo inicial declarado y la diferencia del cierre no significa nada
  const turno = sqlite.queryOne<{ id: string }>(
    "SELECT id FROM cierres_caja WHERE tenant_id = ? AND estado = 'ABIERTA' LIMIT 1",
    [tenant_id]
  );
  if (!turno) {
    res.status(400).json({
      success: false,
      error: 'TURNO_CERRADO',
      message: 'La caja esta cerrada. Abre la caja con su fondo inicial antes de vender.'
    });
    return;
  }

  // Sin un RUT de emisor valido no se puede emitir la boleta, y una venta sin boleta no cumple con
  // el SII: se rechaza antes de cobrar. Lo mismo la factura a un RUT que no se puede leer.
  if (!rutSiiSeguro(defaultDteEmitter.getTenantFiscalConfig(tenant_id).emisor.rut)) {
    res.status(400).json({
      success: false,
      error: 'EMISOR_RUT_INVALIDO',
      message: 'El RUT del emisor en Configuracion no es valido, y sin el no se puede emitir la boleta. Corrijalo antes de vender.'
    });
    return;
  }
  if (tipo_comprobante === 'FACTURA' && receptor_empresa && !rutSiiSeguro(receptor_empresa.rut)) {
    res.status(400).json({
      success: false,
      error: 'RUT_RECEPTOR_INVALIDO',
      message: 'El RUT de la empresa de la factura no es valido: revise el numero y el digito verificador.'
    });
    return;
  }

  const startTime = Date.now();
  const saleId = uuidv4();
  const folio = `POS-${Date.now()}`;
  let cobroAprobado: PaymentTransactionResult | null = null;

  try {
    let total = 0;
    let unidades = 0;
    // Calcular total y unidades. La Ley N° 20.956 rige exclusivamente para pagos en efectivo
    for (const item of lineas) {
      total += montoLinea({ cantidad: item.cantidad, precioUnitario: item.precio_unitario });
      unidades += Number(item.cantidad);
    }
    if (metodo_pago && String(metodo_pago).trim().toUpperCase() === 'EFECTIVO') {
      total = aplicarRedondeoChileno(total);
    }

    // 1. Con tarjeta se cobra primero en la maquina: un pago rechazado no deja venta ni descuenta stock
    let cobro: PaymentTransactionResult | null = null;
    if (metodo_pago !== 'EFECTIVO') {
      try {
        cobro = await defaultPaymentDispatcher.cobrar({
          saleId,
          amount: total,
          gateway: metodo_pago === 'MERCADOPAGO' ? 'MercadoPago' : metodo_pago === 'SUMUP' ? 'SumUp' : metodo_pago === 'RUTPAY' ? 'RutPay' : 'Transbank',
          tenantId: tenant_id
        });
      } catch (payError) {
        logger.warn('PosRoutes', 'La maquina de pago no pudo cobrar', { payError: detalleError(payError) });
        res.status(402).json({ success: false, message: `No se pudo cobrar con tarjeta: ${detalleError(payError)}` });
        return;
      }
      if (cobro.status !== 'APPROVED') {
        const motivo = cobro.metadataResponse.response_message || cobro.metadataResponse.status_detail
          || cobro.metadataResponse.order_status || cobro.metadataResponse.status || cobro.metadataResponse.error;
        res.status(402).json({ success: false, message: `La maquina rechazo el pago${motivo ? `: ${motivo}` : ''}. La venta no se registro.` });
        return;
      }
    }

    // Credito o debito: manda lo que informa la maquina; si no lo informa, lo que indico el cajero.
    // Con efectivo o RutPay no hay tarjeta.
    const tipoTarjetaFinal = PASARELAS_CON_TARJETA.includes(String(metodo_pago).toUpperCase())
      ? tipoTarjetaDePasarela(cobro?.metadataResponse) ?? tipoTarjetaPedido
      : null;

    // 2. Ejecutar venta transaccional en SQLite
    cobroAprobado = cobro;
    const checkoutResult = sqlite.withTransaction(() => {
      const hoy = reloj.ahora();
      const vencidos = new Map<string, { producto_id: string; nombre: string; fecha_vencimiento: string; cantidad: number }>();
      // El descuento por lote actualiza la fecha del producto: con el mismo producto en dos lineas,
      // la segunda la leeria ya cambiada. Por eso se guardan todas antes de descontar nada.
      const fechaAntesDeVender = new Map<string, string | null>();
      for (const item of lineas) {
        const fila = sqlite.queryOne<{ fecha_vencimiento: string | null }>(
          'SELECT fecha_vencimiento FROM productos WHERE id = ?',
          [item.producto_id]
        );
        fechaAntesDeVender.set(item.producto_id, fila?.fecha_vencimiento ?? null);
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
         (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, rut_cliente, observaciones, metodo_pago_id, tipo_tarjeta, is_dirty, sync_attempts, sync_status, fecha)
         VALUES (?, ?, ?, ?, ?, ?, 'COMPLETADA', ?, ?, ?, ?, 1, 0, 'PENDING', datetime('now'))`,
        [saleId, tenant_id, usuario_id, folio, total, unidades, rut_cliente || null, observaciones || null, metodoPagoId, tipoTarjetaFinal]
      );

      // Procesar cada detalle y actualizar stock
      for (const item of lineas) {
        const detailId = uuidv4();
        const subtotal = montoLinea({ cantidad: item.cantidad, precioUnitario: item.precio_unitario });

        // Insertar detalle_venta
        sqlite.execute(
          `INSERT INTO detalle_venta 
           (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [detailId, saleId, item.producto_id, item.cantidad, item.precio_unitario, subtotal]
        );

        // Obtener stock previo
        const prod = sqlite.queryOne<{ stock_actual: number; nombre: string }>(
          'SELECT stock_actual, nombre FROM productos WHERE id = ?',
          [item.producto_id]
        );
        const prevStock = prod ? Number(prod.stock_actual) : 0;
        const newStock = prevStock - Number(item.cantidad);

        // Actualizar stock local
        sqlite.execute(
          'UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?',
          [item.cantidad, item.producto_id]
        );

        // Descuento por lote, lo que vence antes sale antes. No interrumpe la venta si los
        // lotes no cubren la cantidad: el stock del producto manda y la diferencia se registra.
        const consumo = defaultLotesService.consumirFefo(tenant_id, item.producto_id, Number(item.cantidad));

        // D.S. 977/96: la caja no bloquea la venta de un vencido, pero la venta lo deja dicho
        const vencido = unidadesVencidasVendidas(consumo, fechaAntesDeVender.get(item.producto_id), hoy);
        if (vencido) {
          const previo = vencidos.get(item.producto_id);
          vencidos.set(item.producto_id, {
            producto_id: item.producto_id,
            nombre: prod?.nombre ?? '',
            fecha_vencimiento:
              previo && previo.fecha_vencimiento < vencido.fecha_vencimiento ? previo.fecha_vencimiento : vencido.fecha_vencimiento,
            cantidad: (previo?.cantidad ?? 0) + vencido.cantidad
          });
        }

        // Registrar en historial_stock
        const historyId = uuidv4();
        sqlite.execute(
          `INSERT INTO historial_stock 
           (id, tenant_id, producto_id, cambio_anterior, nuevo_stock, cambio, tipo_movimiento, id_venta_manual, motivo, fecha_movimiento, usuario_registro)
           VALUES (?, ?, ?, ?, ?, ?, 'venta', ?, 'Venta POS Local', datetime('now'), ?)`,
          [historyId, tenant_id, item.producto_id, prevStock, newStock, -Number(item.cantidad), saleId, usuario_id]
        );
      }

      const productos_vencidos = [...vencidos.values()];
      if (productos_vencidos.length > 0) {
        logger.warn('PosRoutes', `La venta ${saleId} incluyo productos vencidos`, { productos_vencidos });
      }

      return { saleId, folio, total, unidades, productos_vencidos };
    });

    // La venta existe: desde aqui un error ya no deja un cobro sin venta
    cobroAprobado = null;
    // El cobro ya aprobado se guarda ahora que la venta existe
    let paymentStatus = 'APPROVED';
    let paymentTransactionId = null;
    if (cobro) {
      await defaultPaymentDispatcher.registrarPago(cobro);
      paymentStatus = cobro.status;
      paymentTransactionId = cobro.transactionId;
    }

    // 3. Emisión de Documento Tributario (Boleta 39, Factura 33) o Voucher (Res. Ex. N° 176)
    let dteResult = null;
    try {
      const dteItems = lineas.map((it: any, idx: number) => {
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
          subtotal: montoLinea({ cantidad: it.cantidad, precioUnitario: it.precio_unitario }),
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
      } else if (rut_cliente && rutSiiSeguro(rut_cliente)) {
        // un RUT de cliente que no se puede leer ("S/R", "-") deja la boleta como cliente anonimo
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

    const soldProductIds = lineas.map((it: any) => it.producto_id);
    let hasAlcohol = lineas.some((it: any) => [24, 25, 26].includes(it.codigo_ila));
    if (!hasAlcohol && soldProductIds.length > 0) {
      try {
        const alcCheck = sqlite.queryOne<{ count: number }>(
          `SELECT COUNT(*) as count FROM productos WHERE id IN (${soldProductIds.map(() => '?').join(',')}) AND impuesto_adicional_codigo IN (24, 25, 26)`,
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
            // Las ordenes se graban solo si el correo salio: antes cada venta que dejaba un
            // producto bajo el punto de reorden grababa una orden nueva, saliera o no el aviso.
            await defaultReplenishmentService.despacharAvisoReposicion(tenant_id);
          }
        }
      } catch (err) {
        logger.warn('PosRoutes', 'Background auto-replenishment check failed', { err });
      }

      // El documento tributario intenta salir al SII sin que nadie lo pida: en un local nadie
      // aprieta un boton para eso. Va despues de responder la venta, de modo que la caja no
      // espera por el servicio.
      await defaultSiiEnvio.intentarEnvioAutomatico(tenant_id, 'emision');
    });

    const duration = Date.now() - startTime;
    logger.info('PosRoutes', `Checkout completed in ${duration}ms for sale ${saleId} (folio ${folio})`);

    res.status(201).json({
      success: true,
      data: {
        ...checkoutResult,
        dte: dteResult && dteResult.folio
          ? { ...dteResult, folio_provisional: defaultSiiEnvio.folioEsProvisional(tenant_id, Number(dteResult.tipoDte), Number(dteResult.folio)) }
          : dteResult,
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
    if (cobroAprobado) {
      // La tarjeta ya se cobro y la venta no quedo: se devuelve, para que reintentar no cobre dos veces
      const devolucion = await defaultPaymentDispatcher.devolverCobro(cobroAprobado, uuidv4());
      logger.error('PosRoutes', `Cobro aprobado sin venta: ${devolucion.devuelto ? 'devuelto' : 'NO se pudo devolver'}`, undefined, {
        saleId,
        pasarela: cobroAprobado.gateway,
        monto: cobroAprobado.amount,
        detalle: devolucion.detalle
      });
      res.status(500).json({
        success: false,
        error: devolucion.devuelto ? 'COBRO_DEVUELTO' : 'COBRO_SIN_VENTA',
        cobro_devuelto: devolucion.devuelto,
        message: devolucion.devuelto
          ? 'La venta no se pudo guardar y el cobro con tarjeta se devolvio. Puedes cobrar de nuevo.'
          : `La venta no se pudo guardar y la tarjeta SI se cobro (${cobroAprobado.gateway}, $${cobroAprobado.amount}). NO cobres de nuevo: devuelve el dinero al cliente y avisa al administrador. ${devolucion.detalle}`
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Checkout failed due to transaction error',
      error: detalleError(error)
    });
  }
});

/**
 * POST /api/v1/pos/sync
 * Sincronización manual o periódica iniciada desde el POS. Los seis pasos corren siempre, salvo
 * que la nube no responda: un push parcial no cancela el resto, porque la bajada del catálogo, la
 * cola de facturas y el respaldo documental no dependen de la venta que quedó abajo.
 * 1. Push: envía a la nube las ventas pendientes locales, cada una en su propio envío
 * 2. Respaldo del catálogo: sube los productos y proveedores que la nube no tiene
 * 3. Pull: descarga actualizaciones del catálogo (precios, stock) desde la nube
 * 4. Cola de facturas: reintenta las que quedaron sin digitalizar
 * 5. Respaldo documental: sube los archivos de factura que quedaron solo en disco
 * 6. Conteo de pendientes y de ventas detenidas
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

    // Un push parcial no detiene el resto de la sincronizacion. Antes la ruta respondia 500 y
    // retornaba aqui, de modo que una venta rechazada dejaba sin correr la bajada del catalogo,
    // la cola de facturas y el respaldo de documentos, que no dependen de esa venta.
    const fracasoTotal = !result.success && result.synced_ids.length === 0;

    // 2. Respaldar el catalogo del local en la nube (RF-59)
    let respaldoCatalogo = { productos_nuevos: 0, proveedores_nuevos: 0 };
    try {
      const resultadoCatalogo = await defaultPosSyncEngine.respaldarCatalogoEnNube(tenantId);
      respaldoCatalogo = {
        productos_nuevos: resultadoCatalogo.productos_nuevos,
        proveedores_nuevos: resultadoCatalogo.proveedores_nuevos
      };
    } catch (catErr) {
      logger.warn('PosRoutes', 'El respaldo del catálogo no pudo completarse en esta sincronización', {
        error: catErr instanceof Error ? catErr.message : String(catErr)
      });
    }

    // 3. Traer actualizaciones de catálogo desde la nube (Pull)
    // Su fallo no detiene el resto, pero se informa: tragarlo dejaba decir "sincronizado" con un
    // catalogo que no habia bajado.
    let catalogUpdatedCount = 0;
    let catalogPullError: string | null = null;
    try {
      catalogUpdatedCount = await defaultPosSyncEngine.syncPullCatalog(tenantId);
    } catch (pullErr) {
      catalogPullError = pullErr instanceof Error ? pullErr.message : String(pullErr);
      logger.error('PosRoutes', 'La bajada del catálogo falló durante la sincronización', { error: catalogPullError });
    }

    // 4. Reintentar las facturas que quedaron sin digitalizar por falta de conexión (RF-43)
    let colaFacturas = { por_revisar: 0, fallidas: 0, pendientes: 0 };
    try {
      const resultadoCola = await defaultInvoiceQueue.procesarPendientes(tenantId);
      colaFacturas = {
        por_revisar: resultadoCola.por_revisar,
        fallidas: resultadoCola.fallidas,
        pendientes: resultadoCola.pendientes
      };
    } catch (colaErr) {
      logger.warn('PosRoutes', 'La cola de facturas pendientes no pudo procesarse en esta sincronización', {
        error: colaErr instanceof Error ? colaErr.message : String(colaErr)
      });
    }

    // 5. Subir a la nube los documentos de factura que quedaron solo en disco (RF-46)
    let respaldoNube: ResumenRespaldoDocumentos = {
      respaldados: 0,
      omitidos: 0,
      pendientes: 0,
      sin_archivo: 0,
      en_proceso_ocr: 0,
      fallidos_ocr: 0
    };
    try {
      respaldoNube = await defaultInvoiceIngestionService.respaldarFacturasEnNube(tenantId);
    } catch (respErr) {
      logger.warn('PosRoutes', 'El respaldo de documentos en la nube no pudo completarse', {
        error: respErr instanceof Error ? respErr.message : String(respErr)
      });
    }

    // 6. Obtener conteo actualizado de pendientes
    const dirtyCountResult = sqlite.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM transacciones_venta WHERE is_dirty = 1'
    );

    const detenidas = defaultPosSyncEngine.contarVentasDetenidas(tenantId);

    const contar = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
    const partes = [
      result.synced_ids.length > 0
        ? `${contar(result.synced_ids.length, 'venta respaldada', 'ventas respaldadas')} en la nube`
        : 'ventas ya sincronizadas',
      respaldoCatalogo.productos_nuevos > 0
        ? `${contar(respaldoCatalogo.productos_nuevos, 'producto respaldado', 'productos respaldados')} en la nube`
        : null,
      colaFacturas.por_revisar > 0 ? `${contar(colaFacturas.por_revisar, 'factura leida', 'facturas leidas')} desde la cola, por revisar` : null,
      respaldoNube.respaldados > 0 ? `${contar(respaldoNube.respaldados, 'documento respaldado', 'documentos respaldados')} en la nube` : null
    ].filter(Boolean);

    // El parcial es un exito con cuentas, no un fracaso: hay ventas arriba. Solo cuando no
    // subio ninguna y habia pendientes se responde error, que es lo que el aviso de la caja
    // necesita para decir que las ventas siguen guardadas en el equipo.
    const mensaje = fracasoTotal
      ? `Fallo en sincronización: ${result.message}`
      : result.failed_ids.length > 0
        ? `Subieron ${result.synced_ids.length} de ${result.synced_ids.length + result.failed_ids.length} ventas. ` +
          `El resto sigue guardado en el equipo y se sube al sincronizar de nuevo.`
        : `Sincronización completada: ${partes.join(' y ')}.`;
    const mensajeFinal = catalogPullError
      ? `${mensaje} El catálogo no pudo bajar desde la nube: ${catalogPullError}`
      : mensaje;

    res.status(fracasoTotal ? 500 : 200).json({
      success: !fracasoTotal,
      partial: !fracasoTotal && result.failed_ids.length > 0,
      message: mensajeFinal,
      synced_sales_count: result.synced_ids.length,
      failed_sales_count: result.failed_ids.length,
      stopped_sales_count: detenidas,
      catalog_updated_count: catalogUpdatedCount,
      catalog_pull_error: catalogPullError,
      catalog_backup: respaldoCatalogo,
      pending_dirty_count: dirtyCountResult?.count || 0,
      invoice_queue: colaFacturas,
      invoice_document_backup: respaldoNube,
      cloud_online: true,
      result
    });
  } catch (error) {
    logger.error('PosRoutes', 'Manual sync push failed', error);
    res.status(500).json({
      success: false,
      message: 'Error interno durante la sincronización',
      error: detalleError(error)
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
              p.precio_compra, p.precio_venta, p.categoria, p.activo, p.created_at, p.updated_at,
              p.origen_creacion, p.factura_origen_folio,
              p.lote, p.fecha_vencimiento, p.impuesto_adicional_codigo, p.impuesto_adicional_tasa,
              p.imagen,
              pr.nombre_proveedores as proveedor_nombre,
              (SELECT MAX(h.fecha_movimiento) FROM historial_stock h
                WHERE h.producto_id = p.id AND h.tipo_movimiento = 'ingreso_factura') as ultimo_ingreso_factura
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
      `SELECT id, sku, nombre, stock_actual, precio_compra, precio_venta, lote, fecha_vencimiento
       FROM productos
       WHERE tenant_id = ? AND fecha_vencimiento IS NOT NULL AND activo = 1
       ORDER BY fecha_vencimiento ASC`,
      [tenantId]
    );

    const unidadesPorLote = defaultLotesService.unidadesPorProducto(tenantId);

    // Los dias se cuentan en la fecha local del equipo. Con la hora de la base, que es UTC, de
    // noche en Chile lo que vence hoy aparecia como vencido.
    const hoy = reloj.ahora();
    const clasificados = rows.map(r => {
      // Una fecha que no se puede leer cuenta como cero dias: queda a la vista como urgente
      const dias = diasHastaVencer(r.fecha_vencimiento, hoy) ?? 0;

      return {
        ...r,
        dias_restantes: dias,
        ...clasificarSemaforo(dias),
        // Unidades que vencen en esa fecha. Tres situaciones distintas, y conviene no
        // confundirlas: con lotes se informa la suma; sin lotes pero con el producto en cero
        // se informa cero, porque la cantidad SI se conoce; y solo queda en null el producto
        // con existencia que ningun lote respalda, donde se conoce la fecha pero no cuanto de
        // ese stock vence en ella. Eso ultimo es la existencia anterior a la gestion por lote.
        unidades_por_vencer: unidadesPorLote.has(r.id)
          ? Number(unidadesPorLote.get(r.id))
          : Number(r.stock_actual) === 0
            ? 0
            : null
      };
    });

    const resumen = {
      vencidos: clasificados.filter(c => c.dias_restantes < 0).length,
      riesgo_critico_7d: clasificados.filter(c => c.dias_restantes >= 0 && c.dias_restantes <= 7).length,
      riesgo_medio_15d: clasificados.filter(c => c.dias_restantes > 7 && c.dias_restantes <= 15).length,
      vence_30_dias: clasificados.filter(c => c.dias_restantes > 15 && c.dias_restantes <= 30).length,
      total_con_vencimiento: clasificados.length,
      total_en_riesgo: clasificados.filter(c => c.dias_restantes <= 30).length,
      unidades_en_riesgo_30d: clasificados
        .filter(c => c.dias_restantes <= 30 && c.unidades_por_vencer !== null)
        .reduce((suma, c) => suma + Number(c.unidades_por_vencer), 0),
      productos_sin_detalle_de_lote: clasificados.filter(c => c.unidades_por_vencer === null).length
    };

    res.status(200).json({ success: true, total: clasificados.length, resumen, data: clasificados });
  } catch (error) {
    logger.error('PosRoutes', 'Error retrieving expiration alerts', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve expiration alerts' });
  }
});

/**
 * POST /api/v1/pos/transactions/:id/reintentar-sincronizacion
 * Devuelve a la cola de subida una venta rechazada o detenida, con sus intentos en cero
 */
router.post('/transactions/:id/reintentar-sincronizacion', (req: Request, res: Response): void => {
  const tenantId = (req.body?.tenant_id as string) || (req.query.tenant_id as string) || '00000000-0000-0000-0000-000000000001';
  try {
    if (!defaultPosSyncEngine.reintentarVenta(tenantId, String(req.params.id))) {
      res.status(404).json({ success: false, message: 'No hay una venta rechazada con ese identificador' });
      return;
    }
    res.json({ success: true, message: 'La venta vuelve a subir en la próxima sincronización' });
  } catch (error) {
    logger.error('PosRoutes', 'No se pudo reintentar la venta', error);
    res.status(500).json({ success: false, message: 'No se pudo reintentar la venta' });
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
              COALESCE(v.sync_attempts, 0) as sync_attempts,
              (v.sync_status = 'FAILED' AND COALESCE(v.sync_attempts, 0) >= ?) as sync_detenida,
              v.rut_cliente, v.tipo_documento_tributario, v.monto_ila, v.medio_devolucion, v.tipo_tarjeta,
              u.nombre as cajero_nombre,
              mp.nombre as medio_pago_nombre, mp.pasarela as medio_pago_tipo
       FROM transacciones_venta v
       LEFT JOIN usuarios u ON v.usuario_id = u.id
       LEFT JOIN metodos_pago mp ON v.metodo_pago_id = mp.id
       WHERE v.tenant_id = ?
       ORDER BY v.fecha DESC LIMIT 100`,
      [TOPE_REINTENTOS_VENTA, tenantId]
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
  const { tenant_id, usuario_id, venta_id, motivo = 'Garantía Legal Ley N° 21.398', items_devolucion, medio_devolucion } = req.body;

  if (!tenant_id || !usuario_id || !venta_id) {
    res.status(400).json({
      success: false,
      message: 'tenant_id, usuario_id, and venta_id are required'
    });
    return;
  }

  // Sin medio declarado la devolucion hace lo de siempre: la pantalla anterior no lo envia
  const medioPedido = medio_devolucion === undefined || medio_devolucion === null || medio_devolucion === ''
    ? null
    : String(medio_devolucion).trim().toUpperCase();
  if (medioPedido !== null && !MEDIOS_DEVOLUCION.includes(medioPedido)) {
    res.status(400).json({
      success: false,
      error: 'MEDIO_DEVOLUCION_INVALIDO',
      message: 'El medio de devolucion debe ser TARJETA, EFECTIVO o TRANSFERENCIA.'
    });
    return;
  }

  if (devolucionesEnCurso.has(venta_id)) {
    res.status(409).json({
      success: false,
      error: 'DEVOLUCION_EN_CURSO',
      message: 'Ya hay una devolucion de esta venta en curso. Espera a que termine y revisa lo que queda por devolver.'
    });
    return;
  }
  devolucionesEnCurso.add(venta_id);

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

    // Lo ya devuelto de esta venta, por producto: sin restarlo, devolver dos veces la misma venta
    // emitia dos notas de credito y reponia el stock dos veces.
    const devueltoAntes = new Map(
      sqlite.query<{ producto_id: string; total: number }>(
        `SELECT producto_id, SUM(cantidad) AS total FROM movimientos_inventario
         WHERE id_origen = ? AND tipo_origen = 'DEVOLUCION_VENTA' GROUP BY producto_id`,
        [venta_id]
      ).map((f) => [f.producto_id, Number(f.total)])
    );
    const disponible = (d: any) => Math.max(0, Number(d.cantidad) - (devueltoAntes.get(d.producto_id) ?? 0));

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
        const pedida = reqItem.cantidad === undefined ? 1 : Number(reqItem.cantidad);
        if (!Number.isFinite(pedida) || pedida <= 0) {
          res.status(400).json({ success: false, message: 'La cantidad a devolver debe ser mayor que cero' });
          return;
        }
        const cant = match ? Math.min(pedida, disponible(match)) : 0;
        if (match && cant > 0) {
          itemsADevolver.push({
            producto_id: match.producto_id,
            nombre: match.nombre,
            sku: match.sku,
            cantidad: cant,
            precio_unitario: match.precio_unitario,
            subtotal: montoLinea({ cantidad: cant, precioUnitario: match.precio_unitario }),
            codigoIla: match.impuesto_adicional_codigo || undefined,
            tasaIla: match.impuesto_adicional_tasa || undefined
          });
        }
      }
    } else {
      // Devolución total
      for (const d of detallesOriginales) {
        const cant = disponible(d);
        if (cant <= 0) continue;
        itemsADevolver.push({
          producto_id: d.producto_id,
          nombre: d.nombre,
          sku: d.sku,
          cantidad: cant,
          precio_unitario: d.precio_unitario,
          subtotal: montoLinea({ cantidad: cant, precioUnitario: d.precio_unitario }),
          codigoIla: d.impuesto_adicional_codigo || undefined,
          tasaIla: d.impuesto_adicional_tasa || undefined
        });
      }
    }

    if (itemsADevolver.length === 0) {
      res.status(400).json({ success: false, message: 'No queda nada por devolver de esa venta: ya se devolvio completa' });
      return;
    }

    // 4. Buscar DTE original emitido si existe
    const dteOriginal = sqlite.queryOne<any>(
      `SELECT * FROM sii_dte_emitidos WHERE venta_id = ? ORDER BY fecha_emision DESC LIMIT 1`,
      [venta_id]
    );

    const tipoDocRef = dteOriginal?.tipo_dte || (ventaOriginal.tipo_documento_tributario === 'FACTURA' ? 33 : 39);
    const folioRef = dteOriginal?.folio || parseInt((ventaOriginal.folio_local_sqlite || '1').replace(/\D/g, ''), 10) || 1;
    const fechaRef = (dteOriginal?.fecha_emision || ventaOriginal.fecha || new Date().toISOString()).substring(0, 10);

    // La nota de credito se revisa antes de devolver nada: sin RUT de emisor no se puede emitir, y un
    // RUT de cliente que no se puede leer, guardado antes de la 1.0.4, pasa a cliente anonimo
    if (!rutSiiSeguro(defaultDteEmitter.getTenantFiscalConfig(tenant_id).emisor.rut)) {
      res.status(400).json({
        success: false,
        error: 'EMISOR_RUT_INVALIDO',
        message: 'El RUT del emisor en Configuracion no es valido, y sin el no se puede emitir la nota de credito. Corrijalo antes de devolver.'
      });
      return;
    }
    const receptorNc = dteOriginal?.rut_receptor && rutSiiSeguro(dteOriginal.rut_receptor) ? dteOriginal : null;

    // Como sale el dinero se decide por el medio con que se cobro la venta, no por si quedo un pago
    // que reversar: una venta con tarjeta sin pago aprobado no se da por devuelta en la maquina
    const pasarelaVenta = String(
      sqlite.queryOne<{ pasarela: string }>('SELECT pasarela FROM metodos_pago WHERE id = ?', [ventaOriginal.metodo_pago_id])?.pasarela
        || 'EFECTIVO'
    ).toUpperCase();
    const ventaElectronica = PASARELAS_ELECTRONICAS.includes(pasarelaVenta);
    if (!ventaElectronica && medioPedido !== null && medioPedido !== 'EFECTIVO') {
      res.status(400).json({
        success: false,
        error: 'MEDIO_DEVOLUCION_INVALIDO',
        message: 'La venta se pago en efectivo: se devuelve en efectivo.'
      });
      return;
    }
    if (medioPedido === 'EFECTIVO') {
      // el dinero sale de una gaveta y tiene que restarse de un turno
      const turnoAbierto = sqlite.queryOne<{ id: string }>(
        "SELECT id FROM cierres_caja WHERE tenant_id = ? AND estado = 'ABIERTA' LIMIT 1",
        [tenant_id]
      );
      if (!turnoAbierto) {
        res.status(400).json({
          success: false,
          error: 'TURNO_CERRADO',
          message: 'La caja esta cerrada. Abre la caja antes de devolver dinero en efectivo.'
        });
        return;
      }
    }

    // 5. Lo cobrado con tarjeta se devuelve primero en la maquina: si no se puede, no hay devolucion.
    // Si el cajero declaro que devolvio en efectivo o por transferencia, la maquina no se toca.
    const returnSaleId = uuidv4();
    let reverso: PaymentTransactionResult | null = null;
    if (medioPedido === null || medioPedido === 'TARJETA') {
      try {
        reverso = await defaultPaymentDispatcher.reembolsar(
          venta_id, itemsADevolver.reduce((suma, it) => suma + it.subtotal, 0), returnSaleId);
      } catch (errReverso) {
        logger.warn('PosRoutes', 'No se pudo reversar el cobro con tarjeta', { errReverso: detalleError(errReverso) });
        res.status(402).json({
          success: false,
          message: `No se pudo devolver el pago a la tarjeta: ${detalleError(errReverso)}. La devolucion no se registro.`
        });
        return;
      }
    }
    if (medioPedido === 'TARJETA' && ventaElectronica && (!reverso || reverso.status === 'PENDING')) {
      res.status(409).json({
        success: false,
        error: 'REVERSO_MANUAL',
        message: `No se puede devolver en la maquina: ${reverso?.metadataResponse.motivo
          ?? 'la venta no tiene un pago aprobado que se pueda reversar'}. Indica si devolviste en efectivo o por transferencia. La devolucion no se registro.`
      });
      return;
    }

    // Lo que se declaro, o lo que se sabe sin declararlo; un reverso manual sin declarar queda sin medio
    const medioFinal = medioPedido
      ?? (reverso && reverso.status !== 'PENDING' ? 'TARJETA' : !ventaElectronica ? 'EFECTIVO' : null);
    const metodoEfectivoId = sqlite.queryOne<{ id: string }>(
      "SELECT id FROM metodos_pago WHERE pasarela = 'EFECTIVO' ORDER BY id LIMIT 1"
    )?.id;

    // 6. Restituir inventario dentro de una transacción
    let totalDevuelto = 0;
    let devueltoAlCliente = 0;

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

      // Lo que sale de la gaveta se redondea como el cobro en efectivo (Ley 20.956); la nota de credito
      // declara el monto exacto
      devueltoAlCliente = medioFinal === 'EFECTIVO' ? aplicarRedondeoChileno(totalDevuelto) : totalDevuelto;

      // Registrar transacción de devolución. Lo devuelto en efectivo lleva el medio efectivo, para que
      // reste de la gaveta del turno y no del total de la tarjeta.
      sqlite.execute(
        `INSERT INTO transacciones_venta 
         (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, rut_cliente, observaciones, metodo_pago_id, is_dirty, sync_attempts, sync_status, es_devolucion, referencia_venta_id, medio_devolucion, fecha)
         VALUES (?, ?, ?, ?, ?, ?, 'COMPLETADA', ?, ?, ?, 1, 0, 'PENDING', 1, ?, ?, datetime('now'))`,
        [
          returnSaleId,
          tenant_id,
          usuario_id,
          `DEV-${Date.now()}`,
          -devueltoAlCliente,
          itemsADevolver.reduce((acc, it) => acc + it.cantidad, 0),
          ventaOriginal.rut_cliente,
          `Devolución / NC: ${motivo}`,
          medioFinal === 'EFECTIVO' && metodoEfectivoId ? metodoEfectivoId : ventaOriginal.metodo_pago_id,
          venta_id,
          medioFinal
        ]
      );
    });

    // El reverso se guarda junto a la devolucion, sin marcarla PAGADA
    if (reverso) await defaultPaymentDispatcher.registrarPago(reverso, false);

    // 7. Emitir Nota de Crédito Electrónica (DTE Tipo 61) con nodo <Referencia>
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
      receptor: receptorNc ? {
        rut: receptorNc.rut_receptor,
        razonSocial: receptorNc.razon_social_receptor || 'CLIENTE'
      } : undefined
    });

    logger.info(
      'PosRoutes',
      `Devolución procesada con éxito para venta ${venta_id}. NC Folio ${ncResponse.folio}, Stock restituido.`
    );

    res.status(200).json({
      success: true,
      message: `Devolución procesada exitosamente. Se emitió la Nota de Crédito DTE 61 N° ${ncResponse.folio} y el stock fue restituido.${!reverso ? '' : reverso.status === 'PENDING' ? ` El pago con ${reverso.gateway} no se devolvio automaticamente: ${reverso.metadataResponse.motivo}.` : ` El pago se devolvio a la tarjeta (${reverso.gateway}).`}`,
      data: {
        devolucion_id: returnSaleId,
        folio_nc: ncResponse.folio,
        monto_total: totalDevuelto,
        total_devuelto: totalDevuelto,
        devuelto_al_cliente: devueltoAlCliente,
        medio_devolucion: medioFinal,
        nota_credito: ncResponse,
        dte_nc: ncResponse,
        items_devueltos: itemsADevolver,
        reverso_tarjeta: reverso ? { pasarela: reverso.gateway, monto: -reverso.amount, manual: reverso.status === 'PENDING', detalle: reverso.metadataResponse } : null
      }
    });
  } catch (error) {
    logger.error('PosRoutes', 'Error processing sale return', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la devolución',
      error: detalleError(error)
    });
  } finally {
    devolucionesEnCurso.delete(venta_id);
  }
});

export default router;
