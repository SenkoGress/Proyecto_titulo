// src/features/configuracion/pages/ConfiguracionPage.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { Migas } from '@/shared/components/ui/Migas'
import { SeccionApariencia } from '@/features/configuracion/components/SeccionApariencia'
import { SeccionMargen } from '@/features/configuracion/components/SeccionMargen'
import { SeccionCorreo } from '@/features/configuracion/components/SeccionCorreo'
import { SeccionReposicion } from '@/features/configuracion/components/SeccionReposicion'
import { SeccionModeloSii } from '@/features/configuracion/components/SeccionModeloSii'
import { SeccionEmisor } from '@/features/configuracion/components/SeccionEmisor'
import { SeccionRedondeo } from '@/features/configuracion/components/SeccionRedondeo'
import { SeccionPciDss } from '@/features/configuracion/components/SeccionPciDss'
import { useUsuario } from '@/features/auth/stores/sesionStore'

// configuracion del sistema
export function ConfiguracionPage() {
  const usuario = useUsuario()
  // las reglas del negocio las toca solo quien administra
  const esAdmin = !usuario || usuario.rol === 'admin'

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Migas rutas={['Sistema', 'Configuración']} />

      <Typography variant="h1" sx={{ mb: 0.5 }}>
        Configuración
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {esAdmin
          ? 'Preferencias de este equipo y reglas de negocio del local.'
          : 'Preferencias de este equipo.'}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 980 }}>
        <SeccionApariencia />

        {esAdmin && (
          <>
            <SeccionMargen />
            <SeccionCorreo />
            <SeccionReposicion />
            <SeccionModeloSii />
            <SeccionEmisor />
            <SeccionRedondeo />
            <SeccionPciDss />
          </>
        )}
      </Box>
    </Box>
  )
}
