// src/features/configuracion/components/SeccionPciDss.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import ShieldOutlined from '@mui/icons-material/ShieldOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import { Seccion } from '@/features/configuracion/components/Seccion'
import { useConfigDte } from '@/features/dte/hooks/useConfigDte'

// una regla del estandar, con lo que el backend declara al respecto
function Regla({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      <CheckCircleOutlined fontSize="small" color="success" sx={{ mt: 0.25 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {titulo}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {detalle}
        </Typography>
      </Box>
    </Box>
  )
}

// como trata el sistema los datos de las tarjetas
export function SeccionPciDss() {
  const config = useConfigDte()
  const pci = config.data?.pciDssCompliance

  return (
    <Seccion
      titulo="Manejo de los datos de tarjeta"
      descripcion="Que hace el sistema con la informacion de las tarjetas al cobrar."
      icono={<ShieldOutlined />}
      origen="lectura"
    >
      {config.isPending ? (
        <Skeleton variant="rounded" height={140} />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={pci?.standard ?? 'PCI-DSS'}
              size="small"
              color={pci?.active ? 'success' : 'default'}
              sx={{ fontWeight: 700 }}
            />
            {pci?.active && <Chip label="Declarado activo" size="small" color="success" variant="outlined" />}
          </Box>

          <Regla
            titulo="No se guarda ningun dato sensible"
            detalle="El sistema nunca almacena el numero completo de la tarjeta, ni el codigo de seguridad, ni el PIN."
          />

          <Regla
            titulo="Solo se muestran los ultimos digitos"
            detalle="En los comprobantes la tarjeta aparece enmascarada (**** **** **** 1234)."
          />

          <Regla
            titulo="El cobro lo hace la pasarela"
            detalle="Transbank, Mercado Pago y SumUp reciben el pago directamente; GesTock solo registra el resultado."
          />
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Esto es lo que el backend declara en <code>GET /dte/config</code>. No es una certificacion: para acreditar
        PCI-DSS de verdad hace falta una auditoria externa.
      </Typography>
    </Seccion>
  )
}
