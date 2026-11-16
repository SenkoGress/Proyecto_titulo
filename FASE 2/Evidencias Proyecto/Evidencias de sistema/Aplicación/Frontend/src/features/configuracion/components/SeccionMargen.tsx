// src/features/configuracion/components/SeccionMargen.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import InputAdornment from '@mui/material/InputAdornment'
import PercentOutlined from '@mui/icons-material/PercentOutlined'
import { Seccion } from '@/features/configuracion/components/Seccion'
import { formatoClp } from '@/shared/utils/formatoClp'
import { aplicarRedondeoChileno } from '@/shared/utils/redondeoChileno'
import { useGuardarMargen, useMargen } from '@/features/configuracion/hooks/useConfiguracion'

// costo de ejemplo para mostrar como queda el precio de venta
const COSTO_EJEMPLO = 1000

// margen de ganancia que se aplica al ingresar facturas
export function SeccionMargen() {
  const margen = useMargen()
  const guardar = useGuardarMargen()

  // null = todavia no lo editan, se muestra el valor del servidor
  const [editado, setEditado] = useState<string | null>(null)
  const valor = editado ?? String(margen.data ?? '')

  const numero = Number(valor)
  const esValido = valor.trim() !== '' && !Number.isNaN(numero) && numero >= 0
  const cambio = esValido && numero !== margen.data

  const precioEjemplo = esValido ? aplicarRedondeoChileno(COSTO_EJEMPLO * (1 + numero / 100)) : 0

  return (
    <Seccion
      titulo="Margen de ganancia"
      descripcion="Se aplica al costo de cada producto al ingresar una factura, para proponer el precio de venta."
      icono={<PercentOutlined />}
      origen="servidor"
    >
      <Paper
        variant="outlined"
        sx={{ p: 1.25, mb: 2, bgcolor: 'action.hover', fontFamily: 'monospace', fontSize: 13 }}
      >
        Precio de venta = redondeo chileno( costo x (1 + margen / 100) )
      </Paper>

      {margen.isPending ? (
        <Skeleton variant="rounded" height={80} />
      ) : (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField
            label="Margen por defecto"
            type="number"
            size="small"
            value={valor}
            onChange={(evento) => setEditado(evento.target.value)}
            error={valor.trim() !== '' && !esValido}
            helperText={valor.trim() !== '' && !esValido ? 'Tiene que ser un numero mayor o igual a 0' : ' '}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
            sx={{ width: 200 }}
          />

          <Box sx={{ flexGrow: 1, minWidth: 220, pt: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Ejemplo
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Un producto que cuesta {formatoClp(COSTO_EJEMPLO)} se propondria a{' '}
              <strong>{esValido ? formatoClp(precioEjemplo) : '—'}</strong>
            </Typography>
          </Box>

          <Button
            variant="contained"
            onClick={() => guardar.mutate(numero)}
            disabled={!cambio || guardar.isPending}
            sx={{ mt: 0.25 }}
          >
            {guardar.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </Box>
      )}

      {guardar.isSuccess && !cambio && (
        <Alert severity="success" sx={{ mt: 1 }}>
          {guardar.data.message}
        </Alert>
      )}

      {guardar.isError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {guardar.error.message}
        </Alert>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Cambiar este valor no modifica los precios de los productos que ya estan en el catalogo, solo los proximos
        ingresos por factura.
      </Typography>
    </Seccion>
  )
}
