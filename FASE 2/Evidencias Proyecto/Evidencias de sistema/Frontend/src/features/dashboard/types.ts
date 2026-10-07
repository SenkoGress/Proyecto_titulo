// src/features/dashboard/types.ts
// segun backend/src/analytics/dashboard.service.ts (GET /dashboard/overview)

// los unicos 3 periodos que acepta el backend (no existe "semanal")
export type PeriodoDashboard = 'diario' | 'mensual' | 'historico'

export type KpisDashboard = {
  totalVentasBruto: number
  totalVentasNeto: number
  totalIvaDebito: number
  costoTotalVendido: number
  utilidadBruta: number
  margenUtilidadPorc: number
  totalTransacciones: number
  ticketPromedio: number
  unidadesVendidas: number
  inventarioValorCosto: number
  inventarioValorVenta: number
  productosStockCritico: number
  productosAgotados: number
  totalProveedores: number
}

// serie temporal: por hora si es diario, por dia si es mensual, por mes si es historico
export type TimelineDashboard = {
  labels: string[]
  data: number[]
  transacciones: number[]
}

export type MedioPagoDashboard = {
  metodo: string
  total: number
  cantidad: number
  porcentaje: number
}

export type ProductoTop = {
  nombre: string
  sku: string
  categoria: string
  unidades: number
  ingresos: number
}

export type CategoriaDashboard = {
  categoria: string
  total: number
  unidades: number
}

export type ProveedorDashboard = {
  id: string
  nombre: string
  rut: string
  diasVisita: string
  totalInvertido: number
  facturasIngresadas: number
  productosAsociados: number
}

export type ResumenDashboard = {
  periodo: PeriodoDashboard
  fechaGeneracion: string
  kpis: KpisDashboard
  timelineChart: TimelineDashboard
  paymentsBreakdown: MedioPagoDashboard[]
  topProducts: ProductoTop[]
  categoryBreakdown: CategoriaDashboard[]
  suppliersAnalytics: ProveedorDashboard[]
}

export type RespuestaDashboard = {
  success: boolean
  data: ResumenDashboard
}

// tendencia de mercado (GET /trends, backend/src/routes/market.routes.ts)
export type TendenciaMercado = {
  id: string
  tenantId: string
  sku: string
  keyword: string
  source: string
  demandIndex: number
  averageMarketPrice: number
  lastUpdated: string
}

export type RespuestaTendencias = {
  success: boolean
  data: TendenciaMercado[]
}
