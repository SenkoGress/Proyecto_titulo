import { v4 as uuidv4 } from 'uuid';
import { PostgresClient, defaultPgClient } from '../database/postgres/client';
import { defaultSqliteClient } from '../database/sqlite/client';
import { OcrDispatcherService, defaultOcrDispatcher } from '../ocr/ocr-dispatcher.service';
import { InvoiceInput, ExtractedInvoiceData } from '../ocr/types';
import { defaultTenantConfigService } from '../config/tenant-config.service';
import { calcularPrecioVenta, desglosarIvaChileno } from '../utils/pricing';
import { generateChileanBarcode } from '../utils/barcode.utils';
import { logger } from '../utils/logger';

export interface IngestionResult {
  invoice_id: string;
  folio_factura: string;
  proveedor_id: string;
  rut_proveedor: string;
  total: number;
  items_count: number;
  used_fallback: boolean;
  ocr_provider: string;
  duration_ms: number;
  persistido_local?: boolean;
}

export interface ScannedItemPreview {
  sku: string;
  codigo_barra: string;
  descripcion: string;
  cantidad: number;
  unidad?: string;
  precio_unitario: number;
  subtotal: number;
  precio_venta_sugerido: number;
  es_nuevo: boolean;
  stock_actual: number;
  stock_proyectado: number;
  lote?: string;
  fecha_vencimiento?: string;
}

export interface ScannedInvoicePreview {
  folio_factura: string;
  rut_proveedor: string;
  razon_social: string;
  giro_proveedor?: string;
  direccion_proveedor?: string;
  telefono_proveedor?: string;
  dias_visita_proveedor?: string;
  es_proveedor_nuevo?: boolean;
  fecha_emision: string;
  monto_neto: number;
  iva_credito: number;
  total_factura: number;
  items_count: number;
  ocr_provider: string;
  margin_used: number;
  items: ScannedItemPreview[];
  raw_data: ExtractedInvoiceData;
}

export class InvoiceIngestionService {
  private pgClient: PostgresClient;
  private ocrDispatcher: OcrDispatcherService;

  constructor(customPgClient?: PostgresClient, customDispatcher?: OcrDispatcherService) {
    this.pgClient = customPgClient || defaultPgClient;
    this.ocrDispatcher = customDispatcher || defaultOcrDispatcher;
  }

  /**
   * Paso 1: Escanear la factura y generar la previsualización completa sin modificar la base de datos.
   */
  public async scanInvoice(tenantId: string, input: InvoiceInput): Promise<ScannedInvoicePreview> {
    const startTime = Date.now();
    const ocrResult = await this.ocrDispatcher.processInvoice(input);
    const invoiceData = ocrResult.data;
    const configuredMargin = await defaultTenantConfigService.getProfitMargin(tenantId);

    // Verificar si el proveedor ya existe en SQLite local
    const existingSupplier = defaultSqliteClient.queryOne<{ id: string; dias_visita_proveedores: string; giro: string }>(
      'SELECT id, dias_visita_proveedores, giro FROM proveedores WHERE tenant_id = ? AND rut_proveedor = ?',
      [tenantId, invoiceData.rut_proveedor]
    );

    const es_proveedor_nuevo = !existingSupplier;
    const dias_visita_proveedor = existingSupplier?.dias_visita_proveedores || invoiceData.dias_visita_proveedor || 'Lunes';

    const processedItems: ScannedItemPreview[] = invoiceData.items.map((item) => {
      const itemCantidad = Number(item.cantidad) || 0;
      const unitPrice = Number(item.precio_unitario) || 0;
      const salePrice = calcularPrecioVenta(unitPrice, configuredMargin);
      const sku = item.sku || `SKU-${item.descripcion.slice(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;

      // Verificar en SQLite local si el producto ya existe
      const existing = defaultSqliteClient.queryOne<{ stock_actual: number; precio_venta: number; codigo_barra: string }>(
        'SELECT stock_actual, precio_venta, codigo_barra FROM productos WHERE tenant_id = ? AND sku = ?',
        [tenantId, sku]
      );

      const es_nuevo = !existing;
      const stock_actual = existing ? Number(existing.stock_actual) : 0;
      const stock_proyectado = stock_actual + itemCantidad;
      const precio_venta_sugerido = existing ? Number(existing.precio_venta) : salePrice;
      const codigo_barra = existing?.codigo_barra || generateChileanBarcode(sku);

      return {
        sku,
        codigo_barra,
        descripcion: item.descripcion,
        cantidad: itemCantidad,
        unidad: item.unidad || 'UNI',
        precio_unitario: unitPrice,
        subtotal: item.subtotal || itemCantidad * unitPrice,
        precio_venta_sugerido,
        es_nuevo,
        stock_actual,
        stock_proyectado,
        lote: item.lote,
        fecha_vencimiento: item.fecha_vencimiento
      };
    });

    const tax = desglosarIvaChileno(Number(invoiceData.total) || processedItems.reduce((a, b) => a + b.subtotal, 0));
    const duration = Date.now() - startTime;
    logger.info('InvoiceIngestionService', `Scanned invoice ${invoiceData.folio_factura} with ${processedItems.length} items in ${duration}ms (no DB changes made)`);

    return {
      folio_factura: invoiceData.folio_factura,
      rut_proveedor: invoiceData.rut_proveedor,
      razon_social: invoiceData.razon_social,
      giro_proveedor: invoiceData.giro_proveedor || 'Distribución y Comercio Mayorista',
      direccion_proveedor: invoiceData.direccion_proveedor || 'Dirección Comercial',
      telefono_proveedor: invoiceData.telefono_proveedor || '+56 2 2345 6789',
      dias_visita_proveedor,
      es_proveedor_nuevo,
      fecha_emision: invoiceData.fecha_emision,
      monto_neto: tax.neto,
      iva_credito: tax.iva,
      total_factura: tax.total,
      items_count: processedItems.length,
      ocr_provider: ocrResult.providerName,
      margin_used: configuredMargin,
      items: processedItems,
      raw_data: {
        ...invoiceData,
        dias_visita_proveedor
      }
    };
  }

  /**
   * Paso 2: Confirmar la ingesta mediante transacción ACID persistiendo en SQLite y PostgreSQL
   * y marcando los productos nuevos con 'FACTURA' para etiquetado visual.
   */
  public async confirmIngest(tenantId: string, invoiceData: ExtractedInvoiceData): Promise<IngestionResult> {
    return this.executeIngestTransaction(tenantId, invoiceData, invoiceData.metodo_ingreso || 'CONFIRMED_SCAN', false);
  }

  /**
   * Ingesta directa para retrocompatibilidad
   */
  public async ingestInvoice(tenantId: string, input: InvoiceInput): Promise<IngestionResult> {
    const ocrResult = await this.ocrDispatcher.processInvoice(input);
    return this.executeIngestTransaction(tenantId, ocrResult.data, ocrResult.providerName, ocrResult.usedFallback);
  }

  private async executeIngestTransaction(
    tenantId: string,
    invoiceData: ExtractedInvoiceData,
    ocrProvider: string,
    usedFallback = false
  ): Promise<IngestionResult> {
    const startTime = Date.now();
    const configuredMargin = await defaultTenantConfigService.getProfitMargin(tenantId);

    let invoiceId = uuidv4();
    let supplierId = uuidv4();

    // 1. Transacción ACID en PostgreSQL Cloud (si está disponible)
    if (this.pgClient.isCloudAvailable()) {
      try {
        await this.pgClient.withTransaction(async (client) => {
      // Asegurar tipo de movimiento de inventario
      const movTipoRes = await client.query<{ id: string }>(
        `INSERT INTO movimientos_inventario_tipos (id, nombre, codigo, descripcion)
         VALUES ($1, 'Ingreso por Factura de Proveedor', 'INGRESO_FACTURA', 'Recepción de mercadería de compras')
         ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
         RETURNING id`,
        [uuidv4()]
      );
      const movTipoId = movTipoRes.rows[0].id;

      // Localizar o crear proveedor por RUT
      const supplierCheck = await client.query<{ id: string }>(
        'SELECT id FROM proveedores WHERE tenant_id = $1 AND rut_proveedor = $2',
        [tenantId, invoiceData.rut_proveedor]
      );

      if (supplierCheck.rows.length > 0) {
        supplierId = supplierCheck.rows[0].id;
        await client.query(
          `UPDATE proveedores 
           SET giro = COALESCE(giro, $1), direccion = COALESCE(direccion, $2), telefono = COALESCE(telefono, $3), dias_visita_proveedores = COALESCE($4, dias_visita_proveedores)
           WHERE id = $5`,
          [invoiceData.giro_proveedor || null, invoiceData.direccion_proveedor || null, invoiceData.telefono_proveedor || null, invoiceData.dias_visita_proveedor || null, supplierId]
        );
      } else {
        await client.query(
          `INSERT INTO proveedores (id, tenant_id, rut_proveedor, nombre_proveedores, email, giro, direccion, telefono, dias_visita_proveedores)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            supplierId,
            tenantId,
            invoiceData.rut_proveedor,
            invoiceData.razon_social,
            'contacto@proveedor.cl',
            invoiceData.giro_proveedor || 'Distribuidora Mayorista',
            invoiceData.direccion_proveedor || 'Casa Matriz',
            invoiceData.telefono_proveedor || '+56 2 2345 6789',
            invoiceData.dias_visita_proveedor || 'Lunes'
          ]
        );
      }

      // Insertar factura en factura_ingresos
      const totalQuantity = invoiceData.items.reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0);
      const invoiceTotal = Number(invoiceData.total ?? (invoiceData as any).total_factura) || 0;

      await client.query(
        `INSERT INTO factura_ingresos 
         (id, tenant_id, proveedor_id, numero_factura, fecha_ingreso, estado, cantidad, metodo_ingreso, rut_proveedor, total, json_ocr_raw)
         VALUES ($1, $2, $3, $4, $5, 'PROCESSED', $6, $7, $8, $9, $10)`,
        [
          invoiceId,
          tenantId,
          supplierId,
          invoiceData.folio_factura,
          invoiceData.fecha_emision,
          totalQuantity,
          invoiceData.metodo_ingreso || ocrProvider,
          invoiceData.rut_proveedor,
          invoiceTotal,
          JSON.stringify(invoiceData)
        ]
      );

      // Procesar cada ítem: actualizar stock y registrar movimientos con cantidades estrictas
      for (const item of invoiceData.items) {
        const itemCantidad = Number(item.cantidad);
        if (isNaN(itemCantidad) || itemCantidad <= 0) {
          throw new Error(`La línea para "${item.descripcion || item.sku}" no tiene una cantidad válida especificada (${item.cantidad}).`);
        }

        const unitPrice = Number(item.precio_unitario) || 0;
        const salePrice = calcularPrecioVenta(unitPrice, configuredMargin);
        const itemSku = item.sku || `SKU-AUTO-${uuidv4().slice(0, 8).toUpperCase()}`;

        // Buscar producto por SKU
        const prodResult = await client.query<{ id: string; stock_actual: string }>(
          'SELECT id, stock_actual FROM productos WHERE tenant_id = $1 AND sku = $2 FOR UPDATE',
          [tenantId, itemSku]
        );

        let productId: string;
        let previousStock = 0;

        if (prodResult.rows.length > 0) {
          productId = prodResult.rows[0].id;
          previousStock = parseFloat(prodResult.rows[0].stock_actual);
          const newStock = previousStock + itemCantidad;

          await client.query(
            `UPDATE productos 
             SET stock_actual = $1, precio_compra = $2, factura_origen_folio = $3,
                 lote = COALESCE($6, lote), fecha_vencimiento = COALESCE($7, fecha_vencimiento),
                 updated_at = now() 
             WHERE id = $4 AND tenant_id = $5`,
            [newStock, unitPrice, invoiceData.folio_factura, productId, tenantId, item.lote ?? null, item.fecha_vencimiento ?? null]
          );
        } else {
          productId = uuidv4();
          previousStock = 0;
          const barcode = generateChileanBarcode(itemSku);
          await client.query(
            `INSERT INTO productos 
             (id, tenant_id, proveedor_id, sku, codigo_barra, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, activo, origen_creacion, factura_origen_folio, lote, fecha_vencimiento)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 5.0, $8, $9, true, 'FACTURA', $10, $11, $12)`,
            [
              productId,
              tenantId,
              supplierId,
              itemSku,
              barcode,
              item.descripcion,
              itemCantidad,
              unitPrice,
              salePrice,
              invoiceData.folio_factura,
              item.lote ?? null,
              item.fecha_vencimiento ?? null
            ]
          );
        }

        const newStock = previousStock + itemCantidad;

        // Registrar relación en producto_proveedores para comparador multiproveedor
        await client.query(
          `INSERT INTO producto_proveedores 
           (id, tenant_id, producto_id, proveedor_id, ultimo_precio_compra, fecha_ultima_compra, folio_ultima_factura, updated_at)
           VALUES ($1, $2, $3, $4, $5, now(), $6, now())
           ON CONFLICT (tenant_id, producto_id, proveedor_id) 
           DO UPDATE SET ultimo_precio_compra = EXCLUDED.ultimo_precio_compra, 
                         fecha_ultima_compra = now(), 
                         folio_ultima_factura = EXCLUDED.folio_ultima_factura,
                         updated_at = now()`,
          [uuidv4(), tenantId, productId, supplierId, unitPrice, invoiceData.folio_factura]
        );

        // Registrar en historial_stock
        await client.query(
          `INSERT INTO historial_stock 
           (id, tenant_id, producto_id, cambio_anterior, nuevo_stock, cambio, tipo_movimiento, motivo, usuario_registro)
           VALUES ($1, $2, $3, $4, $5, $6, 'ingreso_factura', $7, 'Ingesta Factura Autorizada')`,
          [
            uuidv4(),
            tenantId,
            productId,
            previousStock,
            newStock,
            itemCantidad,
            `Ingreso de mercadería factura ${invoiceData.folio_factura}`
          ]
        );

        // Registrar en movimientos_inventario
        await client.query(
          `INSERT INTO movimientos_inventario 
           (id, tenant_id, producto_id, tipo_movimiento_id, cantidad, saldo_anterior, nuevo_saldo, id_origen, tipo_origen, usuario_registro)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'FACTURA_COMPRA', 'OCR Engine')`,
          [
            uuidv4(),
            tenantId,
            productId,
            movTipoId,
            itemCantidad,
            previousStock,
            newStock,
            invoiceId
          ]
        );
      }
    });
  } catch (pgErr) {
    logger.warn('InvoiceIngestionService', 'Cloud PostgreSQL unreachable for invoice ingestion, saving to local SQLite mirror', { pgErr });
  }
}

    // 2. Réplica simultánea en SQLite local para disponibilidad offline inmediata
    let persistidoLocal = true;
    try {
      const invoiceTotal = Number(invoiceData.total ?? (invoiceData as any).total_factura) || 0;
      const totalQuantity = invoiceData.items.reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0);

      defaultSqliteClient.withTransaction(() => {
        // Reutilizar el ID del proveedor si ya existe para evitar errores de clave foránea en SQLite
        const existingSupplier = defaultSqliteClient.queryOne<{ id: string }>(
          'SELECT id FROM proveedores WHERE tenant_id = ? AND rut_proveedor = ? LIMIT 1',
          [tenantId, invoiceData.rut_proveedor]
        );

        if (existingSupplier) {
          supplierId = existingSupplier.id;
          defaultSqliteClient.execute(
            `UPDATE proveedores 
             SET giro = COALESCE(?, giro),
                 direccion = COALESCE(?, direccion),
                 telefono = COALESCE(?, telefono),
                 dias_visita_proveedores = COALESCE(?, dias_visita_proveedores)
             WHERE id = ?`,
            [
              invoiceData.giro_proveedor || null,
              invoiceData.direccion_proveedor || null,
              invoiceData.telefono_proveedor || null,
              invoiceData.dias_visita_proveedor || null,
              supplierId
            ]
          );
        } else {
          defaultSqliteClient.execute(
            `INSERT INTO proveedores (id, tenant_id, rut_proveedor, nombre_proveedores, email, whatsapp_contacto, giro, direccion, telefono, dias_visita_proveedores)
             VALUES (?, ?, ?, ?, 'contacto@proveedor.cl', '+56911223344', ?, ?, ?, ?)`,
            [
              supplierId,
              tenantId,
              invoiceData.rut_proveedor,
              invoiceData.razon_social,
              invoiceData.giro_proveedor || 'Distribución Mayorista',
              invoiceData.direccion_proveedor || 'Casa Matriz',
              invoiceData.telefono_proveedor || '+56 2 2345 6789',
              invoiceData.dias_visita_proveedor || 'Lunes'
            ]
          );
        }

        defaultSqliteClient.execute(
          `INSERT OR IGNORE INTO factura_ingresos 
           (id, tenant_id, proveedor_id, numero_factura, fecha_ingreso, estado, cantidad, metodo_ingreso, rut_proveedor, total, json_ocr_raw)
           VALUES (?, ?, ?, ?, ?, 'PROCESSED', ?, ?, ?, ?, ?)`,
          [
            invoiceId,
            tenantId,
            supplierId,
            invoiceData.folio_factura || 'FOLIO-S/N',
            invoiceData.fecha_emision || new Date().toISOString().slice(0, 10),
            totalQuantity,
            invoiceData.metodo_ingreso || ocrProvider || 'CONFIRMED_SCAN',
            invoiceData.rut_proveedor || 'S/RUT',
            invoiceTotal,
            JSON.stringify(invoiceData)
          ]
        );

        for (const item of invoiceData.items) {
          const itemCantidad = Number(item.cantidad) || 0;
          const unitPrice = Number(item.precio_unitario) || 0;
          const salePrice = calcularPrecioVenta(unitPrice, configuredMargin);
          const itemSku = item.sku || `SKU-AUTO-${uuidv4().slice(0, 8).toUpperCase()}`;

          const sqliteProd = defaultSqliteClient.queryOne<any>(
            'SELECT id, stock_actual, codigo_barra FROM productos WHERE tenant_id = ? AND sku = ?',
            [tenantId, itemSku]
          );

          let productId: string;
          let prevStock = 0;

          if (sqliteProd) {
            productId = sqliteProd.id;
            prevStock = Number(sqliteProd.stock_actual);
            defaultSqliteClient.execute(
              "UPDATE productos SET stock_actual = stock_actual + ?, precio_compra = ?, factura_origen_folio = ?, lote = COALESCE(?, lote), fecha_vencimiento = COALESCE(?, fecha_vencimiento), updated_at = datetime('now') WHERE id = ?",
              [itemCantidad, unitPrice, invoiceData.folio_factura, item.lote ?? null, item.fecha_vencimiento ?? null, productId]
            );
          } else {
            productId = uuidv4();
            prevStock = 0;
            const barcode = generateChileanBarcode(itemSku);
            defaultSqliteClient.execute(
              `INSERT OR IGNORE INTO productos 
               (id, tenant_id, proveedor_id, sku, codigo_barra, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, activo, origen_creacion, factura_origen_folio, lote, fecha_vencimiento)
               VALUES (?, ?, ?, ?, ?, ?, ?, 5.0, ?, ?, 1, 'FACTURA', ?, ?, ?)`,
              [productId, tenantId, supplierId, itemSku, barcode, item.descripcion, itemCantidad, unitPrice, salePrice, invoiceData.folio_factura, item.lote ?? null, item.fecha_vencimiento ?? null]
            );
          }

          const newStock = prevStock + itemCantidad;

          // Registrar en producto_proveedores en SQLite
          defaultSqliteClient.execute(
            `INSERT INTO producto_proveedores 
             (id, tenant_id, producto_id, proveedor_id, ultimo_precio_compra, fecha_ultima_compra, folio_ultima_factura, updated_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))
             ON CONFLICT (tenant_id, producto_id, proveedor_id) 
             DO UPDATE SET ultimo_precio_compra = excluded.ultimo_precio_compra, 
                           fecha_ultima_compra = datetime('now'), 
                           folio_ultima_factura = excluded.folio_ultima_factura,
                           updated_at = datetime('now')`,
            [uuidv4(), tenantId, productId, supplierId, unitPrice, invoiceData.folio_factura]
          );

          defaultSqliteClient.execute(
            `INSERT INTO historial_stock 
             (id, tenant_id, producto_id, cambio_anterior, nuevo_stock, cambio, tipo_movimiento, motivo, fecha_movimiento, usuario_registro)
             VALUES (?, ?, ?, ?, ?, ?, 'ingreso_factura', ?, datetime('now'), 'Ingesta Factura Autorizada')`,
            [uuidv4(), tenantId, productId, prevStock, newStock, itemCantidad, `Ingreso factura ${invoiceData.folio_factura}`]
          );
        }
      });
    } catch (sqliteErr) {
      persistidoLocal = false;
      logger.warn('InvoiceIngestion', 'Failed to mirror invoice to SQLite local', { sqliteErr });
    }

    const duration = Date.now() - startTime;
    logger.info('InvoiceIngestionService', `Invoice ${invoiceData.folio_factura} successfully confirmed and ingested in ${duration}ms`);

    const invoiceTotal = Number(invoiceData.total ?? (invoiceData as any).total_factura) || 0;

    return {
      invoice_id: invoiceId,
      folio_factura: invoiceData.folio_factura,
      proveedor_id: supplierId,
      rut_proveedor: invoiceData.rut_proveedor,
      total: invoiceTotal,
      items_count: invoiceData.items.length,
      used_fallback: usedFallback,
      ocr_provider: ocrProvider,
      duration_ms: duration,
      persistido_local: persistidoLocal
    };
  }

  public async getInvoices(tenantId: string): Promise<any[]> {
    let rows: any[] = [];
    try {
      const result = await this.pgClient.query(
        `SELECT fi.*, p.nombre_proveedores as proveedor_nombre 
         FROM factura_ingresos fi
         LEFT JOIN proveedores p ON fi.proveedor_id = p.id
         WHERE fi.tenant_id = $1
         ORDER BY fi.created_at DESC`,
        [tenantId]
      );
      if (result.rows.length > 0) {
        rows = result.rows;
      }
    } catch (pgError) {
      logger.warn('InvoiceIngestionService', 'Postgres getInvoices failed, checking SQLite fallback', { error: pgError });
    }

    if (rows.length === 0) {
      try {
        rows = defaultSqliteClient.query<any>(
          `SELECT fi.*, p.nombre_proveedores as proveedor_nombre 
           FROM factura_ingresos fi
           LEFT JOIN proveedores p ON fi.proveedor_id = p.id
           WHERE fi.tenant_id = ?
           ORDER BY fi.fecha_ingreso DESC`,
          [tenantId]
        );
      } catch {
        rows = [];
      }
    }

    return rows.map((inv) => {
      const totalNum = Number(inv.total) || 0;
      const tax = desglosarIvaChileno(totalNum);
      return {
        ...inv,
        monto_neto: tax.neto,
        iva_credito: tax.iva,
        total_factura: tax.total
      };
    });
  }
}

export const defaultInvoiceIngestionService = new InvoiceIngestionService();
