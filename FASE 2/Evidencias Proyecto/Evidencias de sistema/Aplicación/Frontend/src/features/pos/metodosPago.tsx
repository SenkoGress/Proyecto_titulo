// src/features/pos/metodosPago.tsx
import type { ReactNode } from 'react'
import PaymentsIcon from '@mui/icons-material/Payments'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import ContactlessIcon from '@mui/icons-material/Contactless'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import type { MetodoPago } from '@/features/pos/types'

type OpcionPago = {
  valor: MetodoPago
  etiqueta: string
  icono: ReactNode
}

// medios de pago del backend (tecla 1 a 5 en modo tecnico)
export const METODOS_PAGO: OpcionPago[] = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo', icono: <PaymentsIcon fontSize="small" /> },
  { valor: 'TRANSBANK', etiqueta: 'Transbank', icono: <CreditCardIcon fontSize="small" /> },
  { valor: 'MERCADOPAGO', etiqueta: 'Mercado Pago', icono: <QrCode2Icon fontSize="small" /> },
  { valor: 'SUMUP', etiqueta: 'SumUp', icono: <ContactlessIcon fontSize="small" /> },
  { valor: 'RUTPAY', etiqueta: 'RutPay', icono: <AccountBalanceIcon fontSize="small" /> },
]
