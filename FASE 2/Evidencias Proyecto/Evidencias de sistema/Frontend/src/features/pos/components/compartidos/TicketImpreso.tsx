// src/features/pos/components/compartidos/TicketImpreso.tsx
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import { QRCodeSVG } from 'qrcode.react'
import { formatoClp } from '@/shared/utils/formatoClp'
import { formatFecha } from '@/shared/utils/formatFecha'
import { env } from '@/config/env'
import { nombreDocumentoDte } from '@/features/dte/utils/nombreDte'
import type { ComprobanteDte } from '@/features/dte/types'
import type { EmisorFiscal } from '@/features/dte/types'

type Props = {
  comprobante: ComprobanteDte
  emisor: EmisorFiscal | undefined
  metodoPago: string
  ajusteRedondeo: number
}

// ancho de un ticket termico de 80mm
const ANCHO_TICKET = 320

// linea de separacion igual a la del papel
function Separador() {
  return <Divider sx={{ my: 0.75, borderStyle: 'dashed' }} />
}

// fila etiqueta / valor del ticket
function Fila({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, fontWeight: fuerte ? 700 : 400 }}>
      <Box component="span">{etiqueta}</Box>
      <Box component="span">{valor}</Box>
    </Box>
  )
}

// representacion del ticket tal como se imprime en papel de 80mm
export function TicketImpreso({ comprobante, emisor, metodoPago, ajusteRedondeo }: Props) {
  const { neto, iva, exento, total } = comprobante.totales

  // lo que sobra despues de neto, iva, exento y el redondeo es el impuesto adicional
  const ila = Math.max(0, total - neto - iva - exento - ajusteRedondeo)

  return (
    <Box
      id="ticket-impreso"
      sx={{
        width: ANCHO_TICKET,
        maxWidth: '100%',
        mx: 'auto',
        p: 2,
        bgcolor: 'background.paper',
        color: 'text.primary',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: 1.6,
      }}
    >
      {/* emisor */}
      <Box sx={{ textAlign: 'center' }}>
        <Box sx={{ fontWeight: 700 }}>{comprobante.emisor.razonSocial}</Box>
        <Box>RUT: {comprobante.emisor.rut}</Box>
        {emisor && (
          <>
            <Box>GIRO: {emisor.giro}</Box>
            <Box>{emisor.direccion}</Box>
            <Box>
              {emisor.comuna} - {emisor.ciudad}
            </Box>
          </>
        )}
      </Box>

      <Separador />

      <Box sx={{ textAlign: 'center', fontWeight: 700 }}>
        {nombreDocumentoDte(comprobante.tipoDte, comprobante.nombreDocumento)} N°{' '}
        {String(comprobante.folio).padStart(6, '0')}
      </Box>

      <Separador />

      <Fila etiqueta="FECHA:" valor={formatFecha(comprobante.fechaEmision)} />
      <Fila etiqueta="CAJERO:" valor={env.cajeroNombre} />
      <Fila etiqueta="CLIENTE:" valor={comprobante.receptor.rut ?? 'Consumidor final'} />
      <Fila etiqueta="MEDIO DE PAGO:" valor={metodoPago} />

      <Separador />

      {/* detalle */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
        <Box component="span">CANT DETALLE</Box>
        <Box component="span">TOTAL</Box>
      </Box>

      {comprobante.items.map((item) => (
        <Box key={item.sku} sx={{ mt: 0.5 }}>
          <Box>{item.nombre}</Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box component="span">
              {item.cantidad} x {formatoClp(item.precio_unitario)}
            </Box>
            <Box component="span">{formatoClp(item.subtotal)}</Box>
          </Box>
        </Box>
      ))}

      <Separador />

      <Fila etiqueta="MONTO NETO:" valor={formatoClp(comprobante.totales.neto)} />
      <Fila etiqueta="IVA (19%):" valor={formatoClp(comprobante.totales.iva)} />
      {comprobante.totales.exento > 0 && (
        <Fila etiqueta="EXENTO:" valor={formatoClp(comprobante.totales.exento)} />
      )}
      {/* el comprobante del backend no trae el ILA por separado, se deduce para que
          los montos del ticket cuadren con el total */}
      {ila > 0 && <Fila etiqueta="IMPUESTO ADICIONAL ILA:" valor={formatoClp(ila)} />}
      {ajusteRedondeo !== 0 && (
        <Fila
          etiqueta="LEY REDONDEO (20.956):"
          valor={`${ajusteRedondeo > 0 ? '+' : ''}${ajusteRedondeo}`}
        />
      )}

      <Separador />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}>
        <Box component="span">TOTAL A PAGAR:</Box>
        <Box component="span">{formatoClp(comprobante.totales.total)}</Box>
      </Box>

      <Separador />

      {/* timbre electronico */}
      <Box sx={{ textAlign: 'center', mt: 1 }}>
        <Box sx={{ fontWeight: 700 }}>TIMBRE ELECTRONICO DTE</Box>
        <Box sx={{ fontSize: 10 }}>{comprobante.leyendaFiscal}</Box>

        {/* el qr se genera aca mismo: el timbre no sale del equipo */}
        <Box sx={{ display: 'inline-flex', bgcolor: 'common.white', p: 1, borderRadius: 1, my: 1 }}>
          <QRCodeSVG value={comprobante.qrCodeUrl} size={140} level="M" />
        </Box>

        <Box sx={{ fontSize: 10 }}>Verifique su documento en www.sii.cl</Box>
      </Box>

      <Separador />

      <Box sx={{ textAlign: 'center', fontSize: 10 }}>
        <Box>GRACIAS POR SU COMPRA</Box>
        <Box>Sistema GesTock POS</Box>
      </Box>
    </Box>
  )
}
