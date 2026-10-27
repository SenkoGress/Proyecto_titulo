// casos/11-sincronizacion.mjs
import { pedir } from '../lib/cliente.mjs'

export const nombre = 'Sincronizacion con la nube'

// el push sube las ventas del terminal; si la nube no esta, el pos sigue vendiendo
export async function ejecutar(b) {
  const estado = await pedir('GET', '/api/v1/pos/status')
  b.estado('GET /pos/status responde', estado, 200)

  const datos = estado.datos?.data ?? estado.datos
  const pendientesAntes = datos?.pending_dirty_count ?? 0
  const hayNube = datos?.status === 'ONLINE' || datos?.status === 'SYNC_PENDING'

  b.comprobar(
    'informa si hay ventas esperando subir',
    datos?.pending_dirty_count !== undefined,
    `pendientes: ${pendientesAntes}`,
  )

  // sin nube levantada no se puede probar la subida, pero si que el pos no se caiga
  if (!hayNube) {
    const sinNube = await pedir('POST', '/api/v1/pos/sync', {})
    b.comprobar(
      'sin nube el pos avisa en vez de fallar en silencio',
      sinNube.estado === 503 && sinNube.datos?.success === false,
      `llego ${sinNube.estado}`,
    )
    b.comprobar(
      'el aviso dice por que no se pudo',
      typeof sinNube.datos?.message === 'string' && sinNube.datos.message.length > 0,
      sinNube.datos?.message ?? '',
    )
    b.omitir('subir las ventas a la nube', 'la nube no esta disponible en esta corrida')
    b.omitir('comprobar que no quedan ventas sin subir', 'la nube no esta disponible')
    return
  }

  const sync = await pedir('POST', '/api/v1/pos/sync', {})
  b.estado('POST /pos/sync responde', sync, 200)

  const resultado = sync.datos?.result ?? sync.datos
  const subidas = resultado?.synced_ids?.length ?? 0
  const fallidas = resultado?.failed_ids?.length ?? 0

  // aca se cayo la version anterior: el lote llevaba ventas pero no los productos
  // que esas ventas usan, asi que la nube rechazaba el detalle por clave foranea
  b.comprobar(
    'la subida no deja ventas rechazadas',
    fallidas === 0,
    fallidas > 0 ? `${fallidas} rechazadas: ${sync.datos?.message ?? ''}` : 'ninguna rechazada',
  )

  b.comprobar(
    'sube las ventas que estaban esperando',
    pendientesAntes === 0 || subidas > 0,
    `esperaban ${pendientesAntes}, subieron ${subidas}`,
  )

  const despues = await pedir('GET', '/api/v1/pos/status')
  const pendientesDespues = (despues.datos?.data ?? despues.datos)?.pending_dirty_count ?? 0

  b.comprobar(
    'el contador de pendientes baja despues de subir',
    pendientesDespues <= pendientesAntes,
    `${pendientesAntes} -> ${pendientesDespues}`,
  )

  // volver a sincronizar no puede duplicar ni reventar
  const repetida = await pedir('POST', '/api/v1/pos/sync', {})
  b.estado('sincronizar de nuevo sigue respondiendo', repetida, 200)
  b.comprobar(
    'una segunda subida no rechaza nada',
    (repetida.datos?.result?.failed_ids?.length ?? 0) === 0,
    repetida.datos?.message ?? '',
  )
}
