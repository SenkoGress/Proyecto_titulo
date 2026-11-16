// src/features/inventario/utils/fichaCodigoBarras.ts

// lo que devuelve GET /pos/products/lookup/:codigo cuando encuentra el producto
export type FichaExterna = {
  codigo: string
  nombre: string | null
  marca: string | null
  contenido: string | null
  // miniatura incrustada como data URL, o null si no vino
  imagen: string | null
  fuente: string
}

// el backend avisa si ese codigo de barras ya esta en el catalogo del local, lo encuentre o no
// en Open Food Facts
export type ProductoEnCatalogo = {
  id: string
  nombre: string
  sku: string
} | null

export type ResultadoBusqueda = {
  encontrada: FichaExterna | null
  enCatalogo: ProductoEnCatalogo
  // por que no hay ficha, para decirlo en pantalla
  motivo: 'encontrado' | 'no_esta' | 'sin_conexion'
}

// el backend acepta entre 8 y 14 digitos
export function codigoBuscable(codigo: string): boolean {
  return /^\d{8,14}$/.test(codigo.trim())
}

// el catalogo del local nombra los productos como "MARCA Nombre Contenido", igual que llegan
// desde las facturas. Se arma asi para que el nombre sugerido no desentone con el resto
export function nombreSugerido(ficha: FichaExterna): string {
  return [ficha.marca, ficha.nombre, ficha.contenido]
    .map((parte) => (parte ?? '').trim())
    .filter((parte) => parte !== '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// sin nombre ni marca la ficha no aporta nada que valga la pena ofrecer
export function fichaAprovechable(ficha: FichaExterna): boolean {
  return nombreSugerido(ficha) !== ''
}
