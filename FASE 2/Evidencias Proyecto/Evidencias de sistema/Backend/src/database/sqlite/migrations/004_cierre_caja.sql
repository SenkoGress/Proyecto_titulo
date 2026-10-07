-- ============================================================================
-- Gestock SQLite Local Mirror Migration: 004_cierre_caja.sql
-- Gestión Local de Sesiones, Arqueos y Cierres de Caja (Balance Z)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cierres_caja (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_apertura TEXT NOT NULL DEFAULT (datetime('now')),
    fecha_cierre TEXT,
    monto_apertura REAL NOT NULL DEFAULT 0.00,
    ventas_efectivo REAL NOT NULL DEFAULT 0.00,
    ventas_transbank REAL NOT NULL DEFAULT 0.00,
    ventas_mercadopago REAL NOT NULL DEFAULT 0.00,
    ventas_sumup REAL NOT NULL DEFAULT 0.00,
    total_ventas REAL NOT NULL DEFAULT 0.00,
    monto_esperado_efectivo REAL NOT NULL DEFAULT 0.00,
    monto_real_efectivo REAL,
    diferencia_efectivo REAL DEFAULT 0.00,
    estado TEXT NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA', 'CERRADA')),
    observaciones TEXT,
    is_dirty INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED', 'FAILED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cierres_caja_tenant ON cierres_caja(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cierres_caja_usuario ON cierres_caja(usuario_id);
CREATE INDEX IF NOT EXISTS idx_cierres_caja_estado ON cierres_caja(tenant_id, estado);
