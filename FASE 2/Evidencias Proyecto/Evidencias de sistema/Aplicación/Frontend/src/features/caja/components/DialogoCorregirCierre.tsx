// src/features/caja/components/DialogoCorregirCierre.tsx
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { formatFecha } from '@/shared/utils/formatFecha'
import { obtenerMensajeError } from '@/lib/api/apiError'
import { useCorreccionesCierre, useCorregirCierre } from '@/features/caja/hooks/useCaja'
import { conteoVigente } from '@/features/caja/utils/correccionCierre'
import type { CierreHistorial } from '@/features/caja/types'

type Props = {
  cierre: CierreHistorial
  onCerrar: () => void
}

// la diferencia con color, igual que en el historial
function Diferencia({ monto }: { monto: number }) {
  if (monto === 0) {
    return (
      <Typography sx={{ fontWeight: 700, color: 'success.main' }}>Cuadrada</Typography>
    )
  }
  return (
    <Typography sx={{ fontWeight: 700, color: monto > 0 ? 'info.main' : 'error.main' }}>
      {monto > 0 ? 'Sobrante ' : 'Faltante '}
      {formatoClp(Math.abs(monto))}
    </Typography>
  )
}

// corregir el conteo de un cierre ya cerrado, sin tocar el original
export function DialogoCorregirCierre({ cierre, onCerrar }: Props) {
  const corregir = useCorregirCierre()
  const rastro = useCorreccionesCierre(cierre.id)

  const vigente = conteoVigente(cierre)
  const [monto, setMonto] = useState(vigente === null ? '' : String(vigente))
  const [motivo, setMotivo] = useState('')

  const nuevo = Number(monto)
  const montoValido = monto !== '' && Number.isFinite(nuevo) && nuevo >= 0
  const motivoValido = motivo.trim().length > 0
  const esperado = cierre.monto_esperado_efectivo
  const puedeGuardar = montoValido && motivoValido && !corregir.isPending

  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditNoteOutlined color="primary" />
        <Box sx={{ flexGrow: 1 }}>Corregir el conteo del cierre</Box>
        <IconButton size="small" onClick={onCerrar} aria-label="Cerrar">
          <CloseOutlined fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {corregir.isSuccess ? (
          <Alert severity="success">
            <AlertTitle sx={{ fontWeight: 700 }}>Conteo corregido</AlertTitle>
            El conteo quedo en {formatoClp(corregir.data.correccion.monto_nuevo)}, antes{' '}
            {formatoClp(corregir.data.correccion.monto_anterior)}. Es la correccion N°{' '}
            {corregir.data.correccion.correlativo} de este cierre.
            <Typography variant="body2" sx={{ mt: 1 }}>
              El conteo original y su diferencia quedan como estaban: esta correccion se suma al
              rastro, no lo reemplaza.
            </Typography>
          </Alert>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              <AlertTitle sx={{ fontWeight: 700 }}>El conteo original no se borra</AlertTitle>
              Queda registrado quien corrige, cuando y por que. Cada correccion se agrega al rastro
              del cierre, que solo crece.
            </Alert>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  CERRADO EL
                </Typography>
                <Typography variant="body2">{formatFecha(cierre.fecha_cierre ?? null)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  CAJERO
                </Typography>
                <Typography variant="body2">{cierre.cajero_nombre ?? '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  EFECTIVO ESPERADO
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {formatoClp(esperado)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  CONTEO VIGENTE
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {vigente === null ? '—' : formatoClp(vigente)}
                </Typography>
              </Box>
            </Box>

            <TextField
              label="Efectivo contado"
              fullWidth
              size="small"
              value={monto}
              onChange={(evento) => setMonto(evento.target.value.replace(/\D/g, ''))}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                htmlInput: { inputMode: 'numeric' },
              }}
              helperText="Lo que hay de verdad en la gaveta"
            />

            <TextField
              label="Motivo"
              fullWidth
              required
              size="small"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              sx={{ mt: 2 }}
              error={motivo !== '' && !motivoValido}
              helperText="Por que se corrige. Queda en el rastro del cierre y el servidor lo exige."
            />

            {montoValido && (
              <Box
                sx={{
                  mt: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Diferencia con la correccion
                </Typography>
                <Diferencia monto={nuevo - esperado} />
              </Box>
            )}

            {corregir.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {obtenerMensajeError(corregir.error)}
              </Alert>
            )}
          </>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Correcciones de este cierre
        </Typography>

        {rastro.isPending && <Skeleton variant="rounded" height={60} />}

        {rastro.isError && (
          <Typography variant="body2" color="error">
            No se pudo cargar el rastro de correcciones.
          </Typography>
        )}

        {rastro.data && rastro.data.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Este cierre no se ha corregido nunca.
          </Typography>
        )}

        {rastro.data?.map((correccion) => (
          <Box key={correccion.id} sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              N° {correccion.correlativo} · {formatoClp(correccion.monto_anterior)} →{' '}
              {formatoClp(correccion.monto_nuevo)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatFecha(correccion.created_at)}
              {correccion.usuario_nombre ? ` · ${correccion.usuario_nombre}` : ''} ·{' '}
              {correccion.motivo}
            </Typography>
          </Box>
        ))}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {corregir.isSuccess ? (
          <Button variant="contained" onClick={onCerrar} autoFocus>
            Listo
          </Button>
        ) : (
          <>
            <Button onClick={onCerrar}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={() => corregir.mutate({ cierreId: cierre.id, montoRealEfectivo: nuevo, motivo: motivo.trim() })}
              disabled={!puedeGuardar}
            >
              {corregir.isPending ? 'Guardando...' : 'Guardar la correccion'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
