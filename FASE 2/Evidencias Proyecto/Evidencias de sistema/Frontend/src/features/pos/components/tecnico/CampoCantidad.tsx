// src/features/pos/components/tecnico/CampoCantidad.tsx
import { useState } from 'react'
import TextField from '@mui/material/TextField'
import { useCarritoStore, type LineaCarrito } from '@/features/pos/stores/carritoStore'
import { idCampoCantidad } from '@/features/pos/components/tecnico/ids'

type Props = {
  linea: LineaCarrito
}

// cantidad editable de una linea
export function CampoCantidad({ linea }: Props) {
  const fijarCantidad = useCarritoStore((estado) => estado.fijarCantidad)

  // null = no se esta editando
  const [texto, setTexto] = useState<string | null>(null)
  const valor = texto ?? String(linea.cantidad)

  // guardar cantidad (el store la deja entre 1 y el stock)
  function confirmar() {
    const numero = Number(texto)
    if (numero >= 1) fijarCantidad(linea.producto.id, numero)
    setTexto(null)
  }

  return (
    <TextField
      id={idCampoCantidad(linea.producto.id)}
      value={valor}
      size="small"
      onFocus={() => setTexto(String(linea.cantidad))}
      onChange={(evento) => setTexto(evento.target.value.replace(/\D/g, ''))}
      onBlur={confirmar}
      onKeyDown={(evento) => {
        if (evento.key === 'Enter') (evento.target as HTMLInputElement).blur()
      }}
      slotProps={{
        htmlInput: {
          inputMode: 'numeric',
          style: { textAlign: 'center', width: 44, fontWeight: 700, color: 'primary.main' },
        },
      }}
    />
  )
}
