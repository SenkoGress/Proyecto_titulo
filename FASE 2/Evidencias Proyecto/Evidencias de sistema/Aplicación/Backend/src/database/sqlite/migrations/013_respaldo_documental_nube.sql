-- ============================================================================
-- Gestock SQLite Local Mirror Migration: 013_respaldo_documental_nube.sql
-- Control de Respaldo del Documento en la Nube (RF-46)
-- El nodo local conserva el documento en disco; esta bandera indica si además
-- ya se subió a la nube, de modo que un POS que trabajó sin conexión sepa qué
-- documentos le quedan por respaldar cuando la recupere.
-- ============================================================================

ALTER TABLE factura_ingresos ADD COLUMN archivo_respaldado INTEGER NOT NULL DEFAULT 0;
ALTER TABLE factura_ingresos ADD COLUMN archivo_bytes INTEGER;

CREATE INDEX IF NOT EXISTS idx_factura_ingresos_respaldo
  ON factura_ingresos(tenant_id, archivo_respaldado);
