// src/features/caja/components/Movimientos.tsx
import { useState } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import InputAdornment from '@mui/material/InputAdornment'
import CircularProgress from '@mui/material/CircularProgress'
import AddIcon from '@mui/icons-material/Add'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { formatoClp } from '@/shared/utils/formatoClp'
import { formatFecha } from '@/shared/utils/formatFecha'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { useRegistrarMovimiento } from '@/features/caja/hooks/useCaja'
import type { MovimientoCaja, TipoMovimiento } from '@/features/caja/types'

// egresos (gastos menores) e ingresos manuales de efectivo durante el turno
export function Movimientos({ movimientos }: { movimientos: MovimientoCaja[] }) {
  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState<TipoMovimiento>('EGRESO')
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState('')

  const registrar = useRegistrarMovimiento()

  function agregar() {
    const montoNumero = Number(monto)
    if (!montoNumero || montoNumero <= 0 || !motivo.trim()) return

    registrar.mutate(
      { tipo, monto: montoNumero, motivo: motivo.trim() },
      {
        onSuccess: () => {
          setMonto('')
          setMotivo('')
          setAbierto(false)
        },
      },
    )
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Movimientos de caja
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setAbierto((v) => !v)}>
          Registrar
        </Button>
      </Box>

      {/* lista de movimientos ya registrados */}
      {movimientos.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Sin movimientos manuales en este turno.
        </Typography>
      )}

      {movimientos.map((mov) => (
        <Box key={mov.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {mov.tipo === 'INGRESO' ? (
              <ArrowUpwardIcon fontSize="small" color="success" />
            ) : (
              <ArrowDownwardIcon fontSize="small" color="error" />
            )}
            <Box>
              <Typography variant="body2">{mov.motivo}</Typography>
              <Typography variant="caption" color="text.secondary">
                {formatFecha(mov.created_at)}
              </Typography>
            </Box>
          </Box>
          <Typography sx={{ fontWeight: 700 }} color={mov.tipo === 'INGRESO' ? 'success.main' : 'error.main'}>
            {mov.tipo === 'INGRESO' ? '+' : '-'}
            {formatoClp(mov.monto)}
          </Typography>
        </Box>
      ))}

      {/* formulario para agregar uno nuevo */}
      {abierto && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1, borderTop: 1, borderTopColor: 'divider' }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={tipo}
            onChange={(_evento, valor) => valor && setTipo(valor)}
          >
            <ToggleButton value="EGRESO" color="error">
              Egreso (gasto)
            </ToggleButton>
            <ToggleButton value="INGRESO" color="success">
              Ingreso (sencillo)
            </ToggleButton>
          </ToggleButtonGroup>

          <TextField
            label="Monto"
            size="small"
            value={monto}
            onChange={(evento) => setMonto(evento.target.value.replace(/\D/g, ''))}
            slotProps={{
              input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
              htmlInput: { inputMode: 'numeric' },
            }}
          />

          <TextField
            label="Motivo"
            size="small"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
          />

          {registrar.isError && <ErrorBox error={registrar.error} />}

          <Button
            variant="contained"
            size="small"
            disabled={registrar.isPending}
            startIcon={registrar.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={agregar}
          >
            Guardar movimiento
          </Button>
        </Box>
      )}
    </Paper>
  )
}
