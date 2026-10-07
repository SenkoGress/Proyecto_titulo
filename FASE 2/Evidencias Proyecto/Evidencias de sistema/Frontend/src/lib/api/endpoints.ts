// src/lib/api/endpoints.ts

// prefijo del backend
const API_V1 = '/api/v1'

// rutas del backend que usa el frontend
export const endpoints = {
  // pendiente: el backend todavia no expone estas rutas, ver AUTENTICACION-MARCELO.txt
  auth: {
    login: `${API_V1}/auth/login`,
    registro: `${API_V1}/auth/register`,
    perfil: `${API_V1}/auth/me`,
  },
  sistema: {
    info: '/api',
    salud: '/health',
  },
  dashboard: {
    resumen: `${API_V1}/dashboard/overview`,
    tendencias: `${API_V1}/trends`,
  },
  pos: {
    productos: `${API_V1}/pos/products`,
    estado: `${API_V1}/pos/status`,
    checkout: `${API_V1}/pos/checkout`,
    sincronizar: `${API_V1}/pos/sync`,
    inventario: `${API_V1}/pos/inventory`,
    vencimientos: `${API_V1}/pos/vencimientos`,
    transacciones: `${API_V1}/pos/transactions`,
    devolucion: `${API_V1}/pos/devolucion`,
    producto: (id: string) => `${API_V1}/pos/products/${id}`,
    stockProducto: (id: string) => `${API_V1}/pos/products/${id}/stock`,
    mermas: `${API_V1}/pos/mermas`,
    historialProducto: (id: string) => `${API_V1}/pos/products/${id}/history`,
  },
  replenishment: {
    sugerir: `${API_V1}/replenishment/suggest`,
    ordenesCompra: `${API_V1}/replenishment/purchase-orders`,
    enviarCorreo: `${API_V1}/replenishment/send-email`,
  },
  configuracion: {
    margen: `${API_V1}/config/margin`,
    correo: `${API_V1}/config/email`,
  },
  proveedores: {
    listar: `${API_V1}/suppliers`,
    crear: `${API_V1}/suppliers`,
    actualizar: (id: string) => `${API_V1}/suppliers/${id}`,
  },
  dte: {
    config: `${API_V1}/dte/config`,
    lista: `${API_V1}/dte/list`,
    comprobante: (id: string) => `${API_V1}/dte/${id}/receipt`,
    xml: (id: string) => `${API_V1}/dte/${id}/xml`,
    enviarCorreo: `${API_V1}/dte/send-email`,
    caf: `${API_V1}/dte/caf/status`,
    f29: `${API_V1}/dte/f29`,
    rcofLista: `${API_V1}/dte/rcof/list`,
    rcofGenerar: `${API_V1}/dte/rcof/generate`,
    guias: `${API_V1}/dte/guias`,
    guiasEmitir: `${API_V1}/dte/guias/emitir`,
    certificacion: `${API_V1}/dte/certification/run-set`,
    respaldo: `${API_V1}/dte/backup/export`,
  },
  invoices: {
    scan: `${API_V1}/invoices/scan`,
    confirm: `${API_V1}/invoices/confirm`,
    listar: `${API_V1}/invoices/`,
  },
  caja: {
    abrir: `${API_V1}/caja/abrir`,
    resumen: `${API_V1}/caja/resumen`,
    cerrar: `${API_V1}/caja/cerrar`,
    historial: `${API_V1}/caja/historial`,
    movimiento: `${API_V1}/caja/movimiento`,
    movimientos: `${API_V1}/caja/movimientos`,
  },
} as const
