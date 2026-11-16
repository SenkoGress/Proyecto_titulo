-- ============================================================================
-- Gestock Cloud Database Migration: 023_ila_tasa_y_modelo_emision.sql
-- Filas de azucar alta con la tasa de la analcoholica, y modelo de emision por defecto
-- ============================================================================

-- La 022 tradujo el codigo sin mirar la tasa. Una bebida que tenia el codigo de azucar alta con la
-- tasa del 10% quedo en 271 al 10%, que no existe: la tasa es la que se cobro, asi que manda ella.
UPDATE productos SET impuesto_adicional_codigo = 27
WHERE impuesto_adicional_codigo = 271 AND impuesto_adicional_tasa = 10;

-- MODELO_B solo es valido con el voucher de un operador autorizado (Res. Ex. SII 176/2020). El valor
-- venia de la siembra, no de una eleccion del comercio: pasa a MODELO_A, que siempre emite boleta.
UPDATE configuracion_sistema SET valor = 'MODELO_A'
WHERE clave = 'sii_modelo_emision' AND valor = 'MODELO_B';
