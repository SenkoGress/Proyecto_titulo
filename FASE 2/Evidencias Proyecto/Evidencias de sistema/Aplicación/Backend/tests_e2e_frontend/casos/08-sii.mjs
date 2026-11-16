// casos/08-sii.mjs
import { obtener } from '../lib/cliente.mjs'

export const nombre = 'SII: folios, F29 y respaldo tributario'

export async function ejecutar(b) {
  const caf = await obtener('/api/v1/dte/caf/status')
  b.estado('GET /dte/caf/status responde', caf, 200)

  const folios = caf.datos?.data ?? caf.datos
  if (Array.isArray(folios) && folios.length > 0) {
    const f = folios[0]
    // ojo: las rutas de /dte usan camelCase, el resto del backend usa snake_case
    b.comprobar(
      'informa cuantos folios quedan',
      f.foliosDisponibles !== undefined,
      `tipo ${f.tipoDte}: ${f.foliosDisponibles} de ${f.folioHasta}`,
    )
    b.comprobar('avisa si un tipo de documento se esta quedando sin folios',
      f.porcentajeDisponible !== undefined)
  } else {
    b.omitir('revisar los folios', 'no hay archivos CAF cargados')
  }

  const periodo = new Date().toISOString().slice(0, 7)
  const f29 = await obtener(`/api/v1/dte/f29?periodo=${periodo}`)
  b.estado('GET /dte/f29 responde', f29, 200)

  const reporte = f29.datos?.data ?? f29.datos
  if (reporte) {
    b.comprobar('calcula el debito fiscal', reporte.debitoFiscal !== undefined)
    b.comprobar('calcula el credito fiscal', reporte.creditoFiscal !== undefined)
  }

  const rcof = await obtener('/api/v1/dte/rcof/list')
  b.estado('GET /dte/rcof/list responde', rcof, 200)

  const guias = await obtener('/api/v1/dte/guias')
  b.estado('GET /dte/guias responde', guias, 200)

  const config = await obtener('/api/v1/dte/config')
  b.estado('GET /dte/config responde', config, 200)

  const emisor = (config.datos?.data ?? config.datos)?.emisor
  if (emisor?.rut) {
    b.comprobar('informa el RUT del emisor', true, emisor.rut)
    b.comprobar(
      'el RUT del emisor pasa el digito verificador',
      rutValido(emisor.rut),
      rutValido(emisor.rut) ? '' : 'el SII rechazaria los documentos emitidos con este RUT',
    )
  }

  b.omitir('ejecutar el set de certificacion', 'emite documentos reales y consume folios')
}

// modulo 11, la regla del SII
function rutValido(rut) {
  const limpio = String(rut).replace(/\./g, '').replace(/-/g, '')
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1).toUpperCase()
  if (!/^\d+$/.test(cuerpo)) return false

  let suma = 0
  let multiplicador = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1
  }

  const resto = 11 - (suma % 11)
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto)
  return dv === esperado
}
