// src/features/notificaciones/components/BarraFiltrosNotificaciones.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import { NOMBRE_CATEGORIA, contarPorCategoria } from '@/features/notificaciones/utils/severidad'
import { ICONO_CATEGORIA } from '@/features/notificaciones/components/iconoCategoria'
import type { CategoriaNotificacion, Notificacion } from '@/features/notificaciones/types'

export const TODAS_CATEGORIAS = 'Todas'

type Props = {
  lista: Notificacion[]
  filtro: string
  soloSinVer: boolean
  pendientes: number
  onFiltrar: (filtro: string) => void
  onSoloSinVer: (valor: boolean) => void
  onMarcarTodas: () => void
}

const CATEGORIAS: CategoriaNotificacion[] = [
  'sanitaria',
  'stock',
  'caja',
  'proveedores',
  'inventario',
  'sistema',
]

export function BarraFiltrosNotificaciones({
  lista,
  filtro,
  soloSinVer,
  pendientes,
  onFiltrar,
  onSoloSinVer,
  onMarcarTodas,
}: Props) {
  const conteo = contarPorCategoria(lista)

  return (
    <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', flexGrow: 1 }}>
        <Chip
          label={`${TODAS_CATEGORIAS} (${lista.length})`}
          color={filtro === TODAS_CATEGORIAS ? 'primary' : 'default'}
          variant={filtro === TODAS_CATEGORIAS ? 'filled' : 'outlined'}
          onClick={() => onFiltrar(TODAS_CATEGORIAS)}
        />

        {CATEGORIAS.filter((categoria) => conteo[categoria] > 0).map((categoria) => (
          <Chip
            key={categoria}
            icon={ICONO_CATEGORIA[categoria] as React.ReactElement}
            label={`${NOMBRE_CATEGORIA[categoria]} (${conteo[categoria]})`}
            color={filtro === categoria ? 'primary' : 'default'}
            variant={filtro === categoria ? 'filled' : 'outlined'}
            onClick={() => onFiltrar(categoria)}
          />
        ))}
      </Box>

      <FormControlLabel
        control={<Switch size="small" checked={soloSinVer} onChange={(evento) => onSoloSinVer(evento.target.checked)} />}
        label="Solo sin ver"
      />

      <Button size="small" startIcon={<DoneAllIcon />} onClick={onMarcarTodas} disabled={pendientes === 0}>
        Marcar todo como visto
      </Button>
    </Paper>
  )
}
