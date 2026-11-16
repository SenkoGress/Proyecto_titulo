# Pruebas de endpoints — GesTock

Batería automatizada que golpea el backend de verdad y revisa lo que responde.
No usa datos simulados: si el servidor no está arriba, las pruebas no corren.

## Cómo correrlas

Primero el backend, en otra terminal y desde la raíz del proyecto:

```bash
npm run dev
```

Y después, también desde la raíz:

```bash
npm run test:e2e:frontend
```

Para correr solo un grupo, se le pasa parte del nombre del archivo:

```bash
npm run test:e2e:frontend productos
npm run test:e2e:frontend 10
```

No hay que instalar nada. Usa el `fetch` que ya trae Node.

## Qué se prueba

| Archivo | Cubre |
|---|---|
| `01-sistema.mjs` | `/api`, `/health` y el estado de la caja |
| `02-inventario.mjs` | Catálogo y semáforo de vencimientos |
| `03-productos.mjs` | Alta, edición, ajuste de stock, merma e historial |
| `04-caja.mjs` | Resumen del turno, medios de pago y fórmula del arqueo |
| `05-ventas.mjs` | Historial, devoluciones y documentos emitidos |
| `06-reabastecimiento.mjs` | Punto de reorden |
| `07-facturas-ocr.mjs` | Lectura de facturas con OCR |
| `08-sii.mjs` | Folios CAF, F29, RCOF y guías |
| `09-autenticacion.mjs` | Login, usuarios y permisos |
| `10-permisos-cajero.mjs` | Lo que el cajero puede y no puede hacer |

## Lo que no se prueba, y por qué

Algunas cosas quedan marcadas como **SALTA** a propósito:

- **Confirmar la ingesta de una factura.** Crearía productos de verdad en el
  inventario. Se prueba a mano desde la pantalla.
- **El set de certificación del SII.** Emite documentos reales y consume folios.
- **La comprobación de que sin token no se entra.** En desarrollo el backend deja
  pasar a propósito, así que esa sola queda saltada. Con `ENFORCE_AUTH=true` o con
  `NODE_ENV=production` sí se exige y la prueba corre.

Una prueba saltada no cuenta como falla, pero queda registrada en el reporte.

## Limpieza

Las pruebas de producto crean un artículo con SKU `PRUEBA-########`. Al terminar
lo desactivan, que es lo máximo que permite la API porque no existe un endpoint
para borrar productos.

Para sacarlos de la base del todo, desde esta carpeta:

```bash
node limpiar.mjs
```

Ese script sí entra directo a SQLite, por eso está separado de las pruebas.

## Reportes

Cada corrida deja un archivo en `reportes/` con la fecha, el resultado de cada
comprobación y el total. Sirve como evidencia para la Fase 2.

## Variables de entorno

| Variable | Para qué | Por defecto |
|---|---|---|
| `GESTOCK_URL` | Dirección del backend | `http://localhost:3000` |
| `GESTOCK_TENANT` | Local sobre el que se prueba | el tenant demo |
| `GESTOCK_DEVICE` | Identificador de la caja | `PRUEBAS-AUTOMATICAS` |
| `GESTOCK_ADMIN_EMAIL` | Correo del admin | `admin@gestock.cl` |
| `GESTOCK_ADMIN_PASSWORD` | Clave del admin | `admin123` |
| `GESTOCK_CAJERO_EMAIL` | Correo del cajero | `cajero@gestock.cl` |
| `GESTOCK_CAJERO_PASSWORD` | Clave del cajero | `cajero123` |
| `GESTOCK_SQLITE` | Ruta de la base, solo para `limpiar.mjs` | la del proyecto |

En producción no existen las cuentas de ejemplo, así que ahí hay que pasar las
credenciales de verdad por variable de entorno.
