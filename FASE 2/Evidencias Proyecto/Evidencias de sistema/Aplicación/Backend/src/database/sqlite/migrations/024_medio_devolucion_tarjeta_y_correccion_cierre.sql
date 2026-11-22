-- ============================================================================
-- Gestock Local POS Database Migration: 024_medio_devolucion_tarjeta_y_correccion_cierre.sql
-- Como se devolvio el dinero, credito o debito, y correccion del conteo de un cierre de caja
-- ============================================================================

-- TARJETA, EFECTIVO o TRANSFERENCIA en la venta de devolucion; nula en una venta normal y en las
-- devoluciones anteriores, que se clasifican como antes
ALTER TABLE transacciones_venta ADD COLUMN medio_devolucion TEXT;
-- CREDITO o DEBITO cuando se cobro con tarjeta
ALTER TABLE transacciones_venta ADD COLUMN tipo_tarjeta TEXT;

-- Lo devuelto por transferencia no sale de la gaveta ni de la tarjeta: el cierre lo guarda aparte
ALTER TABLE cierres_caja ADD COLUMN devoluciones_transferencia REAL DEFAULT 0;

-- La ultima correccion del conteo; el conteo y la diferencia originales no se modifican
ALTER TABLE cierres_caja ADD COLUMN monto_corregido_efectivo REAL;
ALTER TABLE cierres_caja ADD COLUMN diferencia_corregida REAL;
ALTER TABLE cierres_caja ADD COLUMN corregido_por TEXT;
ALTER TABLE cierres_caja ADD COLUMN corregido_at TEXT;

-- Rastro de las correcciones: solo se agrega. Sin llaves foraneas: en la nube el cierre o el usuario
-- pueden no estar todavia. El correlativo ordena, la fecha puede empatar dentro del mismo segundo.
CREATE TABLE IF NOT EXISTS correcciones_cierre_caja (
    id TEXT PRIMARY KEY,
    correlativo INTEGER NOT NULL,
    tenant_id TEXT NOT NULL,
    cierre_id TEXT NOT NULL,
    monto_anterior REAL NOT NULL,
    monto_nuevo REAL NOT NULL,
    motivo TEXT NOT NULL,
    usuario_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_correcciones_cierre ON correcciones_cierre_caja(cierre_id, correlativo);
