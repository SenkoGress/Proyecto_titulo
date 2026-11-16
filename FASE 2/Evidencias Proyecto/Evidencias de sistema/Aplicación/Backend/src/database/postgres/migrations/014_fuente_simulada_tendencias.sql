-- ============================================================================
-- Gestock SaaS Cloud Database Migration: 014_fuente_simulada_tendencias.sql
-- El proveedor de contingencia debe poder declararse como tal
-- ============================================================================

-- El dato de contingencia se guardaba bajo la fuente externa solicitada, de modo
-- que una tendencia calculada por el sistema quedaba registrada como si la
-- hubiera entregado MercadoLibre. La restriccion se amplia para que la fuente
-- simulada sea un valor valido y el origen del dato quede trazable.

-- La tabla se reconstruye en vez de alterar la restriccion, porque una restriccion
-- declarada en linea recibe un nombre generado por el motor y ese nombre no es el
-- mismo en todos los entornos. Nadie referencia market_trends por clave foranea.

CREATE TABLE IF NOT EXISTS market_trends_nueva (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fuente_api VARCHAR(50) NOT NULL CHECK (fuente_api IN ('MercadoLibre', 'AliExpress', 'Simulado')),
    sku_referencia VARCHAR(100) NOT NULL,
    palabra_clave VARCHAR(200) NOT NULL,
    indice_demanda NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    precio_promedio_mercado NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    ultima_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_market_trends_nueva_tenant_fuente_sku UNIQUE(tenant_id, fuente_api, sku_referencia)
);

INSERT INTO market_trends_nueva
    (id, tenant_id, fuente_api, sku_referencia, palabra_clave,
     indice_demanda, precio_promedio_mercado, ultima_actualizacion, created_at)
SELECT id, tenant_id, fuente_api, sku_referencia, palabra_clave,
       indice_demanda, precio_promedio_mercado, ultima_actualizacion, created_at
FROM market_trends
ON CONFLICT DO NOTHING;

DROP TABLE market_trends;

ALTER TABLE market_trends_nueva RENAME TO market_trends;
