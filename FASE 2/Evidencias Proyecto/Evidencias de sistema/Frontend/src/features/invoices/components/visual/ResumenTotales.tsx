// src/features/invoices/components/ResumenTotales.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import InputAdornment from '@mui/material/InputAdornment'
import { formatoClp } from '@/shared/utils/formatoClp'
import { calcularResumenFactura } from '@/features/invoices/utils/calculosFactura'
import type { ItemFactura } from '@/features/invoices/types'

type Props = {
  items: ItemFactura[]
  totalDeclarado: number
  onCambiarTotal: (total: number) => void
}

// fila simple de un monto
function Fila({ texto, monto }: { texto: string; monto: number }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="body2" color="text.secondary">
        {texto}
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
        {formatoClp(monto)}
      </Typography>
    </Box>
  )
}

// resumen tributario y cuadratura: lo que dice el papel vs lo que suman las lineas
export function ResumenTotales({ items, totalDeclarado, onCambiarTotal }: Props) {
  const resumen = calcularResumenFactura(items, totalDeclarado)
  const cuadra = resumen.diferencia === 0

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        Resumen y cuadratura
      </Typography>

      {/* el total que trae la factura fisica, por si el ocr lo leyo mal */}
      <TextField
        label="Total segun factura fisica"
        size="small"
        value={totalDeclarado}
        onChange={(evento) => onCambiarTotal(Number(evento.target.value) || 0)}
        slotProps={{
          input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
          htmlInput: { inputMode: 'decimal' },
        }}
      />

      <Fila texto="Subtotal neto (afecto)" monto={resumen.montoNeto} />
      <Fila texto="IVA credito fiscal (19%)" monto={resumen.iva} />
      <Fila texto="Total factura" monto={resumen.totalFactura} />

      {/* comparacion: suma de las lineas vs el total declarado */}
      <Alert severity={cuadra ? 'success' : 'warning'} sx={{ mt: 0.5 }}>
        {cuadra
          ? `Cuadratura exacta: las ${resumen.itemsCount} lineas suman ${formatoClp(resumen.sumaNetaItems)}`
          : `Diferencia de ${formatoClp(Math.abs(resumen.diferencia))} entre el total y la suma de las lineas. Revise antes de confirmar.`}
      </Alert>

      <Typography variant="caption" color="text.secondary">
        {resumen.mapeados}/{resumen.itemsCount} productos ya existian en el catalogo ·{' '}
        {resumen.unidadesTotales} unidades fisicas a ingresar
      </Typography>
    </Paper>
  )
}
