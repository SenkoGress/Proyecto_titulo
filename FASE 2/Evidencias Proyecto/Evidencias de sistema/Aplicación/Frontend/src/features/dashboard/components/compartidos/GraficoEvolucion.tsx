// src/features/dashboard/components/compartidos/GraficoEvolucion.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import { LineChart } from '@mui/x-charts/LineChart'
import ShowChartOutlined from '@mui/icons-material/ShowChartOutlined'
import { formatoClp, formatoClpCorto } from '@/shared/utils/formatoClp'
import {
  medioPreferido,
  puntoMasAlto,
  tituloPunto,
  tituloSerie,
  totalTransaccionesSerie,
} from '@/features/dashboard/utils/analisisVentas'
import type { MedioPagoDashboard, PeriodoDashboard, TimelineDashboard } from '@/features/dashboard/types'

type Props = {
  timeline: TimelineDashboard
  medios: MedioPagoDashboard[]
  totalVentas: number
  periodo: PeriodoDashboard
}

// una estadistica del pie del grafico
function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.3, color: 'text.secondary' }}>
        {titulo.toUpperCase()}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {valor}
      </Typography>
    </Box>
  )
}

// evolucion de las ventas del periodo
export function GraficoEvolucion({ timeline, medios, totalVentas, periodo }: Props) {
  const maximo = puntoMasAlto(timeline)
  const preferido = medioPreferido(medios)
  const tickets = totalTransaccionesSerie(timeline)

  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <ShowChartOutlined color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {tituloSerie(periodo)}
        </Typography>
      </Box>

      <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mt: 0.5 }}>
        {formatoClp(totalVentas)}
        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          acumulado
        </Typography>
      </Typography>

      {timeline.data.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>
          No hay ventas registradas en este periodo.
        </Typography>
      ) : (
        <LineChart
          height={280}
          xAxis={[{ data: timeline.labels, scaleType: 'point' }]}
          yAxis={[{ valueFormatter: (valor: number) => formatoClpCorto(valor) }]}
          series={[
            {
              data: timeline.data,
              area: true,
              showMark: true,
              curve: 'monotoneX',
              label: 'Ventas',
              valueFormatter: (valor) => formatoClp(valor ?? 0),
            },
          ]}
          margin={{ left: 55 }}
        />
      )}

      <Box sx={{ display: 'flex', gap: 2, mt: 'auto', pt: 1.5, flexWrap: 'wrap' }}>
        <Dato
          titulo={tituloPunto(periodo)}
          valor={maximo ? `${maximo.etiqueta} · ${formatoClp(maximo.monto)}` : 'Sin datos'}
        />
        <Divider orientation="vertical" flexItem />
        <Dato titulo="Tickets del periodo" valor={`${tickets} ventas`} />
        <Divider orientation="vertical" flexItem />
        <Dato
          titulo="Medio preferido"
          valor={preferido ? `${preferido.metodo} (${preferido.porcentaje}%)` : 'Sin datos'}
        />
      </Box>
    </Paper>
  )
}
