-- ============================================================================
-- Gestock POS Local SQLite Migration: 009_rutpay_gateway_support.sql
-- Habilitación de Pasarela RutPay (BancoEstado / CuentaRUT)
-- ============================================================================
INSERT OR IGNORE INTO metodos_pago (id, nombre, descripcion, activo, pasarela)
VALUES ('11111111-0000-0000-0000-000000000005', 'RutPay (BancoEstado / CuentaRUT)', 'Pago móvil y transferencias CuentaRUT', 1, 'RUTPAY');
