-- ============================================================================
-- Gestock SQLite Local Mirror Migration: 006_proveedores_y_multiprecio.sql
-- Datos detallados de Proveedores y Relación Producto-Proveedor con Historial de Precios
-- ============================================================================

ALTER TABLE proveedores ADD COLUMN giro TEXT;
ALTER TABLE proveedores ADD COLUMN direccion TEXT;
ALTER TABLE proveedores ADD COLUMN telefono TEXT;

CREATE TABLE IF NOT EXISTS producto_proveedores (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    producto_id TEXT NOT NULL,
    proveedor_id TEXT NOT NULL,
    ultimo_precio_compra REAL NOT NULL,
    fecha_ultima_compra TEXT NOT NULL DEFAULT (datetime('now')),
    folio_ultima_factura TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, producto_id, proveedor_id)
);

CREATE INDEX IF NOT EXISTS idx_prod_prov_prod ON producto_proveedores(tenant_id, producto_id);
CREATE INDEX IF NOT EXISTS idx_prod_prov_prov ON producto_proveedores(tenant_id, proveedor_id);
