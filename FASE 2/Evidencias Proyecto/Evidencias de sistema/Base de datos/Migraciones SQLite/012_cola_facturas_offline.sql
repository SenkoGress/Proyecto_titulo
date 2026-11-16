-- ============================================================================
-- Gestock SQLite Local Mirror Migration: 012_cola_facturas_offline.sql
-- Cola de Facturas Pendientes de Digitalización (RF-43)
-- Persiste la referencia al archivo subido para poder reprocesarlo cuando se
-- restablezca la conectividad. Sin el archivo no habría documento que reintentar.
-- Las banderas is_dirty, sync_attempts y sync_status ya las garantiza el parche
-- idempotente de arranque y no se vuelven a declarar aquí: un ALTER duplicado
-- aborta la migración completa en SQLite.
-- ============================================================================

ALTER TABLE factura_ingresos ADD COLUMN archivo_ruta TEXT;
ALTER TABLE factura_ingresos ADD COLUMN archivo_nombre TEXT;
ALTER TABLE factura_ingresos ADD COLUMN archivo_mime TEXT;
ALTER TABLE factura_ingresos ADD COLUMN ultimo_error TEXT;
ALTER TABLE factura_ingresos ADD COLUMN procesado_at TEXT;

CREATE INDEX IF NOT EXISTS idx_factura_ingresos_estado ON factura_ingresos(tenant_id, estado);
