# Pruebas de rendimiento

Mide el desempeño del backend bajo carga fija y deja el informe escrito en `reportes/`.

```bash
npm run dev              # en una consola: el backend que se va a medir
npm run test:rendimiento # en otra: la carga
```

## Qué mide y qué no

Cada escenario declara el requisito no funcional al que responde y su desempeño de referencia
(`docs/ARQUITECTURA_SISTEMA.md`, sección 3.1). Se informa p50, p95, p99, máximo y operaciones por
segundo, y el p95 se compara con la referencia.

Lo que se assertea es distinto de lo que se mide. Un umbral de milisegundos dentro de una prueba
verifica la máquina que la corre, no el código: la batería funcional tenía ocho aserciones así y una
fallaba en el equipo de un integrante y pasaba en el del otro sobre el mismo código. Aquí la corrida
falla solo por un error de la operación o por un máximo sobre el tope de regresión de 10 segundos,
que no mide desempeño sino que detecta algo colgado. Un escenario marcado `SOBRE` queda registrado
en el informe para explicarlo, no para dar la corrida por fallada.

Las 20 primeras llamadas se descartan: miden la compilación en caliente y el primer llenado de
caché, no el sistema en régimen.

## La venta transaccional

El escenario de `POST /pos/checkout` registra ventas reales y descuenta existencias, así que está
apagado por omisión. Para medirlo, contra una base desechable:

```bash
cp data/gestock_local_pos.sqlite /tmp/rendimiento.sqlite
SQLITE_DB_PATH=/tmp/rendimiento.sqlite npm run dev
GESTOCK_REND_ESCRITURA=true npm run test:rendimiento
```

## Variables

| Variable | Omisión | Para qué |
|---|---|---|
| `GESTOCK_URL` | `http://localhost:3000` | backend a medir |
| `GESTOCK_TENANT` | tenant de demostración | comercio sobre el que se mide |
| `GESTOCK_REND_ESCRITURA` | `false` | habilita el escenario de venta |
| `SQLITE_DB_PATH` | `data/gestock_local_pos.sqlite` | base que se consulta para medir el índice |

## Lo que queda fuera

El tiempo de respuesta de la API en la nube (RNF-REND-03 sobre PostgreSQL) necesita el contenedor
levantado: sin él, los escenarios de lectura miden el camino local sobre SQLite, que es el que
atiende el mostrador. La emisión criptográfica de documentos (RNF-REND-04) no se mide todavía,
porque exige folios CAF cargados.
