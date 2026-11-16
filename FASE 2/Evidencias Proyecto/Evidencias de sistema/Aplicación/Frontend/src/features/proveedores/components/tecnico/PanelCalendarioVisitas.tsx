// src/features/proveedores/components/tecnico/PanelCalendarioVisitas.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

type Props = {
  fichas: FichaProveedor[]
}

// etiqueta segun que tan cerca esta la visita
function etiqueta(dias: number): { texto: string; color: 'error' | 'warning' | 'default' } {
  if (dias === 0) return { texto: 'HOY', color: 'error' }
  if (dias === 1) return { texto: 'MANANA', color: 'warning' }
  return { texto: `EN ${dias}D`, color: 'default' }
}

// proximas visitas de preventistas, ordenadas por cercania (la fecha la calcula el backend)
export function PanelCalendarioVisitas({ fichas }: Props) {
  const ordenadas = [...fichas].sort((a, b) => a.proxima_visita.daysUntil - b.proxima_visita.daysUntil)

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <CalendarMonthOutlined color="action" fontSize="small" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Calendario de visitas
        </Typography>
      </Box>

      <Typography variant="caption" color="text.secondary">
        Proxima visita de cada proveedor segun sus dias configurados.
      </Typography>

      <Divider sx={{ my: 1.5 }} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {ordenadas.map((ficha) => {
          const marca = etiqueta(ficha.proxima_visita.daysUntil)

          return (
            <Box key={ficha.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Chip label={marca.texto} size="small" color={marca.color} sx={{ minWidth: 64, flexShrink: 0 }} />

              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {ficha.nombre_proveedores}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ficha.proxima_visita.displayText} · {ficha.total_productos_suministrados} productos
                </Typography>
              </Box>
            </Box>
          )
        })}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        El sistema no guarda hora de llegada ni estado del camion: solo el dia de visita.
      </Typography>
    </Paper>
  )
}
