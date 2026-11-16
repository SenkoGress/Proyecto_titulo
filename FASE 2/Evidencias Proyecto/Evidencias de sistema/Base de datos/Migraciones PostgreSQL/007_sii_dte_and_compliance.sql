-- ============================================================================
-- Gestock PostgreSQL Cloud Migration: 007_sii_dte_and_compliance.sql
-- Cumplimiento SII (Ley 20.727, Res. 74, Res. 176, Res. 53) y Gestión CAF / TED / RCOF
-- ============================================================================

-- 1. Tabla de Archivos de Autorización de Folios (CAF)
CREATE TABLE IF NOT EXISTS sii_caf (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo_dte INTEGER NOT NULL,
    folio_desde INTEGER NOT NULL,
    folio_hasta INTEGER NOT NULL,
    ultimo_folio_usado INTEGER NOT NULL DEFAULT 0,
    fecha_autorizacion DATE NOT NULL,
    rsask_private_key TEXT NOT NULL,
    rsapk_public_key TEXT,
    caf_xml_content TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sii_caf_tenant_tipo ON sii_caf(tenant_id, tipo_dte, activo);

-- 2. Registro de Documentos Tributarios Electrónicos (DTE) Emitidos
CREATE TABLE IF NOT EXISTS sii_dte_emitidos (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    venta_id UUID REFERENCES transacciones_venta(id) ON DELETE SET NULL,
    tipo_dte INTEGER NOT NULL,
    folio INTEGER NOT NULL,
    fecha_emision TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rut_emisor VARCHAR(12) NOT NULL,
    razon_social_emisor VARCHAR(255) NOT NULL,
    rut_receptor VARCHAR(12) NOT NULL DEFAULT '66666666-6',
    razon_social_receptor VARCHAR(255) DEFAULT 'CLIENTE ANONIMO',
    monto_neto NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    monto_iva NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    monto_exento NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    monto_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ted_xml TEXT NOT NULL,
    dte_xml_completo TEXT NOT NULL,
    qr_code_content TEXT NOT NULL,
    estado_sii VARCHAR(20) NOT NULL DEFAULT 'EMITIDO_LOCAL' CHECK (estado_sii IN ('EMITIDO_LOCAL', 'ENVIADO_SII', 'ACEPTADO_SII', 'RECHAZADO_SII', 'ANULADO')),
    track_id_sii VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, tipo_dte, folio)
);

CREATE INDEX IF NOT EXISTS idx_sii_dte_tenant_tipo_folio ON sii_dte_emitidos(tenant_id, tipo_dte, folio);
CREATE INDEX IF NOT EXISTS idx_sii_dte_venta ON sii_dte_emitidos(venta_id);

-- 3. Registro de Consumo de Folios (RCOF / Registro Diario de Boletas SII)
CREATE TABLE IF NOT EXISTS sii_rcof_registros (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fecha_reporte DATE NOT NULL,
    secuencia_envio INTEGER NOT NULL DEFAULT 1,
    cantidad_boletas INTEGER NOT NULL DEFAULT 0,
    total_neto NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_iva NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_exento NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_ventas NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    rcof_xml_content TEXT NOT NULL,
    estado_envio VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado_envio IN ('PENDIENTE', 'ENVIADO_SII', 'ACEPTADO', 'RECHAZADO')),
    track_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sii_rcof_tenant_fecha ON sii_rcof_registros(tenant_id, fecha_reporte);

-- 4. Extensión de transacciones_venta
ALTER TABLE transacciones_venta ADD COLUMN IF NOT EXISTS tipo_documento_tributario VARCHAR(30) DEFAULT 'BOLETA_ELECTRONICA';
ALTER TABLE transacciones_venta ADD COLUMN IF NOT EXISTS dte_folio INTEGER;
ALTER TABLE transacciones_venta ADD COLUMN IF NOT EXISTS dte_id UUID;
