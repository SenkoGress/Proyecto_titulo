// src/features/inventario/components/compartidos/MiniaturaProducto.tsx
import Box from '@mui/material/Box'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'

type Props = {
  imagen: string | null
  nombre: string
  lado?: number
}

// la foto del producto en una fila del inventario: el dueno la acaba de cargar y espera verla aca
export function MiniaturaProducto({ imagen, nombre, lado = 40 }: Props) {
  return (
    <Box
      sx={{
        width: lado,
        height: lado,
        flexShrink: 0,
        borderRadius: 1,
        bgcolor: 'action.hover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {imagen ? (
        <Box
          component="img"
          src={imagen}
          alt={`Foto de ${nombre}`}
          loading="lazy"
          sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <ImageOutlinedIcon sx={{ color: 'text.disabled', fontSize: lado * 0.5 }} />
      )}
    </Box>
  )
}
