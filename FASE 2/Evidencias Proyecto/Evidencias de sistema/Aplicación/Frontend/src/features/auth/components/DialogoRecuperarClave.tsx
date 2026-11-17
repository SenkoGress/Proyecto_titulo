// src/features/auth/components/DialogoRecuperarClave.tsx
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import { obtenerMensajeError } from '@/lib/api/apiError'
import { usePedirCodigoDeClave, useRestablecerClave } from '@/features/auth/hooks/useAuth'

type Props = {
  correoInicial: string
  onCerrar: () => void
  onClaveCambiada: (mensaje: string) => void
}

const LARGO_MINIMO = 8
const LARGO_CODIGO = 6

// dos pasos en la misma ventana: pedir el codigo que llega por correo y canjearlo por una clave
// nueva. Solo sirve para el administrador; a un cajero la clave se la cambia el administrador
export function DialogoRecuperarClave({ correoInicial, onCerrar, onClaveCambiada }: Props) {
  const [email, setEmail] = useState(correoInicial)
  const [codigo, setCodigo] = useState('')
  const [password, setPassword] = useState('')

  const pedir = usePedirCodigoDeClave()
  const restablecer = useRestablecerClave()

  const codigoPedido = pedir.isSuccess
  const claveCorta = password.length > 0 && password.length < LARGO_MINIMO
  const listoParaCambiar = codigo.length === LARGO_CODIGO && password.length >= LARGO_MINIMO

  function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    if (!codigoPedido) {
      if (email.trim()) pedir.mutate(email.trim())
      return
    }
    if (!listoParaCambiar) return
    restablecer.mutate(
      { email: email.trim(), codigo, password_nueva: password },
      { onSuccess: (respuesta) => onClaveCambiada(respuesta.message) },
    )
  }

  function pedirOtroCodigo() {
    setCodigo('')
    restablecer.reset()
    pedir.reset()
  }

  const error = restablecer.error ?? pedir.error
  const ocupado = pedir.isPending || restablecer.isPending

  return (
    <Dialog open onClose={onCerrar} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={enviar}>
        <DialogTitle>Recuperar la contraseña</DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
            {!codigoPedido ? (
              <>
                <Typography variant="body2" color="text.secondary">
                  Te enviamos un codigo al correo del administrador del local. Si eres cajero,
                  pidele al administrador que te cambie la clave.
                </Typography>

                <TextField
                  label="Correo del administrador"
                  type="email"
                  value={email}
                  onChange={(evento) => setEmail(evento.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                  fullWidth
                />
              </>
            ) : (
              <>
                <Alert severity="info">{pedir.data?.message}</Alert>

                <TextField
                  label="Codigo de 6 digitos"
                  value={codigo}
                  onChange={(evento) =>
                    setCodigo(evento.target.value.replace(/\D/g, '').slice(0, LARGO_CODIGO))
                  }
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  fullWidth
                  slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                />

                <TextField
                  label="Clave nueva"
                  type="password"
                  value={password}
                  onChange={(evento) => setPassword(evento.target.value)}
                  autoComplete="new-password"
                  error={claveCorta}
                  helperText={`Al menos ${LARGO_MINIMO} caracteres`}
                  required
                  fullWidth
                />
              </>
            )}

            {error && <Alert severity="error">{obtenerMensajeError(error)}</Alert>}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          {codigoPedido && (
            <Button onClick={pedirOtroCodigo} disabled={ocupado} sx={{ mr: 'auto' }}>
              Pedir otro codigo
            </Button>
          )}
          <Button onClick={onCerrar}>Cancelar</Button>
          {!codigoPedido ? (
            <Button type="submit" variant="contained" disabled={!email.trim() || ocupado}>
              {pedir.isPending ? 'Enviando...' : 'Enviar codigo'}
            </Button>
          ) : (
            <Button type="submit" variant="contained" disabled={!listoParaCambiar || ocupado}>
              {restablecer.isPending ? 'Cambiando...' : 'Cambiar clave'}
            </Button>
          )}
        </DialogActions>
      </Box>
    </Dialog>
  )
}
