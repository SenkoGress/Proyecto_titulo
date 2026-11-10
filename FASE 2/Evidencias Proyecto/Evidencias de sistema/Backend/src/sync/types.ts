import { DetalleVenta, Producto, TransaccionVenta } from '../database/types';

export interface ProveedorReferenciado {
  id: string;
  rut_proveedor: string;
  nombre_proveedores: string;
  email: string | null;
}

export interface ProductoReferenciado {
  id: string;
  sku: string;
  codigo_barra: string | null;
  nombre: string;
  precio_compra: number;
  precio_venta: number;
  proveedor_id: string | null;
  /** Solo viaja en el respaldo del catalogo: en la fila que la nube ya tiene manda su propia cuenta. */
  stock_actual?: number;
  stock_minimo?: number;
}

export interface SyncPushItem {
  sale: TransaccionVenta;
  details: DetalleVenta[];
  /** Productos que el detalle referencia, para que la nube pueda crear los que no conoce. */
  productos?: ProductoReferenciado[];
  /** Proveedores de esos productos: sin ellos el producto no se puede crear con su vinculo. */
  proveedores?: ProveedorReferenciado[];
}

export interface SyncPushPayload {
  tenant_id: string;
  device_id: string;
  sales: SyncPushItem[];
}

export interface SyncPushResponse {
  success: boolean;
  synced_ids: string[];
  failed_ids: string[];
  processed_at: string;
  message: string;
}

export interface SyncPullRequest {
  tenant_id: string;
  last_pull_timestamp?: string | null;
}

export interface SyncPullResponse {
  success: boolean;
  products: Producto[];
  /** Proveedores que referencian los productos: sin ellos la clave foranea del terminal falla. */
  proveedores?: ProveedorReferenciado[];
  server_timestamp: string;
}

export interface BackoffConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitterFactor: number;
}

export interface RespaldoCatalogoResultado {
  success: boolean;
  productos_nuevos: number;
  proveedores_nuevos: number;
  message: string;
}
