-- ============================================================================
-- Gestock PostgreSQL Cloud Migration: 006_proveedores_y_multiprecio.sql
-- Datos detallados de Proveedores y Relación Producto-Proveedor con Historial de Precios
-- ============================================================================

ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS giro VARCHAR(255);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS direccion VARCHAR(255);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS telefono VARCHAR(50);

CREATE TABLE IF NOT EXISTS producto_proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    ultimo_precio_compra NUMERIC(12, 2) NOT NULL,
    fecha_ultima_compra TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    folio_ultima_factura VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, producto_id, proveedor_id)
);

CREATE INDEX IF NOT EXISTS idx_prod_prov_prod ON producto_proveedores(tenant_id, producto_id);
CREATE INDEX IF NOT EXISTS idx_prod_prov_prov ON producto_proveedores(tenant_id, proveedor_id);
