// src/features/proveedores/components/visual/DialogoFacturasProveedor.tsx
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { formatoClp } from '@/shared/utils/formatoClp'
import { facturasDelProveedor } from '@/features/proveedores/utils/fichaProveedor'
import type { FacturaRegistrada } from '@/features/invoices/types'
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

type Props = {
  ficha: FichaProveedor | null
  facturas: FacturaRegistrada[]
  onCerrar: () => void
}

// si el motor fue el de respaldo, el dato no vino de la ia real
function esOcrReal(metodo: string): boolean {
  return !metodo.toUpperCase().includes('MOCK') && !metodo.toUpperCase().includes('FALLBACK')
}

// facturas ya procesadas de un proveedor
export function DialogoFacturasProveedor({ ficha, facturas, onCerrar }: Props) {
  const suyas = ficha ? facturasDelProveedor(ficha.id, facturas) : []

  return (
    <Dialog open={Boolean(ficha)} onClose={onCerrar} maxWidth="md" fullWidth>
      <DialogTitle>Facturas de {ficha?.nombre_proveedores}</DialogTitle>

      <DialogContent dividers>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>N° factura</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell align="right">Neto</TableCell>
              <TableCell align="right">IVA credito</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Unidades</TableCell>
              <TableCell>Motor OCR</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {suyas.map((factura) => (
              <TableRow key={factura.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{factura.numero_factura}</TableCell>
                <TableCell>{factura.fecha_ingreso}</TableCell>
                <TableCell align="right">{formatoClp(factura.monto_neto)}</TableCell>
                <TableCell align="right">{formatoClp(factura.iva_credito)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {formatoClp(factura.total_factura)}
                </TableCell>
                <TableCell align="right">{factura.cantidad}</TableCell>
                <TableCell>
                  <Chip
                    label={factura.metodo_ingreso}
                    size="small"
                    color={esOcrReal(factura.metodo_ingreso) ? 'success' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          El motor en gris es el de respaldo: se usa cuando el backend no tiene configurada la clave de Google AI
          Studio, asi que esos datos no salieron de la IA real.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCerrar}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
