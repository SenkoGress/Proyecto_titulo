-- ============================================================================
-- Gestock PostgreSQL Cloud Migration: 011_proveedor_origen.sql
-- Rastreo de Origen de Creación de Proveedores
-- Permite distinguir en el directorio los proveedores que creó la ingesta OCR de
-- los cargados a mano: un proveedor extraído de una factura puede traer el RUT o
-- la razón social mal leídos y conviene señalarlo para su revisión.
-- ============================================================================

ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS origen_creacion VARCHAR(50) DEFAULT 'CATALOGO';
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS factura_origen_folio VARCHAR(100);
