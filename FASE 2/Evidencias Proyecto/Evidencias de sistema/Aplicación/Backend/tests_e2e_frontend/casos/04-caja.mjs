// casos/04-caja.mjs
import { obtener } from '../lib/cliente.mjs'

export const nombre = 'Caja: resumen del turno y arqueo'

export async function ejecutar(b) {
  const resumen = await obtener('/api/v1/caja/resumen')
  b.estado('GET /caja/resumen responde', resumen, 200)

  const sesion = resumen.datos?.data ?? resumen.datos
  if (!sesion || !sesion.id) {
    b.omitir('revisar el desglose del turno', 'no hay una caja abierta en este momento')
    return
  }

  b.comprobar('informa el estado del turno', Boolean(sesion.estado), sesion.estado)
  b.comprobar('informa el monto de apertura', sesion.monto_apertura !== undefined)

  // cada medio de pago tiene que venir por separado, si no el arqueo da mal
  const medios = ['ventas_efectivo', 'ventas_transbank', 'ventas_mercadopago', 'ventas_sumup', 'ventas_rutpay']
  const faltantes = medios.filter((m) => sesion[m] === undefined)
  b.comprobar('separa los medios de pago', faltantes.length === 0, faltantes.join(', '))

  b.comprobar(
    'RutPay va aparte del efectivo',
    sesion.ventas_rutpay !== undefined,
    `efectivo ${sesion.ventas_efectivo}, rutpay ${sesion.ventas_rutpay}`,
  )

  b.comprobar('informa el impuesto adicional del turno', sesion.monto_ila !== undefined || sesion.total_ila !== undefined)

  // el efectivo esperado tiene que ser apertura + ventas en efectivo + ingresos - egresos
  if (sesion.monto_esperado_efectivo !== undefined) {
    const calculado =
      Number(sesion.monto_apertura) +
      Number(sesion.ventas_efectivo) +
      Number(sesion.total_ingresos_caja) -
      Number(sesion.total_egresos_caja)

    b.igual(
      'el efectivo esperado cuadra con la formula del arqueo',
      Number(sesion.monto_esperado_efectivo),
      calculado,
    )
  }

  const historial = await obtener('/api/v1/caja/historial')
  b.estado('GET /caja/historial responde', historial, 200)

  const movimientos = await obtener(`/api/v1/caja/movimientos?sesion_id=${sesion.id}`)
  b.estado('GET /caja/movimientos responde', movimientos, 200)

  const sinSesion = await obtener('/api/v1/caja/movimientos')
  b.igual('sin sesion_id responde 400 y no revienta', sinSesion.estado, 400)
}
