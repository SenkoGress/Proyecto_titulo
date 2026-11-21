// src/features/inventario/utils/categoriasExistentes.ts
import type { ProductoInventario } from '@/features/inventario/types'

// categorias ya usadas en el catalogo, ordenadas y sin repetir. Sirven para ofrecerlas al dar de
// alta: escritas a mano, "Lacteos" y "Lácteos" quedan como dos categorias distintas
export function categoriasExistentes(productos: ProductoInventario[]): string[] {
  const vistas = new Set<string>()

  for (const producto of productos) {
    const nombre = (producto.categoria ?? '').trim()
    if (nombre !== '') vistas.add(nombre)
  }

  return [...vistas].sort((a, b) => a.localeCompare(b, 'es'))
}

// la opcion que crea una categoria nueva. El campo siempre acepto escribir una, pero el
// desplegable solo mostraba las que ya existian y en la prueba con usuarios se leyo como que no
// se podia: ahora la lista ofrece crear la que se esta escribiendo
const PREFIJO_CREAR = 'Crear la categoria '

export function opcionesDeCategoria(categorias: string[], escrito: string): string[] {
  const texto = escrito.trim()
  if (texto === '') return categorias

  const buscado = texto.toLowerCase()
  const encontradas = categorias.filter((nombre) => nombre.toLowerCase().includes(buscado))
  if (categorias.some((nombre) => nombre.toLowerCase() === buscado)) return encontradas

  return [...encontradas, `${PREFIJO_CREAR}"${texto}"`]
}

// nombre real de lo que eligio: de la lista, o la categoria nueva sin el texto de la opcion
export function categoriaElegida(opcion: string): string {
  if (!opcion.startsWith(PREFIJO_CREAR)) return opcion
  return opcion.slice(PREFIJO_CREAR.length).replace(/^"|"$/g, '')
}
