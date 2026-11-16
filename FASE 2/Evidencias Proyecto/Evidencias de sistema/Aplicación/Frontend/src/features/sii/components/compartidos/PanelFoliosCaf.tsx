// src/features/sii/components/compartidos/PanelFoliosCaf.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import { formatFechaSola } from '@/shared/utils/formatFecha'
import type { EstadoCaf } from '@/features/sii/types'

type Props = {
  folios: EstadoCaf[]
  cargando: boolean
}

// bajo 20% conviene pedir folios nuevos al sii
const UMBRAL_AVISO = 20

// stock de folios autorizados por tipo de documento
export function PanelFoliosCaf({ folios, cargando }: Props) {
  if (cargando) return <Skeleton variant="rounded" height={260} />

  const porAgotarse = folios.filter((caf) => caf.porcentajeDisponible < UMBRAL_AVISO)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Alert severity={porAgotarse.length > 0 ? 'warning' : 'info'}>
        {porAgotarse.length > 0
          ? `Quedan pocos folios de: ${porAgotarse.map((caf) => caf.nombreDte).join(', ')}. Hay que pedir un CAF nuevo en el sitio del SII.`
          : 'Los folios son los numeros que el SII autoriza para emitir documentos. Sin folios no se puede emitir boleta.'}
      </Alert>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {folios.map((caf) => {
          const usado = 100 - caf.porcentajeDisponible

          return (
            <Paper key={caf.tipoDte} variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, flexGrow: 1 }}>
                  {caf.nombreDte}
                </Typography>
                <Chip
                  label={caf.activo ? 'ACTIVO' : 'INACTIVO'}
                  size="small"
                  color={caf.activo ? 'success' : 'default'}
                  variant="outlined"
                  sx={{ fontWeight: 700, fontSize: 10 }}
                />
              </Box>

              <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {caf.foliosDisponibles.toLocaleString('es-CL')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                folios disponibles
              </Typography>

              <LinearProgress
                variant="determinate"
                value={usado}
                color={caf.porcentajeDisponible < UMBRAL_AVISO ? 'warning' : 'primary'}
                sx={{ my: 1, height: 6, borderRadius: 3 }}
              />

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Rango {caf.folioDesde} al {caf.folioHasta} · ultimo usado {caf.ultimoUsado}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Tipo {caf.tipoDte} · autorizado el {formatFechaSola(caf.fechaAutorizacion)}
              </Typography>
            </Paper>
          )
        })}
      </Box>

      <Typography variant="caption" color="text.secondary">
        El backend sabe importar un CAF real desde su XML (POST /dte/caf/upload), pero estos folios los genera solo
        para poder trabajar: no vienen de un archivo descargado del SII.
      </Typography>
    </Box>
  )
}
