// lib/verificar.mjs
// comprobaciones y registro de resultados

const COLOR = {
  verde: '\x1b[32m',
  rojo: '\x1b[31m',
  amarillo: '\x1b[33m',
  gris: '\x1b[90m',
  fin: '\x1b[0m',
}

export class Bloque {
  constructor(nombre) {
    this.nombre = nombre
    this.resultados = []
    this.limpiezas = []
  }

  // registra algo que hay que borrar al terminar, pase lo que pase
  alTerminar(descripcion, accion) {
    this.limpiezas.push({ descripcion, accion })
  }

  // una comprobacion: si condicion es falsa, la prueba falla
  comprobar(descripcion, condicion, detalle = '') {
    const paso = Boolean(condicion)
    this.resultados.push({ descripcion, paso, detalle })
    const marca = paso ? `${COLOR.verde}OK  ${COLOR.fin}` : `${COLOR.rojo}FALLA${COLOR.fin}`
    const extra = detalle ? ` ${COLOR.gris}${detalle}${COLOR.fin}` : ''
    console.log(`    ${marca} ${descripcion}${extra}`)
    return paso
  }

  igual(descripcion, obtenido, esperado) {
    return this.comprobar(
      descripcion,
      obtenido === esperado,
      obtenido === esperado ? '' : `esperaba ${esperado}, llego ${obtenido}`,
    )
  }

  // la respuesta llego con el estado que corresponde
  estado(descripcion, respuesta, esperado) {
    const detalle = `${respuesta.ms} ms`
    const paso = respuesta.estado === esperado
    this.resultados.push({ descripcion, paso, detalle, ms: respuesta.ms })
    const marca = paso ? `${COLOR.verde}OK  ${COLOR.fin}` : `${COLOR.rojo}FALLA${COLOR.fin}`
    const aclaracion = paso
      ? `${COLOR.gris}${detalle}${COLOR.fin}`
      : `${COLOR.rojo}esperaba ${esperado}, llego ${respuesta.estado}${COLOR.fin} ${COLOR.gris}${detalle}${COLOR.fin}`
    console.log(`    ${marca} ${descripcion} ${aclaracion}`)
    return paso
  }

  // algo que no se pudo probar, no cuenta como falla
  omitir(descripcion, motivo) {
    this.resultados.push({ descripcion, omitida: true, detalle: motivo })
    console.log(`    ${COLOR.amarillo}SALTA${COLOR.fin} ${descripcion} ${COLOR.gris}${motivo}${COLOR.fin}`)
  }

  async limpiar() {
    for (const { descripcion, accion } of this.limpiezas.reverse()) {
      try {
        await accion()
      } catch (error) {
        console.log(`    ${COLOR.amarillo}AVISO${COLOR.fin} no se pudo limpiar ${descripcion}: ${error.message}`)
      }
    }
  }

  get resumen() {
    const total = this.resultados.filter((r) => !r.omitida).length
    const pasaron = this.resultados.filter((r) => r.paso).length
    const omitidas = this.resultados.filter((r) => r.omitida).length
    return { total, pasaron, fallaron: total - pasaron, omitidas }
  }
}
