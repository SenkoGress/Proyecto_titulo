export type TenantPlan = 'FREE' | 'PRO' | 'ENTERPRISE';
export type TenantStatus = 'ACTIVO' | 'SUSPENDIDO' | 'CANCELADO';
export type UserRole = 'admin' | 'cajero';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';
export type StockMovementType = 'venta' | 'ingreso_factura' | 'ajuste';
export type PaymentGateway = 'EFECTIVO' | 'TRANSBANK' | 'MERCADOPAGO' | 'SUMUP' | 'OTRO';

export interface PlanFacturacion {
  id: string;
  nombre: string;
  precio_mensual: number;
  precio_anual: number;
  descuento_anual: number;
  caracteristicas?: Record<string, unknown> | null;
  activo: boolean;
  creado_en?: string;
}

export interface Tenant {
  id: string;
  nombre: string;
  plan_id?: string | null;
  estado: TenantStatus;
  created_at?: string;
  updated_at?: string;
}

export interface Usuario {
  id: string;
  tenant_id: string;
  nombre: string;
  email: string;
  password_hash: string;
  rol: UserRole;
  created_at?: string;
  updated_at?: string;
}

export interface NotificacionToken {
  id: string;
  usuario_id: string;
  tipo: string;
  token: string;
  activo: boolean;
  creada_en?: string;
  expiracion: string;
}

export interface HistorialPlan {
  id: string;
  tenant_id: string;
  plan_id: string;
  usuario_id?: string | null;
  fecha_cambio?: string;
  metodo_pago: string;
  monto_pagado: number;
}

export interface ConfiguracionSistema {
  id: string;
  tenant_id?: string | null;
  clave: string;
  valor: string;
  descripcion?: string | null;
  actualizado_at?: string;
}

export interface Proveedor {
  id: string;
  tenant_id: string;
  rut_proveedor: string;
  nombre_proveedores: string;
  dias_visita_proveedores?: string | null;
  email?: string | null;
  whatsapp_contacto?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CatalogoBorrador {
  id: string;
  tenant_id: string;
  proveedor_id?: string | null;
  estado_revision_catalogo: string;
  fecha_ingreso?: string;
  notas?: string | null;
  created_at?: string;
}

export interface Producto {
  id: string;
  tenant_id: string;
  proveedor_id?: string | null;
  codigo_barra?: string | null;
  sku: string;
  nombre: string;
  stock_actual: number;
  stock_minimo: number;
  id_pos_externo?: string | null;
  precio_compra: number;
  precio_venta: number;
  categoria?: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MovimientoInventarioTipo {
  id: string;
  nombre: string;
  codigo: string;
  descripcion?: string | null;
}

export interface MovimientoInventario {
  id: string;
  tenant_id: string;
  producto_id: string;
  tipo_movimiento_id: string;
  cantidad: number;
  saldo_anterior: number;
  nuevo_saldo: number;
  id_origen?: string | null;
  tipo_origen?: string | null;
  fecha_movimiento?: string;
  usuario_registro?: string | null;
}

export interface HistorialStock {
  id: string;
  tenant_id: string;
  producto_id: string;
  cambio_anterior: number;
  nuevo_stock: number;
  cambio: number;
  tipo_movimiento: StockMovementType;
  id_venta_manual?: string | null;
  motivo?: string | null;
  fecha_movimiento?: string;
  usuario_registro?: string | null;
}

export interface FacturaIngreso {
  id: string;
  tenant_id: string;
  proveedor_id?: string | null;
  numero_factura: string;
  fecha_ingreso: string;
  estado: string;
  cantidad: number;
  metodo_ingreso?: string | null;
  rut_proveedor?: string | null;
  total: number;
  json_ocr_raw?: Record<string, unknown> | null;
  created_at?: string;
}

export interface MetodoPago {
  id: string;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  pasarela: PaymentGateway;
}

export interface TransaccionVenta {
  id: string;
  tenant_id: string;
  usuario_id: string;
  folio_local_sqlite?: string | null;
  fecha?: string;
  total: number;
  unidades: number;
  estado: string;
  rut_cliente?: string | null;
  observaciones?: string | null;
  metodo_pago_id?: string | null;
  is_dirty?: number;
  sync_attempts?: number;
  last_synced_at?: string | null;
  sync_status?: SyncStatus;
}

export interface DetalleVenta {
  id: string;
  venta_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}
