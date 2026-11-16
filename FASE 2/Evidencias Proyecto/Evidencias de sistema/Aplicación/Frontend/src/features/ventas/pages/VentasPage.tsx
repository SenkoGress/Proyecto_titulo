// src/features/ventas/pages/VentasPage.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { Migas } from '@/shared/components/ui/Migas'
import { useEsModoTecnico } from '@/shared/stores/modoVistaStore'
import { RegistroVentasVisual } from '@/features/ventas/components/visual/RegistroVentasVisual'
import { AuditoriaVentasTecnica } from '@/features/ventas/components/tecnico/AuditoriaVentasTecnica'

// historial de ventas, devoluciones y comprobantes
export function VentasPage() {
  const esModoTecnico = useEsModoTecnico()

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Migas
        rutas={
          esModoTecnico
            ? ['Registro de Ventas', 'Auditoria de ventas y documentos']
            : ['Historial de Ventas', 'Ventas del local']
        }
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
        <Typography variant="h1">
          {esModoTecnico ? 'Registro de ventas y auditoria' : 'Historial de ventas'}
        </Typography>
        <Chip label="Datos en vivo" size="small" color="success" variant="outlined" />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {esModoTecnico
          ? 'Historial cronologico con folio, cajero, medio de pago, estado de sincronizacion y documento tributario.'
          : 'Todas las ventas del local, con su boleta y la opcion de devolver.'}
      </Typography>

      {esModoTecnico ? <AuditoriaVentasTecnica /> : <RegistroVentasVisual />}
    </Box>
  )
}
