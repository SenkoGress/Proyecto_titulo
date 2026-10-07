// src/features/configuracion/components/SeccionModeloSii.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Radio from '@mui/material/Radio'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import { alpha, useTheme } from '@mui/material/styles'
import GavelOutlined from '@mui/icons-material/GavelOutlined'
import { Seccion } from '@/features/configuracion/components/Seccion'
import { useConfigDte, useGuardarConfigDte } from '@/features/dte/hooks/useConfigDte'
import type { ModeloEmision } from '@/features/dte/types'

const OPCIONES: { valor: ModeloEmision; titulo: string; detalle: string }[] = [
  {
    valor: 'MODELO_B',
    titulo: 'El voucher de la tarjeta reemplaza a la boleta',
    detalle:
      'Al cobrar con tarjeta (Transbank, Mercado Pago o SumUp) el POS no emite boleta tipo 39, porque la pasarela ya informa el debito al SII. Se entrega un comprobante interno no tributario. La boleta electronica queda para efectivo y transferencia.',
  },
  {
    valor: 'MODELO_A',
    titulo: 'Emitir siempre boleta electronica, tambien con tarjeta',
    detalle:
      'Se genera boleta tipo 39 por el 100% de las ventas. Requiere tener informado al SII que el terminal POS esta integrado, para que la operadora no duplique el debito fiscal.',
  },
]

// como opera el pos frente a los pagos con tarjeta (Res. Ex. N° 176 del SII)
export function SeccionModeloSii() {
  const theme = useTheme()
  const config = useConfigDte()
  const guardar = useGuardarConfigDte()

  const guardado = config.data?.modeloEmision
  const [elegido, setElegido] = useState<ModeloEmision | null>(null)
  const actual = elegido ?? guardado

  const cambio = actual !== undefined && actual !== guardado

  return (
    <Seccion
      titulo="Modelo de emision tributaria"
      descripcion="Como opera el punto de venta frente a los pagos con tarjeta, para no duplicar el IVA debito en el registro del SII (Res. Exenta N° 176)."
      icono={<GavelOutlined />}
      origen="servidor"
    >
      {config.isPending ? (
        <Skeleton variant="rounded" height={180} />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {OPCIONES.map((opcion) => {
            const activa = actual === opcion.valor

            return (
              <Paper
                key={opcion.valor}
                variant="outlined"
                onClick={() => setElegido(opcion.valor)}
                sx={{
                  p: 2,
                  display: 'flex',
                  gap: 1,
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  borderWidth: activa ? 2 : 1,
                  borderColor: activa ? 'primary.main' : 'divider',
                  bgcolor: activa ? alpha(theme.palette.primary.main, 0.06) : 'background.paper',
                }}
              >
                <Radio checked={activa} size="small" sx={{ mt: -0.5 }} />

                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 700, color: activa ? 'primary.main' : 'text.primary' }}
                  >
                    {opcion.titulo}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {opcion.detalle}
                  </Typography>
                </Box>
              </Paper>
            )
          })}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              disabled={!cambio || guardar.isPending}
              onClick={() => actual && guardar.mutate({ modeloEmision: actual })}
            >
              {guardar.isPending ? 'Guardando...' : 'Guardar modelo de emision'}
            </Button>
          </Box>
        </Box>
      )}

      {guardar.isSuccess && !cambio && (
        <Alert severity="success" sx={{ mt: 1 }}>
          {guardar.data.message}
        </Alert>
      )}

      {guardar.isError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {guardar.error.message}
        </Alert>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Esto cambia lo que recibe el cliente al pagar con tarjeta desde la proxima venta. No toca las boletas ya
        emitidas.
      </Typography>
    </Seccion>
  )
}
