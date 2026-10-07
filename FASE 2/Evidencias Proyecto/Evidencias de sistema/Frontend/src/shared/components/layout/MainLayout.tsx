// src/shared/components/layout/MainLayout.tsx
import { Outlet } from 'react-router'
import Box from '@mui/material/Box'
import { MenuLateral } from '@/shared/components/layout/MenuLateral'
import { BarraSuperior } from '@/shared/components/layout/BarraSuperior'
import { BarraSuperiorTecnica } from '@/shared/components/layout/BarraSuperiorTecnica'
import { useEsModoTecnico } from '@/shared/stores/modoVistaStore'

// estructura comun: menu + barra + contenido
export function MainLayout() {
  const esModoTecnico = useEsModoTecnico()

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <MenuLateral />

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* barra segun el modo */}
        {esModoTecnico ? <BarraSuperiorTecnica /> : <BarraSuperior />}

        {/* pantalla actual */}
        <Box sx={{ flexGrow: 1, overflow: 'hidden', p: 2 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
