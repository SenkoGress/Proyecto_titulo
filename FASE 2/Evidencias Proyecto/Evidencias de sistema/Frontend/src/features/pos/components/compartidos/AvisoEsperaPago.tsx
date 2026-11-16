// src/features/pos/components/compartidos/AvisoEsperaPago.tsx
import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import { avisoEspera, esperaEnMaquina, type AccionEnMaquina } from '@/features/pos/utils/esperaPago'

type Props = {
  metodoPago: string
  accion?: AccionEnMaquina
}

// mientras la maquina cobra o devuelve, el cajero solo veia el boton cargando: con un terminal de
// verdad eso puede durar minutos y no se sabe si el sistema respondio o se colgo.
// Se monta solo mientras dura la espera, asi el reloj parte de cero sin tener que reiniciarlo.
export function AvisoEsperaPago({ metodoPago, accion = 'COBRO' }: Props) {
  const [segundos, setSegundos] = useState(0)

  useEffect(() => {
    const reloj = setInterval(() => setSegundos((previo) => previo + 1), 1000)
    return () => clearInterval(reloj)
  }, [])

  if (!esperaEnMaquina(metodoPago)) return null

  return (
    <Alert severity="info" sx={{ alignItems: 'center' }}>
      {avisoEspera(metodoPago, segundos, accion)}
    </Alert>
  )
}
