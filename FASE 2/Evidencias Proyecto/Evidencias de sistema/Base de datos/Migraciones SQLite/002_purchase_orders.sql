-- ============================================================================
-- Gestock Local POS Database Migration: 002_purchase_orders.sql
-- Ingesta Inteligente y Abastecimiento Predictivo Mirror
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Purchase_Orders (Órdenes de Compra Sugeridas y Emitidas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id TEXT NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
    estado TEXT NOT NULL DEFAULT 'sugerida' CHECK (estado IN ('sugerida', 'enviada', 'recibida', 'cancelada')),
    fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
    total_estimado REAL NOT NULL DEFAULT 0.00,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_estado ON purchase_orders(tenant_id, estado);

-- ----------------------------------------------------------------------------
-- 2. Purchase_Order_Details (Detalle de Productos y Cantidades Sugeridas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_order_details (
    id TEXT PRIMARY KEY,
    purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad_sugerida REAL NOT NULL,
    precio_unitario REAL NOT NULL DEFAULT 0.00,
    subtotal REAL NOT NULL DEFAULT 0.00,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_po_details_order ON purchase_order_details(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_details_product ON purchase_order_details(product_id);
