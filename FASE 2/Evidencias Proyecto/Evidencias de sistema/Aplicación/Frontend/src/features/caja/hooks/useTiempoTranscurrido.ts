// src/features/caja/hooks/useTiempoTranscurrido.ts
import { useEffect, useState } from 'react'

// cuanto tiempo lleva abierto el turno, formato "06h 32m"
export function useTiempoTranscurrido(fechaApertura: string): string {
  const [texto, setTexto] = useState('')

  useEffect(() => {
    function actualizar() {
      const inicio = new Date(fechaApertura).getTime()
      const minutos = Math.max(0, Math.floor((Date.now() - inicio) / 60000))
      const horas = Math.floor(minutos / 60)
      setTexto(`${String(horas).padStart(2, '0')}h ${String(minutos % 60).padStart(2, '0')}m`)
    }

    actualizar()
    const intervalo = setInterval(actualizar, 30_000)
    return () => clearInterval(intervalo)
  }, [fechaApertura])

  return texto
}
