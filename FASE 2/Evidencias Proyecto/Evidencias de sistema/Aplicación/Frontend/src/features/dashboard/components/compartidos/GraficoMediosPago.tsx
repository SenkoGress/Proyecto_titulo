// src/features/dashboard/components/compartidos/GraficoMediosPago.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { PieChart } from '@mui/x-charts/PieChart'
import CreditCardOutlined from '@mui/icons-material/CreditCardOutlined'
import Divider from '@mui/material/Divider'
import { formatoClp } from '@/shared/utils/formatoClp'
import { porcentajeDeLoCobrado, repartirMediosPago } from '@/features/dashboard/utils/mediosPago'
import type { MedioPagoDashboard } from '@/features/dashboard/types'

type Props = {
  medios: MedioPagoDashboard[]
}

// reparto de las ventas por medio de pago
export function GraficoMediosPago({ medios }: Props) {
  const { cobros, devoluciones, totalCobrado, totalDevuelto, neto } = repartirMediosPago(medios)

  const datos = cobros.map((medio, indice) => ({
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
        {totalDevuelto > 0 && (
          <Typography variant="caption" color="text.secondary">
            (lo cobrado)
          </Typography>
        )}
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
        {cobros.map((medio) => (
          <Box key={medio.metodo} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.25 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {medio.metodo}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatoClp(medio.total)} · {medio.cantidad} tx ·{' '}
              {porcentajeDeLoCobrado(medio.total, totalCobrado)}%
            </Typography>
          </Box>
        ))}

        {/* lo devuelto sale de la torta: es plata que salio, no una porcion de lo que entro */}
        {devoluciones.length > 0 && (
          <>
            <Divider sx={{ my: 0.75 }} />
            {devoluciones.map((medio) => (
              <Box
                key={medio.metodo}
                sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.25 }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Devuelto por {medio.metodo.toLowerCase()}
                </Typography>
                <Typography variant="body2" sx={{ color: 'error.main' }}>
                  −{formatoClp(Math.abs(medio.total))} · {medio.cantidad} tx
                </Typography>
              </Box>
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, pt: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Queda
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {formatoClp(neto)}
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </Paper>
  )
}
