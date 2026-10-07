// src/features/caja/components/ArqueoDenominaciones.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import ClearIcon from '@mui/icons-material/Clear'
import { formatoClp } from '@/shared/utils/formatoClp'
import { DENOMINACIONES } from '@/features/caja/utils/denominaciones'
import { useArqueoStore, useTotalContado, usePiezasContadas } from '@/features/caja/stores/arqueoStore'

// una denominacion: cuantos billetes/monedas de ese valor hay
function FilaDenominacion({ valor }: { valor: number }) {
  const cantidad = useArqueoStore((estado) => estado.cantidades[valor] ?? 0)
  const fijarCantidad = useArqueoStore((estado) => estado.fijarCantidad)

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{formatoClp(valor)}</Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Cant:
        </Typography>
        <TextField
          size="small"
          value={cantidad}
          onChange={(evento) => fijarCantidad(valor, Number(evento.target.value.replace(/\D/g, '')) || 0)}
          slotProps={{ htmlInput: { inputMode: 'numeric', style: { textAlign: 'center', width: 50 } } }}
        />
        <Typography variant="caption" sx={{ flexGrow: 1, textAlign: 'right', fontWeight: 600 }}>
          {formatoClp(valor * cantidad)}
        </Typography>
      </Box>
    </Paper>
  )
}

// conteo ciego de billetes y monedas: solo importa el total, no se guarda el desglose
export function ArqueoDenominaciones() {
  const limpiar = useArqueoStore((estado) => estado.limpiar)
  const total = useTotalContado()
  const piezas = usePiezasContadas()

  const billetes = DENOMINACIONES.filter((d) => d.tipo === 'billete')
  const monedas = DENOMINACIONES.filter((d) => d.tipo === 'moneda')

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Arqueo fisico de gaveta
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Cuenta el efectivo y digita cuantas piezas hay de cada denominacion.
          </Typography>
        </Box>
        <Button size="small" color="inherit" startIcon={<ClearIcon />} onClick={limpiar}>
          Limpiar
        </Button>
      </Box>

      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
        BILLETES
      </Typography>
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))' }}>
        {billetes.map((d) => (
          <FilaDenominacion key={d.valor} valor={d.valor} />
        ))}
      </Box>

      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
        MONEDAS
      </Typography>
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))' }}>
        {monedas.map((d) => (
          <FilaDenominacion key={d.valor} valor={d.valor} />
        ))}
      </Box>

      <Divider />

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'grey.900',
          color: 'common.white',
          borderRadius: 2,
          px: 2,
          py: 1.5,
        }}
      >
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            EFECTIVO FISICO CONTADO EN GAVETA
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: 'grey.400' }}>
            {piezas} piezas fisicas
          </Typography>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {formatoClp(total)}
        </Typography>
      </Box>
    </Paper>
  )
}
