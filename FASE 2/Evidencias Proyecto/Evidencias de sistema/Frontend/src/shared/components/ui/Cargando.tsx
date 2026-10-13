// src/shared/components/ui/Cargando.tsx
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

// se ve mientras llega el codigo de una pantalla
export function Cargando() {
  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CircularProgress size={32} />
    </Box>
  )
}
