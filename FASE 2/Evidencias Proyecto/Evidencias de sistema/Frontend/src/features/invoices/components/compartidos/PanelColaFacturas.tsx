// src/features/invoices/components/compartidos/PanelColaFacturas.tsx
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import { usePendientes, useProcesarPendientes } from '@/features/invoices/hooks/useInvoices'
import { formatFecha } from '@/shared/utils/formatFecha'
import type { FacturaEnCola } from '@/features/invoices/types'

// facturas guardadas que todavia no se pudieron leer
export function PanelColaFacturas() {
  const cola = usePendientes()
  const procesar = useProcesarPendientes()

  const lista = cola.data?.data ?? []
  if (lista.length === 0) return null

  const esperando = lista.filter((f) => f.estado === 'PENDIENTE_OCR')
  const rendidas = lista.filter((f) => f.estado === 'FALLIDA_OCR')

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 1.5 }}>
        <ScheduleOutlined color="info" />

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Facturas guardadas sin leer
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {esperando.length} esperando otro intento
            {rendidas.length > 0 && `, ${rendidas.length} hay que ingresarlas a mano`}
          </Typography>
        </Box>

        <Button
          variant="outlined"
          onClick={() => procesar.mutate()}
          disabled={esperando.length === 0 || procesar.isPending}
        >
          {procesar.isPending ? 'Intentando...' : 'Intentar ahora'}
        </Button>
      </Box>

      <Divider sx={{ mb: 1.5 }} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {lista.map((factura) => (
          <FilaCola key={factura.id} factura={factura} maximo={cola.data?.intentos_maximos ?? 3} />
        ))}
      </Box>

      {procesar.isSuccess && (
        <Alert severity={procesar.data.procesadas > 0 ? 'success' : 'info'} sx={{ mt: 1.5 }}>
          {procesar.data.procesadas > 0
            ? `Se procesaron ${procesar.data.procesadas}. Revisa el historial para confirmar que quedaron bien.`
            : 'Todavia no se pudo leer ninguna. Se vuelve a intentar al sincronizar.'}
        </Alert>
      )}
    </Paper>
  )
}

function FilaCola({ factura, maximo }: { factura: FacturaEnCola; maximo: number }) {
  const seRindio = factura.estado === 'FALLIDA_OCR'

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        alignItems: 'center',
        flexWrap: 'wrap',
        py: 0.75,
        px: 1,
        borderRadius: 1,
        bgcolor: seRindio ? 'error.lighter' : 'action.hover',
      }}
    >
      <Chip
        label={factura.numero_factura}
        size="small"
        variant="outlined"
        sx={{ fontFamily: 'monospace', flexShrink: 0 }}
      />

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {factura.archivo_nombre}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {factura.created_at ? formatFecha(factura.created_at) : ''}
          {seRindio
            ? ` · se intento ${maximo} veces`
            : ` · intento ${factura.sync_attempts ?? 0} de ${maximo}`}
        </Typography>
      </Box>

      <Chip
        label={seRindio ? 'Ingresar a mano' : 'Esperando'}
        size="small"
        color={seRindio ? 'error' : 'info'}
        variant={seRindio ? 'filled' : 'outlined'}
        sx={{ flexShrink: 0 }}
      />
    </Box>
  )
}
