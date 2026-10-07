// src/features/ventas/components/compartidos/BarraHerramientasVentas.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import CircularProgress from '@mui/material/CircularProgress'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import RefreshOutlined from '@mui/icons-material/RefreshOutlined'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import type { RangoFecha, TipoMovimiento } from '@/features/ventas/utils/filtrosVentas'

type Props = {
  busqueda: string
  tipo: TipoMovimiento
  rango: RangoFecha
  actualizando: boolean
  onBuscar: (texto: string) => void
  onTipo: (tipo: TipoMovimiento) => void
  onRango: (rango: RangoFecha) => void
  onActualizar: () => void
  onExportar: () => void
}

const TIPOS: { valor: TipoMovimiento; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todo' },
  { valor: 'ventas', etiqueta: 'Solo ventas' },
  { valor: 'devoluciones', etiqueta: 'Solo devoluciones' },
]

const RANGOS: { valor: RangoFecha; etiqueta: string }[] = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: 'semana', etiqueta: 'Ultimos 7 dias' },
  { valor: 'mes', etiqueta: 'Ultimos 30 dias' },
  { valor: 'todo', etiqueta: 'Todo el historial' },
]

export function BarraHerramientasVentas({
  busqueda,
  tipo,
  rango,
  actualizando,
  onBuscar,
  onTipo,
  onRango,
  onActualizar,
  onExportar,
}: Props) {
  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField
        size="small"
        placeholder="Buscar por folio, producto, SKU o cajero"
        value={busqueda}
        onChange={(evento) => onBuscar(evento.target.value)}
        sx={{ flex: '1 1 280px' }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {TIPOS.map((item) => (
          <Chip
            key={item.valor}
            label={item.etiqueta}
            color={tipo === item.valor ? 'primary' : 'default'}
            variant={tipo === item.valor ? 'filled' : 'outlined'}
            onClick={() => onTipo(item.valor)}
          />
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {RANGOS.map((item) => (
          <Chip
            key={item.valor}
            label={item.etiqueta}
            size="small"
            color={rango === item.valor ? 'info' : 'default'}
            variant={rango === item.valor ? 'filled' : 'outlined'}
            onClick={() => onRango(item.valor)}
          />
        ))}
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      <Button
        size="small"
        variant="outlined"
        startIcon={actualizando ? <CircularProgress size={16} /> : <RefreshOutlined />}
        onClick={onActualizar}
        disabled={actualizando}
      >
        Actualizar
      </Button>

      <Button size="small" variant="outlined" startIcon={<FileDownloadOutlined />} onClick={onExportar}>
        Exportar CSV
      </Button>
    </Paper>
  )
}
