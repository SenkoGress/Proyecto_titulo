-- ============================================================================
-- Gestock SaaS Cloud Database Migration: 021_producto_imagen.sql
-- La foto del producto se guarda con el producto
-- ============================================================================

-- Imagen como data URL (data:image/...;base64,...), ya reducida por la interfaz a unos 20 KB.
-- Sirve para las dos fuentes: la que trae Open Food Facts y la que saca el dueno del local. Va
-- en la fila y no en un archivo aparte para que viaje con el producto en la sincronizacion y la
-- caja la muestre sin internet.
ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen TEXT;
