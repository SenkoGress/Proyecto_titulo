// src/features/proveedores/utils/pedidoCorreo.ts
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

// sin un correo bien formado no hay a donde mandar el pedido
export function tieneCorreo(email: string | null | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email ?? '').trim())
}

// arma el texto del pedido con los productos que estan bajo su stock minimo
export function textoPedido(ficha: FichaProveedor, nombreLocal: string): string {
  const lineas = [`Hola ${ficha.nombre_proveedores}, les escribo de ${nombreLocal}.`, '']

  if (ficha.aReponer.length > 0) {
    lineas.push('Necesito reponer:')
    for (const producto of ficha.aReponer) {
      const faltante = producto.stock_minimo - producto.stock_actual
      lineas.push(`- ${producto.nombre} (me quedan ${producto.stock_actual}, necesito ${faltante} mas)`)
    }
  } else {
    lineas.push('Quiero hacer un pedido.')
  }

  lineas.push('', 'Quedo atento a la confirmacion. Gracias.')
  return lineas.join('\n')
}
