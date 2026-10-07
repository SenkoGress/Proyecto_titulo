// src/features/caja/components/KpisBalanceTurno.tsx
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { formatoClp } from '@/shared/utils/formatoClp'
import type { SesionCaja } from '@/features/caja/types'

type Props = {
  sesion: SesionCaja
}

type Color = 'text.primary' | 'success.main' | 'info.main' | 'error.main' | 'primary.main'

// un numero grande del balance
function Kpi({
  etiqueta,
  monto,
  color,
  ayuda,
  destacado,
}: {
  etiqueta: string
  monto: number
  color: Color
  ayuda?: string
  destacado?: boolean
}) {
  const contenido = (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        height: '100%',
        borderWidth: destacado ? 2 : 1,
        borderColor: destacado ? 'primary.main' : 'divider',
      }}
    >
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, letterSpacing: 0.4, color: 'text.secondary', display: 'block' }}
      >
        {etiqueta.toUpperCase()}
      </Typography>

      <Typography variant="h5" sx={{ fontWeight: 700, color, mt: 0.5 }}>
        {formatoClp(monto)}
      </Typography>
    </Paper>
  )

  return ayuda ? <Tooltip title={ayuda}>{contenido}</Tooltip> : contenido
}

// balance en vivo del turno: de donde sale y como queda el efectivo en gaveta
export function KpisBalanceTurno({ sesion }: Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* la cadena del efectivo: apertura + ventas + aportes - egresos = gaveta */}
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' },
        }}
      >
        <Kpi etiqueta="Fondo apertura" monto={sesion.monto_apertura} color="text.primary" />
        <Kpi
          etiqueta="Ventas efectivo"
          monto={sesion.ventas_efectivo}
          color="success.main"
          ayuda="Solo efectivo. Las ventas electronicas van aparte"
        />
        <Kpi etiqueta="Aportes sencillo (+)" monto={sesion.total_ingresos_caja} color="info.main" />
        <Kpi etiqueta="Egresos / gastos (-)" monto={sesion.total_egresos_caja} color="error.main" />
        <Kpi
          etiqueta="Efectivo en gaveta (=)"
          monto={sesion.monto_esperado_efectivo}
          color="primary.main"
          ayuda="Lo que deberia haber en la gaveta segun el sistema"
          destacado
        />
      </Box>

      {/* medios de pago que no pasan por la gaveta */}
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
        <Kpi etiqueta="Transbank (tarjetas)" monto={sesion.ventas_transbank} color="text.primary" />
        <Kpi etiqueta="Mercado Pago" monto={sesion.ventas_mercadopago} color="text.primary" />
        <Kpi etiqueta="SumUp" monto={sesion.ventas_sumup} color="text.primary" />
      </Box>
    </Box>
  )
}
