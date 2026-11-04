-- ============================================================================
-- Gestock Local POS Database Migration: 018_envio_sii.sql
-- Origen del CAF y registro de los envios al SII
-- ============================================================================

-- Un CAF puede venir del SII o haberse provisionado localmente para operar sin folios
-- autorizados. La distincion decide si un documento puede enviarse: un folio que el SII nunca
-- autorizo no es enviable, y presentarlo como tal seria declarar valido lo que no lo es.
ALTER TABLE sii_caf ADD COLUMN origen TEXT NOT NULL DEFAULT 'PROVISIONAL';

CREATE TABLE IF NOT EXISTS sii_envios (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ambiente TEXT NOT NULL,
    documentos INTEGER NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'PREPARADO' CHECK (estado IN ('PREPARADO', 'ENVIADO', 'RECHAZADO')),
    track_id TEXT,
    motivo TEXT,
    sobre_xml TEXT NOT NULL,
    creado_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sii_envios_tenant ON sii_envios(tenant_id, creado_at);

-- Que envio llevo cada documento, para que el estado del documento y el del sobre no se
-- contradigan.
ALTER TABLE sii_dte_emitidos ADD COLUMN envio_id TEXT;
