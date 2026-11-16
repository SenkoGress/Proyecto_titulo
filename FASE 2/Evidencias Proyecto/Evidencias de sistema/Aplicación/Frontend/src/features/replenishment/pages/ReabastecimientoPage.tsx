// src/features/replenishment/pages/ReabastecimientoPage.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { Migas } from '@/shared/components/ui/Migas'
import { useEsModoTecnico } from '@/shared/stores/modoVistaStore'
import { ReabastecimientoVisual } from '@/features/replenishment/components/visual/ReabastecimientoVisual'
import { ReabastecimientoTecnico } from '@/features/replenishment/components/tecnico/ReabastecimientoTecnico'

// reposicion de stock y ordenes de compra sugeridas
export function ReabastecimientoPage() {
  const esModoTecnico = useEsModoTecnico()

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Migas
        rutas={
          esModoTecnico
            ? ['Reabastecimiento ROP', 'Ordenes de compra sugeridas']
            : ['Reposicion', 'Que hay que pedir']
        }
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography variant="h1">{esModoTecnico ? 'Reabastecimiento ROP' : 'Reposicion de stock'}</Typography>
        <Chip label="Datos en vivo" size="small" color="success" variant="outlined" />
      </Box>

      {esModoTecnico ? <ReabastecimientoTecnico /> : <ReabastecimientoVisual />}
    </Box>
  )
}
