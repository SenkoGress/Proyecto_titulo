// src/features/pos/components/tecnico/DesgloseTotales.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { formatoClp } from '@/shared/utils/formatoClp'
import { useTotalesCarrito } from '@/features/pos/hooks/useTotalesCarrito'

// fila de un monto
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

// neto, iva, ila y total
export function DesgloseTotales() {
  const { neto, iva, ila, redondeo, total, aplicaRedondeo } = useTotalesCarrito()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Fila texto="Subtotal neto (afecto)" monto={neto} />
      <Fila texto="IVA debito fiscal (19%)" monto={iva} />

      {/* solo si hay productos con ila */}
      {ila > 0 && <Fila texto="Impuesto adicional (ILA)" monto={ila} />}

      {/* ley 20.956: solo rige para efectivo */}
      {redondeo !== 0 && <Fila texto="Ajuste redondeo (Ley 20.956)" monto={redondeo} />}

      {!aplicaRedondeo && (
        <Typography variant="caption" color="text.secondary">
          Sin redondeo: la Ley 20.956 solo aplica a pagos en efectivo.
        </Typography>
      )}

      {/* total */}
      <Box
        sx={{
          mt: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'grey.900',
          color: 'common.white',
          borderRadius: 2,
          px: 2,
          py: 1.5,
        }}
      >
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
            TOTAL A PAGAR
          </Typography>
          <Typography variant="caption" sx={{ color: 'grey.400' }}>
            Moneda nacional (CLP)
          </Typography>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
          {formatoClp(total)}
        </Typography>
      </Box>
    </Box>
  )
}
