// src/shared/pages/SinPermiso.tsx
import { Link } from 'react-router'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import LockOutlined from '@mui/icons-material/LockOutlined'

// la pantalla existe pero el rol del usuario no la alcanza
export function SinPermiso() {
  return (
    <Box sx={{ textAlign: 'center', py: 10 }}>
      <LockOutlined sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />

      <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
        Esta parte es del administrador
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Si necesitas entrar aca, pidele a quien administra el local que te cambie el rol.
      </Typography>

      <Button component={Link} to="/" variant="contained">
        Volver a la caja
      </Button>
    </Box>
  )
}
