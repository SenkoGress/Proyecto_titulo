// src/shared/utils/reducirImagen.ts
// la foto del producto se guarda con el producto, asi que se reduce antes de mandarla

// el servidor rechaza sobre 300 KB de texto; a 400 pixeles una foto queda en unos 25 KB
export const LADO_MAXIMO = 400
export const TOPE_CARACTERES = 300 * 1024
const CALIDAD = 0.78

// lado mayor a 400 pixeles, manteniendo la proporcion; una foto chica no se agranda
export function medidaReducida(ancho: number, alto: number, maximo = LADO_MAXIMO) {
  if (ancho <= 0 || alto <= 0) return { ancho: 0, alto: 0 }
  const factor = Math.min(1, maximo / Math.max(ancho, alto))
  return { ancho: Math.max(1, Math.round(ancho * factor)), alto: Math.max(1, Math.round(alto * factor)) }
}

// se acepta jpeg, png y webp porque son los que acepta el servidor
export function formatoAceptado(tipo: string): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(tipo)
}

// motivo del rechazo antes de leer el archivo, o null si sirve
export function motivoArchivoInvalido(archivo: File): string | null {
  if (!formatoAceptado(archivo.type)) return 'La foto tiene que ser JPEG, PNG o WebP'
  if (archivo.size > 20 * 1024 * 1024) return 'La foto pesa mas de 20 MB'
  return null
}

// carga una imagen desde un data URL o una url de objeto
function cargarImagen(origen: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image()
    imagen.onload = () => resolver(imagen)
    imagen.onerror = () => rechazar(new Error('No se pudo leer la foto'))
    imagen.src = origen
  })
}

// dibuja la imagen ya reducida y la devuelve como data URL jpeg
export async function reducirImagen(origen: Blob | string): Promise<string> {
  const url = typeof origen === 'string' ? origen : URL.createObjectURL(origen)

  try {
    const imagen = await cargarImagen(url)
    const medida = medidaReducida(imagen.naturalWidth, imagen.naturalHeight)

    const lienzo = document.createElement('canvas')
    lienzo.width = medida.ancho
    lienzo.height = medida.alto

    const pincel = lienzo.getContext('2d')
    if (!pincel) throw new Error('No se pudo preparar la foto')

    // fondo blanco: un png con transparencia queda negro al pasarlo a jpeg
    pincel.fillStyle = '#ffffff'
    pincel.fillRect(0, 0, medida.ancho, medida.alto)
    pincel.drawImage(imagen, 0, 0, medida.ancho, medida.alto)

    const reducida = lienzo.toDataURL('image/jpeg', CALIDAD)
    if (reducida.length > TOPE_CARACTERES) throw new Error('La foto quedo muy pesada, prueba con otra')
    return reducida
  } finally {
    if (typeof origen !== 'string') URL.revokeObjectURL(url)
  }
}
