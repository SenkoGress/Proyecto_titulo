// src/features/proveedores/utils/pedidoWhatsApp.ts
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

// deja el telefono como lo pide wa.me: solo digitos, con codigo de pais
export function telefonoParaWhatsApp(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '')
  if (digitos.startsWith('56')) return digitos
  if (digitos.startsWith('9') && digitos.length === 9) return `56${digitos}`
  return digitos
}

// un celular chileno es 56 9 + 8 digitos; si no cumple, whatsapp no va a encontrar la cuenta
export function esCelularChileno(telefono: string): boolean {
  return /^569\d{8}$/.test(telefonoParaWhatsApp(telefono))
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

// link de whatsapp con el mensaje ya escrito
export function enlaceWhatsApp(telefono: string, mensaje: string): string {
  return `https://wa.me/${telefonoParaWhatsApp(telefono)}?text=${encodeURIComponent(mensaje)}`
}
