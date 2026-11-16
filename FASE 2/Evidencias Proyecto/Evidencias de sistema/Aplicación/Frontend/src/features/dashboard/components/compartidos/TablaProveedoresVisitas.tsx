// src/features/dashboard/components/compartidos/TablaProveedoresVisitas.tsx
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import EventOutlined from '@mui/icons-material/EventOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import type { ProveedorDashboard } from '@/features/dashboard/types'

type Props = {
  proveedores: ProveedorDashboard[]
  visitas: Record<string, string> // proxima visita por proveedor, la calcula el backend
}

export function TablaProveedoresVisitas({ proveedores, visitas }: Props) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
        Detalle de proveedores y visitas
      </Typography>

      {proveedores.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Todavia no hay proveedores registrados.
        </Typography>
      ) : (
        <TableContainer sx={{ maxHeight: 320 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Proveedor</TableCell>
                <TableCell>Visita</TableCell>
                <TableCell align="right">Facturas</TableCell>
                <TableCell align="right">Total comprado</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {proveedores.map((proveedor) => (
                <TableRow key={proveedor.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {proveedor.nombre}
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                      {proveedor.rut} · {proveedor.productosAsociados} productos
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                      <EventOutlined fontSize="small" color="action" />
                      <Typography variant="body2">{visitas[proveedor.id] ?? 'Sin programar'}</Typography>
                    </Box>
                  </TableCell>

                  <TableCell align="right">{proveedor.facturasIngresadas}</TableCell>

                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {formatoClp(proveedor.totalInvertido)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  )
}
