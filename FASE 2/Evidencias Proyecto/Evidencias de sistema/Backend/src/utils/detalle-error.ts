/**
 * Detalle de un error interno para la respuesta HTTP. En produccion no se envia: el mensaje de una
 * falla de base de datos puede revelar tablas, rutas de archivo o la forma de la consulta. El
 * detalle completo queda siempre en el registro del servidor.
 */
export function detalleError(error: unknown): string | undefined {
  if (process.env.NODE_ENV === 'production') return undefined;
  return error instanceof Error ? error.message : String(error);
}
