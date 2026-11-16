-- ============================================================================
-- Gestock SaaS Cloud Database Migration: 022_codigos_ila_sii.sql
-- Codigos de impuesto adicional segun la tabla del SII
-- ============================================================================

-- Los codigos de impuesto adicional pasan a los de la tabla del formato DTE del SII, que es lo
-- que viaja en CodImpAdic. La tabla anterior estaba corrida: el 25 se declaraba como vino, el 27
-- como bebida analcoholica y el 28, que el SII reserva al diesel, como licor.
--   antes 25 analcoholica 10%     ahora 27
--   antes 26 azucar alta 18%      ahora 271
--   antes 27 cervezas y vinos     ahora 26 cervezas, o 25 si el nombre dice vino
--   antes 28 licores 31.5%        ahora 24
-- Un solo UPDATE con CASE: cada fila se lee con su codigo anterior, sin encadenar cambios.
UPDATE productos SET impuesto_adicional_codigo = CASE
    WHEN impuesto_adicional_codigo = 25 THEN 27
    WHEN impuesto_adicional_codigo = 26 THEN 271
    WHEN impuesto_adicional_codigo = 27 AND LOWER(nombre) LIKE '%vino%' THEN 25
    WHEN impuesto_adicional_codigo = 27 THEN 26
    WHEN impuesto_adicional_codigo = 28 THEN 24
  END
WHERE impuesto_adicional_codigo IN (25, 26, 27, 28);
