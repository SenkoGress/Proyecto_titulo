// src/features/caja/utils/imprimirReporteZ.ts
import { anchoPapelActual } from '@/shared/stores/papelStore'
import { reglaPagina, tamanoLetraPx } from '@/shared/utils/papelTermico'

// imprime el reporte del turno desde el navegador, en el rollo que tenga esta caja
export function imprimirReporteZ() {
  const reporte = document.getElementById('reporte-z')
  if (!reporte) return

  const ventana = window.open('', '_blank', 'width=400,height=700')
  if (!ventana) return

  const ancho = anchoPapelActual()

  ventana.document.write(`
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
  `)

  ventana.document.close()
  ventana.focus()
  ventana.print()
  ventana.close()
}
