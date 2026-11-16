-- ============================================================================
-- Gestock PostgreSQL Cloud Migration: 013_respaldo_documental_nube.sql
-- Respaldo del Documento de Compra en la Nube (RF-46)
-- Hasta la migración 012 la nube recibía solo la metadata del archivo
-- (archivo_ruta, archivo_nombre, archivo_mime), y esa ruta apunta al disco del
-- POS local: si ese equipo se pierde, el soporte del crédito fiscal de IVA se
-- pierde con él. Esta columna guarda el documento en sí.
-- ============================================================================

ALTER TABLE factura_ingresos ADD COLUMN IF NOT EXISTS archivo_contenido BYTEA;
ALTER TABLE factura_ingresos ADD COLUMN IF NOT EXISTS archivo_bytes INTEGER;
ALTER TABLE factura_ingresos ADD COLUMN IF NOT EXISTS archivo_respaldado_at TIMESTAMPTZ;
