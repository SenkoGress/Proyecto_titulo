// src/features/configuracion/components/SeccionCorreo.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import MailOutlineOutlined from '@mui/icons-material/MailOutlineOutlined'
import { Seccion } from '@/features/configuracion/components/Seccion'
import { useCorreo, useGuardarCorreo } from '@/features/configuracion/hooks/useConfiguracion'

// formato minimo de correo, igual de permisivo que el backend
function esCorreoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())
}

// correo al que llegan las ordenes de compra sugeridas
export function SeccionCorreo() {
  const config = useCorreo()
  const guardar = useGuardarCorreo()

  // null = todavia no lo editan
  const [correoEditado, setCorreoEditado] = useState<string | null>(null)
  const [autoEditado, setAutoEditado] = useState<boolean | null>(null)

  const correo = correoEditado ?? config.data?.email ?? ''
  const envioAutomatico = autoEditado ?? config.data?.auto_send ?? false

  const valido = esCorreoValido(correo)
  const cambio = valido && (correo !== (config.data?.email ?? '') || envioAutomatico !== config.data?.auto_send)

  return (
    <Seccion
      titulo="Correo para pedidos"
      descripcion="A donde se envian las ordenes de compra que sugiere el sistema cuando hay stock bajo."
      icono={<MailOutlineOutlined />}
      origen="servidor"
    >
      {config.isPending ? (
        <Skeleton variant="rounded" height={90} />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <TextField
              label="Correo de destino"
              type="email"
              size="small"
              value={correo}
              onChange={(evento) => setCorreoEditado(evento.target.value)}
              placeholder="pedidos@mialmacen.cl"
              error={correo.trim() !== '' && !valido}
              helperText={correo.trim() !== '' && !valido ? 'Correo invalido' : ' '}
              sx={{ flexGrow: 1, minWidth: 260 }}
            />

            <Button
              variant="contained"
              onClick={() => guardar.mutate({ correo: correo.trim(), envioAutomatico })}
              disabled={!cambio || guardar.isPending}
              sx={{ mt: 0.25 }}
            >
              {guardar.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={envioAutomatico}
                onChange={(evento) => setAutoEditado(evento.target.checked)}
              />
            }
            label="Enviar las ordenes automaticamente cuando se detecte stock bajo"
          />
        </Box>
      )}

      {!config.isPending && !config.data?.email && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Sin correo configurado, el boton de enviar ordenes queda deshabilitado en Proveedores y en el panel tecnico.
        </Alert>
      )}

      {guardar.isSuccess && !cambio && (
        <Alert severity="success" sx={{ mt: 1 }}>
          {guardar.data.message}
        </Alert>
      )}

      {guardar.isError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {guardar.error.message}
        </Alert>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        El servidor ademas necesita tener configurado el envio de correos para que esto funcione de verdad.
      </Typography>
    </Seccion>
  )
}
