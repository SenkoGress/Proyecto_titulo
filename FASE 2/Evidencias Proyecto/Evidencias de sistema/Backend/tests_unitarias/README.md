# 🧪 Batería de Pruebas Unitarias — GesTock

Esta carpeta contiene las suites de pruebas unitarias independientes y automatizadas de GesTock, estructuradas de forma modular y segregada por ámbito de responsabilidad (**Backend** y **Frontend**).

Está diseñada para ser transportable, auditable y ejecutable en CI/CD de forma aislada, sin requerir bases de datos externas activas ni conexión a la nube.

---

## 📁 Estructura Modular de Carpetas

```
tests_unitarias/
├── backend/                               # Pruebas Unitarias del Backend (Lógica de Servidor & Core)
│   ├── all_endpoints.unit.test.ts         # Cobertura de catálogo REST (57 pruebas)
│   ├── circuit_breaker.unit.test.ts       # Resiliencia Offline-First & Circuit Breaker (5 pruebas)
│   ├── dte_crypto_rules.unit.test.ts      # Facturación DTE, Timbre TED y Res. Ex. N° 176 (5 pruebas)
│   ├── pricing_and_rounding.unit.test.ts  # Ley de Redondeo N° 20.956, Margen e IVA (7 pruebas)
│   ├── replenishment_math.unit.test.ts    # Algoritmos predictivos ROP & Empaques (6 pruebas)
│   └── security_and_auth.unit.test.ts     # Bcrypt, JWT, RBAC Middleware & Tenant Sanitize (16 pruebas)
├── frontend/                              # Pruebas Unitarias de Reglas de Contrato Frontend
│   └── frontend_contract_rules.unit.test.ts # Módulo 11 SII, Arqueo, RutPay, Stock y Anti-Enumeración (11 pruebas)
├── jest.unit.config.js                    # Configuración centralizada de Jest para unitarias
└── README.md                              # Documentación técnica de la suite
```

---

## 📊 Matriz Detallada de Pruebas Unitarias

### 1. Módulo Backend (`tests_unitarias/backend/` — 96 Pruebas)

| Archivo | Dominio Evaluado | Descripción Técnica | Tests | Estado |
|---|---|---|:---:|:---:|
| `all_endpoints.unit.test.ts` | Catálogo Completo de Endpoints | Valida los endpoints REST con contratos de entrada, respuestas HTTP (200/201/400/404) y payloads válidos. | 57 | **100% PASS** |
| `security_and_auth.unit.test.ts` | Seguridad, Auth & Middleware | Valida generación de Bcrypt de 60 chars, firma/verificación JWT, RBAC por rol (admin vs cajero), sanitización de Tenant ID y manejo de errores. | 16 | **100% PASS** |
| `pricing_and_rounding.unit.test.ts` | Normativa Tributaria & Precios | Valida Ley de Redondeo Chilena N° 20.956 (redondeo a decena en efectivo), margen de ganancia comercial y desglose exacto de IVA (19%). | 7 | **100% PASS** |
| `replenishment_math.unit.test.ts` | Algoritmos Predictivos ROP | Valida cálculo de velocidad diaria de venta, punto de reorden (ROP = Demanda Lead Time + Stock Seguridad) y ajuste por bulto mínimo. | 6 | **100% PASS** |
| `circuit_breaker.unit.test.ts` | Resiliencia Offline-First | Valida estados CLOSED, OPEN y HALF_OPEN, tiempo de respuesta en falla (<2ms) y rechazo inmediato sin retardo de red. | 5 | **100% PASS** |
| `dte_crypto_rules.unit.test.ts` | Facturación Electrónica SII | Valida tipología DTE (33, 39, 41, 52, 61), prevención de doble tributación (Res. Ex. N° 176) y estructura XML del Timbre Electrónico (<TED>). | 5 | **100% PASS** |

### 2. Módulo Frontend (`tests_unitarias/frontend/` — 11 Pruebas)

| Archivo | Dominio Evaluado | Descripción Técnica | Tests | Estado |
|---|---|---|:---:|:---:|
| `frontend_contract_rules.unit.test.ts` | Reglas de Negocio & Contratos UI | Algoritmo Módulo 11 oficial del SII (76.123.456-0, DV numérico y K), fórmula matemática de arqueo de caja con RutPay aislado, trazabilidad continua de existencias (0->10->7->5), idempotencia en edición parcial (COALESCE), estructura de notas de crédito y anti-enumeración de usuarios en login (HTTP 401 unificado). | 11 | **100% PASS** |

**Total Consolidado:** **107 pruebas unitarias automatizadas (100% aprobadas).**

---

## 🚀 Comandos de Ejecución

Desde la raíz del proyecto GesTock:

```bash
# 1. Ejecutar TODAS las pruebas unitarias (Backend + Frontend, 107 tests)
npm run test:unit

# 2. Ejecutar EXCLUSIVAMENTE las pruebas unitarias del Backend (96 tests)
npm run test:unit:backend

# 3. Ejecutar EXCLUSIVAMENTE las pruebas unitarias del Frontend (11 tests)
npm run test:unit:frontend
```

---

## 🎯 Criterios de Aprobación
* **Tasa de Aprobación:** 100% de pruebas exitosas (107/107).
* **Velocidad de Ejecución:** Menor a 4.5 segundos en ejecución secuencial en banda (`--runInBand`).
* **Aislamiento e Independencia:** No requiere conexión externa a PostgreSQL Cloud ni servicios físicos; opera con SQLite simulado y Express en memoria.
