// src/features/auth/pages/LoginPage.tsx
import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import { FormularioLogin } from '@/features/auth/components/FormularioLogin'
import { FormularioRegistro } from '@/features/auth/components/FormularioRegistro'
import { useHaySesion } from '@/features/auth/stores/sesionStore'

export function LoginPage() {
  const [creandoCuenta, setCreandoCuenta] = useState(false)
  const haySesion = useHaySesion()
  const ubicacion = useLocation()

  // si ya entro, vuelve a donde queria ir
  if (haySesion) {
    const destino = (ubicacion.state as { desde?: string } | null)?.desde ?? '/'
    return <Navigate to={destino} replace />
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Paper
        elevation={0}
        variant="outlined"
        sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 4 }, borderRadius: 3 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <PointOfSaleIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              GesTock
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Punto de venta e inventario
            </Typography>
          </Box>
        </Box>

        {creandoCuenta ? (
          <FormularioRegistro onIrALogin={() => setCreandoCuenta(false)} />
        ) : (
          <FormularioLogin onIrARegistro={() => setCreandoCuenta(true)} />
        )}
      </Paper>
    </Box>
  )
}
