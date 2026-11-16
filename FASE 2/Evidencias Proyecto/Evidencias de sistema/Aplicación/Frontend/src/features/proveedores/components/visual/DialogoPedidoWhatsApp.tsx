// src/features/proveedores/components/visual/DialogoPedidoWhatsApp.tsx
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { useConfigDte } from '@/features/dte/hooks/useConfigDte'
import { enlaceWhatsApp, textoPedido } from '@/features/proveedores/utils/pedidoWhatsApp'
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

type Props = {
  ficha: FichaProveedor
  onCerrar: () => void
}

// revisar el mensaje antes de abrir whatsapp con el pedido escrito
export function DialogoPedidoWhatsApp({ ficha, onCerrar }: Props) {
  const configDte = useConfigDte()
  const nombreLocal = configDte.data?.emisor.razonSocial ?? 'el local'

  // null = todavia no lo tocan, se muestra el borrador automatico
  const [editado, setEditado] = useState<string | null>(null)
  const mensaje = editado ?? textoPedido(ficha, nombreLocal)

  const enviar = () => {
    window.open(enlaceWhatsApp(ficha.telefono, mensaje), '_blank', 'noopener,noreferrer')
    onCerrar()
  }

  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Pedido a {ficha.nombre_proveedores}</DialogTitle>

      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Esto abre WhatsApp con el mensaje escrito. El pedido no queda registrado en el sistema: el backend todavia no
          tiene endpoint para crear ordenes de compra desde aca.
        </Alert>

        <TextField
          label={`Mensaje para ${ficha.telefono}`}
          value={mensaje}
          onChange={(evento) => setEditado(evento.target.value)}
          multiline
          minRows={8}
          fullWidth
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button variant="contained" color="success" startIcon={<WhatsAppIcon />} onClick={enviar}>
          Abrir WhatsApp
        </Button>
      </DialogActions>
    </Dialog>
  )
}
