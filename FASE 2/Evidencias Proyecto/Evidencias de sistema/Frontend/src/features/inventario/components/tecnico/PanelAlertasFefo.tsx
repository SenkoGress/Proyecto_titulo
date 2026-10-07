// src/features/inventario/components/tecnico/PanelAlertasFefo.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import type { ResumenVencimientos } from '@/features/inventario/types'

type Props = {
  resumen: ResumenVencimientos
  totalProductos: number
}

type Color = 'error' | 'warning' | 'success' | 'text.secondary'

// una fila de la lista: punto de color + numero + etiqueta
function Fila({ color, valor, etiqueta }: { color: Color; valor: number; etiqueta: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75 }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: color === 'text.secondary' ? 'grey.400' : `${color}.main`,
          flexShrink: 0,
        }}
      />
      <Typography variant="body2" sx={{ flexGrow: 1 }}>
        {etiqueta}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, color: color === 'text.secondary' ? color : `${color}.main` }}>
        {valor}
      </Typography>
    </Box>
  )
}

// panel lateral compacto: alertas de vencimiento fefo (a un lado de la tabla principal)
export function PanelAlertasFefo({ resumen, totalProductos }: Props) {
  const sinRegistro = totalProductos - resumen.total_con_vencimiento
  const vigentesSinApuro =
    resumen.total_con_vencimiento - resumen.vencidos - resumen.riesgo_critico_7d - resumen.riesgo_medio_15d - resumen.vence_30_dias

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <EventBusyIcon color="action" fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Alertas de vencimiento (FEFO)
        </Typography>
      </Box>

      <Divider sx={{ my: 1 }} />

      <Fila color="error" valor={resumen.vencidos + resumen.riesgo_critico_7d} etiqueta="Vencidos + criticos (≤7d)" />
      <Fila color="warning" valor={resumen.riesgo_medio_15d} etiqueta="Alerta (8-15d)" />
      <Fila color="success" valor={resumen.vence_30_dias + vigentesSinApuro} etiqueta="Vence en 30d o mas" />
      <Fila color="text.secondary" valor={sinRegistro} etiqueta="Sin fecha registrada" />
    </Paper>
  )
}
