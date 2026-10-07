// src/lib/api/httpClient.ts
import axios from 'axios'
import { env } from '@/config/env'
import { tokenActual, useSesionStore } from '@/features/auth/stores/sesionStore'

// cliente http
export const httpClient = axios.create({
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// agregar tenant y caja a cada peticion
httpClient.interceptors.request.use((config) => {
  config.headers.set('X-Tenant-ID', env.tenantId)
  config.headers.set('X-Device-ID', env.deviceId)

  const token = tokenActual()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)

  config.params = { tenant_id: env.tenantId, ...config.params }
  return config
})

// si el token vencio o no sirve, se cierra la sesion y vuelve al login
httpClient.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    if (error.response?.status === 401 && tokenActual()) {
      useSesionStore.getState().cerrar()
    }
    return Promise.reject(error)
  },
)
