// src/features/invoices/components/tecnico/ResumenConciliacionTecnica.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Chip from '@mui/material/Chip'
import { formatoClp } from '@/shared/utils/formatoClp'
import { calcularResumenFactura } from '@/features/invoices/utils/calculosFactura'
import type { ItemFactura } from '@/features/invoices/types'

type Props = {
  items: ItemFactura[]
  totalDeclarado: number
  onCambiarTotal: (total: number) => void
}

// una fila metrica del panel
function Metrica({ etiqueta, valor, mono = true }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {etiqueta}
      </Typography>
      <Typography sx={{ fontWeight: 700, fontFamily: mono ? 'monospace' : undefined }}>{valor}</Typography>
    </Box>
  )
}

// resumen tributario denso + estado de cuadratura contra el total declarado
export function ResumenConciliacionTecnica({ items, totalDeclarado, onCambiarTotal }: Props) {
  const resumen = calcularResumenFactura(items, totalDeclarado)
  const cuadra = resumen.diferencia === 0

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Cuadratura
        </Typography>
        <Chip
          size="small"
          label={cuadra ? 'EXACTA' : `DIFERENCIA ${formatoClp(Math.abs(resumen.diferencia))}`}
          color={cuadra ? 'success' : 'warning'}
        />
      </Box>

      <TextField
        label="Total segun factura fisica"
        size="small"
        value={totalDeclarado}
        onChange={(evento) => onCambiarTotal(Number(evento.target.value) || 0)}
        slotProps={{
          input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
          htmlInput: { inputMode: 'decimal', style: { fontFamily: 'monospace' } },
        }}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        <Metrica etiqueta="Monto neto" valor={formatoClp(resumen.montoNeto)} />
        <Metrica etiqueta="IVA 19%" valor={formatoClp(resumen.iva)} />
        <Metrica etiqueta="Total factura" valor={formatoClp(resumen.totalFactura)} />
        <Metrica etiqueta="Suma de lineas" valor={formatoClp(resumen.sumaNetaItems)} />
        <Metrica etiqueta="Unidades totales" valor={String(resumen.unidadesTotales)} mono={false} />
        <Metrica etiqueta="Productos" valor={String(resumen.itemsCount)} mono={false} />
      </Box>
    </Paper>
  )
}
