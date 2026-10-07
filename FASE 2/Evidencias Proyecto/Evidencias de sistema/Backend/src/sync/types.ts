import { DetalleVenta, Producto, TransaccionVenta } from '../database/types';

export interface SyncPushItem {
  sale: TransaccionVenta;
  details: DetalleVenta[];
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
  server_timestamp: string;
}

export interface BackoffConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitterFactor: number;
}
