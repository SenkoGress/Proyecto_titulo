// src/shared/components/layout/IndicadorClima.tsx
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import CloudIcon from '@mui/icons-material/Cloud'
import BlurOnIcon from '@mui/icons-material/BlurOn'
import GrainIcon from '@mui/icons-material/Grain'
import AcUnitIcon from '@mui/icons-material/AcUnit'
import ThunderstormIcon from '@mui/icons-material/Thunderstorm'
import { useClima } from '@/features/clima/hooks/useClima'
import { avisoDelDia, describirClima } from '@/features/clima/utils/codigoClima'
import type { TipoClima } from '@/features/clima/utils/codigoClima'

const ICONOS = {
  despejado: WbSunnyIcon,
  nubes: CloudIcon,
  niebla: BlurOnIcon,
  lluvia: GrainIcon,
  nieve: AcUnitIcon,
  tormenta: ThunderstormIcon,
} as const satisfies Record<TipoClima, unknown>

// del tema, que ya trae su tono para claro y para oscuro
const COLORES = {
  calor: 'warning.main',
  frio: 'info.main',
  lluvia: 'info.main',
} as const

type Props = {
  // en modo tecnico va mas apretado y sin el aviso al lado
  compacto?: boolean
}

// clima de hoy junto al reloj
export function IndicadorClima({ compacto = false }: Props) {
  const { data: clima } = useClima()

  // sin comuna configurada o sin internet no se muestra nada
  if (!clima) return null

  const { texto, tipo } = describirClima(clima.codigo)
  const Icono = ICONOS[tipo]
  const aviso = avisoDelDia(clima)

  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
            {texto} en {clima.lugar}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            Maxima {clima.maxima}° y minima {clima.minima}°
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            Probabilidad de lluvia {clima.probabilidadLluvia}%
          </Typography>
          {aviso && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              {aviso.detalle}
            </Typography>
          )}
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7 }}>
            Medido a las {clima.medidoA.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
          </Typography>
        </Box>
      }
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'help' }}>
        <Icono fontSize="small" sx={{ color: aviso ? COLORES[aviso.tono] : 'text.disabled' }} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {clima.temperatura}°
        </Typography>

        {/* el aviso va a la vista: la caja es pantalla tactil y ahi no hay tooltip */}
        {aviso && !compacto && (
          <Typography
            variant="body2"
            sx={{ color: COLORES[aviso.tono], display: { xs: 'none', md: 'block' } }}
          >
            {aviso.corto}
          </Typography>
        )}
      </Box>
    </Tooltip>
  )
}
