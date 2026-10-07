// src/features/ventas/components/tecnico/PanelAuditoriaDte.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import GavelOutlined from '@mui/icons-material/GavelOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { nombreDocumentoDte } from '@/features/dte/utils/nombreDte'
import type { DteEmitido } from '@/features/ventas/types'

type Props = {
  dtes: DteEmitido[]
}

type ResumenTipo = {
  tipo: number
  cantidad: number
  monto: number
  folioMenor: number
  folioMayor: number
}

// agrupa los documentos por tipo y saca el rango de folios usado
function agruparPorTipo(dtes: DteEmitido[]): ResumenTipo[] {
  const mapa = new Map<number, ResumenTipo>()

  for (const dte of dtes) {
    const actual = mapa.get(dte.tipo_dte)

    if (!actual) {
      mapa.set(dte.tipo_dte, {
        tipo: dte.tipo_dte,
        cantidad: 1,
        monto: dte.monto_total,
        folioMenor: dte.folio,
        folioMayor: dte.folio,
      })
      continue
    }

    actual.cantidad += 1
    actual.monto += dte.monto_total
    actual.folioMenor = Math.min(actual.folioMenor, dte.folio)
    actual.folioMayor = Math.max(actual.folioMayor, dte.folio)
  }

  return [...mapa.values()].sort((a, b) => a.tipo - b.tipo)
}

// documentos tributarios emitidos, agrupados por tipo
export function PanelAuditoriaDte({ dtes }: Props) {
  const porTipo = agruparPorTipo(dtes)
  const ivaTotal = dtes.reduce((suma, dte) => suma + dte.monto_iva, 0)
  const netoTotal = dtes.reduce((suma, dte) => suma + dte.monto_neto, 0)

  const estados = [...new Set(dtes.map((dte) => dte.estado_sii))]

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
        <GavelOutlined color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
          Documentos tributarios emitidos
        </Typography>

        {estados.map((estado) => (
          <Tooltip key={estado} title="Estado que guarda el backend en sii_dte_emitidos">
            <Chip label={estado} size="small" variant="outlined" />
          </Tooltip>
        ))}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Emitidos localmente con folios CAF. Todavia no hay envio real al SII.
      </Typography>

      {porTipo.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Todavia no se ha emitido ningun documento.
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
          {porTipo.map((grupo) => (
            <Box key={grupo.tipo}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                {nombreDocumentoDte(grupo.tipo)} ({grupo.tipo})
              </Typography>

              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {grupo.cantidad} {grupo.cantidad === 1 ? 'documento' : 'documentos'}
              </Typography>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Folios {grupo.folioMenor} al {grupo.folioMayor} · {formatoClp(grupo.monto)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            NETO DECLARADO
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 700 }}>
            {formatoClp(netoTotal)}
          </Typography>
        </Box>

        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            IVA DEBITO
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 700 }}>
            {formatoClp(ivaTotal)}
          </Typography>
        </Box>
      </Box>
    </Paper>
  )
}
