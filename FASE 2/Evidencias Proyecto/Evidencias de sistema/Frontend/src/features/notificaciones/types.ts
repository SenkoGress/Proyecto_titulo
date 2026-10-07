// src/features/notificaciones/types.ts

// que tan urgente es
export type SeveridadNotificacion = 'critica' | 'alta' | 'media' | 'info'

// de que parte del negocio viene
export type CategoriaNotificacion =
  | 'sanitaria'
  | 'stock'
  | 'caja'
  | 'proveedores'
  | 'inventario'
  | 'sistema'

export type Notificacion = {
  id: string
  categoria: CategoriaNotificacion
  severidad: SeveridadNotificacion
  titulo: string
  detalle: string
  cuando: string | null // fecha del backend, si el dato la trae
  origen: string // endpoint del que sale, se muestra en modo tecnico
  ruta: string | null
  textoAccion: string | null
  proveedorId: string | null // para pedir directo al proveedor
}
