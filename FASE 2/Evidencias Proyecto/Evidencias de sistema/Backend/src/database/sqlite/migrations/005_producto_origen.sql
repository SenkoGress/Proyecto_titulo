-- ============================================================================
-- Gestock SQLite Local Mirror Migration: 005_producto_origen.sql
-- Rastreo de Origen de Creación de Productos y Folio de Factura
-- ============================================================================

ALTER TABLE productos ADD COLUMN origen_creacion TEXT DEFAULT 'CATALOGO';
ALTER TABLE productos ADD COLUMN factura_origen_folio TEXT;
