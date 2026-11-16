// src/features/configuracion/components/SeccionRedondeo.tsx
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import BalanceOutlined from '@mui/icons-material/BalanceOutlined'
import { Seccion } from '@/features/configuracion/components/Seccion'
import { formatoClp } from '@/shared/utils/formatoClp'
import { aplicarRedondeoChileno } from '@/shared/utils/redondeoChileno'

// montos que muestran las dos direcciones del redondeo
const EJEMPLOS = [1234, 1236, 1899, 2500]

// ley 20.956: el vuelto en efectivo se redondea a la decena
export function SeccionRedondeo() {
  return (
    <Seccion
      titulo="Ley de redondeo (Ley N° 20.956)"
      descripcion="Como se ajusta el total cuando el cliente paga en efectivo."
      icono={<BalanceOutlined />}
      origen="lectura"
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="body2">
          Como no existen monedas de $1 ni de $5, el total en efectivo se lleva a la decena mas cercana:
        </Typography>

        <Box component="ul" sx={{ m: 0, pl: 3 }}>
          <Typography component="li" variant="body2">
            Si termina en <strong>$1, $2, $3 o $4</strong>, baja a la decena inferior.
          </Typography>
          <Typography component="li" variant="body2">
            Si termina en <strong>$5, $6, $7, $8 o $9</strong>, sube a la decena superior.
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {EJEMPLOS.map((monto) => {
            const redondeado = aplicarRedondeoChileno(monto)
            const ajuste = redondeado - monto

            return (
              <Paper key={monto} variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {formatoClp(monto)}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {formatoClp(redondeado)}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: ajuste === 0 ? 'text.secondary' : ajuste > 0 ? 'error.main' : 'success.main' }}
                >
                  {ajuste === 0 ? 'sin ajuste' : `${ajuste > 0 ? '+' : ''}${formatoClp(ajuste)}`}
                </Typography>
              </Paper>
            )
          })}
        </Box>

        <Alert severity="info">
          El redondeo aplica <strong>solo al pago en efectivo</strong>. Con tarjeta o transferencia se cobra el monto
          exacto, porque ahi no hay monedas de por medio.
        </Alert>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        La misma regla se usa para proponer el precio de venta al ingresar una factura, para que los precios del
        catalogo queden en decenas.
      </Typography>
    </Seccion>
  )
}
