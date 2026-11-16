// src/shared/components/layout/EstadoConexion.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import { obtenerColoresMenu } from '@/app/theme/theme'
import { useModoTema } from '@/shared/stores/temaStore'
import { useEstadoPos } from '@/features/pos/hooks/usePos'
import { useEsModoTecnico } from '@/shared/stores/modoVistaStore'
import { formatFecha, haceCuanto } from '@/shared/utils/formatFecha'
import type { EstadoPos } from '@/features/pos/types'
import { avisoModoPagos } from '@/features/pos/utils/modoPagos'

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

  // el modo de cobro no se ve en ninguna parte, y en simulado la tarjeta aprueba sin cobrar.
  // Va aca y no en el aviso de espera porque en simulado el cobro es instantaneo: no se alcanza a leer
  const modo = avisoModoPagos(data?.modo)

  return (
    <Box sx={{ px: 2, py: 1, flexShrink: 0 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: estado.color }} />
        <Typography variant="caption" sx={{ color: estado.color, fontWeight: 700 }}>
          {estado.titulo}
        </Typography>
      </Box>

      {modo && (
        <Tooltip title={modo.detalle}>
          <Chip
            size="small"
            color={modo.tono}
            label={modo.texto}
            sx={{ mt: 0.75, height: 20, fontSize: 10, fontWeight: 700, cursor: 'help' }}
          />
        </Tooltip>
      )}

      <Typography variant="caption" sx={{ color: coloresMenu.textoApagado, display: 'block' }}>
        {data ? data.device_id : 'Terminal local'}
      </Typography>

      {/* la fecha de la ultima subida vivia solo en el tooltip del modo tecnico: en modo visual no
          habia forma de saber desde cuando no se sube nada */}
      {data && (
        <Tooltip title={`Ultima subida a la nube: ${formatFecha(data.last_synced_at)}`}>
          <Typography
            variant="caption"
            sx={{ color: coloresMenu.textoApagado, display: 'block', cursor: 'help' }}
          >
            Se subio {haceCuanto(data.last_synced_at)}
          </Typography>
        </Tooltip>
      )}

      {esModoTecnico && data && (
        <Typography variant="caption" sx={{ color: coloresMenu.textoApagado, display: 'block' }}>
          {data.pending_dirty_count} ventas por subir
        </Typography>
      )}
    </Box>
  )
}
