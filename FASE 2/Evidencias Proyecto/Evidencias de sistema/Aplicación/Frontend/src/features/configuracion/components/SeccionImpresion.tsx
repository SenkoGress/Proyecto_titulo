// src/features/configuracion/components/SeccionImpresion.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import { Seccion } from '@/features/configuracion/components/Seccion'
import { usePapelStore } from '@/shared/stores/papelStore'
import { ANCHOS_PAPEL } from '@/shared/utils/papelTermico'
import type { AnchoPapel } from '@/shared/utils/papelTermico'

// ancho del rollo de la impresora de este mostrador
export function SeccionImpresion() {
  const ancho = usePapelStore((estado) => estado.ancho)
  const cambiarAncho = usePapelStore((estado) => estado.cambiarAncho)

  return (
    <Seccion
      titulo="Impresion"
      descripcion="Como salen el ticket y el reporte del turno en la impresora de este mostrador."
      icono={<ReceiptLongOutlined />}
      origen="equipo"
    >
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 220 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Ancho del rollo
          </Typography>
          <Typography variant="caption" color="text.secondary">
            El que dice la caja del papel. Si el ticket sale cortado por el lado, es este.
          </Typography>
        </Box>

        <ToggleButtonGroup
          value={ancho}
          exclusive
          size="small"
          onChange={(_, valor: AnchoPapel | null) => valor && cambiarAncho(valor)}
        >
          {ANCHOS_PAPEL.map((opcion) => (
            <ToggleButton key={opcion} value={opcion}>
              {opcion} mm
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
    </Seccion>
  )
}
