// src/features/pos/components/compartidos/EtiquetasProducto.tsx
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import { etiquetasProducto } from '@/features/pos/utils/etiquetasProducto'
import type { Producto } from '@/features/pos/types'

type Props = {
  producto: Producto
  // en listas apretadas solo se muestra la etiqueta mas importante
  soloPrincipal?: boolean
}

// tiquetado legal del producto: alcohol, energetica, azucar e impuesto adicional
export function EtiquetasProducto({ producto, soloPrincipal }: Props) {
  const etiquetas = etiquetasProducto(producto)
  if (etiquetas.length === 0) return null

  const visibles = soloPrincipal ? etiquetas.slice(0, 1) : etiquetas

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {visibles.map((etiqueta) => (
        <Tooltip key={etiqueta.texto} title={etiqueta.ayuda}>
          <Chip
            label={etiqueta.texto}
            size="small"
            color={etiqueta.color}
            variant="outlined"
            sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
          />
        </Tooltip>
      ))}
    </Box>
  )
}
