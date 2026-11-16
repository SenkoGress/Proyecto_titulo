// src/features/pos/components/compartidos/VoucherImpreso.tsx
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import { usePapelStore } from '@/shared/stores/papelStore'
import { anchoVistaPx, tamanoLetraPx } from '@/shared/utils/papelTermico'
import { formatoClp } from '@/shared/utils/formatoClp'
import { etiquetaDocumentoVenta } from '@/shared/utils/etiquetasEstado'
import type { EmisorFiscal } from '@/features/dte/types'
import type { VentaRegistrada } from '@/features/pos/types'

type Props = {
  venta: VentaRegistrada
  emisor: EmisorFiscal | undefined
}

// comprobante del pago con tarjeta bajo el modelo B: no es boleta, pero igual hay que poder
// entregarle algo al cliente. El checkout no devuelve el detalle de la venta, asi que lleva el
// total y las unidades, como cualquier voucher de pasarela
export function VoucherImpreso({ venta, emisor }: Props) {
  const anchoPapel = usePapelStore((estado) => estado.ancho)

  return (
    <Box
      id="ticket-impreso"
      sx={{
        width: anchoVistaPx(anchoPapel),
        maxWidth: '100%',
        mx: 'auto',
        p: 2,
        bgcolor: 'background.paper',
        color: 'text.primary',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        fontFamily: 'monospace',
        fontSize: tamanoLetraPx(anchoPapel),
        lineHeight: 1.6,
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <Box sx={{ fontWeight: 700 }}>{emisor?.razonSocial ?? 'COMPROBANTE DE PAGO'}</Box>
        {emisor && (
          <>
            <Box>RUT: {emisor.rut}</Box>
            <Box>{emisor.direccion}</Box>
            <Box>
              {emisor.comuna} - {emisor.ciudad}
            </Box>
          </>
        )}
      </Box>

      <Divider sx={{ my: 0.75, borderStyle: 'dashed' }} />

      <Box sx={{ textAlign: 'center', fontWeight: 700 }}>
        {etiquetaDocumentoVenta(venta.dte?.tipoDocumento ?? 'VOUCHER_TRANSBANK').texto.toUpperCase()}
      </Box>

      <Divider sx={{ my: 0.75, borderStyle: 'dashed' }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        <Box component="span">FECHA</Box>
        <Box component="span">{new Date().toLocaleString('es-CL')}</Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        <Box component="span">FOLIO INTERNO</Box>
        <Box component="span">{venta.folio}</Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        <Box component="span">ARTICULOS</Box>
        <Box component="span">{venta.unidades}</Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        <Box component="span">MEDIO DE PAGO</Box>
        <Box component="span">{venta.payment_method}</Box>
      </Box>

      {venta.payment_transaction_id && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          <Box component="span">N° TRANSACCION</Box>
          <Box component="span">{venta.payment_transaction_id}</Box>
        </Box>
      )}

      <Divider sx={{ my: 0.75, borderStyle: 'dashed' }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, fontWeight: 700 }}>
        <Box component="span">TOTAL</Box>
        <Box component="span">{formatoClp(venta.total)}</Box>
      </Box>

      <Divider sx={{ my: 0.75, borderStyle: 'dashed' }} />

      <Box sx={{ textAlign: 'center', fontSize: '0.85em' }}>
        {venta.dte?.mensajeLegal ??
          'Comprobante de Pago Electronico. Voucher valido como Boleta Electronica segun Res. Exenta N° 176 del SII.'}
      </Box>
    </Box>
  )
}
