// src/features/caja/utils/imprimirReporteZ.ts

// imprime el reporte del turno desde el navegador, papel de 80mm
export function imprimirReporteZ() {
  const reporte = document.getElementById('reporte-z')
  if (!reporte) return

  const ventana = window.open('', '_blank', 'width=400,height=700')
  if (!ventana) return

  ventana.document.write(`
    <html lang="es">
      <head>
        <title>Reporte Z - GesTock</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          body { font-family: monospace; font-size: 12px; margin: 0; color: #000; background: #fff; }
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
