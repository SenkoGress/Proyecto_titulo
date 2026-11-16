-- ============================================================================
-- Gestock SaaS Cloud Database Migration: 002_purchase_orders.sql
-- Ingesta Inteligente y Abastecimiento Predictivo
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Purchase_Orders (Órdenes de Compra Sugeridas y Emitidas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
    estado VARCHAR(30) NOT NULL DEFAULT 'sugerida' CHECK (estado IN ('sugerida', 'enviada', 'recibida', 'cancelada')),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_estimado NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_estado ON purchase_orders(tenant_id, estado);

-- ----------------------------------------------------------------------------
-- 2. Purchase_Order_Details (Detalle de Productos y Cantidades Sugeridas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_order_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad_sugerida NUMERIC(14, 2) NOT NULL,
    precio_unitario NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_details_order ON purchase_order_details(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_details_product ON purchase_order_details(product_id);
