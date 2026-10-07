// src/features/inventario/components/compartidos/AlertaSanitaria.tsx
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import type { ResumenVencimientos } from '@/features/inventario/types'

type Props = {
  resumen: ResumenVencimientos
  filtroActivo: boolean
  onVerEnRiesgo: () => void
}

// un conteo del encabezado, con su color segun la urgencia
function Conteo({ valor, texto, color }: { valor: number; texto: string; color: string }) {
  return (
    <Box component="span" sx={{ mr: 2 }}>
      <Box component="span" sx={{ fontWeight: 700, color }}>
        {valor}
      </Box>{' '}
      {texto}
    </Box>
  )
}

// aviso sanitario del D.S. 977/96 MINSAL: producto vencido no se puede tener a la venta
export function AlertaSanitaria({ resumen, filtroActivo, onVerEnRiesgo }: Props) {
  const hayRiesgo = resumen.total_en_riesgo > 0

  return (
    <Alert
      severity={resumen.vencidos > 0 ? 'error' : hayRiesgo ? 'warning' : 'success'}
      action={
        hayRiesgo ? (
          <Button color="inherit" size="small" onClick={onVerEnRiesgo}>
            {filtroActivo ? 'Ver todo el catalogo' : 'Ver productos en riesgo'}
          </Button>
        ) : undefined
      }
    >
      <AlertTitle sx={{ fontWeight: 700 }}>Alerta sanitaria de vencimientos (D.S. N° 977/96 MINSAL)</AlertTitle>

      {hayRiesgo ? (
        <Typography variant="body2">
          <Conteo valor={resumen.vencidos} texto="vencidos" color="error.main" />
          <Conteo valor={resumen.riesgo_critico_7d} texto="vencen en 7 dias o menos" color="warning.main" />
          <Conteo valor={resumen.riesgo_medio_15d} texto="vencen en 15 dias" color="warning.main" />
        </Typography>
      ) : (
        <Typography variant="body2">
          Ningun producto con fecha registrada esta vencido ni por vencer en los proximos 15 dias.
        </Typography>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {resumen.total_con_vencimiento} de los productos tienen fecha de vencimiento cargada. El sistema ordena por
        FEFO para apoyar el control, pero no retira el producto de la venta por su cuenta.
      </Typography>
    </Alert>
  )
}
