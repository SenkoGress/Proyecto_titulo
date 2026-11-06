// src/features/sii/components/compartidos/PanelEnvioSii.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Skeleton from '@mui/material/Skeleton'
import SendOutlined from '@mui/icons-material/SendOutlined'
import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import { descargarSobre } from '@/features/sii/api/sii.api'
import { useEnviarAlSii, useEstadoEnvioSii } from '@/features/sii/hooks/useSii'
import { avisoFoliosProvisionales, envioSalioCompleto } from '@/features/sii/utils/envioSii'

// lo que el local tiene emitido y todavia no llega al sii
export function PanelEnvioSii() {
  const estado = useEstadoEnvioSii()
  const enviar = useEnviarAlSii()

  if (estado.isPending) return <Skeleton variant="rounded" height={240} />

  if (estado.isError || !estado.data) {
    return <Alert severity="error">No se pudo leer el estado del envio al SII.</Alert>
  }

  const { pendientes_count, provisionales_count, puede_enviar, faltantes, ambiente } = estado.data
  const resultado = enviar.data
  const salioBien = envioSalioCompleto(resultado)
  const provisionales = avisoFoliosProvisionales(provisionales_count)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ flexGrow: 1, minWidth: 220 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Documentos esperando al SII
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {pendientes_count.toLocaleString('es-CL')}
            </Typography>
          </Box>

          <Chip label={ambiente} size="small" variant="outlined" sx={{ fontSize: 10, fontWeight: 700 }} />

          <Button
            variant="contained"
            startIcon={<SendOutlined />}
            disabled={!puede_enviar || pendientes_count === 0 || enviar.isPending}
            onClick={() => enviar.mutate(undefined)}
          >
            {enviar.isPending ? 'Enviando...' : `Enviar al SII (${pendientes_count})`}
          </Button>
        </Box>

        {provisionales && <Alert severity="warning">{provisionales}</Alert>}

        {/* el detalle viene redactado por el servidor para mostrarse tal cual */}
        {!puede_enviar && faltantes.length > 0 && (
          <Alert severity="info">
            <AlertTitle>Que falta para poder enviar</AlertTitle>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {faltantes.map((falta) => (
                <li key={falta.requisito}>
                  <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
                    {falta.requisito}:
                  </Typography>{' '}
                  <Typography variant="body2" component="span">
                    {falta.detalle}
                  </Typography>
                </li>
              ))}
            </Box>
          </Alert>
        )}
      </Paper>

      {enviar.isError && (
        <Alert severity="error">No se pudo preparar el envio. Los documentos siguen en la cola.</Alert>
      )}

      {/* que el sobre quede preparado sin viajar no es un fallo, pero tampoco una buena noticia */}
      {resultado && (
        <Alert severity={salioBien ? 'success' : 'warning'}>
          {resultado.mensaje}
        </Alert>
      )}

      {resultado && resultado.sobres.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Sobres preparados
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Las boletas viajan en un sobre y el resto de los documentos en otro. Se suben a mano en el
            portal del SII.
          </Typography>

          {resultado.sobres.map((sobre) => (
            <Box
              key={sobre.envio_id}
              sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {sobre.tipo_sobre}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {sobre.documentos === 1 ? '1 documento' : `${sobre.documentos} documentos`}
                  {sobre.track_id ? ` · seguimiento ${sobre.track_id}` : ''}
                </Typography>
              </Box>

              <Button
                size="small"
                startIcon={<DownloadOutlined />}
                onClick={() => descargarSobre(sobre.envio_id, sobre.tipo_sobre)}
              >
                Descargar sobre
              </Button>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  )
}
