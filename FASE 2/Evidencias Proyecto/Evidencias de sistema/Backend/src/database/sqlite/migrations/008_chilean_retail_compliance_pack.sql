-- ============================================================================
-- Migration 008: Chilean Retail & Tax Compliance Pack
-- DS 977/96 MINSAL (Vencimientos), DL 825 (ILA), Ley 21.398 (Garantía/DTE 61),
-- Ley 21.131 (Guías 52) y Caja Integral (Ingresos/Egresos)
-- ============================================================================

-- 1. Agregar trazabilidad sanitaria (Lotes y Vencimientos) e Impuesto ILA a productos
ALTER TABLE productos ADD COLUMN lote TEXT;
ALTER TABLE productos ADD COLUMN fecha_vencimiento TEXT;
ALTER TABLE productos ADD COLUMN impuesto_adicional_codigo INTEGER DEFAULT 0;
ALTER TABLE productos ADD COLUMN impuesto_adicional_tasa REAL DEFAULT 0.00;

-- 2. Agregar campos para Notas de Crédito (DTE 61), Referencias e ILA a sii_dte_emitidos
ALTER TABLE sii_dte_emitidos ADD COLUMN referencia_tipo_dte INTEGER;
ALTER TABLE sii_dte_emitidos ADD COLUMN referencia_folio INTEGER;
ALTER TABLE sii_dte_emitidos ADD COLUMN referencia_fecha TEXT;
ALTER TABLE sii_dte_emitidos ADD COLUMN referencia_codigo INTEGER;
ALTER TABLE sii_dte_emitidos ADD COLUMN referencia_razon TEXT;
ALTER TABLE sii_dte_emitidos ADD COLUMN monto_ila REAL DEFAULT 0.00;

-- 3. Agregar campos en transacciones_venta para devoluciones e ILA
ALTER TABLE transacciones_venta ADD COLUMN monto_ila REAL DEFAULT 0.00;
ALTER TABLE transacciones_venta ADD COLUMN es_devolucion INTEGER DEFAULT 0;
ALTER TABLE transacciones_venta ADD COLUMN referencia_venta_id TEXT;

-- 4. Nueva tabla de movimientos de caja (Egresos por gastos menores / Ingresos por aportes)
CREATE TABLE IF NOT EXISTS caja_movimientos (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sesion_caja_id TEXT NOT NULL REFERENCES cierres_caja(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO')),
    monto REAL NOT NULL,
    motivo TEXT NOT NULL,
    usuario_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_caja_movimientos_sesion ON caja_movimientos(sesion_caja_id);
CREATE INDEX IF NOT EXISTS idx_caja_movimientos_tenant ON caja_movimientos(tenant_id);

-- 5. Nueva tabla de Guías de Despacho Electrónicas (DTE Tipo 52)
CREATE TABLE IF NOT EXISTS guias_despacho (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    folio INTEGER NOT NULL,
    fecha_emision TEXT NOT NULL,
    tipo_traslado INTEGER NOT NULL DEFAULT 5, -- 1: Constituye venta, 5: Traslado interno, 6: Otros
    receptor_rut TEXT NOT NULL,
    receptor_razon_social TEXT NOT NULL,
    direccion_destino TEXT NOT NULL,
    comuna_destino TEXT NOT NULL,
    chofer_rut TEXT,
    chofer_nombre TEXT,
    patente_vehiculo TEXT,
    total_items INTEGER NOT NULL DEFAULT 0,
    monto_total REAL NOT NULL DEFAULT 0.00,
    estado TEXT NOT NULL DEFAULT 'EMITIDA',
    dte_xml TEXT,
    ted_xml TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guias_despacho_tenant ON guias_despacho(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guias_despacho_folio ON guias_despacho(tenant_id, folio);
