// src/features/auth/types.ts
// segun la tabla usuarios del backend (backend/src/database/sqlite/migrations/001_initial_schema.sql)

export type RolUsuario = 'admin' | 'cajero'

export type Usuario = {
  id: string
  tenant_id: string
  nombre: string
  email: string
  rol: RolUsuario
}

export type Credenciales = {
  email: string
  password: string
}

export type NuevoUsuario = {
  nombre: string
  email: string
  password: string
  rol: RolUsuario
}

export type RespuestaSesion = {
  success: boolean
  data: {
    token: string
    usuario: Usuario
  }
}
