// src/features/ventas/components/compartidos/BotonReintentarVenta.tsx
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import ReplayOutlined from '@mui/icons-material/ReplayOutlined'
import { useReintentarVenta } from '@/features/ventas/hooks/useVentas'
import { estaDetenida } from '@/features/ventas/utils/sincronizacionVenta'
import type { FilaVenta } from '@/features/ventas/utils/filaVenta'

type Props = {
  venta: FilaVenta
  compacto?: boolean
}

// solo aparece en la venta que agoto sus intentos: el resto se reintenta solo
export function BotonReintentarVenta({ venta, compacto }: Props) {
  const reintentar = useReintentarVenta()

  if (!estaDetenida(venta)) return null

  // el backend la devuelve a la cola, pero recien viaja al sincronizar
  const titulo = reintentar.isSuccess
    ? 'Ya esta en la cola: sube al tocar Sincronizar'
    : 'Vuelve a poner esta venta en la cola para subirla a la nube'

  return (
    <Tooltip title={titulo}>
      <span>
        <Button
          size="small"
          color="warning"
          variant={reintentar.isSuccess ? 'text' : 'outlined'}
          startIcon={reintentar.isPending ? <CircularProgress size={14} /> : <ReplayOutlined />}
          onClick={() => reintentar.mutate(venta.id)}
          disabled={reintentar.isPending || reintentar.isSuccess}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {reintentar.isSuccess ? 'En la cola' : compacto ? 'Reintentar' : 'Reintentar subida'}
        </Button>
      </span>
    </Tooltip>
  )
}
