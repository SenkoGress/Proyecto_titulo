// src/features/configuracion/components/SeccionVencimientos.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined'
import { Seccion } from '@/features/configuracion/components/Seccion'

// d.s. 977/96: el sistema controla el vencimiento de lo que el local tiene a la venta
export function SeccionVencimientos() {
  return (
    <Seccion
      titulo="Control de vencimientos (D.S. N° 977/96)"
      descripcion="Como cuida el sistema que no haya productos vencidos a la venta."
      icono={<EventBusyOutlined />}
      origen="lectura"
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="body2">
          GesTock trabaja bajo el <strong>Reglamento Sanitario de los Alimentos (D.S. N° 977/96, MINSAL)</strong>,
          que no permite tener a la venta un producto vencido. Por eso:
        </Typography>

        <Box component="ul" sx={{ m: 0, pl: 3 }}>
          <Typography component="li" variant="body2">
            Al ingresar una factura, <strong>cada producto debe llevar su fecha de vencimiento</strong> o la marca
            de que no vence. Sin eso, la factura no entra al inventario.
          </Typography>
          <Typography component="li" variant="body2">
            Si un producto se ingresa <strong>ya vencido</strong>, el sistema lo avisa antes de confirmar y lo
            nombra de nuevo al terminar.
          </Typography>
          <Typography component="li" variant="body2">
            En Inventario, la alerta sanitaria avisa de los productos que vencen en <strong>15 dias</strong>, en{' '}
            <strong>7 dias</strong> y de los que ya vencieron.
          </Typography>
          <Typography component="li" variant="body2">
            Las facturas que quedaron en cola sin leer no se ingresan solas: esperan a que alguien las revise y
            declare los vencimientos.
          </Typography>
        </Box>

        <Alert severity="info">
          El sistema avisa, pero <strong>no retira el producto por su cuenta</strong>. Sacarlo de la venta y
          registrarlo como merma lo hace el local, desde Inventario.
        </Alert>
      </Box>
    </Seccion>
  )
}
