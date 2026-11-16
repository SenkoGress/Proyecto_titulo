-- ============================================================================
-- Gestock SaaS Cloud Database Migration: 019_sobre_por_tipo.sql
-- El SII recibe las boletas y el resto de los documentos en sobres distintos
-- ============================================================================

-- Las boletas electronicas (39 y 41) viajan en un sobre EnvioBOLETA y el resto de los
-- documentos en uno EnvioDTE. Mezclarlos en un solo sobre es un envio que el servicio rechaza,
-- de modo que el tipo forma parte del registro y no se deduce despues.
ALTER TABLE sii_envios ADD COLUMN IF NOT EXISTS tipo_sobre VARCHAR(20) NOT NULL DEFAULT 'EnvioDTE';
