// src/features/auth/utils/identidad.ts
import { env } from '@/config/env'
import { useSesionStore } from '@/features/auth/stores/sesionStore'

// quien esta usando la caja, para que las ventas queden a su nombre
export function usuarioActualId(): string {
  return useSesionStore.getState().usuario?.id ?? env.usuarioId
}

// el local del token manda: el backend rechaza con 403 cualquier otro
export function tenantActual(): string {
  return useSesionStore.getState().usuario?.tenant_id ?? env.tenantId
}

// nombre para mostrar en el historial
export function nombreActual(): string {
  return useSesionStore.getState().usuario?.nombre ?? env.cajeroNombre
}
