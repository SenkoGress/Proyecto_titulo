-- ============================================================================
-- Migration 008: Chilean Retail & Tax Compliance Pack
-- DS 977/96 MINSAL (Vencimientos), DL 825 (ILA), Ley 21.398 (Garantía/DTE 61),
-- Ley 21.131 (Guías 52) y Caja Integral (Ingresos/Egresos)
-- ============================================================================

-- 1. Agregar trazabilidad sanitaria (Lotes y Vencimientos) e Impuesto ILA a productos
ALTER TABLE productos ADD COLUMN IF NOT EXISTS lote VARCHAR(100);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS impuesto_adicional_codigo INTEGER DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS impuesto_adicional_tasa NUMERIC(5, 2) DEFAULT 0.00;

-- 2. Agregar campos para Notas de Crédito (DTE 61), Referencias e ILA a sii_dte_emitidos
ALTER TABLE sii_dte_emitidos ADD COLUMN IF NOT EXISTS referencia_tipo_dte INTEGER;
ALTER TABLE sii_dte_emitidos ADD COLUMN IF NOT EXISTS referencia_folio INTEGER;
ALTER TABLE sii_dte_emitidos ADD COLUMN IF NOT EXISTS referencia_fecha DATE;
ALTER TABLE sii_dte_emitidos ADD COLUMN IF NOT EXISTS referencia_codigo INTEGER;
ALTER TABLE sii_dte_emitidos ADD COLUMN IF NOT EXISTS referencia_razon VARCHAR(255);
ALTER TABLE sii_dte_emitidos ADD COLUMN IF NOT EXISTS monto_ila NUMERIC(12, 2) DEFAULT 0.00;

-- 3. Agregar campos en transacciones_venta para devoluciones e ILA
ALTER TABLE transacciones_venta ADD COLUMN IF NOT EXISTS monto_ila NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE transacciones_venta ADD COLUMN IF NOT EXISTS es_devolucion INTEGER DEFAULT 0;
ALTER TABLE transacciones_venta ADD COLUMN IF NOT EXISTS referencia_venta_id UUID;

-- 4. Nueva tabla de movimientos de caja (Egresos por gastos menores / Ingresos por aportes)
CREATE TABLE IF NOT EXISTS caja_movimientos (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sesion_caja_id UUID NOT NULL REFERENCES cierres_caja(id) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO')),
    monto NUMERIC(12, 2) NOT NULL,
    motivo VARCHAR(255) NOT NULL,
    usuario_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caja_movimientos_sesion ON caja_movimientos(sesion_caja_id);
CREATE INDEX IF NOT EXISTS idx_caja_movimientos_tenant ON caja_movimientos(tenant_id);

-- 5. Nueva tabla de Guías de Despacho Electrónicas (DTE Tipo 52)
CREATE TABLE IF NOT EXISTS guias_despacho (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    folio INTEGER NOT NULL,
    fecha_emision DATE NOT NULL,
    tipo_traslado INTEGER NOT NULL DEFAULT 5, -- 1: Constituye venta, 5: Traslado interno, 6: Otros
    receptor_rut VARCHAR(20) NOT NULL,
    receptor_razon_social VARCHAR(255) NOT NULL,
    direccion_destino VARCHAR(255) NOT NULL,
    comuna_destino VARCHAR(100) NOT NULL,
    chofer_rut VARCHAR(20),
    chofer_nombre VARCHAR(150),
    patente_vehiculo VARCHAR(20),
    total_items INTEGER NOT NULL DEFAULT 0,
    monto_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    estado VARCHAR(50) NOT NULL DEFAULT 'EMITIDA',
    dte_xml TEXT,
    ted_xml TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guias_despacho_tenant ON guias_despacho(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guias_despacho_folio ON guias_despacho(tenant_id, folio);
