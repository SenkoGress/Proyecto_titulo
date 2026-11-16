-- ============================================================================
-- Gestock SQLite Local Mirror Migration: 007_sii_dte_and_compliance.sql
-- Cumplimiento SII (Ley 20.727, Res. 74, Res. 176, Res. 53) y Gestión CAF / TED / RCOF
-- ============================================================================

-- 1. Tabla de Archivos de Autorización de Folios (CAF) autorizados por el SII
CREATE TABLE IF NOT EXISTS sii_caf (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo_dte INTEGER NOT NULL, -- 39: Boleta Afecta, 41: Boleta Exenta, 61: Nota Crédito
    folio_desde INTEGER NOT NULL,
    folio_hasta INTEGER NOT NULL,
    ultimo_folio_usado INTEGER NOT NULL DEFAULT 0,
    fecha_autorizacion TEXT NOT NULL,
    rsask_private_key TEXT NOT NULL,
    rsapk_public_key TEXT,
    caf_xml_content TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sii_caf_tenant_tipo ON sii_caf(tenant_id, tipo_dte, activo);

-- 2. Registro de Documentos Tributarios Electrónicos (DTE) Emitidos
CREATE TABLE IF NOT EXISTS sii_dte_emitidos (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    venta_id TEXT REFERENCES transacciones_venta(id) ON DELETE SET NULL,
    tipo_dte INTEGER NOT NULL,
    folio INTEGER NOT NULL,
    fecha_emision TEXT NOT NULL DEFAULT (datetime('now')),
    rut_emisor TEXT NOT NULL,
    razon_social_emisor TEXT NOT NULL,
    rut_receptor TEXT NOT NULL DEFAULT '66666666-6',
    razon_social_receptor TEXT DEFAULT 'CLIENTE ANONIMO',
    monto_neto REAL NOT NULL DEFAULT 0.00,
    monto_iva REAL NOT NULL DEFAULT 0.00,
    monto_exento REAL NOT NULL DEFAULT 0.00,
    monto_total REAL NOT NULL DEFAULT 0.00,
    ted_xml TEXT NOT NULL,
    dte_xml_completo TEXT NOT NULL,
    qr_code_content TEXT NOT NULL,
    estado_sii TEXT NOT NULL DEFAULT 'EMITIDO_LOCAL' CHECK (estado_sii IN ('EMITIDO_LOCAL', 'ENVIADO_SII', 'ACEPTADO_SII', 'RECHAZADO_SII', 'ANULADO')),
    track_id_sii TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, tipo_dte, folio)
);

CREATE INDEX IF NOT EXISTS idx_sii_dte_tenant_tipo_folio ON sii_dte_emitidos(tenant_id, tipo_dte, folio);
CREATE INDEX IF NOT EXISTS idx_sii_dte_venta ON sii_dte_emitidos(venta_id);

-- 3. Registro de Consumo de Folios (RCOF / Registro Diario de Boletas SII)
CREATE TABLE IF NOT EXISTS sii_rcof_registros (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fecha_reporte TEXT NOT NULL,
    secuencia_envio INTEGER NOT NULL DEFAULT 1,
    cantidad_boletas INTEGER NOT NULL DEFAULT 0,
    total_neto REAL NOT NULL DEFAULT 0.00,
    total_iva REAL NOT NULL DEFAULT 0.00,
    total_exento REAL NOT NULL DEFAULT 0.00,
    total_ventas REAL NOT NULL DEFAULT 0.00,
    rcof_xml_content TEXT NOT NULL,
    estado_envio TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado_envio IN ('PENDIENTE', 'ENVIADO_SII', 'ACEPTADO', 'RECHAZADO')),
    track_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sii_rcof_tenant_fecha ON sii_rcof_registros(tenant_id, fecha_reporte);

-- 4. Extensión de transacciones_venta para soporte DTE y Modelo Res. 176
ALTER TABLE transacciones_venta ADD COLUMN tipo_documento_tributario TEXT DEFAULT 'BOLETA_ELECTRONICA';
ALTER TABLE transacciones_venta ADD COLUMN dte_folio INTEGER;
ALTER TABLE transacciones_venta ADD COLUMN dte_id TEXT;
