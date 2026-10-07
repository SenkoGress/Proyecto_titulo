// src/features/inventario/components/tecnico/DialogoEtiquetas.tsx
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import PrintOutlined from '@mui/icons-material/PrintOutlined'
import { EtiquetaGondola } from '@/features/inventario/components/tecnico/EtiquetaGondola'
import { imprimirEtiquetas } from '@/features/inventario/utils/imprimirEtiquetas'
import { esEan13Valido } from '@/shared/utils/codigoBarra'
import type { ProductoInventario } from '@/features/inventario/types'

type Props = {
  productos: ProductoInventario[]
  onCerrar: () => void
}

// vista previa e impresion de las etiquetas de gondola
export function DialogoEtiquetas({ productos, onCerrar }: Props) {
  const sinCodigo = productos.filter((producto) => !producto.codigo_barra)
  const codigosInvalidos = productos.filter(
    (producto) => producto.codigo_barra && !esEan13Valido(producto.codigo_barra),
  )

  return (
    <Dialog open onClose={onCerrar} maxWidth="md" fullWidth>
      <DialogTitle>Etiquetas de gondola ({productos.length})</DialogTitle>

      <DialogContent dividers>
        {codigosInvalidos.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {codigosInvalidos.length} de {productos.length} productos tienen un codigo de barra que no es un EAN-13
            valido (el digito verificador no cuadra). Las etiquetas se imprimen en formato CODE128, que cualquier
            lector reconoce, pero para el comercio formal los codigos deberian ser EAN-13 reales del proveedor.
          </Alert>
        )}

        {sinCodigo.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {sinCodigo.length} producto(s) no tienen codigo de barra: su etiqueta sale solo con SKU, nombre y precio.
          </Alert>
        )}

        <Box id="etiquetas-gondola" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {productos.map((producto) => (
            <EtiquetaGondola key={producto.id} producto={producto} />
          ))}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Se imprimen desde el navegador: el backend no tiene servicio de impresion de etiquetas.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCerrar}>Cerrar</Button>
        <Button
          variant="contained"
          startIcon={<PrintOutlined />}
          onClick={imprimirEtiquetas}
          disabled={productos.length === 0}
        >
          Imprimir {productos.length} etiqueta(s)
        </Button>
      </DialogActions>
    </Dialog>
  )
}
