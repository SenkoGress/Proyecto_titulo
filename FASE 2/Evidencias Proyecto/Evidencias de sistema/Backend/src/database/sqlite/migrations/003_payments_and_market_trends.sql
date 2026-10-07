-- ============================================================================
-- Gestock Local POS Database Migration: 003_payments_and_market_trends.sql
-- Pasarelas y Factores de Mercado Externos Mirror
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Payment_Transactions (Transacciones con Pasarelas de Pago Externas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_transactions (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES transacciones_venta(id) ON DELETE CASCADE,
    pasarela TEXT NOT NULL CHECK (pasarela IN ('Transbank', 'MercadoPago', 'SumUp', 'RutPay', 'MockGateway')),
    transaction_token TEXT NOT NULL,
    monto REAL NOT NULL DEFAULT 0.00,
    estado_transaccion TEXT NOT NULL CHECK (estado_transaccion IN ('APPROVED', 'REJECTED', 'PENDING')),
    metadata_response TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_sale ON payment_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_token ON payment_transactions(transaction_token);

-- ----------------------------------------------------------------------------
-- 2. Market_Trends (Tendencias e Índices de Demanda Externa)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_trends (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fuente_api TEXT NOT NULL CHECK (fuente_api IN ('MercadoLibre', 'AliExpress')),
    sku_referencia TEXT NOT NULL,
    palabra_clave TEXT NOT NULL,
    indice_demanda REAL NOT NULL DEFAULT 0.00,
    precio_promedio_mercado REAL NOT NULL DEFAULT 0.00,
    ultima_actualizacion TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, fuente_api, sku_referencia)
);

CREATE INDEX IF NOT EXISTS idx_market_trends_tenant ON market_trends(tenant_id);
CREATE INDEX IF NOT EXISTS idx_market_trends_sku ON market_trends(tenant_id, sku_referencia);
