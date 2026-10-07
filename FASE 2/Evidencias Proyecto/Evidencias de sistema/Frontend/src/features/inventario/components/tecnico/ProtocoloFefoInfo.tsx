// src/features/inventario/components/tecnico/ProtocoloFefoInfo.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import GppGoodIcon from '@mui/icons-material/GppGood'

// texto normativo del D.S. 977/96, el sistema no lo aplica solo
export function ProtocoloFefoInfo() {
  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 1.5 }}>
      <GppGoodIcon color="action" />
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Protocolo FEFO (First-Expired, First-Out)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Bajo el Reglamento Sanitario de los Alimentos (D.S. N° 977/96 MINSAL), los productos con
          vencimiento mas proximo deben rotarse y exhibirse primero. Esta pantalla ordena el
          catalogo por fecha de caducidad para apoyar ese control; la rebaja de precio o el retiro
          de gondola se hacen manualmente, el sistema no los automatiza hoy.
        </Typography>
      </Box>
    </Paper>
  )
}
