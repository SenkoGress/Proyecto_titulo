// casos/02-inventario.mjs
import { obtener, enviar, reemplazar, parchar } from '../lib/cliente.mjs'

export const nombre = 'Inventario: catalogo y vencimientos'

export async function ejecutar(b) {
  const inventario = await obtener('/api/v1/pos/inventory')
  b.estado('GET /pos/inventory responde', inventario, 200)

  const productos = inventario.datos?.data ?? []
  b.comprobar('el catalogo trae productos', productos.length > 0, `${productos.length} productos`)

  if (productos.length > 0) {
    const p = productos[0]
    const campos = ['id', 'sku', 'nombre', 'stock_actual', 'precio_compra', 'precio_venta']
    const faltantes = campos.filter((c) => p[c] === undefined)
    b.comprobar('cada producto trae los campos que usa la pantalla', faltantes.length === 0, faltantes.join(', '))

    b.comprobar(
      'informa el origen del producto (catalogo o factura)',
      'origen_creacion' in p,
      `origen: ${p.origen_creacion ?? 'null'}`,
    )
  }

  const vencimientos = await obtener('/api/v1/pos/vencimientos')
  b.estado('GET /pos/vencimientos responde', vencimientos, 200)

  const resumen = vencimientos.datos?.resumen
  b.comprobar('el semaforo sanitario trae su resumen', Boolean(resumen))
  if (resumen) {
    b.comprobar(
      'cuenta vencidos y productos en riesgo',
      resumen.vencidos !== undefined && resumen.total_en_riesgo !== undefined,
      `${resumen.vencidos} vencidos, ${resumen.total_en_riesgo} en riesgo`,
    )
  }

  const lista = vencimientos.datos?.data ?? []
  if (lista.length > 0) {
    const sinFecha = lista.filter((v) => !v.fecha_vencimiento)
    b.comprobar('todos los del semaforo tienen fecha de vencimiento', sinFecha.length === 0)
    b.comprobar('cada uno trae sus dias restantes y su nivel de riesgo',
      lista.every((v) => v.dias_restantes !== undefined && Boolean(v.nivel_riesgo)))
  } else {
    b.omitir('revisar los datos del semaforo', 'no hay productos con vencimiento cargado')
  }
}
