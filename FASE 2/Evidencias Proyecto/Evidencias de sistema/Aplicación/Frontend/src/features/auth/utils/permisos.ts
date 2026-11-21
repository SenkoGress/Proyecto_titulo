// src/features/auth/utils/permisos.ts
import type { RolUsuario } from '@/features/auth/types'

// pantallas que solo ve el admin: margenes, compras y tributario
// configuracion no esta aca: el cajero entra, pero solo a la parte de apariencia
const SOLO_ADMIN = ['/dashboard', '/facturas', '/proveedores', '/reabastecimiento', '/sii', '/mercado']

export function esRutaDeAdmin(ruta: string): boolean {
  return SOLO_ADMIN.includes(ruta)
}

export function puedeEntrar(rol: RolUsuario | undefined, ruta: string): boolean {
  if (rol === 'admin') return true
  return !esRutaDeAdmin(ruta)
}

// a donde entra cada uno al iniciar sesion. La pantalla que quedo abierta es de la sesion
// anterior: al cajero lo dejaba en Configuracion, con la cuenta de otro. Solo el admin vuelve a
// donde iba, que es lo que sirve cuando se entra a una pantalla por un enlace y pide la clave
export function destinoTrasEntrar(rol: RolUsuario | undefined, desde: string | undefined): string {
  if (rol !== 'admin') return '/'
  if (!desde || desde === '/login') return '/'
  return desde
}

export function nombreRol(rol: RolUsuario): string {
  return rol === 'admin' ? 'Administrador' : 'Cajero'
}
