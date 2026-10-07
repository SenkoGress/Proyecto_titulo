// src/features/pos/utils/imprimirTicket.ts

// imprime el ticket desde el navegador, papel de 80mm
export function imprimirTicket() {
  const ticket = document.getElementById('ticket-impreso')
  if (!ticket) return

  const ventana = window.open('', '_blank', 'width=400,height=700')
  if (!ventana) return

  ventana.document.write(`
    <html lang="es">
      <head>
        <title>Comprobante GesTock</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          body { font-family: monospace; font-size: 12px; margin: 0; color: #000; background: #fff; }
          img, svg { max-width: 100%; }
        </style>
      </head>
      <body>${ticket.innerHTML}</body>
    </html>
  `)

  ventana.document.close()
  ventana.focus()
  ventana.print()
  ventana.close()
}
