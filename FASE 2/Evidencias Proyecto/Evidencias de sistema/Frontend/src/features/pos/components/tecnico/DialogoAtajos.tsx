// src/features/pos/components/tecnico/DialogoAtajos.tsx
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'

type Props = {
  abierto: boolean
  onCerrar: () => void
}

// lista de atajos
const atajos = [
  ['F1', 'Abrir esta ayuda'],
  ['F2', 'Ir al buscador / lector'],
  ['F3', 'Editar cantidad del ultimo producto'],
  ['F4', 'Cobrar la venta'],
  ['ESC', 'Limpiar el ticket (o salir de un campo)'],
  ['1 al 5', 'Elegir medio de pago'],
  ['Enter', 'Agregar el producto encontrado'],
]

// ayuda de teclado (F1)
export function DialogoAtajos({ abierto, onCerrar }: Props) {
  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="xs" fullWidth>
      <DialogTitle>Atajos de teclado</DialogTitle>

      <DialogContent>
        <Table size="small">
          <TableBody>
            {atajos.map(([tecla, descripcion]) => (
              <TableRow key={tecla}>
                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, width: 90 }}>
                  {tecla}
                </TableCell>
                <TableCell>{descripcion}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCerrar}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
