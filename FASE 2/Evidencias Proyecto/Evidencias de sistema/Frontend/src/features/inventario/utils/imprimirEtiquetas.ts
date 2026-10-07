// src/features/inventario/utils/imprimirEtiquetas.ts

// imprime las etiquetas desde el navegador
export function imprimirEtiquetas() {
  const grilla = document.getElementById('etiquetas-gondola')
  if (!grilla) return

  const ventana = window.open('', '_blank', 'width=900,height=700')
  if (!ventana) return

  ventana.document.write(`
    <html lang="es">
      <head>
        <title>Etiquetas de gondola - GesTock</title>
        <style>
          @page { margin: 8mm; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            color: #000;
            background: #fff;
            display: flex;
            flex-wrap: wrap;
            gap: 6mm;
          }
          .etiqueta-gondola {
            width: 60mm;
            padding: 3mm;
            border: 1px dashed #999;
            border-radius: 2mm;
            break-inside: avoid;
          }
          svg { width: 100%; }
        </style>
      </head>
      <body>${grilla.innerHTML}</body>
    </html>
  `)

  ventana.document.close()
  ventana.focus()
  ventana.print()
  ventana.close()
}
