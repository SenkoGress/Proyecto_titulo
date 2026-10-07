// src/features/ventas/components/compartidos/DialogoDevolucion.tsx
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Divider from '@mui/material/Divider'
import AssignmentReturnOutlined from '@mui/icons-material/AssignmentReturnOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import AddOutlined from '@mui/icons-material/AddOutlined'
import RemoveOutlined from '@mui/icons-material/RemoveOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { formatFecha } from '@/shared/utils/formatFecha'
import { useDevolucion } from '@/features/ventas/hooks/useVentas'
import type { FilaVenta } from '@/features/ventas/utils/filaVenta'

type Props = {
  venta: FilaVenta
  onCerrar: () => void
}

// el motivo que propone la propia ley del consumidor
const MOTIVO_POR_DEFECTO = 'Garantia Legal Ley N° 21.398'

// cuantas unidades se devuelven de una linea
function Cantidad({
  valor,
  maximo,
  onCambiar,
}: {
  valor: number
  maximo: number
  onCambiar: (valor: number) => void
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <IconButton size="small" onClick={() => onCambiar(valor - 1)} disabled={valor <= 0}>
        <RemoveOutlined fontSize="small" />
      </IconButton>

      <Typography sx={{ minWidth: 44, textAlign: 'center', fontWeight: 700 }}>
        {valor} / {maximo}
      </Typography>

      <IconButton size="small" onClick={() => onCambiar(valor + 1)} disabled={valor >= maximo}>
        <AddOutlined fontSize="small" />
      </IconButton>
    </Box>
  )
}

// devolucion total o parcial de una venta
export function DialogoDevolucion({ venta, onCerrar }: Props) {
  const devolucion = useDevolucion()

  // parte con la devolucion total, que es el caso comun
  const [cantidades, setCantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(venta.items.map((item) => [item.id, item.cantidad])),
  )
  const [motivo, setMotivo] = useState(MOTIVO_POR_DEFECTO)

  const aDevolver = venta.items.filter((item) => (cantidades[item.id] ?? 0) > 0)
  const total = aDevolver.reduce((suma, item) => suma + item.precio_unitario * cantidades[item.id], 0)
  const esTotal = venta.items.length > 0 && venta.items.every((item) => cantidades[item.id] === item.cantidad)

  // sin producto_id no se puede armar la devolucion parcial
  const sinIdentificar = venta.items.filter((item) => !item.producto_id)

  const confirmar = () => {
    devolucion.mutate({
      ventaId: venta.id,
      motivo: motivo.trim() || MOTIVO_POR_DEFECTO,
      // sin items el backend devuelve la venta completa
      items: esTotal
        ? undefined
        : aDevolver.map((item) => ({ producto_id: item.producto_id, cantidad: cantidades[item.id] })),
    })
  }

  const puedeConfirmar = aDevolver.length > 0 && !devolucion.isPending && (esTotal || sinIdentificar.length === 0)

  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AssignmentReturnOutlined color="warning" />
        <Box sx={{ flexGrow: 1 }}>Devolver la venta {venta.folio}</Box>
        <IconButton size="small" onClick={onCerrar} aria-label="Cerrar">
          <CloseOutlined fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {devolucion.isSuccess ? (
          <Alert severity="success">
            <AlertTitle sx={{ fontWeight: 700 }}>Devolucion registrada</AlertTitle>
            {devolucion.data.message}

            <Typography variant="body2" sx={{ mt: 1 }}>
              Nota de credito N° {devolucion.data.data.folio_nc} por{' '}
              {formatoClp(devolucion.data.data.total_devuelto)}. El stock ya volvio al inventario.
            </Typography>
          </Alert>
        ) : (
          <>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <AlertTitle sx={{ fontWeight: 700 }}>Esto no se puede deshacer</AlertTitle>
              Se emite una nota de credito electronica (DTE 61) que anula el documento original y el stock vuelve al
              inventario.
            </Alert>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {formatFecha(venta.fecha)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {venta.cajero_nombre} · {venta.medio_pago_nombre}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Cobrado {formatoClp(venta.total)}
              </Typography>
            </Box>

            {venta.items.length === 0 && (
              <Alert severity="error">
                Esta venta no tiene productos registrados, asi que no se puede devolver.
              </Alert>
            )}

            {venta.items.map((item) => (
              <Paper key={item.id} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.producto_nombre}
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                      {item.sku} · {formatoClp(item.precio_unitario)} c/u
                    </Typography>
                  </Box>

                  <Cantidad
                    valor={cantidades[item.id] ?? 0}
                    maximo={item.cantidad}
                    onCambiar={(valor) => setCantidades((previo) => ({ ...previo, [item.id]: valor }))}
                  />

                  <Typography sx={{ fontWeight: 700, minWidth: 80, textAlign: 'right' }}>
                    {formatoClp(item.precio_unitario * (cantidades[item.id] ?? 0))}
                  </Typography>
                </Box>
              </Paper>
            ))}

            {!esTotal && sinIdentificar.length > 0 && (
              <Alert severity="error" sx={{ mt: 1 }}>
                Estos productos vienen sin identificador: {sinIdentificar.map((item) => item.sku).join(', ')}. La
                devolucion parcial los necesita; la total se puede hacer igual.
              </Alert>
            )}

            <TextField
              label="Motivo"
              fullWidth
              size="small"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              sx={{ mt: 2 }}
              helperText="Queda escrito en la nota de credito"
            />

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {esTotal ? 'Devolucion total' : 'Devolucion parcial'}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
                {formatoClp(total)}
              </Typography>
            </Box>

            {devolucion.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {devolucion.error.message}
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {devolucion.isSuccess ? (
          <Button variant="contained" onClick={onCerrar} autoFocus>
            Listo
          </Button>
        ) : (
          <>
            <Button onClick={onCerrar}>Cancelar</Button>
            <Button variant="contained" color="warning" onClick={confirmar} disabled={!puedeConfirmar}>
              {devolucion.isPending ? 'Procesando...' : `Devolver ${formatoClp(total)}`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
