// src/shared/components/layout/BotonSincronizar.tsx
import Button from '@mui/material/Button'
import Badge from '@mui/material/Badge'
import CloudSyncIcon from '@mui/icons-material/CloudSync'
import { useEstadoPos, useSincronizar } from '@/features/pos/hooks/usePos'

// subir ventas pendientes a la nube
export function BotonSincronizar() {
  const { data: estado } = useEstadoPos()
  const sincronizar = useSincronizar()

  const pendientes = estado?.pending_dirty_count ?? 0

  return (
    <Badge badgeContent={pendientes} color="warning">
      <Button
        variant="outlined"
        size="small"
        startIcon={<CloudSyncIcon />}
        onClick={() => sincronizar.mutate()}
        disabled={sincronizar.isPending}
      >
        {sincronizar.isPending ? 'Sincronizando...' : 'Sincronizar'}
      </Button>
    </Badge>
  )
}
