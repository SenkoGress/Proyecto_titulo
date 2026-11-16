// src/features/sii/pages/SiiPage.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { Migas } from '@/shared/components/ui/Migas'
import { useEsModoTecnico } from '@/shared/stores/modoVistaStore'
import { RespaldoFacturasVisual } from '@/features/sii/components/visual/RespaldoFacturasVisual'
import { CentroTributarioTecnico } from '@/features/sii/components/tecnico/CentroTributarioTecnico'

// respaldo tributario: facturas de compra, documentos emitidos y f29
export function SiiPage() {
  const esModoTecnico = useEsModoTecnico()

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Migas
        rutas={
          esModoTecnico
            ? ['Respaldo Facturas y SII', 'Centro tributario']
            : ['Respaldo de Facturas', 'Documentos del local']
        }
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography variant="h1">{esModoTecnico ? 'Respaldo facturas y SII' : 'Respaldo de facturas'}</Typography>
        <Chip label="Ley N° 20.727" size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
      </Box>

      {esModoTecnico ? <CentroTributarioTecnico /> : <RespaldoFacturasVisual />}
    </Box>
  )
}
