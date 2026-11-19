// src/features/invoices/components/compartidos/PanelColaFacturas.tsx
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import {
  useAbrirFacturaDeCola,
  useDescartarFacturaDeCola,
  usePendientes,
  useProcesarPendientes,
} from '@/features/invoices/hooks/useInvoices'
import { obtenerMensajeError } from '@/lib/api/apiError'
import { formatFecha } from '@/shared/utils/formatFecha'
import type { FacturaEnCola, PrevisualizacionFactura } from '@/features/invoices/types'

type Props = {
  onRevisar: (vista: PrevisualizacionFactura, colaId: string) => void
}

// facturas guardadas que todavia no entraron al inventario
export function PanelColaFacturas({ onRevisar }: Props) {
  const cola = usePendientes()
  const procesar = useProcesarPendientes()
  const abrir = useAbrirFacturaDeCola()
  const descartar = useDescartarFacturaDeCola()

  const lista = cola.data?.data ?? []
  if (lista.length === 0) return null

  const esperando = lista.filter((f) => f.estado === 'PENDIENTE_OCR')
  const rendidas = lista.filter((f) => f.estado === 'FALLIDA_OCR')
  // ya se leyeron: falta que alguien declare los vencimientos y las confirme
  const porRevisar = lista.filter((f) => f.estado === 'POR_REVISAR')

  function revisar(id: string) {
    abrir.mutate(id, { onSuccess: (vista) => onRevisar(vista, id) })
  }

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 1.5 }}>
        <ScheduleOutlined color="info" />

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Facturas guardadas sin ingresar
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {porRevisar.length > 0 && `${porRevisar.length} lista${porRevisar.length === 1 ? '' : 's'} para revisar, `}
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
          <FilaCola
            key={factura.id}
            factura={factura}
            maximo={cola.data?.intentos_maximos ?? 3}
            ocupado={abrir.isPending || descartar.isPending}
            onRevisar={() => revisar(factura.id)}
            onDescartar={() => descartar.mutate(factura.id)}
          />
        ))}
      </Box>

      {(procesar.error ?? abrir.error ?? descartar.error) && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {obtenerMensajeError(procesar.error ?? abrir.error ?? descartar.error)}
        </Alert>
      )}

      {procesar.isSuccess && (
        <Alert severity={procesar.data.por_revisar > 0 ? 'success' : 'info'} sx={{ mt: 1.5 }}>
          {procesar.data.por_revisar > 0
            ? `Se leyeron ${procesar.data.por_revisar}. Todavia no entraron al inventario: revisalas para declarar los vencimientos e ingresarlas.`
            : 'Todavia no se pudo leer ninguna. Se vuelve a intentar al sincronizar.'}
        </Alert>
      )}
    </Paper>
  )
}

type PropsFila = {
  factura: FacturaEnCola
  maximo: number
  ocupado: boolean
  onRevisar: () => void
  onDescartar: () => void
}

function FilaCola({ factura, maximo, ocupado, onRevisar, onDescartar }: PropsFila) {
  const seRindio = factura.estado === 'FALLIDA_OCR'
  const leida = factura.estado === 'POR_REVISAR'

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
          {leida
            ? ' · ya se leyo, falta declarar los vencimientos'
            : seRindio
              ? ` · se intento ${maximo} veces`
              : ` · intento ${factura.sync_attempts ?? 0} de ${maximo}`}
        </Typography>
      </Box>

      {leida ? (
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <Button size="small" onClick={onDescartar} disabled={ocupado}>
            Descartar
          </Button>
          <Button size="small" variant="contained" onClick={onRevisar} disabled={ocupado}>
            Revisar e ingresar
          </Button>
        </Box>
      ) : (
        <Chip
          label={seRindio ? 'Ingresar a mano' : 'Esperando'}
          size="small"
          color={seRindio ? 'error' : 'info'}
          variant={seRindio ? 'filled' : 'outlined'}
          sx={{ flexShrink: 0 }}
        />
      )}
    </Box>
  )
}
