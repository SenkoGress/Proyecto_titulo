// src/features/inventario/components/tecnico/EtiquetaGondola.tsx
import { useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import JsBarcode from 'jsbarcode'
import { formatoClp } from '@/shared/utils/formatoClp'
import { nombreIla, codigoIla } from '@/shared/utils/ila'
import type { ProductoInventario } from '@/features/inventario/types'

type Props = {
  producto: ProductoInventario
}

// code128: los codigos del catalogo no son ean-13 validos
const FORMATO = 'CODE128'

// etiqueta de gondola: sku, nombre del item y codigo de barra
export function EtiquetaGondola({ producto }: Props) {
  const svg = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svg.current || !producto.codigo_barra) return

    JsBarcode(svg.current, producto.codigo_barra, {
      format: FORMATO,
      displayValue: true,
      fontSize: 13,
      height: 42,
      margin: 0,
      width: 1.6,
    })
  }, [producto.codigo_barra])

  return (
    <Box
      className="etiqueta-gondola"
      sx={{
        width: 240,
        p: 1.5,
        border: '1px dashed',
        borderColor: 'text.disabled',
        borderRadius: 1,
        bgcolor: 'common.white',
        color: 'common.black',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        breakInside: 'avoid',
      }}
    >
      {/* sku */}
      <Typography sx={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>
        {producto.sku}
      </Typography>

      {/* nombre del item */}
      <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25, minHeight: 34 }}>
        {producto.nombre}
      </Typography>

      <Typography sx={{ fontSize: 20, fontWeight: 700 }}>{formatoClp(producto.precio_venta)}</Typography>

      {/* el impuesto adicional tiene que ir informado en la gondola */}
      {codigoIla(producto) > 0 && (
        <Typography sx={{ fontSize: 10, fontWeight: 700 }}>{nombreIla(producto)}</Typography>
      )}

      {/* codigo de barra */}
      {producto.codigo_barra ? (
        <Box component="svg" ref={svg} sx={{ width: '100%' }} />
      ) : (
        <Typography sx={{ fontSize: 10 }}>Sin codigo de barra</Typography>
      )}
    </Box>
  )
}
