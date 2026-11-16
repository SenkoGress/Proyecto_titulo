// src/shared/components/ui/Migas.tsx
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Typography from '@mui/material/Typography'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'

type Props = {
  rutas: string[] // ej: ['Inventario y Stock', 'Recepcion de Mercaderia']
}

// migas de pan para ubicar al usuario dentro del modulo
export function Migas({ rutas }: Props) {
  return (
    <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 1 }}>
      {rutas.map((ruta, indice) => (
        <Typography
          key={ruta}
          variant="body2"
          color={indice === rutas.length - 1 ? 'text.primary' : 'text.secondary'}
          sx={{ fontWeight: indice === rutas.length - 1 ? 600 : 400 }}
        >
          {ruta}
        </Typography>
      ))}
    </Breadcrumbs>
  )
}
