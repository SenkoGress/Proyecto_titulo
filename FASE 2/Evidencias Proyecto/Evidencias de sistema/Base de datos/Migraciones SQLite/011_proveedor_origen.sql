-- ============================================================================
-- Gestock SQLite Local Mirror Migration: 011_proveedor_origen.sql
-- Rastreo de Origen de Creación de Proveedores
-- Permite distinguir en el directorio los proveedores que creó la ingesta OCR de
-- los cargados a mano: un proveedor extraído de una factura puede traer el RUT o
-- la razón social mal leídos y conviene señalarlo para su revisión.
-- ============================================================================

ALTER TABLE proveedores ADD COLUMN origen_creacion TEXT DEFAULT 'CATALOGO';
ALTER TABLE proveedores ADD COLUMN factura_origen_folio TEXT;
