-- ============================================================================
-- Gestock SaaS Cloud Database Migration: 003_payments_and_market_trends.sql
-- Pasarelas y Factores de Mercado Externos
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Payment_Transactions (Transacciones con Pasarelas de Pago Externas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES transacciones_venta(id) ON DELETE CASCADE,
    pasarela VARCHAR(50) NOT NULL CHECK (pasarela IN ('Transbank', 'MercadoPago', 'SumUp', 'RutPay', 'MockGateway')),
    transaction_token VARCHAR(255) NOT NULL,
    monto NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    estado_transaccion VARCHAR(20) NOT NULL CHECK (estado_transaccion IN ('APPROVED', 'REJECTED', 'PENDING')),
    metadata_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_sale ON payment_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_token ON payment_transactions(transaction_token);

-- ----------------------------------------------------------------------------
-- 2. Market_Trends (Tendencias e Índices de Demanda Externa)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fuente_api VARCHAR(50) NOT NULL CHECK (fuente_api IN ('MercadoLibre', 'AliExpress')),
    sku_referencia VARCHAR(100) NOT NULL,
    palabra_clave VARCHAR(200) NOT NULL,
    indice_demanda NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    precio_promedio_mercado NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    ultima_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_market_trends_tenant_fuente_sku UNIQUE(tenant_id, fuente_api, sku_referencia)
);

CREATE INDEX IF NOT EXISTS idx_market_trends_tenant ON market_trends(tenant_id);
CREATE INDEX IF NOT EXISTS idx_market_trends_sku ON market_trends(tenant_id, sku_referencia);
