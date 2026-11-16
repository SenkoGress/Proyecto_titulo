// src/features/caja/utils/imprimirReporteZ.ts
import { anchoPapelActual } from '@/shared/stores/papelStore'
import { reglaPagina, tamanoLetraPx } from '@/shared/utils/papelTermico'
import { imprimirDocumento } from '@/shared/utils/imprimirDocumento'

// imprime el reporte del turno desde el navegador, en el rollo que tenga esta caja
export function imprimirReporteZ() {
  const reporte = document.getElementById('reporte-z')
  if (!reporte) return

  const ancho = anchoPapelActual()

  const html = `
    <html lang="es">
      <head>
        <title>Reporte Z - GesTock</title>
        <style>
          ${reglaPagina(ancho)}
          body { font-family: monospace; font-size: ${tamanoLetraPx(ancho)}px; margin: 0; color: #000; background: #fff; }
        </style>
      </head>
      <body>${reporte.innerHTML}</body>
    </html>
  `

  imprimirDocumento(html)
}
