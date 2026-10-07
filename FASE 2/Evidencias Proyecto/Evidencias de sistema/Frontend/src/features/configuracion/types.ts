// src/features/configuracion/types.ts
// segun backend/src/routes/config.routes.ts

// GET /config/margin
export type RespuestaMargen = {
  success: boolean
  margin: number
}

// GET /config/email
export type RespuestaCorreo = {
  success: boolean
  email: string
  auto_send: boolean
}

// respuesta comun de los POST de configuracion
export type RespuestaGuardado = {
  success: boolean
  message: string
}
