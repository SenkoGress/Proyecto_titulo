// casos/06-reabastecimiento.mjs
import { obtener } from '../lib/cliente.mjs'

export const nombre = 'Reabastecimiento: punto de reorden'

export async function ejecutar(b) {
  // antes se guardaba cuantas ordenes hay, porque este GET las creaba sin pedirlo
  const antes = await contarOrdenes()

  const sugerencia = await obtener('/api/v1/replenishment/suggest')
  b.estado('GET /replenishment/suggest responde', sugerencia, 200)

  const datos = sugerencia.datos?.data ?? sugerencia.datos
  b.comprobar('entrega la sugerencia de pedido', Boolean(datos))

  const criticos = datos?.productos_criticos ?? datos?.items ?? []
  if (Array.isArray(criticos) && criticos.length > 0) {
    const p = criticos[0]
    b.comprobar(
      'cada producto trae su punto de reposicion',
      p.reorder_point !== undefined,
      `rop ${p.reorder_point}`,
    )
    b.comprobar('cada producto trae su cobertura en dias', p.dias_inventario_restante !== undefined)
  } else {
    b.omitir('revisar los productos criticos', 'no hay productos bajo el punto de reorden')
  }

  // esta era la falla vieja: consultar no debe escribir en la base
  await obtener('/api/v1/replenishment/suggest')
  const despues = await contarOrdenes()

  b.igual('consultar la sugerencia NO crea ordenes de compra', despues, antes)

  const ordenes = await obtener('/api/v1/replenishment/purchase-orders')
  b.estado('GET /replenishment/purchase-orders responde', ordenes, 200)
}

async function contarOrdenes() {
  const respuesta = await obtener('/api/v1/replenishment/purchase-orders')
  const lista = respuesta.datos?.data ?? []
  return Array.isArray(lista) ? lista.length : 0
}
