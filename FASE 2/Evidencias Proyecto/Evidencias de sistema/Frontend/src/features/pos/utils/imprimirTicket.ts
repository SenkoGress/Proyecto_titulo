// src/features/pos/utils/imprimirTicket.ts
import { anchoPapelActual } from '@/shared/stores/papelStore'
import { reglaPagina, tamanoLetraPx } from '@/shared/utils/papelTermico'
import { imprimirDocumento } from '@/shared/utils/imprimirDocumento'

// imprime el ticket desde el navegador, en el rollo que tenga esta caja
export function imprimirTicket() {
  const ticket = document.getElementById('ticket-impreso')
  if (!ticket) return

  const ancho = anchoPapelActual()

  const html = `
    <html lang="es">
      <head>
        <title>Comprobante GesTock</title>
        <style>
          ${reglaPagina(ancho)}
          body { font-family: monospace; font-size: ${tamanoLetraPx(ancho)}px; margin: 0; color: #000; background: #fff; }
          img, svg { max-width: 100%; }
        </style>
      </head>
      <body>${ticket.innerHTML}</body>
    </html>
  `

  imprimirDocumento(html)
}
