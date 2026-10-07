// src/features/pos/components/tecnico/BarraAtajos.tsx
import Paper from '@mui/material/Paper'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import type { AccionesAtajos } from '@/features/pos/hooks/useAtajosTeclado'

type Props = {
  acciones: AccionesAtajos
}

// botones de atajos (tambien se pueden clickear)
export function BarraAtajos({ acciones }: Props) {
  const atajos = [
    { tecla: 'F1', texto: 'Ayuda POS', accion: acciones.ayuda, destacado: false },
    { tecla: 'F2', texto: 'Buscar item', accion: acciones.buscar, destacado: false },
    { tecla: 'F3', texto: 'Editar cant.', accion: acciones.editarCantidad, destacado: false },
    { tecla: 'F4', texto: 'Cobro rapido', accion: acciones.cobrar, destacado: true },
    { tecla: 'ESC', texto: 'Limpiar carro', accion: acciones.limpiar, destacado: false },
  ]

  return (
    <Paper
      elevation={0}
      sx={{
        display: 'flex',
        gap: 1,
        p: 1,
        border: 1, borderColor: 'divider',
        borderRadius: 2,
        flexWrap: 'wrap',
      }}
    >
      {atajos.map((atajo) => (
        <ButtonBase
          key={atajo.tecla}
          onClick={atajo.accion}
          sx={{ display: 'flex', gap: 1, px: 1, py: 0.5, borderRadius: 1.5 }}
        >
          {/* tecla */}
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              px: 0.75,
              borderRadius: 1,
              border: 1, borderColor: 'divider',
              bgcolor: (theme) =>
                atajo.destacado
                  ? theme.palette.primary.main
                  : atajo.tecla === 'ESC'
                    ? alpha(theme.palette.error.main, 0.12)
                    : theme.palette.background.paper,
              color: atajo.destacado ? 'common.white' : atajo.tecla === 'ESC' ? 'error.main' : 'text.primary',
            }}
          >
            {atajo.tecla}
          </Typography>

          <Typography
            variant="caption"
            sx={{ color: atajo.destacado ? 'primary.main' : 'text.secondary', fontWeight: 600 }}
          >
            {atajo.texto}
          </Typography>
        </ButtonBase>
      ))}
    </Paper>
  )
}
