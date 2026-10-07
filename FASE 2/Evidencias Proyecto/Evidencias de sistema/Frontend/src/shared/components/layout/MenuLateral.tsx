// src/shared/components/layout/MenuLateral.tsx
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import DashboardIcon from '@mui/icons-material/Dashboard'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import RequestQuoteIcon from '@mui/icons-material/RequestQuote'
import SavingsIcon from '@mui/icons-material/Savings'
import NotificationsIcon from '@mui/icons-material/Notifications'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import GavelIcon from '@mui/icons-material/Gavel'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import { obtenerColoresMenu } from '@/app/theme/theme'
import { useModoTema } from '@/shared/stores/temaStore'
import { env } from '@/config/env'
import { EstadoConexion } from '@/shared/components/layout/EstadoConexion'
import { useEsModoTecnico } from '@/shared/stores/modoVistaStore'
import { useNotificaciones } from '@/features/notificaciones/hooks/useNotificaciones'
import { useUsuario } from '@/features/auth/stores/sesionStore'
import { useCerrarSesion } from '@/features/auth/hooks/useAuth'
import { esRutaDeAdmin, nombreRol } from '@/features/auth/utils/permisos'

type Opcion = {
  to: string
  label: string
  icono: ReactNode
  lista: boolean // false = pantalla aun no construida
}

// menu del modo visual (mismo orden que el tecnico, con nombres mas descriptivos)
const opcionesVisual: Opcion[] = [
  { to: '/', label: 'Caja / Nueva Venta', icono: <PointOfSaleIcon />, lista: true },
  { to: '/dashboard', label: 'Panel General', icono: <DashboardIcon />, lista: true },
  { to: '/notificaciones', label: 'Notificaciones', icono: <NotificationsIcon />, lista: true },
  { to: '/facturas', label: 'Facturas', icono: <RequestQuoteIcon />, lista: true },
  { to: '/inventario', label: 'Inventario y Stock', icono: <Inventory2Icon />, lista: true },
  { to: '/proveedores', label: 'Proveedores', icono: <LocalShippingIcon />, lista: true },
  { to: '/reabastecimiento', label: 'Reposición de Stock', icono: <AutorenewIcon />, lista: true },
  { to: '/caja/cierre', label: 'Cierre de Caja', icono: <SavingsIcon />, lista: true },
  { to: '/ventas', label: 'Historial de Ventas', icono: <ReceiptLongIcon />, lista: true },
  { to: '/sii', label: 'Respaldo de Facturas', icono: <GavelIcon />, lista: true },
  { to: '/configuracion', label: 'Configuración', icono: <SettingsIcon />, lista: true },
]

// menu del modo tecnico
const opcionesTecnico: Opcion[] = [
  { to: '/', label: 'Caja POS', icono: <PointOfSaleIcon />, lista: true },
  { to: '/dashboard', label: 'Dashboard', icono: <DashboardIcon />, lista: true },
  { to: '/notificaciones', label: 'Notificaciones', icono: <NotificationsIcon />, lista: true },
  { to: '/facturas', label: 'Facturas', icono: <RequestQuoteIcon />, lista: true },
  { to: '/inventario', label: 'Inventario y Stock', icono: <Inventory2Icon />, lista: true },
  { to: '/proveedores', label: 'Proveedores', icono: <LocalShippingIcon />, lista: true },
  { to: '/reabastecimiento', label: 'Reabastecimiento ROP', icono: <AutorenewIcon />, lista: true },
  { to: '/caja/cierre', label: 'Cierre de Caja', icono: <SavingsIcon />, lista: true },
  { to: '/ventas', label: 'Registro de Ventas', icono: <ReceiptLongIcon />, lista: true },
  { to: '/sii', label: 'Respaldo Facturas y SII', icono: <GavelIcon />, lista: true },
  { to: '/configuracion', label: 'Configuración', icono: <SettingsIcon />, lista: true },
]

// ancho del menu
export const ANCHO_MENU = 256

// menu lateral oscuro
export function MenuLateral() {
  const esModoTecnico = useEsModoTecnico()
  const coloresMenu = obtenerColoresMenu(useModoTema())
  const { sinVer } = useNotificaciones()
  const usuario = useUsuario()
  const cerrarSesion = useCerrarSesion()

  // el cajero no ve las pantallas de administracion
  const todas = esModoTecnico ? opcionesTecnico : opcionesVisual
  const opciones =
    usuario && usuario.rol !== 'admin' ? todas.filter((opcion) => !esRutaDeAdmin(opcion.to)) : todas

  return (
    <Box
      sx={{
        width: ANCHO_MENU,
        flexShrink: 0,
        bgcolor: coloresMenu.fondo,
        color: coloresMenu.texto,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
      }}
    >
      {/* logo */}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', px: 2, py: 1.25, flexShrink: 0 }}>
        <Box
          component="img"
          src="/logo-gestock.png"
          alt="GesTock"
          sx={{ width: 34, height: 34, objectFit: 'contain' }}
        />
        <Box>
          <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>GesTock</Typography>
          <Typography variant="caption" sx={{ color: coloresMenu.textoApagado }}>
            TERMINAL POS
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: coloresMenu.borde }} />

      <EstadoConexion />

      <Divider sx={{ borderColor: coloresMenu.borde }} />

      <List
        sx={{
          flexGrow: 1,
          minHeight: 0,
          overflowY: 'auto',
          px: 1,
          py: 0.5,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: coloresMenu.borde, borderRadius: 3 },
        }}
      >
        {opciones.map((opcion) =>
          opcion.lista ? (
            <ListItemButton
              key={opcion.to}
              component={NavLink}
              to={opcion.to}
              end
              sx={{
                borderRadius: 2,
                mb: 0.25,
                py: 0.5,
                color: coloresMenu.texto,
                '&.active': { bgcolor: coloresMenu.fondoItemActivo, color: '#fff' },
                '&.active .MuiListItemIcon-root': { color: '#fff' },
                '&:hover': { bgcolor: '#1e293b' },
              }}
            >
              <ListItemIcon sx={{ color: coloresMenu.textoApagado, minWidth: 36 }}>
                {opcion.icono}
              </ListItemIcon>
              <ListItemText slotProps={{ primary: { sx: { fontSize: 14 } } }} primary={opcion.label} />

              {/* avisos sin ver */}
              {opcion.to === '/notificaciones' && sinVer.length > 0 && (
                <Chip label={sinVer.length} size="small" color="error" sx={{ height: 20, fontWeight: 700 }} />
              )}
            </ListItemButton>
          ) : (
            // pantalla pendiente
            <Tooltip key={opcion.to} title="Todavía no construimos esta pantalla" placement="right">
              <span>
                <ListItemButton disabled sx={{ borderRadius: 2, mb: 0.25, py: 0.5 }}>
                  <ListItemIcon sx={{ color: coloresMenu.textoApagado, minWidth: 36 }}>
                    {opcion.icono}
                  </ListItemIcon>
                  <ListItemText
                    slotProps={{ primary: { sx: { fontSize: 14 } } }}
                    sx={{ color: coloresMenu.textoApagado }}
                    primary={opcion.label}
                  />
                </ListItemButton>
              </span>
            </Tooltip>
          ),
        )}
      </List>

      <Divider sx={{ borderColor: coloresMenu.borde }} />

      {/* quien esta usando la caja */}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', px: 2, py: 1.25, flexShrink: 0 }}>
        <Avatar sx={{ width: 30, height: 30, bgcolor: '#334155', fontSize: 13 }}>
          {(usuario?.nombre ?? env.cajeroNombre).charAt(0)}
        </Avatar>

        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {usuario?.nombre ?? env.cajeroNombre}
          </Typography>
          <Typography variant="caption" sx={{ color: coloresMenu.textoApagado }}>
            {usuario ? nombreRol(usuario.rol) : env.cajeroRol}
          </Typography>
        </Box>

        {usuario && (
          <Tooltip title="Cerrar sesion">
            <IconButton size="small" onClick={cerrarSesion} sx={{ color: coloresMenu.textoApagado }}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}
