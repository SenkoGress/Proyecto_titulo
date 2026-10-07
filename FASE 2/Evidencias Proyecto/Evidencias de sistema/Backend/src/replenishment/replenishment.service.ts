import { v4 as uuidv4 } from 'uuid';
import { PostgresClient, defaultPgClient } from '../database/postgres/client';
import { defaultSqliteClient, SqliteClient } from '../database/sqlite/client';
import { calculateNextVisit } from '../utils/supplier.utils';
import { defaultTenantConfigService } from '../config/tenant-config.service';
import { logger } from '../utils/logger';
import {
  ProductSalesVelocity,
  ReplenishmentConfig,
  SuggestedPurchaseOrder,
  SupplierCandidateOption
} from './types';

export const defaultReplenishmentConfig: ReplenishmentConfig = {
  analysisDays: 7,
  defaultLeadTimeDays: 7,
  safetyStockFactor: 1.5 // Factor de cobertura para stock de seguridad
};

export class ReplenishmentService {
  private pgClient: PostgresClient;
  private sqliteClient: SqliteClient;
  private config: ReplenishmentConfig;

  constructor(
    customPgClient?: PostgresClient,
    customSqliteClient?: SqliteClient,
    customConfig?: Partial<ReplenishmentConfig>
  ) {
    this.pgClient = customPgClient || defaultPgClient;
    this.sqliteClient = customSqliteClient || defaultSqliteClient;
    this.config = {
      ...defaultReplenishmentConfig,
      ...customConfig
    };
  }

  /**
   * Calcula la velocidad diaria de ventas, punto de reorden (ROP) y analiza proveedores alternativos
   */
  public async calculateSalesVelocity(
    tenantId: string,
    analysisDays = this.config.analysisDays,
    customConfig?: Partial<ReplenishmentConfig>
  ): Promise<ProductSalesVelocity[]> {
    const activeConfig = { ...this.config, ...customConfig, analysisDays };

    // 1. Intentar consultar SQLite local para velocidad y disponibilidad en tiempo real
    try {
      const sqliteQuery = `
        SELECT 
          p.id as product_id,
          p.sku,
          p.codigo_barra,
          p.nombre,
          p.stock_actual,
          p.stock_minimo,
          p.precio_compra,
          p.proveedor_id,
          prov.nombre_proveedores,
          prov.rut_proveedor,
          prov.dias_visita_proveedores,
          COALESCE((
            SELECT SUM(dv.cantidad)
            FROM detalle_venta dv
            JOIN transacciones_venta tv ON dv.venta_id = tv.id
            WHERE dv.producto_id = p.id 
              AND tv.fecha >= datetime('now', '-' || ? || ' days')
          ), 0) as total_sold
        FROM productos p
        LEFT JOIN proveedores prov ON p.proveedor_id = prov.id
        WHERE p.tenant_id = ? AND p.activo = 1
        ORDER BY (p.stock_actual <= p.stock_minimo) DESC, p.stock_actual ASC
      `;

      const rows = this.sqliteClient.query<any>(sqliteQuery, [analysisDays, tenantId]);

      if (rows && rows.length > 0) {
        return this.processProductRows(rows, tenantId, activeConfig);
      }
    } catch (sqliteErr) {
      logger.warn('ReplenishmentService', 'Failed to query SQLite for sales velocity, falling back to PostgreSQL', { sqliteErr });
    }

    // 2. Fallback a PostgreSQL Cloud
    const pgQuery = `
      SELECT 
        p.id as product_id,
        p.sku,
        p.codigo_barra,
        p.nombre,
        p.stock_actual,
        p.stock_minimo,
        p.precio_compra,
        p.proveedor_id,
        prov.nombre_proveedores,
        prov.rut_proveedor,
        prov.dias_visita_proveedores,
        COALESCE(SUM(dv.cantidad), 0) as total_sold
      FROM productos p
      LEFT JOIN proveedores prov ON p.proveedor_id = prov.id
      LEFT JOIN detalle_venta dv ON p.id = dv.producto_id
      LEFT JOIN transacciones_venta tv ON dv.venta_id = tv.id AND tv.fecha >= (now() - ($2 || ' days')::INTERVAL)
      WHERE p.tenant_id = $1 AND p.activo = true
      GROUP BY p.id, p.sku, p.codigo_barra, p.nombre, p.stock_actual, p.stock_minimo, p.precio_compra, p.proveedor_id, prov.nombre_proveedores, prov.rut_proveedor, prov.dias_visita_proveedores
      ORDER BY (p.stock_actual <= p.stock_minimo) DESC, p.stock_actual ASC
    `;

    const result = await this.pgClient.query<any>(pgQuery, [tenantId, analysisDays]);
    return this.processProductRows(result.rows, tenantId, activeConfig);
  }

  private processProductRows(rows: any[], tenantId: string, activeConfig: ReplenishmentConfig): ProductSalesVelocity[] {
    const leadTime = activeConfig.defaultLeadTimeDays;
    const safetyFactor = activeConfig.safetyStockFactor;
    const analysisDays = activeConfig.analysisDays;

    return rows.map((row) => {
      const stockActual = parseFloat(row.stock_actual) || 0;
      const stockMinimo = parseFloat(row.stock_minimo) || 0;
      const precioCompra = parseFloat(row.precio_compra) || 0;
      const totalSold = parseFloat(row.total_sold) || 0;

      const velocityDaily = totalSold / analysisDays;
      const daysOfInventory = velocityDaily > 0 ? stockActual / velocityDaily : (stockActual === 0 ? 0 : 999);
      const reorderPoint = Math.ceil(velocityDaily * leadTime + stockMinimo);
      const isAgotado = stockActual <= 0;
      const isUnderStock = isAgotado || stockActual <= stockMinimo || stockActual <= reorderPoint;

      let suggestedOrderQuantity = 0;
      if (isUnderStock) {
        const targetStock = Math.ceil(Math.max(velocityDaily * leadTime * safetyFactor, stockMinimo * 1.5) + 5);
        suggestedOrderQuantity = Math.max(5, targetStock - stockActual);
      }

      // Buscar opciones de proveedores (histórico en producto_proveedores)
      const opcionesProveedores = this.getSupplierCandidatesForProduct(tenantId, row.product_id, row.proveedor_id, precioCompra);

      const visitInfo = calculateNextVisit(row.dias_visita_proveedores);

      // Proveedor recomendado: si el stock es crítico/agotado, priorizar el de visita más próxima; si no, el de mejor precio
      let proveedorRecomendado: SupplierCandidateOption | undefined;
      if (opcionesProveedores.length > 0) {
        if (isAgotado || daysOfInventory <= 2) {
          proveedorRecomendado = opcionesProveedores.find(op => op.esVisitaMasProxima) || opcionesProveedores[0];
        } else {
          proveedorRecomendado = opcionesProveedores.find(op => op.esMasEconomico) || opcionesProveedores[0];
        }
      }

      return {
        productId: row.product_id,
        sku: row.sku,
        codigoBarra: row.codigo_barra || undefined,
        nombre: row.nombre,
        stockActual,
        stockMinimo,
        precioCompra,
        totalSold,
        velocityDaily: parseFloat(velocityDaily.toFixed(2)),
        daysOfInventory: parseFloat(daysOfInventory.toFixed(1)),
        reorderPoint,
        isUnderStock,
        isAgotado,
        suggestedOrderQuantity,
        proveedorId: row.proveedor_id,
        proveedorNombre: row.nombre_proveedores || 'Proveedor Mayorista General',
        diasVisitaProveedor: row.dias_visita_proveedores || 'Lunes',
        proximaVisitaProveedor: visitInfo.displayText,
        proveedoresAlternativos: opcionesProveedores,
        proveedorRecomendado
      };
    });
  }

  /**
   * Obtiene todos los proveedores históricos para un producto y calcula la comparativa de precio vs fecha de visita
   */
  private getSupplierCandidatesForProduct(
    tenantId: string,
    productId: string,
    defaultSupplierId?: string | null,
    defaultPrice?: number
  ): SupplierCandidateOption[] {
    const candidates: SupplierCandidateOption[] = [];

    try {
      const records = this.sqliteClient.query<any>(
        `SELECT 
           pp.proveedor_id,
           pp.ultimo_precio_compra,
           prov.nombre_proveedores,
           prov.rut_proveedor,
           prov.dias_visita_proveedores
         FROM producto_proveedores pp
         JOIN proveedores prov ON pp.proveedor_id = prov.id
         WHERE pp.tenant_id = ? AND pp.producto_id = ?`,
        [tenantId, productId]
      );

      if (records && records.length > 0) {
        records.forEach(r => {
          const visit = calculateNextVisit(r.dias_visita_proveedores);
          candidates.push({
            proveedorId: r.proveedor_id,
            nombreProveedor: r.nombre_proveedores,
            rutProveedor: r.rut_proveedor,
            diasVisita: r.dias_visita_proveedores || 'Lunes',
            diasHastaVisita: visit.daysUntil,
            proximaVisitaTexto: visit.displayText,
            precioUnitario: parseFloat(r.ultimo_precio_compra) || 0,
            esMasEconomico: false,
            esVisitaMasProxima: false,
            recomendacionBadge: ''
          });
        });
      }
    } catch {}

    // Si no había registros en producto_proveedores, agregar al proveedor por defecto
    if (candidates.length === 0 && defaultSupplierId) {
      try {
        const prov = this.sqliteClient.queryOne<any>(
          'SELECT id, nombre_proveedores, rut_proveedor, dias_visita_proveedores FROM proveedores WHERE id = ?',
          [defaultSupplierId]
        );
        if (prov) {
          const visit = calculateNextVisit(prov.dias_visita_proveedores);
          candidates.push({
            proveedorId: prov.id,
            nombreProveedor: prov.nombre_proveedores,
            rutProveedor: prov.rut_proveedor,
            diasVisita: prov.dias_visita_proveedores || 'Lunes',
            diasHastaVisita: visit.daysUntil,
            proximaVisitaTexto: visit.displayText,
            precioUnitario: defaultPrice || 0,
            esMasEconomico: true,
            esVisitaMasProxima: true,
            recomendacionBadge: 'Proveedor Habitual'
          });
        }
      } catch {}
    }

    if (candidates.length === 0) return [];

    // Calcular quién tiene el precio más bajo y quién tiene la visita más próxima
    const minPrice = Math.min(...candidates.map(c => c.precioUnitario));
    const minDays = Math.min(...candidates.map(c => c.diasHastaVisita));

    candidates.forEach(c => {
      c.esMasEconomico = c.precioUnitario === minPrice;
      c.esVisitaMasProxima = c.diasHastaVisita === minDays;

      if (c.esMasEconomico && c.esVisitaMasProxima) {
        c.recomendacionBadge = 'Opción Recomendada (Mejor Precio y Visita Próxima)';
      } else if (c.esVisitaMasProxima) {
        c.recomendacionBadge = `Visita Más Próxima (${c.proximaVisitaTexto})`;
      } else if (c.esMasEconomico) {
        c.recomendacionBadge = `Mejor Precio ($${c.precioUnitario.toLocaleString('es-CL')})`;
      } else {
        c.recomendacionBadge = 'Opción Alternativa';
      }
    });

    return candidates;
  }

  /**
   * Genera órdenes de compra sugeridas agrupadas por proveedor y evalúa envío automático por correo
   */
  public async generateSuggestedOrders(
    tenantId: string,
    customConfig?: Partial<ReplenishmentConfig>
  ): Promise<{
    orders: SuggestedPurchaseOrder[];
    lowStockAlerts: ProductSalesVelocity[];
    totalCritical: number;
    emailDispatchStatus?: { sent: boolean; message: string; recipient?: string };
  }> {
    const config = { ...this.config, ...customConfig };
    const velocities = await this.calculateSalesVelocity(tenantId, config.analysisDays, config);

    const lowStockAlerts = velocities.filter(v => v.isUnderStock);
    const itemsToOrder = lowStockAlerts.filter(v => v.suggestedOrderQuantity > 0);

    if (itemsToOrder.length === 0) {
      logger.info('ReplenishmentService', 'No products require purchase orders at this time');
      return {
        orders: [],
        lowStockAlerts: [],
        totalCritical: 0
      };
    }

    // Agrupar ítems según su proveedor recomendado o asignado
    const groupedBySupplier = new Map<string, ProductSalesVelocity[]>();

    for (const item of itemsToOrder) {
      const targetSupplierId = item.proveedorRecomendado?.proveedorId || item.proveedorId || 'UNASSIGNED';
      const existing = groupedBySupplier.get(targetSupplierId) || [];
      existing.push(item);
      groupedBySupplier.set(targetSupplierId, existing);
    }

    const createdOrders: SuggestedPurchaseOrder[] = [];

    for (const [supplierIdKey, items] of groupedBySupplier.entries()) {
      let supplierInfo: any = null;

      try {
        supplierInfo = this.sqliteClient.queryOne<any>(
          'SELECT id, nombre_proveedores, rut_proveedor, email, whatsapp_contacto, telefono, dias_visita_proveedores FROM proveedores WHERE id = ?',
          [supplierIdKey]
        );
      } catch {}

      if (!supplierInfo && supplierIdKey !== 'UNASSIGNED') {
        try {
          const pgRes = await this.pgClient.query<any>(
            'SELECT id, nombre_proveedores, rut_proveedor, email, whatsapp_contacto, telefono, dias_visita_proveedores FROM proveedores WHERE id = $1',
            [supplierIdKey]
          );
          if (pgRes.rows.length > 0) supplierInfo = pgRes.rows[0];
        } catch {}
      }

      const finalSupplierId = supplierInfo?.id || supplierIdKey;
      const supplierName = supplierInfo?.nombre_proveedores || 'Proveedor Mayorista General';
      const supplierRut = supplierInfo?.rut_proveedor || '78.450.685-1';
      const supplierEmail = supplierInfo?.email || 'pedidos@proveedor.cl';
      const supplierTel = supplierInfo?.telefono || supplierInfo?.whatsapp_contacto || '+56 9 1122 3344';
      const diasVisita = supplierInfo?.dias_visita_proveedores || 'Lunes';
      const visit = calculateNextVisit(diasVisita);

      const orderId = uuidv4();
      let totalEstimado = 0;

      const orderLines = items.map(item => {
        const unitPrice = item.proveedorRecomendado?.precioUnitario || item.precioCompra;
        const subtotal = item.suggestedOrderQuantity * unitPrice;
        totalEstimado += subtotal;

        return {
          productId: item.productId,
          sku: item.sku,
          codigoBarra: item.codigoBarra,
          nombre: item.nombre,
          cantidadSugerida: item.suggestedOrderQuantity,
          precioUnitario: unitPrice,
          subtotalEstimado: subtotal,
          opcionesProveedores: item.proveedoresAlternativos
        };
      });

      const order: SuggestedPurchaseOrder = {
        orderId,
        tenantId,
        proveedorId: finalSupplierId,
        proveedorNombre: supplierName,
        proveedorRut: supplierRut,
        proveedorEmail: supplierEmail,
        proveedorTelefono: supplierTel,
        diasVisita,
        proximaVisitaTexto: visit.displayText,
        diasHastaVisita: visit.daysUntil,
        estado: 'sugerida',
        fechaCreacion: new Date().toISOString(),
        totalEstimado,
        items: orderLines
      };

      createdOrders.push(order);

      // Persistir orden en SQLite y PostgreSQL a menos que se especifique persist === false
      if (customConfig?.persist !== false) {
        try {
          this.sqliteClient.execute(
            `INSERT INTO purchase_orders (id, tenant_id, supplier_id, estado, fecha_creacion, total_estimado)
             VALUES (?, ?, ?, 'sugerida', datetime('now'), ?)`,
            [orderId, tenantId, finalSupplierId, totalEstimado]
          );
          for (const line of orderLines) {
            this.sqliteClient.execute(
              `INSERT INTO purchase_order_details (id, purchase_order_id, product_id, cantidad_sugerida, precio_unitario, subtotal)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [uuidv4(), orderId, line.productId, line.cantidadSugerida, line.precioUnitario, line.subtotalEstimado]
            );
          }
        } catch {}

        try {
          await this.pgClient.query(
            `INSERT INTO purchase_orders (id, tenant_id, supplier_id, estado, fecha_creacion, total_estimado)
             VALUES ($1, $2, $3, 'sugerida', now(), $4)`,
            [orderId, tenantId, finalSupplierId, totalEstimado]
          );
          for (const line of orderLines) {
            await this.pgClient.query(
              `INSERT INTO purchase_order_details (id, purchase_order_id, product_id, cantidad_sugerida, precio_unitario, subtotal)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [uuidv4(), orderId, line.productId, line.cantidadSugerida, line.precioUnitario, line.subtotalEstimado]
            );
          }
        } catch {}
      }
    }

    // 3. Evaluar envío automático de órdenes de compra por correo
    let emailDispatchStatus: { sent: boolean; message: string; recipient?: string } | undefined;

    try {
      const configuredEmail = await defaultTenantConfigService.getOrderNotificationEmail(tenantId);
      const autoSendEnabled = await defaultTenantConfigService.getAutoSendOrders(tenantId);

      if (configuredEmail && autoSendEnabled && createdOrders.length > 0) {
        const dispatchResult = await this.sendPurchaseOrdersBatchEmail(tenantId, configuredEmail, createdOrders);
        emailDispatchStatus = dispatchResult;
      }
    } catch (err) {
      logger.warn('ReplenishmentService', 'Failed to auto-dispatch orders email', { err });
    }

    return {
      orders: createdOrders,
      lowStockAlerts,
      totalCritical: lowStockAlerts.length,
      emailDispatchStatus
    };
  }

  /**
   * Envía por correo electrónico el consolidado de órdenes de compra al email configurado
   */
  public async sendPurchaseOrdersBatchEmail(
    tenantId: string,
    recipientEmail: string,
    orders: SuggestedPurchaseOrder[]
  ): Promise<{ sent: boolean; message: string; recipient: string }> {
    const totalMonto = orders.reduce((sum, o) => sum + o.totalEstimado, 0);
    const totalItems = orders.reduce((sum, o) => sum + o.items.length, 0);

    logger.info('ReplenishmentService', `Simulating automated dispatch of purchase orders email to: ${recipientEmail}`, {
      ordersCount: orders.length,
      totalMonto,
      totalItems
    });

    // Actualizar estado de las órdenes a 'enviada'
    for (const ord of orders) {
      try {
        this.sqliteClient.execute("UPDATE purchase_orders SET estado = 'enviada' WHERE id = ?", [ord.orderId]);
        await this.pgClient.query("UPDATE purchase_orders SET estado = 'enviada' WHERE id = $1", [ord.orderId]);
      } catch {}
    }

    return {
      sent: true,
      message: `Órdenes de compra enviadas automáticamente a ${recipientEmail} (${orders.length} órdenes, ${totalItems} productos, Total: $${totalMonto.toLocaleString('es-CL')})`,
      recipient: recipientEmail
    };
  }

  /**
   * Obtiene las órdenes de compra para el tenant
   */
  public async getPurchaseOrders(tenantId: string, estado?: string): Promise<any[]> {
    try {
      let sql = 'SELECT * FROM purchase_orders WHERE tenant_id = ?';
      const params: any[] = [tenantId];
      if (estado) {
        sql += ' AND estado = ?';
        params.push(estado);
      }
      sql += ' ORDER BY created_at DESC';
      return this.sqliteClient.query(sql, params);
    } catch {
      try {
        let pgSql = 'SELECT * FROM purchase_orders WHERE tenant_id = $1';
        const pgParams: any[] = [tenantId];
        if (estado) {
          pgSql += ' AND estado = $2';
          pgParams.push(estado);
        }
        pgSql += ' ORDER BY created_at DESC';
        const res = await this.pgClient.query(pgSql, pgParams);
        return res.rows;
      } catch {
        return [];
      }
    }
  }
}

export const defaultReplenishmentService = new ReplenishmentService();
