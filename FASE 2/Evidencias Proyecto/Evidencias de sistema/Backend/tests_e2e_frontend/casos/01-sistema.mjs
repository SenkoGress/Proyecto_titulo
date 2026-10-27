// casos/01-sistema.mjs
import { obtener } from '../lib/cliente.mjs'

export const nombre = 'Sistema y estado del servidor'

export async function ejecutar(b) {
  const api = await obtener('/api')
  b.estado('GET /api responde', api, 200)
  b.comprobar('el catalogo de servicios trae contenido', api.datos !== null)

  const salud = await obtener('/health')
  // 503 es normal cuando PostgreSQL cloud esta caido: el POS igual opera en local
  b.comprobar(
    'GET /health responde 200 o 503',
    salud.estado === 200 || salud.estado === 503,
    `llego ${salud.estado}`,
  )

  const estado = await obtener('/api/v1/pos/status')
  b.estado('GET /pos/status responde', estado, 200)

  const datos = estado.datos?.data ?? estado.datos
  b.comprobar('informa el identificador de la caja', Boolean(datos?.device_id), datos?.device_id ?? '')
  b.comprobar(
    'informa cuantas ventas quedan por subir',
    datos?.pending_dirty_count !== undefined,
    `pendientes: ${datos?.pending_dirty_count}`,
  )
}
