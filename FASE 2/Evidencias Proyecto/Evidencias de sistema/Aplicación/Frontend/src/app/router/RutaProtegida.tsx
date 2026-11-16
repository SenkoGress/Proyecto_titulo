// src/app/router/RutaProtegida.tsx
import { Navigate, Outlet, useLocation } from 'react-router'
import { env } from '@/config/env'
import { useHaySesion, useUsuario } from '@/features/auth/stores/sesionStore'
import { puedeEntrar } from '@/features/auth/utils/permisos'
import { SinPermiso } from '@/shared/pages/SinPermiso'

// pide sesion abierta para cualquier pantalla
export function RutaProtegida() {
  const haySesion = useHaySesion()
  const ubicacion = useLocation()

  // mientras el backend no tenga /auth, la llave queda apagada desde el .env
  if (!env.authActiva) return <Outlet />

  if (!haySesion) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />
  }

  return <Outlet />
}

// va dentro del layout, asi el cajero que se equivoca no pierde el menu
export function RutaDeAdmin() {
  const usuario = useUsuario()
  const ubicacion = useLocation()

  if (!env.authActiva) return <Outlet />
  if (!puedeEntrar(usuario?.rol, ubicacion.pathname)) return <SinPermiso />

  return <Outlet />
}
