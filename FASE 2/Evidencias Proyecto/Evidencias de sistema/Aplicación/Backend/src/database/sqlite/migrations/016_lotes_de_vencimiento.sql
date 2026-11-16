-- ============================================================================
-- Gestock Local POS Database Migration: 016_lotes_de_vencimiento.sql
-- Existencia por lote en el nodo local, que es donde se consume el stock
-- ============================================================================

CREATE TABLE IF NOT EXISTS lotes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    codigo_lote TEXT,
    cantidad REAL NOT NULL CHECK (cantidad >= 0),
    fecha_vencimiento TEXT NOT NULL,
    factura_origen_folio TEXT,
    origen TEXT NOT NULL DEFAULT 'INGESTA',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lotes_fefo ON lotes(tenant_id, producto_id, fecha_vencimiento);

-- Traspaso del estado actual: cada producto con fecha y con existencia aporta un lote
-- inicial por todo su stock. Es una aproximacion declarada, porque el detalle por lote
-- de lo comprado antes de esta migracion no quedo registrado en ninguna parte. El
-- identificador se deriva del producto para que reaplicar la migracion no duplique.
INSERT OR IGNORE INTO lotes (id, tenant_id, producto_id, codigo_lote, cantidad, fecha_vencimiento, origen)
SELECT 'traspaso-' || p.id, p.tenant_id, p.id, p.lote, p.stock_actual, p.fecha_vencimiento, 'TRASPASO_INICIAL'
FROM productos p
WHERE p.fecha_vencimiento IS NOT NULL
  AND p.stock_actual > 0
  AND p.activo = 1;
