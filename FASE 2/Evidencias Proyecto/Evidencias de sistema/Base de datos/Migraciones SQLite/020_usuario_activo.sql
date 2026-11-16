-- ============================================================================
-- Gestock Local POS Database Migration: 020_usuario_activo.sql
-- Un usuario con historial se desactiva en vez de borrarse
-- ============================================================================

-- Borrar a un cajero con ventas no es posible (transacciones_venta lo restringe) y borraria en
-- cascada sus cierres de caja, que son registro tributario. Desactivarlo le quita el acceso y
-- conserva quien hizo cada venta.
ALTER TABLE usuarios ADD COLUMN activo INTEGER NOT NULL DEFAULT 1;
