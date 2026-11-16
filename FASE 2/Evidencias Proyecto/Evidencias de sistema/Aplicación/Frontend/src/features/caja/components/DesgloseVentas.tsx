// src/features/caja/components/DesgloseVentas.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { desglosarIvaClp } from '@/shared/utils/ivaClp'
import type { SesionCaja } from '@/features/caja/types'

type Props = {
  sesion: SesionCaja
}

// una fila de monto
function Fila({ texto, monto, ayuda }: { texto: string; monto: number; ayuda?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          {texto}
        </Typography>
        {ayuda && (
          <Tooltip title={ayuda}>
            <InfoOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
          </Tooltip>
        )}
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {formatoClp(monto)}
      </Typography>
    </Box>
  )
}

// ventas del turno, desglosadas por medio de pago (backend/src/caja/cierre-caja.service.ts)
export function DesgloseVentas({ sesion }: Props) {
  // aproximacion neto/iva a partir del total bruto, igual formula que usa el backend
  const tax = desglosarIvaClp(sesion.total_ventas)

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Ventas del turno
      </Typography>

      <Fila
        texto="Efectivo"
        monto={sesion.ventas_efectivo}
        ayuda="Lo unico que deberia estar fisicamente en la gaveta"
      />
      <Fila texto="Transbank" monto={sesion.ventas_transbank} />
      <Fila texto="Mercado Pago" monto={sesion.ventas_mercadopago} />
      <Fila texto="SumUp" monto={sesion.ventas_sumup} />
      <Fila texto="RutPay" monto={sesion.ventas_rutpay} />

      <Box sx={{ borderTop: 1, borderTopColor: 'divider', pt: 1, mt: 0.5 }}>
        <Fila texto="Ventas netas (aprox.)" monto={tax.neto} />
        <Fila texto="IVA debito (19%, aprox.)" monto={tax.iva} />
        <Fila texto="Total ventas del turno" monto={sesion.total_ventas} />
      </Box>
    </Paper>
  )
}
