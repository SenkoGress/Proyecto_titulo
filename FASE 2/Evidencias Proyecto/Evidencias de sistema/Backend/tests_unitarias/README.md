# Bateria de Pruebas Unitarias - GesTock Backend

Esta carpeta contiene la suite exclusiva de pruebas unitarias independientes para el backend de GesTock.
Esta disenada para ser transportable, auditable y ejecutable de forma aislada sin requerir bases de datos externas activas.

---

## Contenido de la Carpeta

| Archivo | Modulo Evaluado | Descripcion | Tests |
|---|---|---|---|
| `all_endpoints.unit.test.ts` | Catalogo Completo de Endpoints | Valida los 57 endpoints REST de la API con respuestas HTTP esperadas, validaciones y contratos de datos. | 57 |
| `security_and_auth.unit.test.ts` | Seguridad & Middleware | Valida CORS, autenticacion por API Key, sanitizacion de Tenant ID contra SQL Injection y captura sanitizada de errores. | 7 |
| `circuit_breaker.unit.test.ts` | Resiliencia Offline-First | Valida estados CLOSED, OPEN y HALF_OPEN, tiempos de enfriamiento y discriminacion de fallos de red (<2ms). | 5 |
| `pricing_and_rounding.unit.test.ts` | Normativa Tributaria & Precios | Valida Ley N° 20.956 (redondeo de efectivo chileno), margen de ganancia comercial y desglose de IVA (19%). | 7 |
| `dte_crypto_rules.unit.test.ts` | Facturacion Electronica SII | Valida Timbre Electronico (TED con firma RSA-SHA1), correlatividad estricta de folios CAF y Res. Ex. N° 176. | 5 |
| `replenishment_math.unit.test.ts` | Abastecimiento Predictivo | Valida formulas de velocidad diaria de venta, punto de reorden (ROP), stock de seguridad y ajuste por empaques minimos. | 6 |
| `jest.unit.config.js` | Configuracion Jest | Runner aislado para la bateria unitaria. | - |

**Total de Pruebas Unitarias:** 87 pruebas automatizadas (100% aprobadas).

---

## Matriz de Cobertura por Modulo (57 Endpoints REST)

| Modulo / Dominio | N° Endpoints | Rango de Endpoints Evaluados | Cobertura | Estado |
|---|:---:|---|:---:|:---:|
| **Core & Sistema** | 2 | `GET /health`, `GET /api` | 100% | **PASSED** |
| **Caja & Balance Z** | 6 | `POST /caja/abrir`, `GET /caja/resumen`, `POST /caja/movimiento`, `GET /caja/movimientos`, `POST /caja/cerrar`, `GET /caja/historial` | 100% | **PASSED** |
| **Configuracion & Margen** | 4 | `GET /config/margin`, `POST /config/margin`, `GET /config/email`, `POST /config/email` | 100% | **PASSED** |
| **Dashboard Ejecutivo** | 1 | `GET /dashboard/overview` | 100% | **PASSED** |
| **Facturacion DTE / SII** | 16 | `GET /dte/config`, `POST /dte/config`, `GET /dte/caf/status`, `POST /dte/caf/upload`, `POST /dte/emit`, `GET /dte/list`, `GET /dte/:id/xml`, `GET /dte/:id/receipt`, `POST /dte/rcof/generate`, `GET /dte/rcof/list`, `POST /dte/certification/run-set`, `POST /dte/send-email`, `GET /dte/f29`, `POST /dte/guias/emitir`, `GET /dte/guias`, `GET /dte/backup/export` | 100% | **PASSED** |
| **Ingesta de Facturas OCR** | 4 | `POST /invoices/scan`, `POST /invoices/confirm`, `POST /invoices/ingest`, `GET /invoices/` | 100% | **PASSED** |
| **Tendencias de Demanda** | 3 | `POST /trends/sync`, `GET /trends/`, `GET /trends/:tenantId` | 100% | **PASSED** |
| **Pasarelas de Pago** | 3 | `POST /payments/initiate`, `POST /payments/confirm`, `GET /payments/sale/:saleId` | 100% | **PASSED** |
| **Punto de Venta (POS)** | 8 | `GET /pos/products`, `GET /pos/status`, `POST /pos/checkout`, `POST /pos/sync`, `GET /pos/inventory`, `GET /pos/vencimientos`, `GET /pos/transactions`, `POST /pos/devolucion` | 100% | **PASSED** |
| **Reabastecimiento ROP** | 5 | `GET /replenishment/velocity`, `GET /replenishment/suggest`, `POST /replenishment/suggest`, `POST /replenishment/send-email`, `GET /replenishment/purchase-orders` | 100% | **PASSED** |
| **Proveedores B2B** | 3 | `GET /suppliers/`, `POST /suppliers/`, `PUT /suppliers/:id` | 100% | **PASSED** |
| **Sincronizacion Nube** | 2 | `POST /sync/push`, `GET /sync/pull` | 100% | **PASSED** |
| **TOTAL CONSOLIDADO** | **57** | **100% de los endpoints evaluados en `all_endpoints.unit.test.ts`** | **100%** | **PASSED** |

---

## Instrucciones de Ejecucion

Desde la raiz del proyecto GesTock:

```bash
# Ejecutar todas las pruebas unitarias
npm run test:unit

# O directamente con Jest:
npx jest --config tests_unitarias/jest.unit.config.js
```

---

## Criterios de Aprobacion
* 100% de pruebas unitarias exitosas (87/87 tests).
* Cobertura de endpoints del 100% (57/57 endpoints REST probados).
* Tiempo de ejecucion inferior a 4 segundos.
* Aislamiento total: No requiere conexion externa a PostgreSQL Cloud ni hardware fisico (opera con Express en memoria y SQLite simulado).
