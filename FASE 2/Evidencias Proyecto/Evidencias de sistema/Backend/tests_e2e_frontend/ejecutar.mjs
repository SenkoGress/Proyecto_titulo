// ejecutar.mjs
// corre todas las pruebas de la carpeta casos/ contra el backend que este levantado
import { readdir, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Bloque } from './lib/verificar.mjs'
import { CONFIG, obtener, autenticarSiEsNecesario } from './lib/cliente.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const COLOR = { verde: '\x1b[32m', rojo: '\x1b[31m', amarillo: '\x1b[33m', gris: '\x1b[90m', negrita: '\x1b[1m', fin: '\x1b[0m' }

async function backendArriba() {
  const respuesta = await obtener('/api')
  return respuesta.estado > 0
}

async function main() {
  const filtro = process.argv[2]

  console.log(`\n${COLOR.negrita}GesTock - pruebas de endpoints${COLOR.fin}`)
  console.log(`${COLOR.gris}${CONFIG.base} | tenant ${CONFIG.tenant}${COLOR.fin}\n`)

  if (!(await backendArriba())) {
    console.log(`${COLOR.rojo}El backend no responde en ${CONFIG.base}${COLOR.fin}`)
    console.log(`${COLOR.gris}Levantalo con: npm run dev  (desde la carpeta gestock)${COLOR.fin}\n`)
    process.exit(1)
  }

  await autenticarSiEsNecesario()

  const archivos = (await readdir(join(AQUI, 'casos')))
    .filter((a) => a.endsWith('.mjs'))
    .filter((a) => !filtro || a.includes(filtro))
    .sort()

  const bloques = []

  for (const archivo of archivos) {
    const modulo = await import(`./casos/${archivo}`)
    const bloque = new Bloque(modulo.nombre ?? archivo)

    console.log(`${COLOR.negrita}${bloque.nombre}${COLOR.fin}`)
    try {
      await modulo.ejecutar(bloque)
    } catch (error) {
      bloque.comprobar('la prueba corrio sin reventar', false, error.message)
    } finally {
      await bloque.limpiar()
    }

    bloques.push(bloque)
    console.log('')
  }

  // resumen
  const total = bloques.reduce((n, b) => n + b.resumen.total, 0)
  const pasaron = bloques.reduce((n, b) => n + b.resumen.pasaron, 0)
  const omitidas = bloques.reduce((n, b) => n + b.resumen.omitidas, 0)
  const fallaron = total - pasaron

  console.log(`${COLOR.negrita}Resumen${COLOR.fin}`)
  for (const b of bloques) {
    const r = b.resumen
    const estado = r.fallaron === 0 ? `${COLOR.verde}OK${COLOR.fin}` : `${COLOR.rojo}${r.fallaron} fallan${COLOR.fin}`
    const salta = r.omitidas ? ` ${COLOR.amarillo}(${r.omitidas} saltadas)${COLOR.fin}` : ''
    console.log(`  ${b.nombre.padEnd(42)} ${String(r.pasaron).padStart(3)}/${r.total}  ${estado}${salta}`)
  }

  const linea = fallaron === 0
    ? `${COLOR.verde}${pasaron} de ${total} comprobaciones pasaron${COLOR.fin}`
    : `${COLOR.rojo}${fallaron} de ${total} comprobaciones fallaron${COLOR.fin}`
  console.log(`\n${linea}${omitidas ? ` ${COLOR.amarillo}· ${omitidas} saltadas${COLOR.fin}` : ''}\n`)

  await guardarReporte(bloques, { total, pasaron, fallaron, omitidas })
  process.exit(fallaron === 0 ? 0 : 1)
}

// deja constancia escrita de la corrida, sirve como evidencia
async function guardarReporte(bloques, resumen) {
  const carpeta = join(AQUI, 'reportes')
  await mkdir(carpeta, { recursive: true })

  const momento = new Date()
  const sello = momento.toISOString().slice(0, 19).replaceAll(':', '-')

  const lineas = [
    '='.repeat(78),
    'GesTock - Reporte de pruebas de endpoints',
    `Fecha:   ${momento.toLocaleString('es-CL')}`,
    `Backend: ${CONFIG.base}`,
    `Tenant:  ${CONFIG.tenant}`,
    '='.repeat(78),
    '',
  ]

  for (const bloque of bloques) {
    lineas.push(`${bloque.nombre}`)
    lineas.push('-'.repeat(78))
    for (const r of bloque.resultados) {
      const marca = r.omitida ? 'SALTA' : r.paso ? 'OK   ' : 'FALLA'
      const extra = r.detalle ? `  (${r.detalle})` : ''
      lineas.push(`  ${marca}  ${r.descripcion}${extra}`)
    }
    lineas.push('')
  }

  lineas.push('='.repeat(78))
  lineas.push(
    `TOTAL: ${resumen.pasaron} de ${resumen.total} pasaron, ${resumen.fallaron} fallaron, ${resumen.omitidas} saltadas`,
  )
  lineas.push('='.repeat(78))

  const ruta = join(carpeta, `pruebas-${sello}.txt`)
  await writeFile(ruta, '﻿' + lineas.join('\r\n'), 'utf8')
  console.log(`${COLOR.gris}Reporte guardado en reportes/pruebas-${sello}.txt${COLOR.fin}\n`)
}

main()
