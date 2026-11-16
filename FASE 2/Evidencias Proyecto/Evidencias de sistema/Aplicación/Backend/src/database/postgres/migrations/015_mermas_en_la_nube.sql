-- ============================================================================
-- Gestock SaaS Cloud Database Migration: 015_mermas_en_la_nube.sql
-- La tabla de mermas nunca llego a las instalaciones ya creadas
-- ============================================================================

-- La tabla se agrego a 001_initial_schema.sql despues de que la base de la nube
-- ya tenia esa migracion registrada como aplicada, de modo que la sentencia
-- nunca se ejecuto y no habria forma de que se ejecutara: el migrador no vuelve
-- a correr un archivo registrado. El resultado era un espejo incompleto, con la
-- tabla presente en el terminal del local y ausente en la nube, por lo que las
-- mermas registradas en caja no tenian destino al sincronizar.

-- Se repite aqui con el mismo esquema que declara 001, para que una instalacion
-- nueva y una existente converjan al mismo estado.

CREATE TABLE IF NOT EXISTS mermas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    cantidad NUMERIC(14, 2) NOT NULL,
    motivo VARCHAR(100) NOT NULL,
    observaciones TEXT,
    usuario_id VARCHAR(100),
    fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mermas_tenant_producto ON mermas(tenant_id, producto_id);
