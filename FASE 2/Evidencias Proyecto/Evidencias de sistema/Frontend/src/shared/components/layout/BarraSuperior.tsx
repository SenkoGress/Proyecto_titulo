// src/shared/components/layout/BarraSuperior.tsx
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import { useReloj } from '@/shared/hooks/useReloj'
import { BotonSincronizar } from '@/shared/components/layout/BotonSincronizar'

// barra superior del modo visual
export function BarraSuperior() {
  const ahora = useReloj()

  return (
    <Paper
      elevation={0}
      square
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 1.5,
        borderBottom: 1, borderBottomColor: 'divider',
      }}
    >
      {/* fecha y hora */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CalendarTodayIcon fontSize="small" color="disabled" />
        <Typography variant="body2" color="text.secondary">
          {ahora.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {ahora.toLocaleTimeString('es-CL')}
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      <BotonSincronizar />
    </Paper>
  )
}
