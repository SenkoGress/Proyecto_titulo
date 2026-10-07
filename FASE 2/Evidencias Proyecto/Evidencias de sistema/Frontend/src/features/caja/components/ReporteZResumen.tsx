// src/features/caja/components/ReporteZResumen.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import { formatoClp } from '@/shared/utils/formatoClp'
import { formatFecha } from '@/shared/utils/formatFecha'
import { desglosarIvaClp } from '@/shared/utils/ivaClp'
import { useConfigDte } from '@/features/dte/hooks/useConfigDte'
import type { SesionCaja } from '@/features/caja/types'

type Props = {
  sesion: SesionCaja
}

// una fila del "ticket": etiqueta a la izquierda, monto a la derecha
function Fila({ texto, valor }: { texto: string; valor: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 13 }}>
      <span>{texto}</span>
      <span>{valor}</span>
    </Box>
  )
}

// comprobante del cierre, sin timbre SII ni folio Z
export function ReporteZResumen({ sesion }: Props) {
  const { data: configLocal } = useConfigDte()
  const tax = desglosarIvaClp(sesion.total_ventas)
  const diferencia = sesion.diferencia_efectivo ?? 0

  return (
    <Box id="reporte-z" sx={{ maxWidth: 320, mx: 'auto', fontFamily: 'monospace' }}>
      <Box sx={{ textAlign: 'center', mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
          {configLocal?.emisor.razonSocial ?? 'GESTOCK'}
        </Typography>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }}>
          RUT {configLocal?.emisor.rut}
        </Typography>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }}>
          {configLocal?.emisor.comuna}, {configLocal?.emisor.ciudad}
        </Typography>
      </Box>

      <Divider sx={{ borderStyle: 'dashed' }} />

      <Box sx={{ my: 1 }}>
        <Fila texto="Cajero" valor={sesion.cajero_nombre ?? '-'} />
        <Fila texto="Apertura" valor={formatFecha(sesion.fecha_apertura)} />
        <Fila texto="Cierre" valor={formatFecha(sesion.fecha_cierre ?? null)} />
        <Fila texto="Documentos" valor={String(sesion.transacciones_count ?? 0)} />
      </Box>

      <Divider sx={{ borderStyle: 'dashed' }} />

      <Box sx={{ my: 1 }}>
        <Fila texto="Ventas netas (aprox.)" valor={formatoClp(tax.neto)} />
        <Fila texto="IVA debito (aprox.)" valor={formatoClp(tax.iva)} />
        <Fila texto="TOTAL VENTAS" valor={formatoClp(sesion.total_ventas)} />
      </Box>

      <Divider sx={{ borderStyle: 'dashed' }} />

      <Box sx={{ my: 1 }}>
        <Fila texto="Efectivo ventas" valor={formatoClp(sesion.ventas_efectivo)} />
        <Fila texto="Fondo inicial" valor={formatoClp(sesion.monto_apertura)} />
        <Fila texto="Ingresos manuales" valor={formatoClp(sesion.total_ingresos_caja)} />
        <Fila texto="Egresos manuales" valor={`-${formatoClp(sesion.total_egresos_caja)}`} />
        <Fila texto="Efectivo esperado" valor={formatoClp(sesion.monto_esperado_efectivo)} />
        <Fila texto="Efectivo contado" valor={formatoClp(sesion.monto_real_efectivo ?? 0)} />
        <Fila
          texto="Diferencia arqueo"
          valor={diferencia === 0 ? 'EXACTA' : formatoClp(diferencia)}
        />
      </Box>

      <Divider sx={{ borderStyle: 'dashed' }} />

      <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 1, color: 'text.secondary' }}>
        Comprobante interno de cierre de turno. No reemplaza el Reporte Z tributario ante el SII.
      </Typography>
    </Box>
  )
}
