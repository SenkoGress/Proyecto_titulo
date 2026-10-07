// src/features/proveedores/components/visual/TarjetaProveedor.tsx
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Box from '@mui/material/Box'
import Avatar from '@mui/material/Avatar'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { alpha, useTheme } from '@mui/material/styles'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { formatoClp } from '@/shared/utils/formatoClp'
import { colorProveedor, siglaProveedor } from '@/features/proveedores/utils/marcaProveedor'
import { esCelularChileno } from '@/features/proveedores/utils/pedidoWhatsApp'
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

type Props = {
  ficha: FichaProveedor
  onPedir: (ficha: FichaProveedor) => void
  onVerFacturas: (ficha: FichaProveedor) => void
  onEditar: (ficha: FichaProveedor) => void
}

// una fila etiqueta / valor de la ficha
function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
        {etiqueta}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
        {valor}
      </Typography>
    </Box>
  )
}

// linea de estado con punto de color (reposicion pendiente o ultima factura)
function Estado({ color, texto }: { color: 'warning' | 'success' | 'info'; texto: string }) {
  const theme = useTheme()

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 1,
        borderRadius: 2,
        bgcolor: alpha(theme.palette[color].main, 0.1),
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: `${color}.main`, flexShrink: 0 }} />
      <Typography variant="caption" sx={{ fontWeight: 600, color: `${color}.dark` }}>
        {texto}
      </Typography>
    </Box>
  )
}

// tarjeta de proveedor del directorio visual
export function TarjetaProveedor({ ficha, onPedir, onVerFacturas, onEditar }: Props) {
  const puedeWhatsApp = esCelularChileno(ficha.telefono)

  return (
    <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        {/* cabecera: sigla, nombre y rubros reales de sus productos */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 1.5 }}>
          <Avatar
            sx={{
              bgcolor: alpha(colorProveedor(ficha.nombre_proveedores), 0.15),
              color: colorProveedor(ficha.nombre_proveedores),
              fontWeight: 700,
              fontSize: 13,
              width: 46,
              height: 46,
            }}
          >
            {siglaProveedor(ficha.nombre_proveedores)}
          </Avatar>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 700, lineHeight: 1.3 }}>{ficha.nombre_proveedores}</Typography>

              <Tooltip title="Editar proveedor">
                <IconButton size="small" onClick={() => onEditar(ficha)}>
                  <EditOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              RUT {ficha.rut_proveedor} · {ficha.giro}
            </Typography>

            {ficha.rubros.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                {ficha.rubros.map((rubro) => (
                  <Chip key={rubro} label={rubro} size="small" variant="outlined" />
                ))}
              </Box>
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 1 }} />

        <Dato etiqueta="Telefono / WhatsApp" valor={ficha.telefono} />
        <Dato etiqueta="Correo" valor={ficha.email ?? 'Sin correo'} />
        <Dato etiqueta="Dias de visita" valor={ficha.dias_visita_proveedores} />
        <Dato etiqueta="Proxima visita" valor={ficha.proxima_visita.displayText} />
        <Dato etiqueta="Productos que surte" valor={ficha.total_productos_suministrados} />

        {/* estados reales: primero lo urgente */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 1.5 }}>
          {ficha.aReponer.length > 0 && (
            <Estado
              color="warning"
              texto={
                ficha.aReponer.length === 1
                  ? `Stock sugerido: reponer ${ficha.aReponer[0].nombre}`
                  : `Stock sugerido: ${ficha.aReponer.length} productos bajo el minimo`
              }
            />
          )}

          {ficha.ultimaFactura ? (
            <Estado
              color="success"
              texto={`Ultima factura ${ficha.ultimaFactura.numero_factura} · ${ficha.ultimaFactura.fecha_ingreso} · ${formatoClp(ficha.ultimaFactura.total_factura)}`}
            />
          ) : (
            <Estado color="info" texto="Todavia no se ha procesado ninguna factura suya" />
          )}

          {ficha.ultimaOrden && (
            <Estado
              color="info"
              texto={`Ultimo pedido ${ficha.ultimaOrden.fecha_creacion.slice(0, 10)} · estado "${ficha.ultimaOrden.estado}" · ${formatoClp(ficha.ultimaOrden.total_estimado)}`}
            />
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Tooltip title={puedeWhatsApp ? '' : 'El telefono guardado no es un celular chileno valido para WhatsApp'}>
          <span style={{ flex: 1 }}>
            <Button
              fullWidth
              variant="contained"
              color="success"
              startIcon={<WhatsAppIcon />}
              onClick={() => onPedir(ficha)}
              disabled={!puedeWhatsApp}
            >
              Pedir por WhatsApp
            </Button>
          </span>
        </Tooltip>

        <Button
          sx={{ flex: 1 }}
          variant="outlined"
          startIcon={<ReceiptLongOutlined />}
          onClick={() => onVerFacturas(ficha)}
          disabled={ficha.totalFacturas === 0}
        >
          Facturas ({ficha.totalFacturas})
        </Button>
      </CardActions>
    </Card>
  )
}
