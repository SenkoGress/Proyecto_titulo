// src/shared/components/layout/BotonSincronizar.tsx
import Button from '@mui/material/Button'
import Badge from '@mui/material/Badge'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import CloudSyncIcon from '@mui/icons-material/CloudSync'
import { useEstadoPos, useSincronizar } from '@/features/pos/hooks/usePos'
import { resumenSincronizacion } from '@/features/pos/utils/resumenSincronizacion'

// subir ventas pendientes a la nube, y de paso la cola de facturas
export function BotonSincronizar() {
  const { data: estado } = useEstadoPos()
  const sincronizar = useSincronizar()

  const pendientes = estado?.pending_dirty_count ?? 0
  const resultado = sincronizar.data

  // documentos de factura que todavia estan solo en este equipo
  const sinRespaldar = resultado?.invoice_document_backup?.pendientes ?? 0
  const salioMal = sincronizar.isError || resultado?.success === false

  return (
    <>
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

      <Snackbar
        open={sincronizar.isSuccess || sincronizar.isError}
        autoHideDuration={7000}
        onClose={() => sincronizar.reset()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={salioMal ? 'warning' : 'success'} onClose={() => sincronizar.reset()}>
          {/* una subida parcial llega como error: parte de las ventas si quedo en la nube */}
          {sincronizar.isError ? resumenSincronizacion(sincronizar.error) : resultado?.message}
          {sinRespaldar > 0 && ` Quedan ${sinRespaldar} documentos de factura solo en este equipo.`}
        </Alert>
      </Snackbar>
    </>
  )
}
