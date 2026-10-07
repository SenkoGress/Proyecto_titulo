// src/features/ventas/components/tecnico/TablaVentasTecnica.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Button from '@mui/material/Button'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import AssignmentReturnOutlined from '@mui/icons-material/AssignmentReturnOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { formatFecha } from '@/shared/utils/formatFecha'
import { nombreCortoDte, nombreDocumentoDte } from '@/features/dte/utils/nombreDte'
import { detalleProductos } from '@/features/ventas/utils/filaVenta'
import type { FilaVenta } from '@/features/ventas/utils/filaVenta'

type Props = {
  ventas: FilaVenta[]
  cargando: boolean
  onVerTicket: (venta: FilaVenta) => void
  onDevolver: (venta: FilaVenta) => void
}

// el backend marca PENDING mientras la venta no sube a la nube
function ColorSync(estado: string): 'success' | 'warning' {
  return estado === 'SYNCED' ? 'success' : 'warning'
}

function armarColumnas(
  onVerTicket: (venta: FilaVenta) => void,
  onDevolver: (venta: FilaVenta) => void,
): GridColDef<FilaVenta>[] {
  return [
    {
      field: 'folio',
      headerName: 'Folio',
      width: 150,
      renderCell: (parametros) => (
        <Tooltip title={`id interno ${parametros.row.id}`}>
          <Box sx={{ py: 1 }}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                fontWeight: 600,
                color: parametros.row.esDevolucion ? 'warning.main' : 'primary.main',
              }}
            >
              {parametros.row.folio}
            </Typography>
            {parametros.row.folioAnulado && (
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                anula {parametros.row.folioAnulado}
              </Typography>
            )}
          </Box>
        </Tooltip>
      ),
    },
    {
      field: 'fecha',
      headerName: 'Fecha y hora',
      width: 140,
      valueGetter: (_valor, fila) => formatFecha(fila.fecha),
    },
    { field: 'cajero_nombre', headerName: 'Cajero', width: 105 },
    {
      field: 'medio_pago_nombre',
      headerName: 'Medio de pago',
      width: 140,
      renderCell: (parametros) => (
        <Tooltip title={`Pasarela: ${parametros.row.medio_pago_tipo}`}>
          <Chip label={parametros.row.medio_pago_nombre} size="small" variant="outlined" />
        </Tooltip>
      ),
    },
    { field: 'unidades', headerName: 'Un.', width: 60, align: 'right', headerAlign: 'right' },
    {
      field: 'total',
      headerName: 'Total cobrado',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (parametros) => (
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, color: parametros.row.esDevolucion ? 'warning.main' : 'success.main' }}
        >
          {formatoClp(parametros.row.total)}
        </Typography>
      ),
    },
    {
      field: 'estado',
      headerName: 'Estado',
      width: 120,
      renderCell: (parametros) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap', py: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'success.main' }}>
            {parametros.row.estado}
          </Typography>
          <Chip
            label={parametros.row.sync_status}
            size="small"
            color={ColorSync(parametros.row.sync_status)}
            variant="outlined"
            sx={{ height: 18, fontSize: 10 }}
          />
        </Box>
      ),
    },
    {
      field: 'items',
      headerName: 'Detalle de productos',
      flex: 1,
      minWidth: 160,
      sortable: false,
      renderCell: (parametros) => (
        <Tooltip title={detalleProductos(parametros.row)}>
          <Typography variant="caption" sx={{ display: 'block', py: 1.5 }} noWrap>
            {detalleProductos(parametros.row)}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: 'dte',
      headerName: 'Comprobante fiscal',
      width: 170,
      sortable: false,
      renderCell: (parametros) => {
        const dte = parametros.row.dte

        if (!dte) {
          return (
            <Tooltip title="Con tarjeta el voucher reemplaza a la boleta (Res. Ex. N° 176)">
              <Typography variant="caption" color="text.disabled">
                Sin DTE
              </Typography>
            </Tooltip>
          )
        }

        return (
          <Tooltip title={`${nombreDocumentoDte(dte.tipo_dte)} · ${dte.estado_sii}`}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ReceiptLongOutlined />}
            onClick={() => onVerTicket(parametros.row)}
            sx={{ fontSize: 11 }}
          >
            {nombreCortoDte(dte.tipo_dte)} N° {dte.folio}
          </Button>
          </Tooltip>
        )
      },
    },
    {
      field: 'devolucion',
      headerName: 'Devolucion (DTE 61)',
      width: 135,
      sortable: false,
      renderCell: (parametros) => (
        <Tooltip
          title={
            parametros.row.esDevolucion
              ? 'Esta fila ya es una nota de credito'
              : parametros.row.items.length === 0
                ? 'Sin detalle de venta registrado'
                : 'Repone el stock y emite nota de credito'
          }
        >
          <span>
            <Button
              size="small"
              color="warning"
              variant="outlined"
              startIcon={<AssignmentReturnOutlined />}
              disabled={parametros.row.esDevolucion || parametros.row.items.length === 0}
              onClick={() => onDevolver(parametros.row)}
            >
              Devolver
            </Button>
          </span>
        </Tooltip>
      ),
    },
  ]
}

// registro cronologico con todo lo que guarda transacciones_venta
export function TablaVentasTecnica({ ventas, cargando, onVerTicket, onDevolver }: Props) {
  return (
    <Box sx={{ height: 620 }}>
      <DataGrid
        rows={ventas}
        columns={armarColumnas(onVerTicket, onDevolver)}
        loading={cargando}
        getRowHeight={() => 58}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        pageSizeOptions={[10, 25, 50, 100]}
        disableRowSelectionOnClick
        density="compact"
      />
    </Box>
  )
}
