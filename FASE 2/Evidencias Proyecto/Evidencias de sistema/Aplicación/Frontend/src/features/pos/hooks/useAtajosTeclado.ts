// src/features/pos/hooks/useAtajosTeclado.ts
import { useEffect, useRef } from 'react'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'

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

// un lector de codigos teclea mucho mas rapido que una persona: dos digitos tan seguidos no son
// dos atajos, son un codigo entrando
const MS_ENTRE_DIGITOS_DEL_LECTOR = 60

// atajos de teclado de la caja
export function useAtajosTeclado(acciones: AccionesAtajos) {
  // guardar acciones sin volver a registrar el evento
  const accionesRef = useRef(acciones)
  const ultimoDigito = useRef(0)

  useEffect(() => {
    accionesRef.current = acciones
  })

  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      const carrito = useCarritoStore.getState()

      // con el aviso de producto vencido abierto, la caja espera la decision: nada de cobrar ni limpiar
      if (carrito.porConfirmarVencido) return

      // mientras la maquina responde el ticket esta congelado. Solo la ayuda sigue disponible:
      // Escape lo vaciaba a medio cobrar y las teclas 1 a 5 cambiaban el medio de pago
      if (carrito.cobrando && evento.key !== 'F1') return

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

      // Medio de pago con 1 a 5. Un codigo de barras tambien son digitos: si el lector dispara
      // con el foco fuera del buscador, cada digito del 1 al 5 cambiaba el medio de pago y el
      // Enter final apretaba el boton que tuviera el foco. Varios digitos seguidos son un codigo,
      // no cinco veces el atajo: ahi se devuelve el foco al buscador y el resto del codigo entra
      // donde corresponde
      if (!escribiendo && /^[0-9]$/.test(evento.key)) {
        const ahora = evento.timeStamp
        const seguido = ahora - ultimoDigito.current < MS_ENTRE_DIGITOS_DEL_LECTOR
        ultimoDigito.current = ahora

        if (seguido) {
          a.buscar()
          return
        }
        if (/^[1-5]$/.test(evento.key)) a.elegirMetodo(Number(evento.key) - 1)
      }
    }

    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [])
}
