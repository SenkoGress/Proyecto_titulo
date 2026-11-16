// src/features/dashboard/components/compartidos/GraficoMediosPago.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { PieChart } from '@mui/x-charts/PieChart'
import CreditCardOutlined from '@mui/icons-material/CreditCardOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import type { MedioPagoDashboard } from '@/features/dashboard/types'

type Props = {
  medios: MedioPagoDashboard[]
}

// reparto de las ventas por medio de pago
export function GraficoMediosPago({ medios }: Props) {
  const datos = medios.map((medio, indice) => ({
    id: indice,
    value: medio.total,
    label: medio.metodo,
  }))

  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
        <CreditCardOutlined color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Ventas por medio de pago
        </Typography>
      </Box>

      {datos.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>
          Sin ventas en este periodo.
        </Typography>
      ) : (
        <PieChart
          height={240}
          series={[
            {
              data: datos,
              innerRadius: 60,
              paddingAngle: 2,
              cornerRadius: 4,
              valueFormatter: (item) => formatoClp(item.value),
            },
          ]}
        />
      )}

      {/* el detalle en texto, que el grafico solo no alcanza a mostrar */}
      <Box sx={{ mt: 'auto', pt: 1 }}>
        {medios.map((medio) => (
          <Box key={medio.metodo} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.25 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {medio.metodo}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatoClp(medio.total)} · {medio.cantidad} tx · {medio.porcentaje}%
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  )
}
