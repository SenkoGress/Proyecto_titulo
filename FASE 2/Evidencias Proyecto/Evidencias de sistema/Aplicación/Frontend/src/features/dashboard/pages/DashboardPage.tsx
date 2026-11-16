// src/features/dashboard/pages/DashboardPage.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { Migas } from '@/shared/components/ui/Migas'
import { useEsModoTecnico } from '@/shared/stores/modoVistaStore'
import { PanelGeneral } from '@/features/dashboard/components/visual/PanelGeneral'
import { MonitorTecnico } from '@/features/dashboard/components/tecnico/MonitorTecnico'

// dashboard analitico: los avisos que necesitan accion estan en /notificaciones
export function DashboardPage() {
  const esModoTecnico = useEsModoTecnico()

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Migas
        rutas={
          esModoTecnico
            ? ['Dashboard', 'Analitica global del negocio']
            : ['Panel General', 'Resumen del negocio']
        }
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography variant="h1">{esModoTecnico ? 'Dashboard y analitica' : 'Panel General'}</Typography>
        <Chip label="Datos en vivo" size="small" color="success" variant="outlined" />
      </Box>

      {esModoTecnico ? <MonitorTecnico /> : <PanelGeneral />}
    </Box>
  )
}
