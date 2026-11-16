// src/features/notificaciones/utils/severidad.ts
import type { CategoriaNotificacion, Notificacion, SeveridadNotificacion } from '@/features/notificaciones/types'

// lo mas urgente primero
const ORDEN: Record<SeveridadNotificacion, number> = { critica: 0, alta: 1, media: 2, info: 3 }

export const COLOR_SEVERIDAD: Record<SeveridadNotificacion, 'error' | 'warning' | 'info' | 'success'> = {
  critica: 'error',
  alta: 'warning',
  media: 'info',
  info: 'success',
}

export const NOMBRE_SEVERIDAD: Record<SeveridadNotificacion, string> = {
  critica: 'Crítico',
  alta: 'Urgente',
  media: 'Atención',
  info: 'Aviso',
}

export const NOMBRE_CATEGORIA: Record<CategoriaNotificacion, string> = {
  sanitaria: 'Vencimientos',
  stock: 'Quiebres de stock',
  caja: 'Caja',
  proveedores: 'Proveedores',
  inventario: 'Catálogo',
  sistema: 'Sistema',
}

export function ordenarNotificaciones(lista: Notificacion[]): Notificacion[] {
  return [...lista].sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad])
}

// cuantas hay de cada severidad, para el resumen de arriba
export function contarPorSeveridad(lista: Notificacion[]): Record<SeveridadNotificacion, number> {
  const conteo: Record<SeveridadNotificacion, number> = { critica: 0, alta: 0, media: 0, info: 0 }
  for (const item of lista) conteo[item.severidad] += 1
  return conteo
}

export function contarPorCategoria(lista: Notificacion[]): Record<CategoriaNotificacion, number> {
  const conteo = {
    sanitaria: 0,
    stock: 0,
    caja: 0,
    proveedores: 0,
    inventario: 0,
    sistema: 0,
  } as Record<CategoriaNotificacion, number>

  for (const item of lista) conteo[item.categoria] += 1
  return conteo
}
