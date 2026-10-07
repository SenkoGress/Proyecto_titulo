// src/features/inventario/components/tecnico/TablaInventarioTecnico.tsx
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { DataGrid, type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid'
import { formatoClp } from '@/shared/utils/formatoClp'
import { formatFechaSola } from '@/shared/utils/formatFecha'
import { BarraStock } from '@/features/inventario/components/visual/BarraStock'
import Tooltip from '@mui/material/Tooltip'
import { EstadoFefoChip } from '@/features/inventario/components/tecnico/EstadoFefoChip'
import { OrigenProducto } from '@/features/inventario/components/tecnico/OrigenProducto'
import { detalleIla, nombreIla, codigoIla } from '@/shared/utils/ila'
import { calcularMargen } from '@/features/inventario/utils/calculosInventario'
import { AccionesProducto } from '@/features/inventario/components/compartidos/AccionesProducto'
import type { FilaFefo } from '@/features/inventario/utils/matrizFefo'

type Acciones = {
  onEditar: (producto: FilaFefo) => void
  onAjustar: (producto: FilaFefo) => void
  onMerma: (producto: FilaFefo) => void
  onHistorial: (producto: FilaFefo) => void
}

type Props = Acciones & {
  productos: FilaFefo[]
  cargando: boolean
  seleccion: GridRowSelectionModel
  onCambiarSeleccion: (seleccion: GridRowSelectionModel) => void
}

// mismas columnas que el catalogo visual (GET /pos/inventory), mas estado fefo y lote/vencimiento
function armarColumnas(acciones: Acciones): GridColDef<FilaFefo>[] {
  return [
  {
    field: 'nivel',
    headerName: 'Estado FEFO',
    width: 130,
    renderCell: (parametros) => (
      <EstadoFefoChip nivel={parametros.row.nivel} diasRestantes={parametros.row.dias_restantes} />
    ),
  },
  {
    field: 'sku',
    headerName: 'SKU / Codigo',
    width: 135,
    renderCell: (parametros) => (
      <Box sx={{ py: 1 }}>
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {parametros.row.sku}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          {parametros.row.codigo_barra}
        </Typography>
      </Box>
    ),
  },
  {
    field: 'nombre',
    headerName: 'Producto y proveedor',
    flex: 1,
    minWidth: 200,
    renderCell: (parametros) => (
      <Box sx={{ py: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {parametros.row.nombre}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {parametros.row.proveedor_nombre ?? 'Sin proveedor asignado'}
        </Typography>
      </Box>
    ),
  },
  {
    field: 'lote',
    headerName: 'Lote / Vence',
    width: 130,
    renderCell: (parametros) => (
      <Box sx={{ py: 1 }}>
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {parametros.row.lote ?? '-'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {parametros.row.fecha_vencimiento ? formatFechaSola(parametros.row.fecha_vencimiento) : '-'}
        </Typography>
      </Box>
    ),
  },
  {
    field: 'categoria',
    headerName: 'Categoria',
    width: 110,
    renderCell: (parametros) => <Chip size="small" label={parametros.row.categoria ?? 'Sin categoria'} />,
  },
  {
    field: 'stock_actual',
    headerName: 'Stock actual',
    width: 120,
    renderCell: (parametros) => <BarraStock producto={parametros.row} />,
  },
  {
    field: 'precio_compra',
    headerName: 'P. Costo',
    width: 100,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (valor: number) => formatoClp(valor),
  },
  {
    field: 'precio_venta',
    headerName: 'P. Venta',
    width: 100,
    align: 'right',
    headerAlign: 'right',
    renderCell: (parametros) => <Typography sx={{ fontWeight: 700 }}>{formatoClp(parametros.row.precio_venta)}</Typography>,
  },
  {
    field: 'margen',
    headerName: 'Margen',
    width: 90,
    align: 'right',
    headerAlign: 'right',
    valueGetter: (_valor, fila) => calcularMargen(fila.precio_compra, fila.precio_venta),
    renderCell: (parametros) => {
      const margen = calcularMargen(parametros.row.precio_compra, parametros.row.precio_venta)
      return (
        <Typography variant="body2" color={margen >= 30 ? 'success.main' : 'text.secondary'} sx={{ fontWeight: 600 }}>
          {margen.toFixed(1)}%
        </Typography>
      )
    },
  },
  {
    field: 'impuesto_adicional_codigo',
    headerName: 'Impuesto',
    width: 140,
    renderCell: (parametros) => (
      <Tooltip title={detalleIla(parametros.row)}>
        {codigoIla(parametros.row) > 0 ? (
          <Chip
            label={nombreIla(parametros.row)}
            size="small"
            color="warning"
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        ) : (
          <Typography variant="caption" color="text.secondary">
            {nombreIla(parametros.row)}
          </Typography>
        )}
      </Tooltip>
    ),
  },
  {
    field: 'origen_creacion',
    headerName: 'Origen',
    width: 175,
    renderCell: (parametros) => <OrigenProducto producto={parametros.row} />,
    },
    {
      field: 'acciones',
      headerName: '',
      width: 60,
      sortable: false,
      filterable: false,
      align: 'center',
      renderCell: (parametros) => (
        <AccionesProducto
          onEditar={() => acciones.onEditar(parametros.row)}
          onAjustar={() => acciones.onAjustar(parametros.row)}
          onMerma={() => acciones.onMerma(parametros.row)}
          onHistorial={() => acciones.onHistorial(parametros.row)}
        />
      ),
    },
  ]
}

// tabla principal del modo tecnico: TODO el catalogo, con el estado fefo integrado
export function TablaInventarioTecnico({
  productos,
  cargando,
  seleccion,
  onCambiarSeleccion,
  onEditar,
  onAjustar,
  onMerma,
  onHistorial,
}: Props) {
  const columnas = useMemo(
    () => armarColumnas({ onEditar, onAjustar, onMerma, onHistorial }),
    [onEditar, onAjustar, onMerma, onHistorial],
  )

  return (
    <Box sx={{ height: 560 }}>
      <DataGrid
        rows={productos}
        columns={columnas}
        loading={cargando}
        getRowHeight={() => 64}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        pageSizeOptions={[10, 25, 50]}
        checkboxSelection
        rowSelectionModel={seleccion}
        onRowSelectionModelChange={onCambiarSeleccion}
        disableRowSelectionOnClick
        density="comfortable"
      />
    </Box>
  )
}
