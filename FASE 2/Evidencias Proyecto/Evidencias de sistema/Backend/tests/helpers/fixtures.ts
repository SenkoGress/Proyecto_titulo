import { v4 as uuidv4 } from 'uuid';

export const createFixtureIds = () => ({
  tenantId: uuidv4(),
  tenantId2: uuidv4(),
  planId: uuidv4(),
  usuarioAdminId: uuidv4(),
  usuarioCajeroId: uuidv4(),
  notificacionTokenId: uuidv4(),
  historialPlanId: uuidv4(),
  configId: uuidv4(),
  proveedorId: uuidv4(),
  catalogoBorradorId: uuidv4(),
  productoId: uuidv4(),
  movimientoTipoId: uuidv4(),
  movimientoId: uuidv4(),
  historialStockId: uuidv4(),
  facturaId: uuidv4(),
  metodoPagoId: uuidv4(),
  ventaId: uuidv4(),
  detalleVentaId: uuidv4()
});

export const samplePlan = (id = uuidv4()) => ({
  id,
  nombre: `Plan Pro Microempresa ${uuidv4().slice(0, 8)}`,
  precio_mensual: 19990.0,
  precio_anual: 199900.0,
  descuento_anual: 15,
  caracteristicas: JSON.stringify({ pos_offline: true, multi_cajero: true, ocr_facturas: 50 }),
  activo: true
});

export const sampleTenant = (id = uuidv4(), planId?: string) => ({
  id,
  nombre: `Almacén Don Tito SpA ${uuidv4().slice(0, 6)}`,
  plan_id: planId || null,
  estado: 'ACTIVO'
});

export const sampleUsuario = (id = uuidv4(), tenantId = uuidv4(), rol: 'admin' | 'cajero' = 'admin') => ({
  id,
  tenant_id: tenantId,
  nombre: rol === 'admin' ? 'Tito Administrador' : 'Carlos Cajero',
  email: `${rol}_${uuidv4().slice(0, 8)}@gestock.cl`,
  password_hash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
  rol
});

export const sampleProducto = (id = uuidv4(), tenantId = uuidv4(), proveedorId?: string) => ({
  id,
  tenant_id: tenantId,
  proveedor_id: proveedorId || null,
  codigo_barra: '7801234567890',
  sku: `PROD-${uuidv4().slice(0, 8).toUpperCase()}`,
  nombre: 'Bebida Cola 1.5L',
  stock_actual: 48.0,
  stock_minimo: 10.0,
  id_pos_externo: 'EXT-001',
  precio_compra: 850.0,
  precio_venta: 1490.0,
  categoria: 'Bebidas',
  activo: true
});

export const sampleProveedor = (id = uuidv4(), tenantId = uuidv4()) => ({
  id,
  tenant_id: tenantId,
  rut_proveedor: `76.${Math.floor(Math.random() * 899 + 100)}.${Math.floor(Math.random() * 899 + 100)}-K`,
  nombre_proveedores: 'Distribuidora Central Mayorista Ltda.',
  dias_visita_proveedores: 'Lunes y Jueves',
  email: `ventas_${uuidv4().slice(0, 6)}@distribuidoracentral.cl`,
  whatsapp_contacto: '+56912345678'
});

export const sampleMetodoPago = (id = uuidv4()) => ({
  id,
  nombre: `Transbank Redcompra Débito ${uuidv4().slice(0, 6)}`,
  descripcion: 'Pago con tarjeta de débito local mediante POS Transbank',
  activo: true,
  pasarela: 'TRANSBANK' as const
});
