// src/features/pos/hooks/useAtajosTeclado.ts
import { useEffect, useRef } from 'react'

export type AccionesAtajos = {
  ayuda: () => void // F1
  buscar: () => void // F2
  editarCantidad: () => void // F3
  cobrar: () => void // F4
  limpiar: () => void // ESC
  elegirMetodo: (indice: number) => void // teclas 1 a 5
}

// saber si el foco esta en un campo de texto
function estaEscribiendo(objetivo: EventTarget | null): boolean {
  return objetivo instanceof HTMLInputElement || objetivo instanceof HTMLTextAreaElement
}

// atajos de teclado de la caja
export function useAtajosTeclado(acciones: AccionesAtajos) {
  // guardar acciones sin volver a registrar el evento
  const accionesRef = useRef(acciones)

  useEffect(() => {
    accionesRef.current = acciones
  })

  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      const a = accionesRef.current
      const escribiendo = estaEscribiendo(evento.target)

      switch (evento.key) {
        case 'F1':
          evento.preventDefault()
          a.ayuda()
          return
        case 'F2':
          evento.preventDefault()
          a.buscar()
          return
        case 'F3':
          evento.preventDefault()
          a.editarCantidad()
          return
        case 'F4':
          evento.preventDefault()
          a.cobrar()
          return
        case 'Escape':
          // en un campo, esc solo sale del campo
          if (escribiendo) {
            ;(evento.target as HTMLElement).blur()
            return
          }
          a.limpiar()
          return
      }

      // medio de pago con 1 a 5
      if (!escribiendo && /^[1-5]$/.test(evento.key)) {
        a.elegirMetodo(Number(evento.key) - 1)
      }
    }

    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [])
}
