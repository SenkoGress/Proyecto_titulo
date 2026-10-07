// src/features/invoices/utils/archivoBase64.ts

// formatos que acepta el ocr
export const TIPOS_ACEPTADOS = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']

// limite del body del backend es 10mb (base64 pesa ~33% mas que el archivo real)
export const TAMANO_MAXIMO_MB = 6

// convierte un archivo a base64 puro (sin el prefijo data:...)
export function archivoABase64(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => {
      const resultado = lector.result as string
      resolve(resultado.split(',')[1] ?? '')
    }
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'))
    lector.readAsDataURL(archivo)
  })
}

// revisa tipo y tamano antes de subir
export function validarArchivo(archivo: File): string | null {
  if (!TIPOS_ACEPTADOS.includes(archivo.type)) {
    return 'Solo se aceptan archivos PDF, JPG o PNG'
  }
  if (archivo.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
    return `El archivo supera los ${TAMANO_MAXIMO_MB} MB permitidos`
  }
  return null
}
