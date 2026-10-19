-- ============================================================================
-- Gestock Local POS Database Migration: 015_mermas_en_la_nube.sql
-- Contraparte local de la correccion aplicada en la nube
-- ============================================================================

-- En el nodo local la tabla si existe desde 001, porque el espejo se creo
-- despues de que se agrego. La sentencia se repite para que la numeracion de
-- migraciones sea la misma en los dos motores y para que un nodo creado antes
-- de ese cambio converja igual que la nube.

CREATE TABLE IF NOT EXISTS mermas (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    cantidad REAL NOT NULL,
    motivo TEXT NOT NULL,
    observaciones TEXT,
    usuario_id TEXT,
    fecha TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mermas_tenant_producto ON mermas(tenant_id, producto_id);
