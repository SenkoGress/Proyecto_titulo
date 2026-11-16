-- ============================================================================
-- Gestock PostgreSQL Cloud Migration: 012_cola_facturas_offline.sql
-- Cola de Facturas Pendientes de Digitalización (RF-43)
-- La cola opera en el nodo local, que es donde importa la ausencia de red. Estas
-- columnas mantienen la simetría del esquema dual para que el espejo en la nube
-- pueda recibir una factura que nació pendiente.
-- ============================================================================

ALTER TABLE factura_ingresos ADD COLUMN IF NOT EXISTS is_dirty BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE factura_ingresos ADD COLUMN IF NOT EXISTS sync_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE factura_ingresos ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'SYNCED';
ALTER TABLE factura_ingresos ADD COLUMN IF NOT EXISTS archivo_ruta TEXT;
ALTER TABLE factura_ingresos ADD COLUMN IF NOT EXISTS archivo_nombre TEXT;
ALTER TABLE factura_ingresos ADD COLUMN IF NOT EXISTS archivo_mime VARCHAR(100);
ALTER TABLE factura_ingresos ADD COLUMN IF NOT EXISTS ultimo_error TEXT;
ALTER TABLE factura_ingresos ADD COLUMN IF NOT EXISTS procesado_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_factura_ingresos_estado ON factura_ingresos(tenant_id, estado);
