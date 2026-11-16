// src/features/proveedores/components/tecnico/PanelEnvioOrdenes.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import MarkEmailReadOutlined from '@mui/icons-material/MarkEmailReadOutlined'
import { useEnviarOrdenesPorCorreo } from '@/features/replenishment/hooks/useReplenishment'
import { useCorreo } from '@/features/configuracion/hooks/useConfiguracion'

type Props = {
  cantidadOrdenes: number
}

// despacho de las ordenes sugeridas por correo (el backend no tiene envio por whatsapp)
export function PanelEnvioOrdenes({ cantidadOrdenes }: Props) {
  const config = useCorreo()
  const envio = useEnviarOrdenesPorCorreo()

  const correo = config.data?.email ?? ''
  const hayCorreo = correo.trim().length > 0
  const puedeEnviar = hayCorreo && cantidadOrdenes > 0

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <MarkEmailReadOutlined color="action" fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Despacho de ordenes
        </Typography>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        {hayCorreo
          ? `Se envian a ${correo}.`
          : 'No hay correo configurado en el backend, asi que no hay a donde mandarlas.'}
      </Typography>

      <Tooltip
        title={
          !hayCorreo
            ? 'Falta configurar el correo de notificaciones en el backend'
            : cantidadOrdenes === 0
              ? 'No hay ordenes sugeridas para enviar'
              : ''
        }
      >
        <span>
          <Button
            fullWidth
            variant="outlined"
            size="small"
            disabled={!puedeEnviar || envio.isPending}
            onClick={() => envio.mutate(correo)}
          >
            {envio.isPending ? 'Enviando...' : `Enviar ${cantidadOrdenes} ordenes por correo`}
          </Button>
        </span>
      </Tooltip>

      {envio.isSuccess && (
        <Alert severity="success" sx={{ mt: 1.5 }}>
          {envio.data.message}
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
            Ojo: el backend deja las ordenes en estado "enviada", pero todavia no despacha el correo de verdad.
          </Typography>
        </Alert>
      )}

      {envio.isError && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {envio.error.message}
        </Alert>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        El unico canal que existe es el correo (no hay WhatsApp Cloud API ni plantillas HSM), y por ahora el envio
        esta simulado: el backend registra las ordenes como enviadas pero no despacha el mensaje.
      </Typography>
    </Paper>
  )
}
