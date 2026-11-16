// src/features/proveedores/components/tecnico/TablaProveedoresTecnica.tsx
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import EditOutlined from '@mui/icons-material/EditOutlined'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { formatoClp } from '@/shared/utils/formatoClp'
import { ChipsDiasVisita } from '@/features/proveedores/components/tecnico/ChipsDiasVisita'
import { esCelularChileno } from '@/features/proveedores/utils/pedidoWhatsApp'
import type { OrdenSugerida } from '@/features/replenishment/types'
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

type Props = {
  fichas: FichaProveedor[]
  ordenesPorProveedor: Map<string, OrdenSugerida>
  onEditar: (ficha: FichaProveedor) => void
  onPedir: (ficha: FichaProveedor) => void
}

// estado rop de la fila: lo dicta el algoritmo del backend, no un umbral inventado aca
function EstadoRop({ orden }: { orden: OrdenSugerida | undefined }) {
  if (!orden) {
    return <Chip label="Sin disparo" size="small" variant="outlined" />
  }

  const agotados = orden.items.filter((item) => item.is_agotado).length

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
      <Chip
        label={`${orden.items.length} bajo ROP`}
        size="small"
        color={agotados > 0 ? 'error' : 'warning'}
        variant="filled"
      />
      <Typography variant="caption" color="text.secondary">
        Sugerido {formatoClp(orden.total_estimado)}
      </Typography>
    </Box>
  )
}

// tabla densa del modo tecnico
export function TablaProveedoresTecnica({ fichas, ordenesPorProveedor, onEditar, onPedir }: Props) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>RUT</TableCell>
            <TableCell>Razon social / contacto</TableCell>
            <TableCell>Linea / cat.</TableCell>
            <TableCell>Dias visita (semana)</TableCell>
            <TableCell>Proxima visita</TableCell>
            <TableCell align="right">Productos</TableCell>
            <TableCell>Estado ROP</TableCell>
            <TableCell>Ultima factura</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {fichas.map((ficha) => {
            const orden = ordenesPorProveedor.get(ficha.id)

            return (
              <TableRow key={ficha.id} hover>
                <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{ficha.rut_proveedor}</TableCell>

                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {ficha.nombre_proveedores}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {ficha.telefono} · {ficha.email ?? 'sin correo'}
                  </Typography>
                </TableCell>

                <TableCell>
                  {ficha.rubros.length > 0 ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {ficha.rubros.map((rubro) => (
                        <Chip key={rubro} label={rubro} size="small" variant="outlined" />
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.disabled">
                      Sin productos
                    </Typography>
                  )}
                </TableCell>

                <TableCell>
                  <ChipsDiasVisita diasVisita={ficha.dias_visita_proveedores} />
                </TableCell>

                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: ficha.proxima_visita.daysUntil === 0 ? 700 : 400, whiteSpace: 'nowrap' }}
                    color={ficha.proxima_visita.daysUntil === 0 ? 'primary.main' : 'text.primary'}
                  >
                    {ficha.proxima_visita.displayText}
                  </Typography>
                </TableCell>

                <TableCell align="right">{ficha.total_productos_suministrados}</TableCell>

                <TableCell>
                  <EstadoRop orden={orden} />
                </TableCell>

                <TableCell>
                  {ficha.ultimaFactura ? (
                    <Box>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {ficha.ultimaFactura.numero_factura}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ficha.ultimaFactura.fecha_ingreso} · {formatoClp(ficha.ultimaFactura.total_factura)}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.disabled">
                      Sin facturas
                    </Typography>
                  )}
                </TableCell>

                <TableCell align="right">
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                    <Tooltip
                      title={
                        esCelularChileno(ficha.telefono)
                          ? 'Armar pedido por WhatsApp'
                          : 'El telefono guardado no es un celular chileno'
                      }
                    >
                      <span>
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => onPedir(ficha)}
                          disabled={!esCelularChileno(ficha.telefono)}
                        >
                          <WhatsAppIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="Editar proveedor">
                      <IconButton size="small" onClick={() => onEditar(ficha)}>
                        <EditOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
