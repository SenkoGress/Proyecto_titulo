// src/features/ventas/components/compartidos/TarjetasResumenVentas.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { formatoClp } from '@/shared/utils/formatoClp'
import type { ResumenVentas } from '@/features/ventas/utils/resumenVentas'

type Color = 'primary' | 'success' | 'warning' | 'info'

type Props = {
  resumen: ResumenVentas
  tecnico: boolean
}

function Tarjeta({
  titulo,
  valor,
  pie,
  color,
  ayuda,
}: {
  titulo: string
  valor: string
  pie: string
  color: Color
  ayuda: string
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderTop: 3, borderTopColor: `${color}.main` }}>
      <Tooltip title={ayuda}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, letterSpacing: 0.5, color: 'text.secondary', cursor: 'help' }}
        >
          {titulo.toUpperCase()}
        </Typography>
      </Tooltip>

      <Typography variant="h5" sx={{ fontWeight: 700, color: `${color}.main`, my: 0.5 }}>
        {valor}
      </Typography>

      <Typography variant="caption" color="text.secondary">
        {pie}
      </Typography>
    </Paper>
  )
}

// totales de lo que se esta viendo en pantalla
export function TarjetasResumenVentas({ resumen, tecnico }: Props) {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
      <Tarjeta
        titulo="Cobrado"
        valor={formatoClp(resumen.totalVendido)}
        pie={`${resumen.cantidadVentas} ${resumen.cantidadVentas === 1 ? 'venta' : 'ventas'} · ${resumen.unidades} unidades`}
        color="success"
        ayuda="Suma de las ventas que se estan viendo con el filtro actual"
      />

      <Tarjeta
        titulo="Devuelto"
        valor={formatoClp(resumen.totalDevuelto)}
        pie={`${resumen.cantidadDevoluciones} ${resumen.cantidadDevoluciones === 1 ? 'nota' : 'notas'} de credito`}
        color="warning"
        ayuda="Suma de las devoluciones, que el backend guarda con monto negativo"
      />

      <Tarjeta
        titulo={tecnico ? 'Neto del periodo' : 'Venta neta'}
        valor={formatoClp(resumen.neto)}
        pie="Cobrado menos devuelto"
        color="primary"
        ayuda="Lo cobrado descontando las devoluciones"
      />

      <Tarjeta
        titulo="Ticket promedio"
        valor={formatoClp(resumen.ticketPromedio)}
        pie={tecnico ? `${resumen.sinSincronizar} sin subir a la nube` : 'Por venta'}
        color="info"
        ayuda="Cuanto gasta en promedio cada cliente en lo que se esta viendo"
      />
    </Box>
  )
}
