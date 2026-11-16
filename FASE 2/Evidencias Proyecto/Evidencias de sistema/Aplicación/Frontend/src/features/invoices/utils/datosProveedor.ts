// src/features/invoices/utils/datosProveedor.ts
import type { PrevisualizacionFactura } from '@/features/invoices/types'

// lo que el usuario completa del proveedor de una factura
export type DatosProveedorFactura = {
  giro: string
  direccion: string
  telefono: string
  email: string
  dias_visita: string
}

// parte de lo que leyo el ocr; lo que no viene queda en blanco
export function datosDesdeFactura(preview: PrevisualizacionFactura): DatosProveedorFactura {
  return {
    giro: preview.giro_proveedor ?? '',
    direccion: preview.direccion_proveedor ?? '',
    telefono: preview.telefono_proveedor ?? '',
    email: preview.email_proveedor ?? '',
    dias_visita: preview.dias_visita_proveedor ?? '',
  }
}

// la ventana se abre sola solo si el proveedor es nuevo y le falta algo
export function faltanDatos(preview: PrevisualizacionFactura): boolean {
  if (!preview.es_proveedor_nuevo) return false
  return Object.values(datosDesdeFactura(preview)).some((valor) => valor.trim() === '')
}

// campos que entiende POST /invoices/confirm; un campo en blanco no se manda
export function camposParaConfirmar(datos: DatosProveedorFactura) {
  const limpio = (valor: string) => valor.trim() || undefined
  return {
    giro_proveedor: limpio(datos.giro),
    direccion_proveedor: limpio(datos.direccion),
    telefono_proveedor: limpio(datos.telefono),
    email_proveedor: limpio(datos.email),
    dias_visita_proveedor: limpio(datos.dias_visita),
  }
}
