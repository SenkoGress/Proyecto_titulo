// src/shared/pages/NotFoundPage.tsx
import { Link } from 'react-router'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'

// pagina no encontrada
export function NotFoundPage() {
  return (
    <Box sx={{ textAlign: 'center', py: 10 }}>
      <Typography variant="h4" gutterBottom>
        Pagina no encontrada
      </Typography>

      <Button component={Link} to="/" variant="contained">
        Volver a la caja
      </Button>
    </Box>
  )
}
