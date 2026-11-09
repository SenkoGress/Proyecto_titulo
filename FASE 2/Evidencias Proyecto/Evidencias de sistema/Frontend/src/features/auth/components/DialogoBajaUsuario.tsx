// src/features/auth/components/DialogoBajaUsuario.tsx
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import { obtenerMensajeError } from '@/lib/api/apiError'
import { useDarDeBajaUsuario } from '@/features/auth/hooks/useAuth'
import type { Usuario } from '@/features/auth/types'

type Props = {
  usuario: Usuario
  onCerrar: () => void
}

// dar de baja no siempre borra: quien ya vendio o cerro caja queda desactivado, porque sus
// cierres son registro tributario y borrarlos se los llevaria
export function DialogoBajaUsuario({ usuario, onCerrar }: Props) {
  const baja = useDarDeBajaUsuario()

  const hecho = baja.data

  return (
    <Dialog open onClose={onCerrar} maxWidth="xs" fullWidth>
      <DialogTitle>Dar de baja a {usuario.nombre}</DialogTitle>

      <DialogContent dividers>
        {!hecho && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="body2">
              {usuario.nombre} ({usuario.email}) no va a poder entrar al sistema.
            </Typography>

            <Alert severity="info">
              Si esta persona ya hizo ventas o cerro caja, no se elimina: queda desactivada y su
              historial se conserva. Si nunca vendio, se elimina del todo.
            </Alert>

            <Typography variant="caption" color="text.secondary">
              Si tiene la sesion abierta, deja de valer al instante.
            </Typography>
          </Box>
        )}

        {hecho && (
          <Alert severity={hecho.desactivado ? 'warning' : 'success'}>
            {hecho.desactivado
              ? `${usuario.nombre} quedo desactivado y su historial se conserva. Puedes reactivarlo cuando quieras.`
              : `${usuario.nombre} fue eliminado del local.`}
          </Alert>
        )}

        {baja.isError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {obtenerMensajeError(baja.error)}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {hecho ? (
          <Button variant="contained" onClick={onCerrar} autoFocus>
            Listo
          </Button>
        ) : (
          <>
            <Button onClick={onCerrar}>Cancelar</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => baja.mutate(usuario.id)}
              disabled={baja.isPending}
            >
              {baja.isPending ? 'Dando de baja...' : 'Dar de baja'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
