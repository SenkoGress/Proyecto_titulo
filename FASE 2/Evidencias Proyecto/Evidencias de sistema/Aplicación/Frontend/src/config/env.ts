// src/config/env.ts
import { z } from 'zod'

// mismo formato que valida el backend
const formatoId = /^[a-zA-Z0-9_-]{1,64}$/

// reglas del .env
const envSchema = z.object({
  VITE_TENANT_ID: z.string().regex(formatoId, 'VITE_TENANT_ID invalido'),
  VITE_USUARIO_ID: z.string().regex(formatoId, 'VITE_USUARIO_ID invalido'),
  VITE_DEVICE_ID: z.string().regex(formatoId, 'VITE_DEVICE_ID invalido'),
  VITE_CAJERO_NOMBRE: z.string().min(1),
  VITE_CAJERO_ROL: z.string().min(1),
  VITE_AUTH_ACTIVA: z.enum(['true', 'false']).default('false'),
})

// validar al partir
const resultado = envSchema.safeParse(import.meta.env)

if (!resultado.success) {
  console.error('Error en las variables de entorno:', resultado.error.issues)
  throw new Error('Revisa el archivo .env del frontend')
}

// configuracion lista para usar
export const env = {
  tenantId: resultado.data.VITE_TENANT_ID,
  usuarioId: resultado.data.VITE_USUARIO_ID,
  deviceId: resultado.data.VITE_DEVICE_ID,
  cajeroNombre: resultado.data.VITE_CAJERO_NOMBRE,
  cajeroRol: resultado.data.VITE_CAJERO_ROL,
  authActiva: resultado.data.VITE_AUTH_ACTIVA === 'true',
}
