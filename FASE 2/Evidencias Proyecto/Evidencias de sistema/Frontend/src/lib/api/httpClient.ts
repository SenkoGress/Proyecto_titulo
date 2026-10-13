// src/lib/api/httpClient.ts
import axios from 'axios'
import { env } from '@/config/env'
import { tokenActual, useSesionStore } from '@/features/auth/stores/sesionStore'
import { tenantActual } from '@/features/auth/utils/identidad'
import { endpoints } from '@/lib/api/endpoints'

// cliente http
export const httpClient = axios.create({
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// agregar tenant y caja a cada peticion
httpClient.interceptors.request.use((config) => {
  const tenant = tenantActual()
  config.headers.set('X-Tenant-ID', tenant)
  config.headers.set('X-Device-ID', env.deviceId)

  const token = tokenActual()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)

  config.params = { tenant_id: tenant, ...config.params }
  return config
})

// si el token vencio o no sirve, se cierra la sesion y vuelve al login
httpClient.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    // al cambiar la clave un 401 significa que la actual estaba mal, no que la sesion vencio
    const esCambioDeClave = error.config?.url === endpoints.auth.clave

    if (error.response?.status === 401 && tokenActual() && !esCambioDeClave) {
      useSesionStore.getState().cerrar()
    }
    return Promise.reject(error)
  },
)
