// ejecutar.mjs
// mide el desempeno del backend bajo carga fija y deja el informe escrito en reportes/
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { CONFIG, obtener, enviar, autenticarSiEsNecesario } from '../tests_e2e_frontend/lib/cliente.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const COLOR = { verde: '\x1b[32m', rojo: '\x1b[31m', amarillo: '\x1b[33m', gris: '\x1b[90m', negrita: '\x1b[1m', fin: '\x1b[0m' }

// Lo que se assertea es un tope de regresion patologica, no el desempeno: un umbral de
// milisegundos verifica la maquina que corre la prueba, no el codigo. El desempeno esperado se
// declara por escenario y se informa comparado con lo medido.
const TOPE_REGRESION_MS = 10000

const ESCRITURA = process.env.GESTOCK_REND_ESCRITURA === 'true'
const BASE_SQLITE = process.env.SQLITE_DB_PATH || resolve(AQUI, '..', 'data', 'gestock_local_pos.sqlite')

// Sin muestras no hay percentil: un escenario que fallo entero se informa en cero, no revienta
function percentil(ordenados, p) {
  if (ordenados.length === 0) return 0
  const i = Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1)
  return ordenados[Math.max(0, i)]
}

// corre `peticiones` llamadas con `concurrencia` en vuelo a la vez
// La accion devuelve false si la operacion no fue valida, o el tiempo que el propio servidor
// declara haber usado cuando lo informa, para poder separarlo del viaje HTTP.
async function cargar(accion, peticiones, concurrencia) {
  const muestras = []
  const servidor = []
  const fallas = []
  let siguiente = 0

  const trabajador = async () => {
    while (siguiente < peticiones) {
      siguiente += 1
      const partida = performance.now()
      try {
        const r = await accion()
        const ms = performance.now() - partida
        if (r === false) fallas.push('la operacion devolvio un resultado no valido')
        else {
          muestras.push(ms)
          if (typeof r === 'number') servidor.push(r)
        }
      } catch (error) {
        fallas.push(error.message)
      }
    }
  }

  const partida = performance.now()
  await Promise.all(Array.from({ length: concurrencia }, trabajador))
  const totalMs = performance.now() - partida

  const ordenados = [...muestras].sort((a, b) => a - b)
  const enServidor = [...servidor].sort((a, b) => a - b)
  return {
    peticiones,
    concurrencia,
    completadas: muestras.length,
    fallas,
    servidorP50: enServidor.length ? percentil(enServidor, 50) : null,
    servidorP95: enServidor.length ? percentil(enServidor, 95) : null,
    p50: percentil(ordenados, 50),
    p95: percentil(ordenados, 95),
    p99: percentil(ordenados, 99),
    max: ordenados.at(-1) ?? 0,
    porSegundo: muestras.length / (totalMs / 1000),
  }
}

// El catalogo y el usuario salen del sistema, no de datos inventados
async function contexto() {
  const inventario = await obtener('/api/v1/pos/inventory')
  const productos = inventario.datos?.data ?? []
  const usuarios = await obtener('/api/v1/auth/users')
  const usuario = (usuarios.datos?.data ?? [])[0]
  return { productos, usuarioId: usuario?.id ?? null }
}

// Con el backend escribiendo en la misma base, la apertura de solo lectura puede no conseguir el
// archivo de indice compartido del diario WAL. Sin base, el escenario del indice no corre.
function abrirBase(conBarra) {
  if (conBarra.length === 0 || !existsSync(BASE_SQLITE)) return null
  try {
    return new DatabaseSync(BASE_SQLITE, { readOnly: true })
  } catch (error) {
    console.log(`${COLOR.amarillo}  Sin medicion del indice: ${error.message}${COLOR.fin}`)
    return null
  }
}

function escenarios({ productos, usuarioId }) {
  const lista = [
    {
      nombre: 'Catalogo de caja (GET /pos/products)',
      rnf: 'RNF-REND-03',
      referenciaMs: 200,
      peticiones: 200,
      concurrencia: 10,
      accion: async () => {
        const r = await obtener('/api/v1/pos/products')
        return r.estado === 200
      },
    },
    {
      nombre: 'Inventario con proveedor y ultimo ingreso (GET /pos/inventory)',
      rnf: 'RNF-REND-03',
      referenciaMs: 200,
      peticiones: 200,
      concurrencia: 10,
      accion: async () => {
        const r = await obtener('/api/v1/pos/inventory')
        return r.estado === 200
      },
    },
    {
      nombre: 'Historial de ventas de mostrador (GET /pos/transactions)',
      rnf: 'RNF-REND-03',
      referenciaMs: 200,
      peticiones: 150,
      concurrencia: 10,
      accion: async () => {
        const r = await obtener('/api/v1/pos/transactions?limit=100')
        return r.estado === 200
      },
    },
    {
      nombre: 'Semaforo de vencimientos (GET /pos/vencimientos)',
      rnf: 'RNF-REND-03',
      referenciaMs: 200,
      peticiones: 150,
      concurrencia: 10,
      accion: async () => {
        const r = await obtener('/api/v1/pos/vencimientos')
        return r.estado === 200
      },
    },
  ]

  const conBarra = productos.filter((p) => p.codigo_barra)
  // El mostrador busca sobre el catalogo que ya tiene cargado, asi que el indice se mide
  // contra la base, no contra HTTP: por HTTP no habria forma de aislar la consulta.
  const base = abrirBase(conBarra)
  if (base) {
    const consulta = base.prepare(
      'SELECT id, nombre, precio_venta, stock_actual FROM productos WHERE tenant_id = ? AND codigo_barra = ?'
    )
    lista.push({
      nombre: 'Busqueda indexada por codigo de barra (SQLite)',
      rnf: 'RNF-REND-02',
      referenciaMs: 10,
      peticiones: 2000,
      concurrencia: 1,
      cerrar: () => base.close(),
      accion: async () => {
        const p = conBarra[Math.floor(Math.random() * conBarra.length)]
        return Boolean(consulta.get(p.tenant_id, p.codigo_barra))
      },
    })
  }

  // Cada venta medida consume una unidad real, asi que se venden solo los productos con existencia
  // holgada y nunca mas unidades de las que hay: si no, lo que se mide es el rechazo por falta de
  // stock y no la venta.
  const conStock = productos
    .filter((p) => Number(p.stock_actual) >= 10)
    .sort((a, b) => Number(b.stock_actual) - Number(a.stock_actual))
  const disponibles = conStock.reduce((n, p) => n + Number(p.stock_actual), 0)
  const ventas = Math.min(80, Math.floor(disponibles / 3))

  if (ESCRITURA && usuarioId && ventas >= 20) {
    const vendibles = conStock
    const vender = async () => {
      const p = vendibles[Math.floor(Math.random() * vendibles.length)]
      const r = await enviar('/api/v1/pos/checkout', {
        usuario_id: usuarioId,
        metodo_pago: 'EFECTIVO',
        items: [{ producto_id: p.id, cantidad: 1, precio_unitario: Number(p.precio_venta) }],
      })
      if (r.estado !== 200 && r.estado !== 201) return false
      // El requisito acota el procesamiento de la venta, no el viaje HTTP: el servidor informa
      // cuanto le tomo la transaccion y el descuento de existencias.
      return Number(r.datos?.data?.latency_ms ?? 0)
    }

    // Una caja sola mide la venta; cuatro a la vez miden lo que cuesta la cola por la escritura
    // serializada de SQLite. Mezclarlas en una sola cifra esconde cual de las dos se degrado.
    lista.push({
      nombre: 'Venta transaccional, una caja (POST /pos/checkout)',
      rnf: 'RNF-REND-01',
      referenciaMs: 15,
      peticiones: ventas,
      concurrencia: 1,
      accion: vender,
    })
    lista.push({
      nombre: 'Venta transaccional, cuatro cajas a la vez (POST /pos/checkout)',
      rnf: 'RNF-REND-01',
      referenciaMs: 15,
      peticiones: ventas,
      concurrencia: 4,
      accion: vender,
    })
  }

  return lista
}

// El requisito se compara con lo que el requisito acota: si el servidor informa su propio tiempo,
// manda ese, porque el viaje HTTP no es parte de lo que RNF-REND-01 mide.
const comparable = (m) => m.servidorP95 ?? m.p95

function informar(e, m) {
  const dentro = comparable(m) <= e.referenciaMs
  const marca = m.fallas.length > 0
    ? `${COLOR.rojo}FALLA${COLOR.fin}`
    : dentro
      ? `${COLOR.verde}DENTRO${COLOR.fin}`
      : `${COLOR.amarillo}SOBRE${COLOR.fin}`
  console.log(`  ${marca}  ${e.nombre}`)
  console.log(
    `${COLOR.gris}         ${e.rnf} · referencia ${e.referenciaMs} ms · p50 ${m.p50.toFixed(1)} · ` +
      `p95 ${m.p95.toFixed(1)} · p99 ${m.p99.toFixed(1)} · max ${m.max.toFixed(1)} ms · ` +
      `${m.porSegundo.toFixed(0)} op/s · ${m.completadas}/${m.peticiones} con ${m.concurrencia} en paralelo` +
      (m.servidorP95 === null
        ? ''
        : ` · en el servidor p50 ${m.servidorP50.toFixed(1)} / p95 ${m.servidorP95.toFixed(1)} ms`) +
      COLOR.fin
  )
  if (m.fallas.length > 0) console.log(`${COLOR.rojo}         ${m.fallas.length} fallas: ${m.fallas[0]}${COLOR.fin}`)
}

async function main() {
  console.log(`\n${COLOR.negrita}GesTock - pruebas de rendimiento${COLOR.fin}`)
  console.log(`${COLOR.gris}${CONFIG.base} | tenant ${CONFIG.tenant}${COLOR.fin}\n`)

  if ((await obtener('/api')).estado === 0) {
    console.log(`${COLOR.rojo}El backend no responde en ${CONFIG.base}${COLOR.fin}`)
    console.log(`${COLOR.gris}Levantalo con: npm run dev${COLOR.fin}\n`)
    process.exit(1)
  }

  await autenticarSiEsNecesario()
  const ctx = await contexto()

  if (ctx.productos.length === 0) {
    console.log(`${COLOR.rojo}El catalogo esta vacio: carguelo con "npm run datos:demo"${COLOR.fin}\n`)
    process.exit(1)
  }
  console.log(`${COLOR.gris}Catalogo: ${ctx.productos.length} productos${COLOR.fin}`)
  if (!ESCRITURA) {
    console.log(`${COLOR.gris}Solo lectura. La venta transaccional se mide con GESTOCK_REND_ESCRITURA=true,`)
    console.log(`que registra ventas reales: use una base desechable (SQLITE_DB_PATH).${COLOR.fin}`)
  }
  console.log('')

  // Una corrida en frio mide la compilacion JIT y el primer llenado de cache, no el sistema
  for (let i = 0; i < 20; i += 1) await obtener('/api/v1/pos/products')

  const medidas = []
  for (const e of escenarios(ctx)) {
    const m = await cargar(e.accion, e.peticiones, e.concurrencia)
    e.cerrar?.()
    medidas.push({ escenario: e, medida: m })
    informar(e, m)
  }

  const colgadas = medidas.filter(({ medida }) => medida.max > TOPE_REGRESION_MS)
  const conFallas = medidas.filter(({ medida }) => medida.fallas.length > 0)
  const sobreReferencia = medidas.filter(({ escenario, medida }) => comparable(medida) > escenario.referenciaMs)

  console.log('')
  if (conFallas.length === 0 && colgadas.length === 0) {
    console.log(`${COLOR.verde}${medidas.length} escenarios completos sin errores${COLOR.fin}`)
  } else {
    console.log(`${COLOR.rojo}${conFallas.length} con errores, ${colgadas.length} sobre el tope de regresion${COLOR.fin}`)
  }
  if (sobreReferencia.length > 0) {
    console.log(
      `${COLOR.amarillo}${sobreReferencia.length} sobre su desempeno de referencia: ` +
        `${sobreReferencia.map(({ escenario }) => escenario.rnf).join(', ')}${COLOR.fin}`
    )
  }
  console.log('')

  await guardarReporte(medidas, ctx)
  process.exit(conFallas.length === 0 && colgadas.length === 0 ? 0 : 1)
}

async function guardarReporte(medidas, ctx) {
  const carpeta = join(AQUI, 'reportes')
  await mkdir(carpeta, { recursive: true })

  const momento = new Date()
  const sello = momento.toISOString().slice(0, 19).replaceAll(':', '-')

  const lineas = [
    '='.repeat(78),
    'GesTock - Reporte de pruebas de rendimiento',
    `Fecha:     ${momento.toLocaleString('es-CL')}`,
    `Backend:   ${CONFIG.base}`,
    `Tenant:    ${CONFIG.tenant}`,
    `Catalogo:  ${ctx.productos.length} productos`,
    `Equipo:    ${process.platform} ${process.arch}, Node ${process.version}`,
    `Escritura: ${ESCRITURA ? 'si (registra ventas reales)' : 'no (solo lectura)'}`,
    '='.repeat(78),
    '',
    'El p95 se compara con el desempeno de referencia del RNF. Un escenario "SOBRE" no es una',
    'falla de la prueba: es una medicion que queda registrada y hay que explicar. Solo se',
    `considera falla un error de la operacion o un maximo sobre el tope de regresion (${TOPE_REGRESION_MS} ms).`,
    '',
  ]

  for (const { escenario, medida } of medidas) {
    const estado =
      medida.fallas.length > 0 ? 'FALLA ' : comparable(medida) <= escenario.referenciaMs ? 'DENTRO' : 'SOBRE '
    lineas.push(`${estado}  ${escenario.nombre}`)
    lineas.push('-'.repeat(78))
    lineas.push(`  Requisito:    ${escenario.rnf} (referencia ${escenario.referenciaMs} ms)`)
    lineas.push(`  Carga:        ${medida.peticiones} operaciones, ${medida.concurrencia} en paralelo`)
    lineas.push(`  Completadas:  ${medida.completadas} de ${medida.peticiones}`)
    lineas.push(
      `  Latencia:     p50 ${medida.p50.toFixed(1)} ms · p95 ${medida.p95.toFixed(1)} ms · ` +
        `p99 ${medida.p99.toFixed(1)} ms · max ${medida.max.toFixed(1)} ms`
    )
    if (medida.servidorP95 !== null) {
      lineas.push(
        `  En servidor:  p50 ${medida.servidorP50.toFixed(1)} ms, p95 ${medida.servidorP95.toFixed(1)} ms ` +
          '(lo que el propio servidor declara, sin el viaje HTTP)'
      )
    }
    lineas.push(`  Caudal:       ${medida.porSegundo.toFixed(1)} operaciones por segundo`)
    if (medida.fallas.length > 0) {
      lineas.push(`  Errores:      ${medida.fallas.length} (${medida.fallas[0]})`)
    }
    lineas.push('')
  }

  const ruta = join(carpeta, `rendimiento-${sello}.txt`)
  await writeFile(ruta, '﻿' + lineas.join('\r\n'), 'utf8')
  console.log(`${COLOR.gris}Reporte guardado en reportes/rendimiento-${sello}.txt${COLOR.fin}\n`)
}

main()
