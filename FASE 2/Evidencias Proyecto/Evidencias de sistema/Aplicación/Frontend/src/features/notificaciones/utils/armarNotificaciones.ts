// src/features/notificaciones/utils/armarNotificaciones.ts
import { formatFecha, formatFechaSola } from '@/shared/utils/formatFecha'
import { formatoClp } from '@/shared/utils/formatoClp'
import { parsearFechaBackend } from '@/shared/utils/fechaBackend'
import type { ProductoInventario, ProductoVencimiento } from '@/features/inventario/types'
import type { OrdenSugerida, ProductoBajoStock } from '@/features/replenishment/types'
import type { CierreHistorial, SesionCaja } from '@/features/caja/types'
import type { Proveedor } from '@/features/proveedores/types'
import type { EstadoPos } from '@/features/pos/types'
import type { Notificacion } from '@/features/notificaciones/types'

// cuantos dias atras se considera "recien ingresado"
const DIAS_NOVEDAD = 7

function unidades(cantidad: number): string {
  return cantidad === 1 ? '1 unidad' : `${cantidad} unidades`
}

// como se nombra el plazo que queda
function plazoVencimiento(dias: number): string {
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence manana'
  return `Vence en ${dias} dias`
}

// vencimientos: el D.S. 977/96 no permite tener a la venta producto vencido
export function notificacionesVencimiento(productos: ProductoVencimiento[]): Notificacion[] {
  const base = {
    categoria: 'sanitaria' as const,
    origen: 'GET /pos/vencimientos',
    ruta: '/inventario',
    textoAccion: 'Ver en inventario',
    proveedorId: null,
    cuando: null,
  }

  return productos
    .filter((producto) => producto.nivel_riesgo !== 'VERDE' && producto.nivel_riesgo !== 'AMARILLO_PREVENTIVO')
    .map((producto) => {
      const lote = producto.lote ? `Lote ${producto.lote} · ` : ''
      const fecha = formatFechaSola(producto.fecha_vencimiento)

      if (producto.estado === 'VENCIDO') {
        return {
          ...base,
          id: `vencido-${producto.id}`,
          severidad: 'critica' as const,
          titulo: `Producto vencido: ${producto.nombre}`,
          detalle: `${lote}vencio el ${fecha} y quedan ${unidades(producto.stock_actual)} en stock. Hay que retirarlo de la gondola.`,
        }
      }

      const urgente = producto.nivel_riesgo === 'NARANJA_URGENTE'

      return {
        ...base,
        id: `vence-${producto.id}`,
        severidad: urgente ? ('alta' as const) : ('media' as const),
        titulo: `${plazoVencimiento(producto.dias_restantes)}: ${producto.nombre}`,
        detalle: `${lote}vence el ${fecha} y quedan ${unidades(producto.stock_actual)} por ${formatoClp(producto.precio_venta * producto.stock_actual)}. Conviene rotarlo o liquidarlo antes de esa fecha.`,
      }
    })
}

// quiebres de stock: los calcula el motor rop del backend, no un umbral inventado aca
function tituloQuiebre(nombre: string, agotado: boolean, bajoMinimo: boolean): string {
  if (agotado) return `Sin stock: ${nombre}`
  if (bajoMinimo) return `Bajo el minimo: ${nombre}`
  return `Toca reponer: ${nombre}`
}

// cuanto dura el stock que queda, segun la velocidad de venta que calcula el backend
function cobertura(dato: ProductoBajoStock | undefined): string {
  if (!dato) return ''
  return ` Al ritmo actual alcanza para ${dato.dias_inventario_restante} dias y su punto de reposicion es ${dato.reorder_point}.`
}

export function notificacionesStock(ordenes: OrdenSugerida[], bajos: ProductoBajoStock[]): Notificacion[] {
  const base = {
    categoria: 'stock' as const,
    origen: 'GET /replenishment/suggest',
    cuando: null,
  }

  const porProducto = new Map(bajos.map((producto) => [producto.producto_id, producto]))

  const conProveedor = ordenes.flatMap((orden) =>
    orden.items.map((item) => {
      const bajoMinimo = item.stock_actual < item.stock_minimo

      return {
        ...base,
        id: `quiebre-${item.producto_id}`,
        severidad: item.is_agotado ? ('critica' as const) : bajoMinimo ? ('alta' as const) : ('media' as const),
        titulo: tituloQuiebre(item.producto_nombre, item.is_agotado, bajoMinimo),
        detalle: `Quedan ${item.stock_actual} un de un minimo de ${item.stock_minimo}.${cobertura(porProducto.get(item.producto_id))} El sistema sugiere pedir ${item.cantidad_sugerida} un a ${orden.proveedor_nombre} por ${formatoClp(item.costo_estimado)}.`,
        ruta: '/proveedores',
        textoAccion: `Pedir a ${orden.proveedor_nombre}`,
        proveedorId: orden.proveedor_id,
      }
    }),
  )

  const yaCubiertos = new Set(conProveedor.map((item) => item.id))

  // los que estan bajos pero ningun proveedor registrado los vende
  const sinProveedor = bajos
    .filter((producto) => !yaCubiertos.has(`quiebre-${producto.producto_id}`))
    .map((producto) => ({
      ...base,
      id: `quiebre-${producto.producto_id}`,
      severidad: producto.is_agotado ? ('critica' as const) : ('alta' as const),
      titulo: tituloQuiebre(producto.nombre, producto.is_agotado, producto.stock_actual < producto.stock_minimo),
      detalle: `Quedan ${producto.stock_actual} un de un minimo de ${producto.stock_minimo}.${cobertura(producto)} No hay proveedor asociado a este producto, asi que el sistema no puede armar el pedido.`,
      ruta: '/inventario',
      textoAccion: 'Ver en inventario',
      proveedorId: null,
    }))

  return [...conProveedor, ...sinProveedor]
}

// turno de caja: sin abrir, arrastrado de otro dia o cierres descuadrados
export function notificacionesCaja(sesion: SesionCaja | null, historial: CierreHistorial[]): Notificacion[] {
  const base = {
    categoria: 'caja' as const,
    ruta: '/caja/cierre',
    proveedorId: null,
  }

  const lista: Notificacion[] = []

  if (!sesion) {
    lista.push({
      ...base,
      id: 'caja-sin-turno',
      severidad: 'info',
      titulo: 'No hay ningun turno de caja abierto',
      detalle: 'Para que las ventas queden asociadas a un turno hay que abrir la caja con su fondo inicial.',
      cuando: null,
      origen: 'GET /caja/resumen',
      textoAccion: 'Abrir turno',
    })
  }

  if (sesion) {
    const apertura = parsearFechaBackend(sesion.fecha_apertura)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    if (apertura && apertura < hoy) {
      lista.push({
        ...base,
        id: 'caja-turno-arrastrado',
        severidad: 'alta',
        titulo: 'El turno quedo abierto desde otro dia',
        detalle: `Se abrio el ${formatFecha(sesion.fecha_apertura)} y todavia no se cierra. Mientras siga abierto, las ventas nuevas se suman a ese mismo turno.`,
        cuando: sesion.fecha_apertura,
        origen: 'GET /caja/resumen',
        textoAccion: 'Ir al cierre de caja',
      })
    }
  }

  // cierres que no cuadraron
  const descuadrados = historial
    .filter((cierre) => cierre.estado === 'CERRADA' && (cierre.diferencia_efectivo ?? 0) !== 0)
    .slice(0, 5)
    .map((cierre) => {
      const diferencia = cierre.diferencia_efectivo ?? 0

      return {
        ...base,
        id: `caja-diferencia-${cierre.id}`,
        severidad: 'media' as const,
        titulo: `${diferencia > 0 ? 'Sobrante' : 'Faltante'} de ${formatoClp(Math.abs(diferencia))} en un cierre`,
        detalle: `El turno de ${cierre.cajero_nombre ?? 'sin cajero'} cerrado el ${formatFecha(cierre.fecha_cierre ?? null)} esperaba ${formatoClp(cierre.monto_esperado_efectivo)} y se contaron ${formatoClp(cierre.monto_real_efectivo ?? 0)}.`,
        cuando: cierre.fecha_cierre ?? null,
        origen: 'GET /caja/historial',
        textoAccion: 'Ver historial',
      }
    })

  return [...lista, ...descuadrados]
}

// visitas de proveedor de hoy y de manana, con lo que habria que pedirles
export function notificacionesProveedores(
  proveedores: Proveedor[],
  inventario: ProductoInventario[],
): Notificacion[] {
  return proveedores
    .filter((proveedor) => proveedor.proxima_visita.daysUntil <= 1)
    .map((proveedor) => {
      const aReponer = inventario.filter(
        (producto) =>
          producto.proveedor_nombre === proveedor.nombre_proveedores &&
          producto.stock_actual < producto.stock_minimo,
      )

      const hoy = proveedor.proxima_visita.daysUntil === 0

      return {
        id: `visita-${proveedor.id}`,
        categoria: 'proveedores' as const,
        severidad: aReponer.length > 0 ? ('media' as const) : ('info' as const),
        titulo: `${hoy ? 'Hoy' : 'Manana'} visita ${proveedor.nombre_proveedores}`,
        detalle:
          aReponer.length > 0
            ? `Tiene ${aReponer.length} producto${aReponer.length === 1 ? '' : 's'} bajo el minimo: ${aReponer.map((producto) => producto.nombre).join(', ')}.`
            : 'Ninguno de sus productos esta bajo el minimo en este momento.',
        cuando: null,
        origen: 'GET /suppliers',
        ruta: '/proveedores',
        textoAccion: 'Ver proveedor',
        proveedorId: proveedor.id,
      }
    })
}

// novedades del catalogo: lo que entro por ocr y lo que quedo sin fecha de vencimiento
export function notificacionesInventario(inventario: ProductoInventario[]): Notificacion[] {
  const corte = Date.now() - DIAS_NOVEDAD * 24 * 60 * 60 * 1000

  const nuevosPorOcr = inventario
    .filter((producto) => {
      if (producto.origen_creacion !== 'FACTURA') return false
      const fecha = parsearFechaBackend(producto.updated_at)
      return fecha !== null && fecha.getTime() >= corte
    })
    .map((producto) => ({
      id: `ocr-${producto.id}`,
      categoria: 'inventario' as const,
      severidad: 'info' as const,
      titulo: `Producto nuevo por factura: ${producto.nombre}`,
      detalle: `Entro al catalogo desde la factura ${producto.factura_origen_folio ?? 'sin folio'} con precio de venta ${formatoClp(producto.precio_venta)}. Conviene revisar su precio y su stock minimo.`,
      cuando: producto.updated_at,
      origen: 'GET /pos/inventory',
      ruta: '/inventario',
      textoAccion: 'Revisar producto',
      proveedorId: null,
    }))

  // se vende mas barato de lo que costo: cada venta pierde plata
  const bajoCosto = inventario
    .filter((producto) => producto.precio_compra > 0 && producto.precio_venta < producto.precio_compra)
    .map((producto) => ({
      id: `bajo-costo-${producto.id}`,
      categoria: 'inventario' as const,
      severidad: 'alta' as const,
      titulo: `Se vende bajo el costo: ${producto.nombre}`,
      detalle: `Costo ${formatoClp(producto.precio_compra)} y precio de venta ${formatoClp(producto.precio_venta)}: se pierden ${formatoClp(producto.precio_compra - producto.precio_venta)} por unidad.`,
      cuando: null,
      origen: 'GET /pos/inventory',
      ruta: '/inventario',
      textoAccion: 'Ver en inventario',
      proveedorId: null,
    }))

  const sinFecha = inventario.filter((producto) => !producto.fecha_vencimiento)

  const avisoSinFecha: Notificacion[] =
    sinFecha.length === 0
      ? []
      : [
          {
            id: 'sin-fecha-vencimiento',
            categoria: 'inventario',
            severidad: 'media',
            titulo: `${sinFecha.length} productos sin fecha de vencimiento`,
            detalle:
              'Esos productos no entran en el control FEFO, asi que el sistema no puede avisar cuando esten por vencer. Hoy no hay forma de cargarles la fecha desde la aplicacion.',
            cuando: null,
            origen: 'GET /pos/inventory',
            ruta: '/inventario',
            textoAccion: 'Ver catalogo',
            proveedorId: null,
          },
        ]

  return [...bajoCosto, ...nuevosPorOcr, ...avisoSinFecha]
}

// estado del terminal y configuracion que falta
export function notificacionesSistema(estado: EstadoPos | undefined, correo: string | undefined): Notificacion[] {
  const lista: Notificacion[] = []

  if (estado && !estado.cloud_online) {
    lista.push({
      id: 'sistema-sin-nube',
      categoria: 'sistema',
      severidad: 'alta',
      titulo: 'Sin conexion con la nube',
      detalle:
        'El terminal sigue vendiendo con la base local, pero las ventas no se estan respaldando. Se suben solas cuando vuelva la conexion.',
      cuando: estado.last_synced_at,
      origen: 'GET /pos/status',
      ruta: null,
      textoAccion: null,
      proveedorId: null,
    })
  }

  if (estado && estado.pending_dirty_count > 0) {
    lista.push({
      id: 'sistema-pendientes',
      categoria: 'sistema',
      severidad: 'media',
      titulo: `${estado.pending_dirty_count} ventas sin subir a la nube`,
      detalle: `Ultima subida: ${formatFecha(estado.last_synced_at)}. Se pueden subir ahora con el boton Sincronizar de la barra de arriba.`,
      cuando: estado.last_synced_at,
      origen: 'GET /pos/status',
      ruta: null,
      textoAccion: null,
      proveedorId: null,
    })
  }

  if (correo !== undefined && correo.trim() === '') {
    lista.push({
      id: 'sistema-sin-correo',
      categoria: 'sistema',
      severidad: 'info',
      titulo: 'Falta el correo para enviar pedidos',
      detalle: 'Sin ese correo no se pueden despachar las ordenes de compra que arma el sistema de reposicion.',
      cuando: null,
      origen: 'GET /config/email',
      ruta: '/configuracion',
      textoAccion: 'Configurar correo',
      proveedorId: null,
    })
  }

  return lista
}
