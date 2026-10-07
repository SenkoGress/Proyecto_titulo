// src/features/pos/components/visual/PanelTicket.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { alpha } from '@mui/material/styles'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { formatoClp } from '@/shared/utils/formatoClp'
import { obtenerMensajeError } from '@/lib/api/apiError'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import { useTotalesCarrito } from '@/features/pos/hooks/useTotalesCarrito'
import { LineaTicket } from '@/features/pos/components/visual/LineaTicket'
import { SelectorMetodoPago } from '@/features/pos/components/visual/SelectorMetodoPago'
import { CalculadoraVuelto } from '@/features/pos/components/visual/CalculadoraVuelto'
import { VerificacionEdad } from '@/features/pos/components/compartidos/VerificacionEdad'
import { SelectorComprobante } from '@/features/pos/components/compartidos/SelectorComprobante'
import { BotonBolsa } from '@/features/pos/components/compartidos/BotonBolsa'

type Props = {
  onCobrar: () => void
  cobrando: boolean
  errorCobro: unknown
}

// ticket de la venta (derecha)
export function PanelTicket({ onCobrar, cobrando, errorCobro }: Props) {
  const lineas = useCarritoStore((estado) => estado.lineas)
  const metodoPago = useCarritoStore((estado) => estado.metodoPago)
  const limpiar = useCarritoStore((estado) => estado.limpiar)
  const edadVerificada = useCarritoStore((estado) => estado.edadVerificada)
  const tipoComprobante = useCarritoStore((estado) => estado.tipoComprobante)
  const receptorEmpresa = useCarritoStore((estado) => estado.receptorEmpresa)

  const { subtotal, unidades, total, ila, ajusteRedondeo, contieneAlcohol } = useTotalesCarrito()

  const hayProductos = lineas.length > 0
  const bloqueadoPorAlcohol = contieneAlcohol && !edadVerificada
  const faltanDatosFactura = tipoComprobante === 'FACTURA' && !receptorEmpresa

  return (
    <Paper
      elevation={0}
      sx={{
        width: 400,
        flexShrink: 0,
        border: 1, borderColor: 'divider',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* encabezado */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Venta en curso
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {unidades} articulo(s)
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <BotonBolsa compacto />

          <Button size="small" color="error" startIcon={<DeleteSweepIcon />} disabled={!hayProductos} onClick={limpiar}>
            Limpiar
          </Button>
        </Box>
      </Box>

      <Divider />

      {/* productos */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 2 }}>
        {!hayProductos && (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            Agrega productos desde el catalogo o escanea un codigo de barras.
          </Typography>
        )}

        {lineas.map((linea) => (
          <LineaTicket key={linea.producto.id} linea={linea} />
        ))}
      </Box>

      {/* totales y pago */}
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            Subtotal
          </Typography>
          <Typography variant="body2">{formatoClp(subtotal)}</Typography>
        </Box>

        {/* ley de alcoholes: impuesto adicional, va aparte del iva */}
        {ila > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              Impuesto adicional ILA
            </Typography>
            <Typography variant="body2">{formatoClp(ila)}</Typography>
          </Box>
        )}

        {/* ley 20.956: solo efectivo */}
        {ajusteRedondeo !== 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              Ajuste de redondeo (Ley 20.956)
            </Typography>
            <Typography variant="body2">{formatoClp(ajusteRedondeo)}</Typography>
          </Box>
        )}

        {/* total */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
            borderRadius: 2,
            px: 2,
            py: 1.5,
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              TOTAL A PAGAR
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
              Total en pesos chilenos
            </Typography>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {formatoClp(total)}
          </Typography>
        </Box>

        <SelectorComprobante />

        <SelectorMetodoPago />

        {/* vuelto (solo efectivo) */}
        {metodoPago === 'EFECTIVO' && hayProductos && <CalculadoraVuelto total={total} />}

        {contieneAlcohol && <VerificacionEdad />}

        {Boolean(errorCobro) && <Alert severity="error">{obtenerMensajeError(errorCobro)}</Alert>}

        {/* cobrar */}
        <Button
          variant="contained"
          size="large"
          fullWidth
          endIcon={cobrando ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardIcon />}
          disabled={!hayProductos || cobrando || bloqueadoPorAlcohol || faltanDatosFactura}
          onClick={onCobrar}
          sx={{ py: 1.5, fontSize: '1.05rem' }}
        >
          {cobrando ? 'Registrando venta...' : `Cobrar venta ${formatoClp(total)}`}
        </Button>
      </Box>
    </Paper>
  )
}
