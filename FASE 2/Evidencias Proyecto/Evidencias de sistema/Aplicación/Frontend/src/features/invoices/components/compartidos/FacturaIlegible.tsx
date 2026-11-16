// src/features/invoices/components/compartidos/FacturaIlegible.tsx
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ImageNotSupportedOutlined from '@mui/icons-material/ImageNotSupportedOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'

type Props = {
  nombreArchivo: string
  onSubirOtra: () => void
}

const CONSEJOS = [
  'Que salga la factura completa, con los cuatro bordes dentro de la foto.',
  'Con buena luz y sin sombras encima. Evita el flash directo, que vela el papel.',
  'El celular derecho sobre la factura, no de lado.',
  'Toca la pantalla para enfocar antes de sacar la foto.',
  'Si la factura te llego por correo, sube el PDF en vez de una foto de la pantalla.',
]

// el ocr no saco ningun producto: la imagen no se entiende
export function FacturaIlegible({ nombreArchivo, onSubirOtra }: Props) {
  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', mt: 4 }}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 2 }}>
          <ImageNotSupportedOutlined color="warning" />

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              No se pudo leer la factura
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {nombreArchivo}
            </Typography>
          </Box>
        </Box>

        <Alert severity="warning" sx={{ mb: 2 }}>
          La imagen no se entiende lo suficiente para sacar los productos. No entro nada al
          inventario, asi que puedes sacar otra foto y volver a subirla.
        </Alert>

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Para que salga mejor
        </Typography>

        <List dense sx={{ mb: 1 }}>
          {CONSEJOS.map((consejo) => (
            <ListItem key={consejo} disableGutters sx={{ alignItems: 'flex-start', py: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 28, mt: 0.25 }}>
                <CheckCircleOutlined fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText>
                <Typography variant="body2">{consejo}</Typography>
              </ListItemText>
            </ListItem>
          ))}
        </List>

        <Button variant="contained" onClick={onSubirOtra}>
          Subir otra foto
        </Button>
      </Paper>
    </Box>
  )
}
