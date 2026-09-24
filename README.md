# GesTock - Sistema Inteligente de Gestión de Inventarios & POS Offline-First

## 1. Descripción del proyecto
GesTock es una solución integral de gestión comercial, inventario predictivo y punto de venta (POS) diseñada bajo una arquitectura híbrida **Dual-Core (Cloud SaaS Multi-Tenant y Offline-First)**.

Está dirigida al comercio minorista independiente chileno, tales como minimarkets, botillerías y almacenes de barrio. Resuelve tres problemas críticos del sector:
1. **Interrupción operativa por conectividad**: Evita la pérdida de ventas cuando se corta el internet o falla el suministro eléctrico, permitiendo cobros ininterrumpidos en caja mediante base de datos local y sincronización asíncrona posterior.
2. **Carga administrativa y fijación de precios**: Elimina el ingreso manual de mercadería mediante escaneo inteligente de facturas de compra (OCR con IA), actualizando costos, márgenes y precios de venta al instante.
3. **Complejidad tributaria y normativa chilena**: Automatiza el cumplimiento legal ante el SII (emisión de DTEs 39, 33, 52, 61 con timbre TED), la Ley de Redondeo en efectivo (Ley N° 20.956) y el semáforo de vencimientos sanitarios (D.S. 977/96 MINSAL).

## 2. Tecnologías utilizadas
- **Lenguajes:** TypeScript, JavaScript (Node.js v20+ LTS), SQL.
- **Frameworks:** Express.js 4 (Backend API modular), SPA Nativa (HTML5 / CSS3 / Vanilla JS reactivo con transición a React / Electron), Jest (Testing framework con 147 pruebas automatizadas).
- **Base de datos:** PostgreSQL 16+ (Nube Multi-Tenant transaccional) y SQLite 3 (Persistencia de borde local en terminales POS con integridad referencial estricta).
- **Cloud / Infraestructura:** Docker, Docker Compose, Helmet (Seguridad HTTP), Google Gemini AI API (Extracción OCR de facturas).

## 3. Instrucciones para ejecutar el proyecto localmente
```bash
# 1. Clonar el repositorio
git clone https://github.com/Kreiros/GesTock.git
cd GesTock

# 2. Variables de entorno (copiar el ejemplo y completar)
cp .env.example .env

# 3. Levantar el sistema con Docker
docker compose up --build
```

### Ejecución alternativa directa con Node.js:
```bash
# Instalar dependencias
npm install

# Ejecutar migraciones de base de datos
npm run migrate:pg
npm run migrate:sqlite

# Iniciar servidor en modo desarrollo
npm run dev

# Ejecutar batería de pruebas unitarias
npm run test:unit
```

### Parámetros de acceso y pruebas:
- **URL de la Aplicación / POS:** `http://localhost:3000/`
- **Puerto de la API:** `3000`
- **Sonda de Salud (Healthcheck):** `http://localhost:3000/health`
- **Catálogo de Servicios:** `http://localhost:3000/api`
- **Credenciales y contexto de prueba preconfigurado:**
  - **Caja:** Caja 01
  - **Operador:** Admin Demo
  - **Tenant ID de prueba:** `11111111-1111-1111-1111-111111111111`
  - **API Key externa:** `gestock_sec_key_2026_x89`

## 4. Integrantes del equipo y roles
| Integrante | Rol |
|---|---|
| Pino, Marcelo | Líder de Proyecto / Arquitectura de Software & Backend Developer |
| [Apellido, Nombre del Compañero] | Desarrollador Frontend / Diseñador UX-UI (Google Stitch & React) |

## 5. Metodología de trabajo
Se emplea un marco de trabajo ágil basado en **Scrum / Scrumban** apoyado en el repositorio de **GitHub** (Issues, Projects y Milestones) y herramientas de prototipado rápido como **Google Stitch**:
- **Sprints de 2 semanas:** Planificación, desarrollo modular y revisión de entregables.
- **Desacoplamiento Front/Back:** Definición previa de contratos de interfaz en Google Stitch y catálogo de 57 endpoints RESTful para permitir el desarrollo en paralelo sin bloqueos.
- **Integración Continua y Calidad (CI/QA):** Validación mediante suites de pruebas automatizadas antes de cada liberación hacia la rama `main`.

## 6. Arquitectura de la solución
La solución adopta un patrón **Dual-Core Híbrido Desacoplado**:
1. **Capa Cloud SaaS (PostgreSQL 16):** Gestión centralizada multi-tenant, conciliación de catálogos maestros, analítica de compras y respaldo tributario formal.
2. **Capa Borde / POS Local (SQLite 3):** Persistencia espejo en terminales de mostrador con banderas transaccionales (`is_dirty`), garantizando latencias menores a 15 ms en checkout y funcionamiento autónomo sin internet.
3. **Mecanismo de Resiliencia (Circuit Breaker):** Conmutación instantánea (0 ms) ante fallos de conectividad TCP hacia la nube, derivando consultas al almacenamiento local para evitar el congelamiento de la interfaz del cajero.
4. **Seguridad Perimetral:** CORS restrictivo dinámico, Rate Limiting granular, sanitización de identificadores multi-tenant contra SQL Injection y ofuscación de trazas de error en producción.

> El diagrama Entidad-Relación y los esquemas técnicos completos se encuentran disponibles en [`docs/diagrama_base_de_datos.svg`](./docs/diagrama_base_de_datos.svg) y [`docs/arquitectura_sistema.docx`](./docs/arquitectura_sistema.docx).

---
### Sección de innovación (documento de cierre)
- **¿Qué problema resuelve?** Erradica las pérdidas económicas y detenciones de atención en los comercios de barrio provocadas por inestabilidades de red o cortes de internet, eliminando al mismo tiempo la tediosa digitación manual de facturas y los errores de cuadratura de caja.
- **¿Qué hace diferente a la solución?** A diferencia de los POS web tradicionales que se bloquean al perder la conexión, GesTock conmuta automáticamente a su motor local SQLite en 0 ms. Además, incorpora inteligencia artificial multimodal (Gemini OCR) para digitalizar facturas de compra y un modelo nativo ajustado a la normativa tributaria chilena (redondeo Ley N° 20.956, bolsas reutilizables estandarizadas a $1.000 y DTEs con timbre TED).
- **¿Qué valor agrega?** Asegura un 100% de disponibilidad de venta en caja, ahorra hasta un 80% del tiempo administrativo en ingreso de mercadería, reduce el riesgo de multas del SII por omisión de boletas y minimiza las pérdidas por mermas gracias a su semáforo preventivo de vencimientos.
