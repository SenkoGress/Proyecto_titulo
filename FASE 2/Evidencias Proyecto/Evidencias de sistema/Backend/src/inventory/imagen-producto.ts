/**
 * La foto del producto viaja como data URL. La interfaz la reduce antes de enviarla (unos 20 KB);
 * el tope solo impide que una foto de camara sin reducir infle la base y cada sincronizacion.
 */
export const TOPE_IMAGEN_CARACTERES = 300 * 1024;

const FORMATO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Motivo del rechazo, o null si el valor sirve. null y undefined son validos: sin foto. */
export function motivoImagenInvalida(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'string' || !FORMATO.test(valor)) {
    return 'La imagen debe ser una data URL JPEG, PNG o WebP en base64';
  }
  if (valor.length > TOPE_IMAGEN_CARACTERES) {
    return 'La imagen supera los 300 KB: hay que reducirla antes de guardarla';
  }
  return null;
}
