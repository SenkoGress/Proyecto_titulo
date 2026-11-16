// src/shared/components/layout/BotonSincronizar.tsx
import Button from '@mui/material/Button'
import Badge from '@mui/material/Badge'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import CloudSyncIcon from '@mui/icons-material/CloudSync'
import { useEstadoPos, useSincronizar } from '@/features/pos/hooks/usePos'
import { avisoVentasDetenidas, resumenSincronizacion } from '@/features/pos/utils/resumenSincronizacion'
import { avisoDocumentos, documentosNecesitanAtencion } from '@/features/pos/utils/avisoDocumentos'

// subir ventas pendientes a la nube, y de paso la cola de facturas
export function BotonSincronizar() {
  const { data: estado } = useEstadoPos()
  const sincronizar = useSincronizar()

  const pendientes = estado?.pending_dirty_count ?? 0
  const resultado = sincronizar.data

  const documentos = resultado?.invoice_document_backup
  const detenidas = resultado?.stopped_sales_count ?? 0
  const falloLaBajada = resultado?.catalog_pull_error

  // el servidor da por exitosa una subida parcial, y ni una venta detenida ni un documento que
  // perdio su archivo se arreglan solos: ninguno es una buena noticia para el dueño
  const salioMal =
    sincronizar.isError ||
    resultado?.success === false ||
    resultado?.partial === true ||
    detenidas > 0 ||
    Boolean(falloLaBajada) ||
    documentosNecesitanAtencion(documentos)

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
          {sincronizar.isError ? resumenSincronizacion(sincronizar.error) : resultado?.message}
          {avisoVentasDetenidas(detenidas)}
          {avisoDocumentos(documentos)}
          {/* las ventas pueden haber subido y el catalogo no: son dos viajes distintos */}
          {falloLaBajada && ' Los precios y productos nuevos no se pudieron bajar desde la nube.'}
        </Alert>
      </Snackbar>
    </>
  )
}
