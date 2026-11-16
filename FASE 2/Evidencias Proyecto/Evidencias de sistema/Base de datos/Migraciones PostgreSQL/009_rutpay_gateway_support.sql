-- ============================================================================
-- Gestock SaaS Cloud Database Migration: 009_rutpay_gateway_support.sql
-- Habilitación de Pasarela RutPay (BancoEstado / CuentaRUT)
-- ============================================================================

DO $$
BEGIN
    ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_pasarela_check;
    ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_pasarela_check 
        CHECK (pasarela IN ('Transbank', 'MercadoPago', 'SumUp', 'RutPay', 'MockGateway'));

    ALTER TABLE metodos_pago DROP CONSTRAINT IF EXISTS metodos_pago_pasarela_check;
    ALTER TABLE metodos_pago ADD CONSTRAINT metodos_pago_pasarela_check 
        CHECK (pasarela IN ('EFECTIVO', 'TRANSBANK', 'MERCADOPAGO', 'SUMUP', 'RUTPAY', 'OTRO'));

    INSERT INTO metodos_pago (id, nombre, descripcion, activo, pasarela)
    VALUES ('11111111-0000-0000-0000-000000000005', 'RutPay (BancoEstado / CuentaRUT)', 'Pago móvil y transferencias CuentaRUT', true, 'RUTPAY')
    ON CONFLICT (id) DO NOTHING;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

