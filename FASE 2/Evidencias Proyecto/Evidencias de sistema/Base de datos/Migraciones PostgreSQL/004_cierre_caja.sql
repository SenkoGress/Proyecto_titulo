-- ============================================================================
-- Gestock SaaS Cloud Database Migration: 004_cierre_caja.sql
-- Gestión de Sesiones, Arqueos y Cierres de Caja (Balance Z)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cierres_caja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_cierre TIMESTAMPTZ,
    monto_apertura NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    ventas_efectivo NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    ventas_transbank NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    ventas_mercadopago NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    ventas_sumup NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_ventas NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    monto_esperado_efectivo NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    monto_real_efectivo NUMERIC(14, 2),
    diferencia_efectivo NUMERIC(14, 2) DEFAULT 0.00,
    estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA', 'CERRADA')),
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cierres_caja_tenant ON cierres_caja(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cierres_caja_usuario ON cierres_caja(usuario_id);
CREATE INDEX IF NOT EXISTS idx_cierres_caja_estado ON cierres_caja(tenant_id, estado);
