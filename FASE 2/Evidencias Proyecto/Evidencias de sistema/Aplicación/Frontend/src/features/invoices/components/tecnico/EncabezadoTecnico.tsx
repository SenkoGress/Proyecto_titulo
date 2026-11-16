// src/features/invoices/components/tecnico/EncabezadoTecnico.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CloudDoneIcon from '@mui/icons-material/CloudDone'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import { nombreMotorOcr, usoRespaldo } from '@/features/invoices/utils/proveedorOcr'
import type { PrevisualizacionFactura } from '@/features/invoices/types'

type Props = {
  preview: PrevisualizacionFactura
}

// barra de estado del ocr: motor real usado (no hay % de precision, el backend no lo entrega)
export function EncabezadoTecnico({ preview }: Props) {
  const respaldo = usoRespaldo(preview.ocr_provider)

  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        fontFamily: 'monospace',
      }}
    >
      {respaldo ? <CloudOffIcon color="warning" fontSize="small" /> : <CloudDoneIcon color="success" fontSize="small" />}

      <Chip
        size="small"
        icon={<AutoAwesomeIcon />}
        label={nombreMotorOcr(preview.ocr_provider)}
        color={respaldo ? 'warning' : 'success'}
        variant="outlined"
      />

      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
        metodo_ingreso: {preview.raw_data.metodo_ingreso}
      </Typography>

      <Box sx={{ flexGrow: 1 }} />

      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
        {preview.items_count} item(s) detectados
      </Typography>
    </Paper>
  )
}
