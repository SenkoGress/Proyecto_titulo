-- ============================================================================
-- Gestock PostgreSQL Cloud Migration: 005_producto_origen.sql
-- Rastreo de Origen de Creación de Productos y Folio de Factura
-- ============================================================================

ALTER TABLE productos ADD COLUMN IF NOT EXISTS origen_creacion VARCHAR(50) DEFAULT 'CATALOGO';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS factura_origen_folio VARCHAR(100);
