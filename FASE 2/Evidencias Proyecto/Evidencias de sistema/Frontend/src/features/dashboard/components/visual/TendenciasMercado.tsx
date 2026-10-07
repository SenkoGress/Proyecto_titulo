// src/features/dashboard/components/visual/TendenciasMercado.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import Tooltip from '@mui/material/Tooltip'
import InsightsOutlined from '@mui/icons-material/InsightsOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import type { TendenciaComparada } from '@/features/dashboard/utils/comparacionMercado'

type Props = {
  tendencias: TendenciaComparada[]
  cargando: boolean
}

const CUANTAS_MOSTRAR = 5

// como se compara mi precio con el del mercado
function ComparacionPrecio({ tendencia }: { tendencia: TendenciaComparada }) {
  if (!tendencia.producto || tendencia.diferenciaPorc === null) {
    return (
      <Tooltip title="Este producto no esta en el catalogo, no hay con que comparar">
        <Typography variant="caption" color="text.disabled">
          Fuera de catalogo
        </Typography>
      </Tooltip>
    )
  }

  const diferencia = tendencia.diferenciaPorc
  const masCaro = diferencia > 0

  return (
    <Typography variant="caption" color={masCaro ? 'warning.main' : 'success.main'} sx={{ fontWeight: 600 }}>
      {masCaro ? `${diferencia}% sobre el mercado` : `${Math.abs(diferencia)}% bajo el mercado`}
    </Typography>
  )
}

// tendencias de mercado cruzadas con el catalogo propio
export function TendenciasMercado({ tendencias, cargando }: Props) {
  const visibles = tendencias.slice(0, CUANTAS_MOSTRAR)

  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <InsightsOutlined color="action" />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Tendencias de mercado
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Demanda y precio de referencia externos, comparados con tu precio de venta.
      </Typography>

      {cargando && <Skeleton variant="rounded" height={200} />}

      {!cargando && visibles.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No hay tendencias sincronizadas.
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {visibles.map((tendencia, indice) => (
          <Box key={tendencia.id}>
            {indice > 0 && <Divider />}

            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', py: 1.25 }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {tendencia.keyword}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {tendencia.source} · demanda {tendencia.demandIndex} · mercado{' '}
                  {formatoClp(tendencia.averageMarketPrice)}
                </Typography>
                <ComparacionPrecio tendencia={tendencia} />
              </Box>

              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                {tendencia.producto ? (
                  <>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {formatoClp(tendencia.producto.precio_venta)}
                    </Typography>
                    {tendencia.margenPorc !== null && (
                      <Chip label={`margen ${tendencia.margenPorc}%`} size="small" variant="outlined" />
                    )}
                  </>
                ) : (
                  <Typography variant="caption" color="text.disabled">
                    sin precio
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Para sumar uno de estos al catalogo, usa Añadir producto en Inventario.
      </Typography>
    </Paper>
  )
}
