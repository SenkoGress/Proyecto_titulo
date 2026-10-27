# GesTock - Sistema Inteligente de Gestión de Inventarios & POS Offline-First
> **Repositorio Oficial de Título:** Portafolio de Evidencias de Ingeniería de Software (Metodología RUP)  
> **Proyecto:** GesTock — Plataforma Dual-Core Cloud SaaS & Terminal de Punto de Venta Autónomo

---

## 1. Descripción del Proyecto
**GesTock** es una solución integral de gestión comercial, inventario predictivo y punto de venta (POS) diseñada bajo una arquitectura híbrida **Dual-Core (Cloud SaaS Multi-Tenant y Edge Offline-First)**.

Está orientada al comercio minorista independiente chileno (minimarkets, almacenes de barrio, botillerías y ferreterías), mitigando tres problemáticas críticas de la industria:
1. **Continuidad Operativa ante Fallos de Conectividad:** Erradica las pérdidas de ventas causadas por cortes de internet o suministro eléctrico mediante almacenamiento local en el terminal POS (SQLite 3) y conmutación automática en **0 ms** (*Circuit Breaker*), sincronizando transacciones diferidas de forma asíncrona hacia la nube (*PostgreSQL 16*).
2. **Automatización de Ingestión de Mercadería:** Reemplaza la digitación manual de compras mediante escaneo inteligente de facturas electrónicas con IA multimodal (*Google Gemini AI Studio*), extrayendo ítems, costos netos, impuestos y calculando precios comerciales con margen de ganancia configurable y redondeo legal.
3. **Cumplimiento Tributario y Sanitario Chileno:** Automatiza la emisión de DTEs ante el SII (Boletas 39, Facturas 33, Guías 52, Notas de Crédito 61 con timbre fiscal `<TED>`), la aplicación estricta de la Ley de Redondeo en efectivo (Ley N° 20.956) y el semáforo de vencimientos sanitarios bajo el sistema FEFO (*D.S. 977/96 MINSAL*).

---

## 2. Tecnologías Utilizadas
| Capa / Dominio | Tecnologías y Librerías | Propósito en la Solución |
| :--- | :--- | :--- |
| **Backend API** | Node.js (v20+ LTS), Express.js 4, TypeScript 5.8 | Arquitectura modular desacoplada por casos de uso y middlewares de seguridad. |
| **Ciberseguridad** | `jsonwebtoken` (^9.0), `bcryptjs` (^3.0), `helmet`, CORS dinámico | Autenticación basada en tokens JWT (24h), hash de contraseñas con salt rounds 10 (60 caracteres), RBAC y sanitización SQL. |
| **Frontend SPA** | React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons | Interfaz de usuario táctil para punto de venta (POS), catálogo de inventarios, reportes de caja y recepción de mercadería. |
| **Persistencia Dual** | PostgreSQL 16+ (Cloud SaaS) & SQLite 3 (Edge POS) | Modelo dual de 29 tablas persistentes con integridad referencial estricta y banderas `is_dirty` para sincronización. |
| **Inteligencia Artificial** | Google Gemini AI Studio API (Flash / Vision) | Extracción OCR estructurada de facturas de compra y normalización de catálogos. |
| **Pasarelas de Pago** | Sandbox Transbank Webpay Plus, Mercado Pago, SumUp | Simulación de cobros con tarjeta y prevención de doble tributación (Res. Exenta N° 176). |
| **Testing Automatizado** | Jest 29, `ts-jest`, `pg-mem` | Batería de **297 pruebas automatizadas** en el servidor (213 unitarias y 84 de integración), más 52 de interfaz y 113 comprobaciones de extremo a extremo. |
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
│   │   │   ├── Backend/                   # Código fuente completo de la API REST (Express/TS)
│   │   │   └── Frontend/                  # Código fuente completo de la SPA POS (React 19/Vite)
│   │   └── Evidencias de documentación/
│   │       └── arquitectura_sistema.docx  # Documento de Arquitectura de Software (DAS 4+1)
│   ├── Evidencias Individuales/           # Diarios de reflexión (2.1) y autoevaluación (2.2)
│   └── Evidencias Grupales/
└── FASE 3/
    ├── Evidencias Grupales/               # (En preparación - Transición y Cierre)
    └── Evidencias Individuales/
```

> **Acceso a Diagramas UML:** Todos los diagramas de ingeniería de software se encuentran disponibles en la carpeta [`FASE 1/Diagramas`](./FASE%201/Diagramas).  
> **Documento de Arquitectura:** El DAS oficial se encuentra en [`FASE 2/Evidencias Proyecto/Evidencias de documentación/arquitectura_sistema.docx`](./FASE%202/Evidencias%20Proyecto/Evidencias%20de%20documentación/arquitectura_sistema.docx).

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

# Ejecutar las 84 pruebas de integración (15 suites)
npm test

# Ejecutar las 213 pruebas unitarias de algoritmos, RBAC y seguridad (16 suites)
npm run test:unit
```
*Resultado de la ultima corrida: **297 pruebas del servidor aprobadas**, sin fallas.*

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
| **Usuario Administrador** | `admin@gestock.cl` | Cuenta con rol de administración general (acceso total a dashboard, compras, inventario y personal) |
| **Contraseña Administrador** | `admin123` | Cifrada con Bcrypt work factor 10 (hash 60 caracteres) |
| **Usuario Cajero** | `cajero@gestock.cl` | Cuenta con rol operativo de cajero (acceso a terminal POS y arqueo de caja; bloqueado en dashboard) |
| **Contraseña Cajero** | `cajero123` | Cifrada con Bcrypt work factor 10 (hash 60 caracteres) |
| **Tenant ID de Prueba** | `00000000-0000-0000-0000-000000000001` | Comercio demo (*Almacén Don Tito*) |
| **API Key para Clientes Externos** | `gestock_sec_key_2026_x89` | Acceso a endpoints B2B en cabecera `X-API-Key` |

---

## 6. Integrantes del Equipo y Roles

| Integrante | Rol en el Proyecto | Responsabilidades Principales |
| :--- | :--- | :--- |
| **Pino, Marcelo** | Líder de Proyecto / Arquitectura & Backend Developer | Diseño de arquitectura Dual-Core, persistencia híbrida (PostgreSQL/SQLite), Circuit Breaker, seguridad JWT/Bcrypt, cumplimiento SII/DTE, testing y liderazgo técnico. |
| **Miranda, David** | Desarrollador Frontend / Diseñador UX-UI | Diseño de interfaces de usuario (Google Stitch), desarrollo de componentes visuales en React y experiencia de usuario en mostrador. |

---

## 7. Metodología de Trabajo (RUP)

El proyecto se desarrolla bajo el marco de **RUP (Rational Unified Process)**, con un enfoque iterativo e incremental orientado a la arquitectura y mitigación temprana de riesgos:

- **Incepción y Elaboración (Fase 1 - 20%):** Definición de la visión, justificación económica (*Business Case*), especificación de requisitos y diseño de la arquitectura base. Se elaboraron los artefactos UML (Casos de Uso, Clases, Componentes, Despliegue, Secuencia) y el modelo entidad-relación inicial.
- **Construcción (Fase 2 - 50%):** Implementación técnica modular del software. Desarrollo del Backend API con persistencia dual (29 tablas persistentes), autenticación criptográfica JWT/Bcrypt, interfaz React 19, integración de IA Gemini OCR para facturas, simulación de pasarelas de pago y acreditación de calidad mediante **297 pruebas automatizadas** del servidor y 113 comprobaciones de extremo a extremo.
- **Transición (Fase 3 - 30%):** Despliegue del MVP, pruebas de carga y estrés, documentación de usuario, manuales de instalación y preparación de la defensa de título ante la comisión evaluadora.

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
│  │              Circuit Breaker (0 ms) & Exponential Backoff             │  │
│  └───────────┬─────────────────────────────────────────────┬─────────────┘  │
│              │ Local (Latencia < 15ms)                     │ TCP Cloud      │
│              ▼                                             ▼                │
│  ┌─────────────────────────┐   Sincronización Asíncrona  ┌─────────────────┐│
│  │    SQLite 3 (Borde)     │ ◄─────────────────────────► │  PostgreSQL 16  ││
│  │  29 Tablas (is_dirty)   │       (Cola de eventos)     │  (Cloud SaaS)   ││
│  └─────────────────────────┘                             └─────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Capa Cloud SaaS (PostgreSQL 16):** Gestión centralizada multi-tenant, catálogos maestros, analítica de inventario y respaldo tributario formal.
2. **Capa Borde / POS Local (SQLite 3):** Persistencia espejo con integridad referencial estricta y banderas `is_dirty`, garantizando checkout en menos de 15 ms y cobro continuo sin internet.
3. **Circuit Breaker & Resiliencia:** Conmutación determinista en 0 ms ante fallos de conectividad hacia PostgreSQL Cloud, derivando inmediatamente a SQLite local sin bloquear al cajero.
4. **Seguridad y Cumplimiento Normativo:** Aislamiento multi-tenant por discriminador `tenant_id`, contraseñas con hash Bcrypt (60 caracteres), tokens JWT (24h), desglose de IVA (19%), Ley de Redondeo (Ley N° 20.956) y correlatividad DTE ante el SII.

---

### Sección de Innovación
- **¿Qué problema resuelve?** Erradica las pérdidas económicas y detenciones de caja en el comercio de barrio por cortes de internet, eliminando al mismo tiempo la digitación manual de facturas de proveedores y los descuadres de dinero.
- **¿Qué hace diferente a la solución?** La capacidad única de operar 100% offline sin pérdida de datos con conmutación en 0 ms, combinada con digitalización de facturas por IA multimodal (Gemini OCR) y adaptación nativa a las leyes chilenas (Redondeo, DTE, FEFO).
- **¿Qué valor agrega?** Asegura un 100% de disponibilidad operativa en caja, ahorra hasta un 80% del tiempo de ingreso de mercadería y previene sanciones tributarias y sanitarias para los comerciantes independientes.
