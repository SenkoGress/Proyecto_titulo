// src/features/pos/components/tecnico/PanelCobro.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import { formatoClp } from '@/shared/utils/formatoClp'
import { obtenerMensajeError } from '@/lib/api/apiError'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import { useTotalesCarrito } from '@/features/pos/hooks/useTotalesCarrito'
import { ClienteRut } from '@/features/pos/components/tecnico/ClienteRut'
import { DesgloseTotales } from '@/features/pos/components/tecnico/DesgloseTotales'
import { MediosPago } from '@/features/pos/components/tecnico/MediosPago'
import { MontoRecibido } from '@/features/pos/components/tecnico/MontoRecibido'
import { VerificacionEdad } from '@/features/pos/components/compartidos/VerificacionEdad'
import { SelectorComprobante } from '@/features/pos/components/compartidos/SelectorComprobante'
import { BotonBolsa } from '@/features/pos/components/compartidos/BotonBolsa'

type Props = {
  onCobrar: () => void
  onCancelar: () => void
  cobrando: boolean
  errorCobro: unknown
}

// panel derecho: boleta, totales y pago
export function PanelCobro({ onCobrar, onCancelar, cobrando, errorCobro }: Props) {
  const metodoPago = useCarritoStore((estado) => estado.metodoPago)
  const edadVerificada = useCarritoStore((estado) => estado.edadVerificada)
  const tipoComprobante = useCarritoStore((estado) => estado.tipoComprobante)
  const receptorEmpresa = useCarritoStore((estado) => estado.receptorEmpresa)
  const { total, cantidadLineas, contieneAlcohol } = useTotalesCarrito()

  const hayProductos = cantidadLineas > 0
  const bloqueadoPorAlcohol = contieneAlcohol && !edadVerificada
  const faltanDatosFactura = tipoComprobante === 'FACTURA' && !receptorEmpresa
  const esFactura = tipoComprobante === 'FACTURA'

  return (
    <Paper
      elevation={0}
      sx={{
        width: 420,
        flexShrink: 0,
        border: 1, borderColor: 'divider',
        borderRadius: 2,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        overflowY: 'auto',
      }}
    >
      {/* encabezado */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <ReceiptLongIcon color="primary" />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {esFactura ? 'Factura Electronica' : 'Boleta Electronica'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              Folio: se asigna al cobrar
            </Typography>
          </Box>
        </Box>
        <Chip
          size="small"
          label={hayProductos ? 'VENTA EN CURSO' : 'SIN PRODUCTOS'}
          color={hayProductos ? 'success' : 'default'}
          variant="outlined"
          sx={{ fontWeight: 700 }}
        />
      </Box>

      <SelectorComprobante />

      {/* el rut del cliente solo aplica a la boleta: la factura lleva su propio receptor */}
      {!esFactura && <ClienteRut />}

      <BotonBolsa />

      <DesgloseTotales />

      <Divider />

      <MediosPago />

      {/* vuelto (solo efectivo) */}
      {metodoPago === 'EFECTIVO' && hayProductos && <MontoRecibido total={total} />}

      {contieneAlcohol && <VerificacionEdad />}

      {Boolean(errorCobro) && <Alert severity="error">{obtenerMensajeError(errorCobro)}</Alert>}

      {/* cobrar */}
      <Button
        variant="contained"
        size="large"
        startIcon={cobrando ? <CircularProgress size={18} color="inherit" /> : <PointOfSaleIcon />}
        disabled={!hayProductos || cobrando || bloqueadoPorAlcohol || faltanDatosFactura}
        onClick={onCobrar}
        sx={{ py: 1.5, fontSize: '1.05rem' }}
      >
        {cobrando ? 'Registrando venta...' : `COBRAR ${formatoClp(total)} [F4]`}
      </Button>

      {/* cancelar venta */}
      <Button
        color="error"
        variant="outlined"
        startIcon={<HighlightOffIcon />}
        disabled={!hayProductos || cobrando}
        onClick={onCancelar}
      >
        Cancelar [ESC]
      </Button>
    </Paper>
  )
}
