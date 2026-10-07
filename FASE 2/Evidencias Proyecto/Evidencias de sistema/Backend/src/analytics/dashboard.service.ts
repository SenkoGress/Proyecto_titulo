import { defaultSqliteClient, SqliteClient } from '../database/sqlite/client';
import { defaultPgClient, PostgresClient } from '../database/postgres/client';
import { logger } from '../utils/logger';

export interface DashboardOverviewParams {
  tenantId: string;
  periodo?: 'diario' | 'mensual' | 'historico';
}

export interface DashboardKpis {
  totalVentasBruto: number;
  totalVentasNeto: number;
  totalIvaDebito: number;
  costoTotalVendido: number;
  utilidadBruta: number;
  margenUtilidadPorc: number;
  totalTransacciones: number;
  ticketPromedio: number;
  unidadesVendidas: number;
  inventarioValorCosto: number;
  inventarioValorVenta: number;
  productosStockCritico: number;
  productosAgotados: number;
  totalProveedores: number;
}

export interface ChartDataSeries {
  labels: string[];
  data: number[];
  transacciones: number[];
}

export interface PaymentBreakdownItem {
  metodo: string;
  total: number;
  porcentaje: number;
  cantidad: number;
}

export interface TopProductItem {
  nombre: string;
  sku: string;
  categoria: string;
  unidades: number;
  ingresos: number;
}

export interface SupplierAnalyticsItem {
  id: string;
  nombre: string;
  rut: string;
  diasVisita: string;
  totalInvertido: number;
  facturasIngresadas: number;
  productosAsociados: number;
}

export interface DashboardOverviewResult {
  periodo: 'diario' | 'mensual' | 'historico';
  fechaGeneracion: string;
  kpis: DashboardKpis;
  timelineChart: ChartDataSeries;
  paymentsBreakdown: PaymentBreakdownItem[];
  topProducts: TopProductItem[];
  categoryBreakdown: { categoria: string; total: number; unidades: number }[];
  suppliersAnalytics: SupplierAnalyticsItem[];
}

export class DashboardService {
  private sqlite: SqliteClient;
  private pg: PostgresClient;

  constructor(sqlite?: SqliteClient, pg?: PostgresClient) {
    this.sqlite = sqlite || defaultSqliteClient;
    this.pg = pg || defaultPgClient;
  }

  public getOverview(params: DashboardOverviewParams): DashboardOverviewResult {
    const tenantId = params.tenantId;
    const periodo = params.periodo || 'mensual';

    logger.info('DashboardService', `Generating dashboard analytics overview for tenant ${tenantId} (${periodo})`);

    // 1. Cláusula de tiempo según período
    let dateFilter = '';
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const monthStr = todayStr.substring(0, 7); // YYYY-MM

    if (periodo === 'diario') {
      dateFilter = `AND DATE(tv.fecha) = '${todayStr}'`;
    } else if (periodo === 'mensual') {
      dateFilter = `AND strftime('%Y-%m', tv.fecha) = '${monthStr}'`;
    } // 'historico' no agrega filtro de fecha

    // 2. KPIs de Ventas
    const salesAgg = this.sqlite.queryOne<{
      total_bruto: number;
      total_transacciones: number;
      unidades_vendidas: number;
      costo_vendido: number;
    }>(
      `SELECT 
        COALESCE(SUM(tv.total), 0) as total_bruto,
        COUNT(DISTINCT tv.id) as total_transacciones,
        COALESCE(SUM(dv.cantidad), 0) as unidades_vendidas,
        COALESCE(SUM(dv.cantidad * COALESCE(p.precio_compra, 0)), 0) as costo_vendido
       FROM transacciones_venta tv
       LEFT JOIN detalle_venta dv ON tv.id = dv.venta_id
       LEFT JOIN productos p ON dv.producto_id = p.id
       WHERE tv.tenant_id = ? ${dateFilter}`,
      [tenantId]
    ) || { total_bruto: 0, total_transacciones: 0, unidades_vendidas: 0, costo_vendido: 0 };

    const totalVentasBruto = Number(salesAgg.total_bruto || 0);
    const totalVentasNeto = Math.round(totalVentasBruto / 1.19);
    const totalIvaDebito = totalVentasBruto - totalVentasNeto;
    const costoTotalVendido = Number(salesAgg.costo_vendido || 0);
    const utilidadBruta = totalVentasNeto - costoTotalVendido;
    const margenUtilidadPorc = totalVentasNeto > 0 ? Math.round((utilidadBruta / totalVentasNeto) * 100) : 0;
    const totalTransacciones = Number(salesAgg.total_transacciones || 0);
    const ticketPromedio = totalTransacciones > 0 ? Math.round(totalVentasBruto / totalTransacciones) : 0;
    const unidadesVendidas = Number(salesAgg.unidades_vendidas || 0);

    // 3. KPIs de Inventario y Proveedores
    const invAgg = this.sqlite.queryOne<{
      valor_costo: number;
      valor_venta: number;
      criticos: number;
      agotados: number;
    }>(
      `SELECT 
        COALESCE(SUM(stock_actual * precio_compra), 0) as valor_costo,
        COALESCE(SUM(stock_actual * precio_venta), 0) as valor_venta,
        COUNT(CASE WHEN stock_actual <= stock_minimo AND stock_actual > 0 THEN 1 END) as criticos,
        COUNT(CASE WHEN stock_actual <= 0 THEN 1 END) as agotados
       FROM productos
       WHERE tenant_id = ? AND activo = 1`,
      [tenantId]
    ) || { valor_costo: 0, valor_venta: 0, criticos: 0, agotados: 0 };

    const provCount = this.sqlite.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM proveedores WHERE tenant_id = ?',
      [tenantId]
    )?.count || 0;

    const kpis: DashboardKpis = {
      totalVentasBruto,
      totalVentasNeto,
      totalIvaDebito,
      costoTotalVendido,
      utilidadBruta,
      margenUtilidadPorc,
      totalTransacciones,
      ticketPromedio,
      unidadesVendidas,
      inventarioValorCosto: Number(invAgg.valor_costo || 0),
      inventarioValorVenta: Number(invAgg.valor_venta || 0),
      productosStockCritico: Number(invAgg.criticos || 0),
      productosAgotados: Number(invAgg.agotados || 0),
      totalProveedores: Number(provCount)
    };

    // 4. Serie Temporal para Gráfico Evolución
    let timelineQuery = '';
    if (periodo === 'diario') {
      timelineQuery = `
        SELECT strftime('%H:00', fecha) as periodo_label,
               SUM(total) as monto,
               COUNT(*) as conteo
        FROM transacciones_venta
        WHERE tenant_id = ? AND DATE(fecha) = '${todayStr}'
        GROUP BY periodo_label
        ORDER BY periodo_label ASC
      `;
    } else if (periodo === 'mensual') {
      timelineQuery = `
        SELECT strftime('%d/%m', fecha) as periodo_label,
               SUM(total) as monto,
               COUNT(*) as conteo
        FROM transacciones_venta
        WHERE tenant_id = ? AND strftime('%Y-%m', fecha) = '${monthStr}'
        GROUP BY periodo_label
        ORDER BY fecha ASC
      `;
    } else {
      timelineQuery = `
        SELECT strftime('%Y-%m', fecha) as periodo_label,
               SUM(total) as monto,
               COUNT(*) as conteo
        FROM transacciones_venta
        WHERE tenant_id = ?
        GROUP BY periodo_label
        ORDER BY periodo_label ASC
      `;
    }

    const timelineRows = this.sqlite.query<{ periodo_label: string; monto: number; conteo: number }>(
      timelineQuery,
      [tenantId]
    );

    const timelineChart: ChartDataSeries = {
      labels: timelineRows.map(r => r.periodo_label),
      data: timelineRows.map(r => Number(r.monto || 0)),
      transacciones: timelineRows.map(r => Number(r.conteo || 0))
    };

    // 5. Desglose por Medio de Pago (incluyendo RutPay)
    const payRows = this.sqlite.query<{ metodo_pago: string; total: number; cantidad: number }>(
      `SELECT COALESCE(mp.pasarela, 'EFECTIVO') as metodo_pago, SUM(tv.total) as total, COUNT(*) as cantidad
       FROM transacciones_venta tv
       LEFT JOIN metodos_pago mp ON tv.metodo_pago_id = mp.id
       WHERE tv.tenant_id = ? ${dateFilter}
       GROUP BY COALESCE(mp.pasarela, 'EFECTIVO')
       ORDER BY total DESC`,
      [tenantId]
    );

    const paymentsBreakdown: PaymentBreakdownItem[] = payRows.map(r => {
      const tot = Number(r.total || 0);
      return {
        metodo: r.metodo_pago,
        total: tot,
        cantidad: Number(r.cantidad || 0),
        porcentaje: totalVentasBruto > 0 ? Math.round((tot / totalVentasBruto) * 100) : 0
      };
    });

    // 6. Top Productos Más Vendidos
    const topProdRows = this.sqlite.query<any>(
      `SELECT p.nombre, p.sku, p.categoria,
              SUM(dv.cantidad) as unidades,
              SUM(dv.subtotal) as ingresos
       FROM detalle_venta dv
       JOIN transacciones_venta tv ON dv.venta_id = tv.id
       JOIN productos p ON dv.producto_id = p.id
       WHERE tv.tenant_id = ? ${dateFilter}
       GROUP BY p.id, p.nombre, p.sku, p.categoria
       ORDER BY unidades DESC
       LIMIT 8`,
      [tenantId]
    );

    const topProducts: TopProductItem[] = topProdRows.map(r => ({
      nombre: r.nombre,
      sku: r.sku,
      categoria: r.categoria || 'General',
      unidades: Number(r.unidades || 0),
      ingresos: Number(r.ingresos || 0)
    }));

    // 7. Desglose por Categoría
    const catRows = this.sqlite.query<any>(
      `SELECT COALESCE(p.categoria, 'Otras') as categoria,
              SUM(dv.subtotal) as total,
              SUM(dv.cantidad) as unidades
       FROM detalle_venta dv
       JOIN transacciones_venta tv ON dv.venta_id = tv.id
       JOIN productos p ON dv.producto_id = p.id
       WHERE tv.tenant_id = ? ${dateFilter}
       GROUP BY categoria
       ORDER BY total DESC`,
      [tenantId]
    );

    const categoryBreakdown = catRows.map(r => ({
      categoria: r.categoria,
      total: Number(r.total || 0),
      unidades: Number(r.unidades || 0)
    }));

    // 8. Rendimiento de Proveedores
    const provRows = this.sqlite.query<any>(
      `SELECT pr.id, pr.nombre_proveedores as nombre, pr.rut_proveedor as rut,
              pr.dias_visita_proveedores as dias_visita,
              COALESCE(SUM(fi.total), 0) as total_invertido,
              COUNT(DISTINCT fi.id) as facturas_count,
              COUNT(DISTINCT p.id) as productos_count
       FROM proveedores pr
       LEFT JOIN factura_ingresos fi ON pr.id = fi.proveedor_id
       LEFT JOIN productos p ON pr.id = p.proveedor_id
       WHERE pr.tenant_id = ?
       GROUP BY pr.id, pr.nombre_proveedores, pr.rut_proveedor, pr.dias_visita_proveedores
       ORDER BY total_invertido DESC`,
      [tenantId]
    );

    const suppliersAnalytics: SupplierAnalyticsItem[] = provRows.map(r => ({
      id: r.id,
      nombre: r.nombre,
      rut: r.rut,
      diasVisita: r.dias_visita || 'Sin programar',
      totalInvertido: Number(r.total_invertido || 0),
      facturasIngresadas: Number(r.facturas_count || 0),
      productosAsociados: Number(r.productos_count || 0)
    }));

    return {
      periodo,
      fechaGeneracion: new Date().toISOString(),
      kpis,
      timelineChart,
      paymentsBreakdown,
      topProducts,
      categoryBreakdown,
      suppliersAnalytics
    };
  }
}

export const defaultDashboardService = new DashboardService();
