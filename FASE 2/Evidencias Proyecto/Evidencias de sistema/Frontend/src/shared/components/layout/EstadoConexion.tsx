// src/shared/components/layout/EstadoConexion.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import { obtenerColoresMenu } from '@/app/theme/theme'
import { useModoTema } from '@/shared/stores/temaStore'
import { useEstadoPos } from '@/features/pos/hooks/usePos'
import { useEsModoTecnico } from '@/shared/stores/modoVistaStore'
import { formatFecha } from '@/shared/utils/formatFecha'
import type { EstadoPos } from '@/features/pos/types'

// texto y color por estado
const textos: Record<EstadoPos['status'], { titulo: string; color: string }> = {
  ONLINE: { titulo: 'EN LINEA', color: '#22c55e' },
  SYNC_PENDING: { titulo: 'VENTAS POR SUBIR', color: '#f59e0b' },
  OFFLINE: { titulo: 'SIN CONEXION', color: '#ef4444' },
}

// semaforo de conexion
export function EstadoConexion() {
  const { data, isPending } = useEstadoPos()
  const esModoTecnico = useEsModoTecnico()
  const coloresMenu = obtenerColoresMenu(useModoTema())

  if (isPending) {
    return (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', px: 2, py: 1, flexShrink: 0 }}>
        <CircularProgress size={12} />
        <Typography variant="caption" sx={{ color: coloresMenu.textoApagado }}>
          Revisando conexion...
        </Typography>
      </Box>
    )
  }

  // sin respuesta = desconectado
  const estado = data ? textos[data.status] : textos.OFFLINE

  return (
    <Box sx={{ px: 2, py: 1, flexShrink: 0 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: estado.color }} />
        <Typography variant="caption" sx={{ color: estado.color, fontWeight: 700 }}>
          {estado.titulo}
        </Typography>
      </Box>

      <Typography variant="caption" sx={{ color: coloresMenu.textoApagado, display: 'block' }}>
        {data ? data.device_id : 'Terminal local'}
      </Typography>

      {/* detalle modo tecnico */}
      {esModoTecnico && data && (
        <Tooltip title={`Ultima subida a la nube: ${formatFecha(data.last_synced_at)}`}>
          <Typography
            variant="caption"
            sx={{ color: coloresMenu.textoApagado, display: 'block', cursor: 'help' }}
          >
            {data.pending_dirty_count} ventas por subir
          </Typography>
        </Tooltip>
      )}
    </Box>
  )
}
