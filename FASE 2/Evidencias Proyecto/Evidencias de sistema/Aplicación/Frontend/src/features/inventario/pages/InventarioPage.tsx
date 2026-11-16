// src/features/inventario/pages/InventarioPage.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { Migas } from '@/shared/components/ui/Migas'
import { useEsModoTecnico } from '@/shared/stores/modoVistaStore'
import { CatalogoGeneralInventario } from '@/features/inventario/components/visual/CatalogoGeneralInventario'
import { TrazabilidadFefo } from '@/features/inventario/components/tecnico/TrazabilidadFefo'

// inventario y stock: catalogo general (visual) o trazabilidad sanitaria fefo (tecnico)
export function InventarioPage() {
  const esModoTecnico = useEsModoTecnico()

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Migas
        rutas={
          esModoTecnico
            ? ['Inventario y Stock', 'Trazabilidad Sanitaria y Control FEFO']
            : ['Inventario y Stock', 'Catálogo General de Productos']
        }
      />

      <Typography variant="h1" sx={{ mb: 0.5 }}>
        {esModoTecnico ? 'Trazabilidad Sanitaria y Control FEFO' : 'Inventario y Stock'}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {esModoTecnico
          ? 'Control centralizado de existencias, costos, impuestos, vencimientos y proveedores.'
          : 'Todo el catalogo con su stock, costos, precios y margen.'}
      </Typography>

      {esModoTecnico ? <TrazabilidadFefo /> : <CatalogoGeneralInventario />}
    </Box>
  )
}
