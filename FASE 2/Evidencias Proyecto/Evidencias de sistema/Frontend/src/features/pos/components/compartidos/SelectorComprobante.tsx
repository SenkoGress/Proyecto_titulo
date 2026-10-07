// src/features/pos/components/compartidos/SelectorComprobante.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import ReceiptOutlined from '@mui/icons-material/ReceiptOutlined'
import BusinessOutlined from '@mui/icons-material/BusinessOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import { DialogoReceptorFactura } from '@/features/pos/components/compartidos/DialogoReceptorFactura'
import type { TipoComprobante } from '@/features/pos/types'

// boleta o factura: la factura pide los datos de la empresa
export function SelectorComprobante() {
  const tipo = useCarritoStore((estado) => estado.tipoComprobante)
  const receptor = useCarritoStore((estado) => estado.receptorEmpresa)
  const cambiarTipo = useCarritoStore((estado) => estado.cambiarTipoComprobante)

  const [pidiendoDatos, setPidiendoDatos] = useState(false)

  const elegir = (valor: TipoComprobante | null) => {
    if (!valor) return
    cambiarTipo(valor)
    // al pasar a factura hay que capturar el receptor de inmediato
    if (valor === 'FACTURA') setPidiendoDatos(true)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <ToggleButtonGroup value={tipo} exclusive size="small" fullWidth onChange={(_, valor) => elegir(valor)}>
        <ToggleButton value="BOLETA">
          <ReceiptOutlined fontSize="small" sx={{ mr: 0.75 }} />
          Boleta
        </ToggleButton>
        <ToggleButton value="FACTURA">
          <BusinessOutlined fontSize="small" sx={{ mr: 0.75 }} />
          Factura
        </ToggleButton>
      </ToggleButtonGroup>

      {tipo === 'FACTURA' &&
        (receptor ? (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip label={receptor.rut} size="small" color="primary" variant="outlined" />
            <Typography variant="caption" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
              {receptor.razon_social}
            </Typography>
            <Button size="small" startIcon={<EditOutlined />} onClick={() => setPidiendoDatos(true)}>
              Cambiar
            </Button>
          </Box>
        ) : (
          <Button size="small" color="warning" onClick={() => setPidiendoDatos(true)}>
            Faltan los datos de la empresa
          </Button>
        ))}

      {pidiendoDatos && <DialogoReceptorFactura onCerrar={() => setPidiendoDatos(false)} />}
    </Box>
  )
}
