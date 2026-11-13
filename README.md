# GesTock - Sistema Inteligente de Gestión de Inventarios & POS Offline-First
> **Repositorio Oficial de Título:** Portafolio de Evidencias de Ingeniería de Software (Metodología RUP)  
> **Proyecto:** GesTock — Plataforma Dual-Core Cloud SaaS & Terminal de Punto de Venta Autónomo

---

## 1. Descripción del Proyecto
**GesTock** es una solución integral de gestión comercial, inventario predictivo y punto de venta (POS) diseñada bajo una arquitectura híbrida **Dual-Core (Cloud SaaS Multi-Tenant y Edge Offline-First)**.

Está orientada al comercio minorista independiente chileno (minimarkets, almacenes de barrio, botillerías y ferreterías), mitigando tres problemáticas críticas de la industria:
1. **Continuidad Operativa ante Fallos de Conectividad:** Evita las ventas perdidas por cortes de internet: cada caja guarda sus operaciones en su propio equipo (SQLite), no espera a una nube caída gracias a un *Circuit Breaker*, y sube lo pendiente a la nube (*PostgreSQL 16*) al sincronizar.
2. **Automatización de Ingestión de Mercadería:** Reemplaza la digitación manual de compras mediante escaneo inteligente de facturas electrónicas con IA multimodal (*Google Gemini AI Studio*), extrayendo ítems, costos netos, impuestos y calculando precios comerciales con margen de ganancia configurable y redondeo legal.
3. **Cumplimiento Tributario y Sanitario Chileno:** Automatiza la emisión de DTEs ante el SII (Boletas 39, Facturas 33, Guías 52, Notas de Crédito 61 con timbre fiscal `<TED>`), la aplicación estricta de la Ley de Redondeo en efectivo (Ley N° 20.956) y el semáforo de vencimientos sanitarios bajo el sistema FEFO (*D.S. 977/96 MINSAL*).

---

## 2. Tecnologías Utilizadas
| Capa / Dominio | Tecnologías y Librerías | Propósito en la Solución |
| :--- | :--- | :--- |
| **Backend API** | Node.js 22.13 o superior (24 recomendado), Express.js 4, TypeScript 5.8 | Arquitectura modular desacoplada por casos de uso y middlewares de seguridad. |
| **Ciberseguridad** | `jsonwebtoken` (^9.0), `bcryptjs` (^3.0), `helmet`, CORS dinámico | Autenticación basada en tokens JWT (24h), hash de contraseñas con salt rounds 10 (60 caracteres), RBAC y sanitización SQL. |
| **Frontend SPA** | React 19, TypeScript, Vite 8, Material UI 9, React Router 8, Zustand, TanStack Query | Interfaz de punto de venta en modo visual y modo técnico, inventario, caja, recepción de mercadería y administración. |
| **Aplicación de escritorio** | Electron 44, electron-builder (instalador NSIS) | Programa instalable para Windows; los datos del local viven en una carpeta aparte que la reinstalación no toca. |
| **Persistencia Dual** | PostgreSQL 16 (nube) y SQLite mediante `node:sqlite` (caja) | Modelo dual de 29 tablas más la tabla de control `_migrations`, con integridad referencial y banderas `is_dirty` para la sincronización. |
| **Inteligencia Artificial** | Google Gemini AI Studio API (Flash / Vision) | Extracción OCR estructurada de facturas de compra y normalización de catálogos. |
| **Pasarelas de Pago** | Sandbox Transbank Webpay Plus, Mercado Pago, SumUp | Simulación de cobros con tarjeta y prevención de doble tributación (Res. Exenta N° 176). |
| **Testing Automatizado** | Jest 29, `ts-jest`, `pg-mem`, Vitest | Batería de **436 pruebas automatizadas** en el servidor (335 unitarias en 26 suites y 101 de integración en 16 suites, medidas el 12-11-2026 sobre `pg-mem` y sobre PostgreSQL real), 172 de interfaz en 22 archivos, más 118 comprobaciones de extremo a extremo y 7 escenarios de rendimiento con percentiles. |
| **DevOps & Despliegue** | Docker, Docker Compose, Git / GitHub | Empaquetado en contenedores y control de versiones centralizado. |

---

## 3. Estructura de Evidencias del Repositorio

El repositorio organiza las entregas y artefactos conforme a las fases del ciclo de vida RUP:

```text
Proyecto_titulo/
├── FASE 1/
│   ├── Diagramas/                         # Modelado UML completo de la arquitectura base
│   │   ├── diagrama de casos de uso.png
│   │   ├── diagrama de clases.png
│   │   ├── diagrama de componentes.png
│   │   ├── diagrama de comunicacion.png
│   │   ├── Diagrama de Despliegue.png
│   │   ├── diagrama de secuencia.png
│   │   ├── logica.png
│   │   └── modelo_relacional.png
│   ├── Evidencias Grupales/               # Guías de definición de proyecto (1.5)
│   └── Evidencias Individuales/           # Diarios de reflexión y autoevaluación Fase 1
├── FASE 2/
│   ├── Evidencias Proyecto/
│   │   ├── Evidencias de sistema/
│   │   │   ├── Backend/                   # Código fuente y pruebas de la API REST (Express/TS)
│   │   │   ├── Frontend/                  # Código fuente y pruebas de la interfaz (React 19/Vite)
│   │   │   ├── Escritorio/                # Proceso principal de la aplicación Electron
│   │   │   ├── Semillas/                  # Catálogo de demostración
│   │   │   ├── Dockerfile
│   │   │   └── docker-compose.yml
│   │   └── Evidencias de documentación/
│   │       ├── Arquitectura Sistema.docx  # Documento de Arquitectura de Software (DAS 4+1)
│   │       ├── Manual De Funcionalidades.docx
│   │       ├── Plan De Pruebas.docx       # y el resto de los documentos formales
│   │       ├── Diagramas/                 # Diagrama entidad-relación completo y general
│   │       └── Pruebas Unitarias/         # Scripts de prueba del backend y de la interfaz
│   ├── Evidencias Individuales/           # Diarios de reflexión (2.1) y autoevaluación (2.2)
│   └── Evidencias Grupales/
└── FASE 3/
    ├── Evidencias Grupales/               # (En preparación - Transición y Cierre)
    └── Evidencias Individuales/
```

> **Acceso a Diagramas UML:** Todos los diagramas de ingeniería de software se encuentran disponibles en la carpeta [`FASE 1/Diagramas`](./FASE%201/Diagramas).  
> **Documento de Arquitectura:** El DAS oficial se encuentra en [`FASE 2/Evidencias Proyecto/Evidencias de documentación/Arquitectura Sistema.docx`](./FASE%202/Evidencias%20Proyecto/Evidencias%20de%20documentaci%C3%B3n/Arquitectura%20Sistema.docx).
> **Modelo de Datos:** El diagrama entidad-relación está en [`FASE 2/Evidencias Proyecto/Evidencias de documentación/Diagramas`](./FASE%202/Evidencias%20Proyecto/Evidencias%20de%20documentaci%C3%B3n/Diagramas).

---

## 4. Instrucciones para Ejecutar el Proyecto Localmente

### Opción A: Ejecución desde este Repositorio (`Proyecto_titulo`)

#### 1. Backend API (Servidor Express & Base de Datos)
```bash
# 1. Navegar al directorio del Backend
cd "FASE 2/Evidencias Proyecto/Evidencias de sistema/Backend"

# 2. Configurar variables de entorno
cp .env.example .env

# 3. Instalar dependencias
npm install

# 4. Iniciar el servidor en modo desarrollo (compilación TS en memoria)
npm run dev
```
*El servidor arrancará en `http://localhost:3000` e inicializará automáticamente el motor local SQLite con la siembra de datos demo.*

#### 2. Frontend SPA (Punto de Venta React 19)
```bash
# 1. En una nueva terminal, navegar al directorio del Frontend
cd "FASE 2/Evidencias Proyecto/Evidencias de sistema/Frontend"

# 2. Configurar variables de entorno
cp .env.example .env

# 3. Instalar dependencias
npm install

# 4. Iniciar el servidor de desarrollo Vite
npm run dev
```
*La interfaz gráfica interactiva quedará disponible en `http://localhost:5173`.*

#### 3. Ejecución de Pruebas Automatizadas
```bash
cd "FASE 2/Evidencias Proyecto/Evidencias de sistema/Backend"

# Ejecutar las 101 pruebas de integración (16 suites) sobre pg-mem
npm test

# Ejecutar las 335 pruebas unitarias de algoritmos, RBAC y seguridad (26 suites)
npm run test:unit
```
*Resultado de la última corrida, el 12-11-2026: **436 pruebas del servidor aprobadas**, sin fallas.*

Para correr la integración contra un PostgreSQL real, con el contenedor levantado, se define `USE_REAL_PG=true`. Las pruebas usan su propia base, `gestock_test_db`, que se crea sola: nunca escriben en la base de la nube.

---

### Opción B: Ejecución desde el Repositorio de Desarrollo (`GesTock`)

Si se desea clonar y ejecutar el repositorio de trabajo continuo con soporte Docker:
```bash
# 1. Clonar el repositorio
git clone https://github.com/Kreiros/GesTock.git
cd GesTock

# 2. Variables de entorno
cp .env.example .env

# 3. Levantar entorno completo con Docker Compose (PostgreSQL + Backend API)
docker compose up --build
```

---

## 5. Parámetros de Acceso y Credenciales de Prueba

| Parámetro | Valor Preconfigurado / Endpoint | Descripción |
| :--- | :--- | :--- |
| **Frontend SPA (Vite)** | `http://localhost:5173/` | Interfaz gráfica moderna (React 19 + POS táctil) |
| **Backend API / POS Directo** | `http://localhost:3000/` | Servidor REST y vista directa de caja |
| **Sonda de Salud (Healthcheck)** | `http://localhost:3000/health` | Estado del Circuit Breaker, SQLite y Postgres |
| **Catálogo de Servicios API** | `http://localhost:3000/api` | Lista de endpoints expuestos |
| **Usuario Administrador** | `admin@gestock.cl` | Cuenta de prueba con rol de administración general, solo fuera de producción |
| **Contraseña Administrador** | `admin123` | Cifrada con Bcrypt work factor 10 (hash 60 caracteres) |
| **Usuario Cajero** | `cajero@gestock.cl` | Cuenta de prueba con rol de cajero (caja, cierre de caja, inventario, ventas y notificaciones), solo fuera de producción |
| **Contraseña Cajero** | `cajero123` | Cifrada con Bcrypt work factor 10 (hash 60 caracteres) |
| **Tenant ID de Prueba** | `00000000-0000-0000-0000-000000000001` | Comercio demo (*Almacén Don Tito*) |
| **Clave para integraciones** | Variable `API_KEY` (opcional) | Si se define, toda petición con cabecera `X-API-Key` debe traer ese valor |
| **Producción** | Sin cuentas de prueba | La aplicación de escritorio crea el administrador en el primer inicio |

---

## 6. Integrantes del Equipo y Roles

| Integrante | Rol en el Proyecto | Responsabilidades Principales |
| :--- | :--- | :--- |
| **Pino, Marcelo** | Líder de Proyecto / Arquitectura & Backend Developer | Diseño de arquitectura Dual-Core, persistencia híbrida (PostgreSQL/SQLite), Circuit Breaker, seguridad JWT/Bcrypt, cumplimiento SII/DTE, testing y liderazgo técnico. |
| **Miranda, David** | Desarrollador Frontend / Diseñador UX-UI | Diseño de interfaces, SPA en React con modo visual y técnico, experiencia de usuario en mostrador, pruebas de interfaz y de extremo a extremo. |

---

## 7. Metodología de Trabajo (RUP)

El proyecto se desarrolla bajo el marco de **RUP (Rational Unified Process)**, con un enfoque iterativo e incremental orientado a la arquitectura y mitigación temprana de riesgos:

- **Incepción y Elaboración (Fase 1 - 20%):** Definición de la visión, justificación económica (*Business Case*), especificación de requisitos y diseño de la arquitectura base. Se elaboraron los artefactos UML (Casos de Uso, Clases, Componentes, Despliegue, Secuencia) y el modelo entidad-relación inicial.
- **Construcción (Fase 2 - 50%):** Implementación técnica modular del software. Desarrollo del Backend API con persistencia dual (29 tablas persistentes), autenticación criptográfica JWT/Bcrypt, interfaz React 19, integración de IA Gemini OCR para facturas, simulación de pasarelas de pago y acreditación de calidad mediante **436 pruebas automatizadas** del servidor, 172 de interfaz, 118 comprobaciones de extremo a extremo y 7 escenarios de rendimiento con percentiles.
- **Transición (Fase 3 - 30%):** Despliegue del MVP, ejecución del plan de pruebas y de las pruebas de rendimiento, documentación de usuario, manuales de instalación y preparación de la defensa de título ante la comisión evaluadora.

---

## 8. Arquitectura de la Solución

La solución adopta el patrón arquitectónico **Dual-Core Híbrido Desacoplado**:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ARQUITECTURA DUAL-CORE GESTOCK                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [ TERMINAL DE VENTA / BORDE ]               [ NUBE SAAS CENTRALIZADA ]     │
│  ┌─────────────────────────┐                 ┌───────────────────────────┐  │
│  │    React 19 SPA POS     │                 │   Panel Administrativo    │  │
│  │   (:5173 / Localhost)   │                 │   Multi-Tenant Cloud      │  │
│  └───────────┬─────────────┘                 └─────────────┬─────────────┘  │
│              │ HTTP REST                                   │ HTTP REST      │
│              ▼                                             ▼                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     API REST BACKEND (Express / TS)                   │  │
│  │              Circuit Breaker & Exponential Backoff                    │  │
│  └───────────┬─────────────────────────────────────────────┬─────────────┘  │
│              │ Local, sin esperar a la nube                │ TCP Cloud      │
│              ▼                                             ▼                │
│  ┌─────────────────────────┐   Sincronización al pedirla ┌─────────────────┐│
│  │    SQLite 3 (Borde)     │ ◄─────────────────────────► │  PostgreSQL 16  ││
│  │  29 Tablas (is_dirty)   │  (ventas, catálogo, fotos)  │  (Cloud SaaS)   ││
│  └─────────────────────────┘                             └─────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Capa Cloud SaaS (PostgreSQL 16):** Gestión centralizada multi-tenant, catálogos maestros, analítica de inventario y respaldo tributario formal.
2. **Capa Borde / POS Local (SQLite):** Persistencia espejo con integridad referencial y banderas `is_dirty`, que permite cobrar sin internet. La venta se resuelve en el servidor local con una mediana de 4 ms (batería de rendimiento del 07-11-2026); con la base en un disco de estado sólido, el percentil 95 queda entre 5 y 8 ms, dentro de la referencia de 15 ms. En un disco mecánico cada confirmación de escritura espera el giro del disco y la venta sube a 400 ms, por lo que el disco de estado sólido se declara como requisito de hardware de la caja.
3. **Circuit Breaker & Resiliencia:** Cuando la nube no responde, el *Circuit Breaker* deja de consultarla por un periodo y responde de inmediato que no está disponible, de modo que la caja sigue en SQLite sin esperar un tiempo de espera de red.
4. **Seguridad y Cumplimiento Normativo:** Aislamiento multi-tenant por discriminador `tenant_id` en cada consulta, con el comercio de la sesión aplicado aunque la petición no lo declare, contraseñas con hash Bcrypt (60 caracteres), tokens JWT (24h), desglose de IVA (19%), Ley de Redondeo (Ley N° 20.956) y correlatividad DTE ante el SII.

---

### Sección de Innovación
- **¿Qué problema resuelve?** Erradica las pérdidas económicas y detenciones de caja en el comercio de barrio por cortes de internet, eliminando al mismo tiempo la digitación manual de facturas de proveedores y los descuadres de dinero.
- **¿Qué hace diferente a la solución?** Vender sin internet sin perder ventas, junto con el ingreso de facturas por IA multimodal (Gemini), el alta de productos por código de barras con Open Food Facts y la adaptación a las leyes chilenas (redondeo, DTE, FEFO).
- **¿Qué valor agrega?** Mantiene la caja operando aunque se caiga internet, reduce la digitación de facturas de proveedores y ayuda a cumplir las obligaciones tributarias y sanitarias del comercio independiente. El detalle de lo implementado y verificado está en `Innovacion.docx`.
