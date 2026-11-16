// src/features/proveedores/pages/ProveedoresPage.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { Migas } from '@/shared/components/ui/Migas'
import { useEsModoTecnico } from '@/shared/stores/modoVistaStore'
import { DirectorioProveedores } from '@/features/proveedores/components/visual/DirectorioProveedores'
import { LogisticaRop } from '@/features/proveedores/components/tecnico/LogisticaRop'

// proveedores: directorio en tarjetas (visual) o logistica y motor rop (tecnico)
export function ProveedoresPage() {
  const esModoTecnico = useEsModoTecnico()

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Migas
        rutas={
          esModoTecnico
            ? ['Proveedores', 'Directorio y Logística ROP']
            : ['Proveedores', 'Directorio de Proveedores']
        }
      />

      <Typography variant="h1" sx={{ mb: 0.5 }}>
        {esModoTecnico ? 'Directorio de Proveedores y Logística ROP' : 'Directorio de Proveedores'}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {esModoTecnico
          ? 'Directorio mayorista, días de visita y disparadores automáticos por punto de reorden (ROP).'
          : 'Compras mayoristas, reposición por WhatsApp y facturas leídas con IA de cada proveedor.'}
      </Typography>

      {esModoTecnico ? <LogisticaRop /> : <DirectorioProveedores />}
    </Box>
  )
}
