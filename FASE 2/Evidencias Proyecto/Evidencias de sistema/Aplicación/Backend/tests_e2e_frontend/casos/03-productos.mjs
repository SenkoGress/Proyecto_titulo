// casos/03-productos.mjs
import { obtener, enviar, reemplazar, parchar } from '../lib/cliente.mjs'

export const nombre = 'Productos: alta, edicion, ajuste de stock y merma'

const SKU = `PRUEBA-${Date.now().toString().slice(-8)}`

export async function ejecutar(b) {
  // ---- alta
  const alta = await enviar('/api/v1/pos/products', {
    nombre: 'Producto de prueba automatica',
    sku: SKU,
    stock_actual: 10,
    stock_minimo: 2,
    precio_compra: 500,
    precio_venta: 900,
    categoria: 'Pruebas',
    lote: 'L-PRUEBA',
    fecha_vencimiento: '2027-01-31',
  })
  b.estado('POST /pos/products crea el producto', alta, 201)

  const creado = alta.datos?.data
  if (!creado?.id) {
    b.omitir('el resto de las pruebas de producto', 'no se pudo crear el producto')
    return
  }

  const id = creado.id
  b.alTerminar('el producto de prueba', async () => {
    // se desactiva, porque el backend no tiene borrado de productos
    await reemplazar(`/api/v1/pos/products/${id}`, { activo: false, nombre: 'BORRAR - prueba automatica' })
  })

  b.comprobar('le genera un codigo de barras', Boolean(creado.codigo_barra), creado.codigo_barra)
  b.igual('guarda el stock inicial', Number(creado.stock_actual), 10)
  b.igual('guarda el lote', creado.lote, 'L-PRUEBA')
  b.igual('guarda la fecha de vencimiento', creado.fecha_vencimiento, '2027-01-31')

  // ---- edicion parcial: lo que no se manda no se debe perder
  const edicion = await reemplazar(`/api/v1/pos/products/${id}`, { precio_venta: 1100, lote: 'L-PRUEBA-B' })
  b.estado('PUT /pos/products/:id edita', edicion, 200)

  const trasEdicion = await buscarPorSku(SKU)
  if (trasEdicion) {
    b.igual('cambia el precio de venta', Number(trasEdicion.precio_venta), 1100)
    b.igual('cambia el lote', trasEdicion.lote, 'L-PRUEBA-B')
    b.igual('NO pierde el precio de compra que no se mando', Number(trasEdicion.precio_compra), 500)
    b.igual('NO pierde el nombre que no se mando', trasEdicion.nombre, 'Producto de prueba automatica')
    b.igual('NO pierde la fecha de vencimiento', trasEdicion.fecha_vencimiento, '2027-01-31')
  }

  // ---- ajuste de stock (conteo fisico)
  const ajuste = await parchar(`/api/v1/pos/products/${id}/stock`, {
    nuevo_stock: 7,
    motivo: 'Conteo de prueba automatica',
    usuario_id: 'Pruebas',
  })
  b.estado('PATCH /pos/products/:id/stock ajusta', ajuste, 200)

  const datosAjuste = ajuste.datos?.data
  if (datosAjuste) {
    // ojo: aca el campo se llama stock_nuevo, y en mermas se llama stock_actual
    b.igual('deja el stock en lo contado', Number(datosAjuste.stock_nuevo), 7)
    b.igual('calcula la diferencia', Number(datosAjuste.diferencia), -3)
  }

  // ---- merma
  const merma = await enviar('/api/v1/pos/mermas', {
    producto_id: id,
    cantidad: 2,
    motivo: 'vencimiento',
    observaciones: 'prueba automatica',
    usuario_id: 'Pruebas',
  })
  b.estado('POST /pos/mermas registra la baja', merma, 201)

  const datosMerma = merma.datos?.data
  if (datosMerma) {
    b.igual('descuenta del stock', Number(datosMerma.stock_actual), 5)
    b.igual('deja constancia del stock anterior', Number(datosMerma.stock_anterior), 7)
  }

  const historialMermas = await obtener('/api/v1/pos/mermas')
  b.estado('GET /pos/mermas lista el historial', historialMermas, 200)
  const mias = (historialMermas.datos?.data ?? []).filter((m) => m.producto_id === id)
  b.comprobar('la merma recien creada aparece en el historial', mias.length === 1)

  // ---- historial de movimientos del producto
  const movimientos = await obtener(`/api/v1/pos/products/${id}/history`)
  b.estado('GET /pos/products/:id/history responde', movimientos, 200)

  const tipos = (movimientos.datos?.data ?? []).map((m) => m.tipo_movimiento)
  b.comprobar('registra el alta del producto', tipos.includes('alta_inicial'), tipos.join(', '))
  b.comprobar('registra el ajuste manual', tipos.includes('ajuste_manual'))
  b.comprobar('registra la merma', tipos.includes('merma'))

  // ---- el rastro tiene que cuadrar: 0 -> 10 -> 7 -> 5
  const cadena = encadenar(movimientos.datos?.data ?? [])
  b.comprobar(
    'el rastro de stock es continuo, sin saltos',
    cadena !== null,
    cadena ? cadena.map((m) => `${m.cambio_anterior}->${m.nuevo_stock}`).join(' ') : 'no se pudo encadenar',
  )
  if (cadena) {
    b.igual('parte de cero', Number(cadena[0].cambio_anterior), 0)
    b.igual('termina en el stock actual', Number(cadena.at(-1).nuevo_stock), 5)
  }
}

// el historial no viene en orden cronologico estricto, asi que se arma siguiendo
// el enlace: cada movimiento parte donde termino el anterior
function encadenar(movimientos) {
  const pendientes = movimientos.slice()
  const inicio = pendientes.findIndex((m) => Number(m.cambio_anterior) === 0)
  if (inicio === -1) return null

  const cadena = pendientes.splice(inicio, 1)
  while (pendientes.length > 0) {
    const ultimo = Number(cadena.at(-1).nuevo_stock)
    const siguiente = pendientes.findIndex((m) => Number(m.cambio_anterior) === ultimo)
    if (siguiente === -1) return null
    cadena.push(...pendientes.splice(siguiente, 1))
  }
  return cadena
}

async function buscarPorSku(sku) {
  const inventario = await obtener('/api/v1/pos/inventory')
  return (inventario.datos?.data ?? []).find((p) => p.sku === sku) ?? null
}
