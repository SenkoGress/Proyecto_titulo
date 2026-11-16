# Base de datos

Evidencias del almacenamiento de datos de GesTock. El sistema usa persistencia dual: SQLite en el
terminal del local, para vender sin conexión, y PostgreSQL en la nube.

| Carpeta | Contenido |
|---|---|
| `Migraciones SQLite/` | Las 23 migraciones versionadas que crean y actualizan el esquema del terminal. |
| `Migraciones PostgreSQL/` | Las 23 migraciones equivalentes para la nube. |
| `Diagramas/` | Diagramas entidad-relación, general y completo, en imagen y en su fuente Mermaid. |
| `Semillas/` | Catálogo de demostración de 25 productos con que se presenta el sistema. |

Las migraciones se aplican en orden al iniciar la aplicación y quedan registradas en la tabla
`_migrations`, de modo que una instalación existente se actualiza sin perder datos. El código que las
aplica está en `../Aplicación/Backend/src/database/`, que conserva su propia copia de estos archivos
porque la aplicación los necesita para ejecutarse.

El contenedor de PostgreSQL se levanta con `../Aplicación/docker-compose.yml`.
