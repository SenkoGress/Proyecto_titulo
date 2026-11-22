/**
 * La marca de edicion de un producto (`updated_at`) decide quien gana entre la caja y la nube. La
 * caja la guarda como texto UTC sin zona y al segundo ('AAAA-MM-DD HH:MM:SS'); la nube, como
 * TIMESTAMPTZ con microsegundos. Se comparan en segundos UTC: con los microsegundos, la bajada
 * veria siempre la nube mas nueva y reescribiria todo el catalogo en cada sincronizacion.
 */
export function segundosUtc(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (valor instanceof Date) return Math.floor(valor.getTime() / 1000);
  const texto = String(valor).trim().replace(' ', 'T');
  const conZona = /([zZ]|[+-]\d{2}:?\d{2})$/.test(texto) ? texto : `${texto}Z`;
  const ms = Date.parse(conZona);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

/** La marca en el formato de la caja, desde segundos UTC. */
export function marcaSqlite(segundos: number): string {
  return new Date(segundos * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

/** La marca para la nube, con zona explicita: sin ella Postgres la leeria en la zona de la sesion. */
export function marcaNube(segundos: number): string {
  return new Date(segundos * 1000).toISOString();
}
