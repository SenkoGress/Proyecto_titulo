-- ============================================================================
-- Gestock SaaS Cloud Database Migration: 018_envio_sii.sql
-- Origen del CAF y registro de los envios al SII
-- ============================================================================

-- Un CAF puede venir del SII o haberse provisionado localmente para operar sin folios
-- autorizados. La distincion decide si un documento puede enviarse: un folio que el SII nunca
-- autorizo no es enviable, y presentarlo como tal seria declarar valido lo que no lo es.
ALTER TABLE sii_caf ADD COLUMN IF NOT EXISTS origen VARCHAR(20) NOT NULL DEFAULT 'PROVISIONAL';

CREATE TABLE IF NOT EXISTS sii_envios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ambiente VARCHAR(40) NOT NULL,
    documentos INTEGER NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'PREPARADO',
    track_id VARCHAR(100),
    motivo TEXT,
    sobre_xml TEXT NOT NULL,
    creado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sii_envios_estado_valido CHECK (estado IN ('PREPARADO', 'ENVIADO', 'RECHAZADO'))
);

CREATE INDEX IF NOT EXISTS idx_sii_envios_tenant ON sii_envios(tenant_id, creado_at);

-- Que envio llevo cada documento, para que el estado del documento y el del sobre no se
-- contradigan.
ALTER TABLE sii_dte_emitidos ADD COLUMN IF NOT EXISTS envio_id UUID;
