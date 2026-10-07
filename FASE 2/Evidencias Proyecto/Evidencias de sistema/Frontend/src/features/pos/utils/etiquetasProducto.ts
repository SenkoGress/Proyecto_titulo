// src/features/pos/utils/etiquetasProducto.ts
import { esAlcohol, esAzucarada, tasaIla, codigoIla } from '@/shared/utils/ila'
import type { Producto } from '@/features/pos/types'

export type Etiqueta = {
  texto: string
  color: 'error' | 'warning' | 'info'
  ayuda: string
}

// ley 19.925: alcohol, no se vende a menores de 18
export { esAlcohol }

// las energeticas se reconocen por el nombre, no por el impuesto
export function esEnergetica(producto: Producto): boolean {
  return /energ[eé]tic|energy/i.test(producto.nombre)
}

// etiquetas que se muestran junto al nombre del producto
export function etiquetasProducto(producto: Producto): Etiqueta[] {
  const etiquetas: Etiqueta[] = []
  const tasa = tasaIla(producto)

  if (esAlcohol(producto)) {
    etiquetas.push({
      texto: '+18 ALCOHOL',
      color: 'error',
      ayuda: 'Ley 19.925: prohibida la venta a menores de 18 anos. Hay que verificar la edad antes de cobrar.',
    })
  }

  if (esEnergetica(producto)) {
    etiquetas.push({
      texto: 'ENERGETICA',
      color: 'warning',
      ayuda: 'Bebida energetica: no recomendada para ninos ni embarazadas.',
    })
  }

  if (esAzucarada(producto) && !esAlcohol(producto)) {
    etiquetas.push({
      texto: 'ALTO EN AZUCAR',
      color: 'warning',
      ayuda: `Paga impuesto adicional ILA de ${tasa}% por ser bebida azucarada.`,
    })
  }

  if (tasa > 0) {
    etiquetas.push({
      texto: `ILA ${tasa}%`,
      color: 'info',
      ayuda: `Impuesto adicional de la Ley de Alcoholes, codigo ${codigoIla(producto)}. Va sumado al IVA.`,
    })
  }

  return etiquetas
}
