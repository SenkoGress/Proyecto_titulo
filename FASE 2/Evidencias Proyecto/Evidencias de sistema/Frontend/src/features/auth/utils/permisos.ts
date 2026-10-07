// src/features/auth/utils/permisos.ts
import type { RolUsuario } from '@/features/auth/types'

// pantallas que solo ve el admin: margenes, compras y tributario
// configuracion no esta aca: el cajero entra, pero solo a la parte de apariencia
const SOLO_ADMIN = ['/dashboard', '/facturas', '/proveedores', '/reabastecimiento', '/sii']

export function esRutaDeAdmin(ruta: string): boolean {
  return SOLO_ADMIN.includes(ruta)
}

export function puedeEntrar(rol: RolUsuario | undefined, ruta: string): boolean {
  if (rol === 'admin') return true
  return !esRutaDeAdmin(ruta)
}

export function nombreRol(rol: RolUsuario): string {
  return rol === 'admin' ? 'Administrador' : 'Cajero'
}
