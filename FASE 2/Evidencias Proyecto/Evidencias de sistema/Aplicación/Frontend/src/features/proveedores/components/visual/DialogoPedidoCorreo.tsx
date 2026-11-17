// src/features/proveedores/components/visual/DialogoPedidoCorreo.tsx
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import EmailOutlined from '@mui/icons-material/EmailOutlined'
import { obtenerMensajeError } from '@/lib/api/apiError'
import { useConfigDte } from '@/features/dte/hooks/useConfigDte'
import { useEnviarPedidoPorCorreo } from '@/features/proveedores/hooks/useProveedores'
import { textoPedido, tieneCorreo } from '@/features/proveedores/utils/pedidoCorreo'
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

type Props = {
  ficha: FichaProveedor
  onCerrar: () => void
}

// revisar el mensaje antes de mandarle el pedido al proveedor por correo
export function DialogoPedidoCorreo({ ficha, onCerrar }: Props) {
  const configDte = useConfigDte()
  const nombreLocal = configDte.data?.emisor.razonSocial ?? 'el local'
  const envio = useEnviarPedidoPorCorreo()

  // null = todavia no lo tocan, se muestra el borrador automatico
  const [editado, setEditado] = useState<string | null>(null)
  const mensaje = editado ?? textoPedido(ficha, nombreLocal)
  const hayCorreo = tieneCorreo(ficha.email)

  return (
    <Dialog open onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Pedido a {ficha.nombre_proveedores}</DialogTitle>

      <DialogContent dividers>
        {hayCorreo ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            El pedido sale desde GesTock al correo del proveedor, y su respuesta llega al correo del local. No queda
            registrado como orden de compra.
          </Alert>
        ) : (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Este proveedor no tiene un correo guardado. Agregalo en su ficha para poder enviarle el pedido.
          </Alert>
        )}

        <TextField
          label={hayCorreo ? `Mensaje para ${ficha.email}` : 'Mensaje'}
          value={mensaje}
          onChange={(evento) => setEditado(evento.target.value)}
          multiline
          minRows={8}
          fullWidth
          disabled={envio.isSuccess}
        />

        {envio.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {obtenerMensajeError(envio.error)}
          </Alert>
        )}
        {envio.isSuccess && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {envio.data.message}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCerrar}>{envio.isSuccess ? 'Cerrar' : 'Cancelar'}</Button>
        {!envio.isSuccess && (
          <Button
            variant="contained"
            startIcon={<EmailOutlined />}
            onClick={() => envio.mutate({ id: ficha.id, mensaje })}
            disabled={!hayCorreo || !mensaje.trim() || envio.isPending}
          >
            {envio.isPending ? 'Enviando...' : 'Enviar por correo'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
