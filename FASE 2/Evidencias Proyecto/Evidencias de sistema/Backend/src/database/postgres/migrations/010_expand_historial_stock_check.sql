-- Migración 010: Ampliar CHECK constraint de historial_stock en PostgreSQL para incluir 'alta_inicial', 'ajuste_manual' y 'merma'
DO $$
BEGIN
    ALTER TABLE historial_stock DROP CONSTRAINT IF EXISTS historial_stock_tipo_movimiento_check;
    ALTER TABLE historial_stock ADD CONSTRAINT historial_stock_tipo_movimiento_check 
        CHECK (tipo_movimiento IN ('venta', 'ingreso_factura', 'ajuste', 'alta_inicial', 'ajuste_manual', 'merma'));
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
