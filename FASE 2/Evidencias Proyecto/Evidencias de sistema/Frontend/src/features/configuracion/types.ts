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
  // dia de la semana en norma ISO, 1 lunes y 7 domingo
  dia_envio: number
  hora_envio: string
}

// respuesta comun de los POST de configuracion
export type RespuestaGuardado = {
  success: boolean
  message: string
}
