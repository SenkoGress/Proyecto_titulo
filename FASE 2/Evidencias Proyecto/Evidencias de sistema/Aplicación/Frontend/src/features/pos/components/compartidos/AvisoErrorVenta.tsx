// src/features/pos/components/compartidos/AvisoErrorVenta.tsx
import { useNavigate } from 'react-router'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import { obtenerMensajeError } from '@/lib/api/apiError'
import {
  cobroSinVenta,
  emisorSinRutValido,
  esTurnoCerrado,
  faltaStock,
  productosSinStock,
} from '@/features/pos/utils/errorVenta'

type Props = { error: unknown; onEmpezarDeNuevo?: () => void }

// el servidor manda un codigo con cada rechazo de la venta. Mostrar solo el texto deja al cajero
// sin la accion: donde abrir el turno, que linea corregir, o que no vuelva a cobrar
export function AvisoErrorVenta({ error, onEmpezarDeNuevo }: Props) {
  const navegar = useNavigate()

  if (!error) return null

  const faltantes = productosSinStock(error)

  if (esTurnoCerrado(error)) {
    return (
      <Alert severity="warning">
        <AlertTitle sx={{ fontWeight: 700 }}>La caja esta cerrada</AlertTitle>
        Para vender hay que abrir el turno declarando el fondo inicial de la gaveta.
        <Box sx={{ mt: 1 }}>
          <Button size="small" variant="contained" onClick={() => navegar('/caja/cierre')}>
            Abrir la caja
          </Button>
        </Box>
      </Alert>
    )
  }

  if (emisorSinRutValido(error)) {
    return (
      <Alert severity="error">
        <AlertTitle sx={{ fontWeight: 700 }}>No se puede emitir la boleta</AlertTitle>
        El RUT del local no es valido y va dentro de cada boleta. Avisa al administrador para que lo
        corrija en Configuracion: hasta entonces la caja no puede vender.
      </Alert>
    )
  }

  if (cobroSinVenta(error)) {
    return (
      <Alert severity="error">
        <AlertTitle sx={{ fontWeight: 700 }}>La tarjeta quedo cobrada y la venta no</AlertTitle>
        No vuelvas a cobrar: le cobrarias dos veces al cliente. Devuelve el dinero y avisa al
        administrador.
        {onEmpezarDeNuevo && (
          <Box sx={{ mt: 1 }}>
            <Button size="small" variant="contained" color="error" onClick={onEmpezarDeNuevo}>
              Entendido, empezar otra venta
            </Button>
          </Box>
        )}
      </Alert>
    )
  }

  if (faltantes.length > 0) {
    return (
      <Alert severity="warning">
        <AlertTitle sx={{ fontWeight: 700 }}>No alcanza el stock</AlertTitle>
        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
          {faltantes.map((producto) => (
            <li key={producto.producto_id}>{faltaStock(producto)}</li>
          ))}
        </Box>
        Baja la cantidad. Si en la gondola si hay, pide al administrador que corrija el stock en Inventario.
      </Alert>
    )
  }

  return <Alert severity="error">{obtenerMensajeError(error)}</Alert>
}
