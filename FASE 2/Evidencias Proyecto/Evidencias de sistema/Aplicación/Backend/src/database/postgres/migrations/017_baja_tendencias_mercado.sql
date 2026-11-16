-- ============================================================================
-- Gestock SaaS Cloud Database Migration: 017_baja_tendencias_mercado.sql
-- Retiro de la tabla de tendencias de mercado
-- ============================================================================

-- Los proveedores que alimentaban esta tabla no consultaban ningun servicio externo: derivaban
-- el indice de demanda y el precio de referencia del largo del nombre del producto, y el panel
-- presentaba el resultado al usuario como si proviniera de un mercado real. El modulo se retiro
-- del servidor y la interfaz lo reemplazo por sugerencias calculadas sobre las ventas del local.
-- La tabla se da de baja porque su contenido solo puede inducir a error: cada fila declara una
-- fuente externa que nunca entrego ese dato.

DROP TABLE IF EXISTS market_trends;
