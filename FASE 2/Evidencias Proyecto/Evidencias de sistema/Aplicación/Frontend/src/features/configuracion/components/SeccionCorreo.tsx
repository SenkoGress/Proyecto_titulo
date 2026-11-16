// src/features/configuracion/components/SeccionCorreo.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import MailOutlineOutlined from '@mui/icons-material/MailOutlineOutlined'
import { Seccion } from '@/features/configuracion/components/Seccion'
import { useCorreo, useGuardarCorreo } from '@/features/configuracion/hooks/useConfiguracion'
import { DIAS_AVISO, esHoraValida, textoHorarioAviso } from '@/features/configuracion/utils/horarioAviso'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'

// formato minimo de correo, igual de permisivo que el backend
function esCorreoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())
}

// correo al que llegan las ordenes de compra sugeridas, y cuando salen
export function SeccionCorreo() {
  const config = useCorreo()
  const guardar = useGuardarCorreo()

  // null = todavia no lo editan
  const [correoEditado, setCorreoEditado] = useState<string | null>(null)
  const [autoEditado, setAutoEditado] = useState<boolean | null>(null)
  const [diaEditado, setDiaEditado] = useState<number | null>(null)
  const [horaEditada, setHoraEditada] = useState<string | null>(null)

  const guardado = config.data
  const correo = correoEditado ?? guardado?.email ?? ''
  const envioAutomatico = autoEditado ?? guardado?.auto_send ?? false
  const dia = diaEditado ?? guardado?.dia_envio ?? 0
  const hora = horaEditada ?? guardado?.hora_envio ?? ''

  const valido = esCorreoValido(correo) && esHoraValida(hora)
  const cambio =
    valido &&
    (correo !== (guardado?.email ?? '') ||
      envioAutomatico !== guardado?.auto_send ||
      dia !== guardado?.dia_envio ||
      hora !== guardado?.hora_envio)

  const resumen = textoHorarioAviso(dia, hora)

  return (
    <Seccion
      titulo="Correo para pedidos"
      descripcion="A donde se envian las ordenes de compra que sugiere el sistema cuando hay stock bajo, y que dia salen."
      icono={<MailOutlineOutlined />}
      origen="servidor"
    >
      {config.isPending && <Skeleton variant="rounded" height={150} />}

      {/* sin la respuesta del servidor no hay horario que mostrar, y no corresponde suponerlo */}
      {config.isError && <ErrorBox error={config.error} />}

      {guardado && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <TextField
              label="Correo de destino"
              type="email"
              size="small"
              value={correo}
              onChange={(evento) => setCorreoEditado(evento.target.value)}
              placeholder="pedidos@mialmacen.cl"
              error={correo.trim() !== '' && !esCorreoValido(correo)}
              helperText={correo.trim() !== '' && !esCorreoValido(correo) ? 'Correo invalido' : ' '}
              sx={{ flexGrow: 1, minWidth: 260 }}
            />

            <Button
              variant="contained"
              onClick={() =>
                guardar.mutate({
                  correo: correo.trim(),
                  envioAutomatico,
                  diaEnvio: dia,
                  horaEnvio: hora,
                })
              }
              disabled={!cambio || guardar.isPending}
              sx={{ mt: 0.25 }}
            >
              {guardar.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <TextField
              select
              label="Dia del aviso"
              size="small"
              value={dia}
              onChange={(evento) => setDiaEditado(Number(evento.target.value))}
              sx={{ minWidth: 160 }}
            >
              {DIAS_AVISO.map((opcion) => (
                <MenuItem key={opcion.valor} value={opcion.valor}>
                  {opcion.nombre}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Hora"
              type="time"
              size="small"
              value={hora}
              onChange={(evento) => setHoraEditada(evento.target.value)}
              error={hora !== '' && !esHoraValida(hora)}
              sx={{ minWidth: 130 }}
            />
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

          {resumen && (
            <Typography variant="body2" color="text.secondary">
              {envioAutomatico
                ? resumen
                : `${resumen} Hoy no sale, porque el envio automatico esta apagado.`}
            </Typography>
          )}
        </Box>
      )}

      {guardado && !guardado.email && (
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
        El servidor revisa cada minuto si corresponde mandar el aviso del dia.
      </Typography>
    </Seccion>
  )
}
