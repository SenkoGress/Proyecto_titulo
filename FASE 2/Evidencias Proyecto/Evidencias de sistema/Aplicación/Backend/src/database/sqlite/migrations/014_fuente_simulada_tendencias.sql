-- ============================================================================
-- Gestock Local POS Database Migration: 014_fuente_simulada_tendencias.sql
-- El proveedor de contingencia debe poder declararse como tal
-- ============================================================================

-- SQLite no permite modificar una restriccion CHECK, de modo que la tabla se
-- reconstruye con la fuente simulada admitida y los datos se trasladan.

CREATE TABLE IF NOT EXISTS market_trends_nueva (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fuente_api TEXT NOT NULL CHECK (fuente_api IN ('MercadoLibre', 'AliExpress', 'Simulado')),
    sku_referencia TEXT NOT NULL,
    palabra_clave TEXT NOT NULL,
    indice_demanda REAL NOT NULL DEFAULT 0.00,
    precio_promedio_mercado REAL NOT NULL DEFAULT 0.00,
    ultima_actualizacion TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, fuente_api, sku_referencia)
);

INSERT OR IGNORE INTO market_trends_nueva
    (id, tenant_id, fuente_api, sku_referencia, palabra_clave,
     indice_demanda, precio_promedio_mercado, ultima_actualizacion, created_at)
SELECT id, tenant_id, fuente_api, sku_referencia, palabra_clave,
       indice_demanda, precio_promedio_mercado, ultima_actualizacion, created_at
FROM market_trends;

DROP TABLE market_trends;

ALTER TABLE market_trends_nueva RENAME TO market_trends;
