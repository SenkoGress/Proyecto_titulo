// src/features/clima/api/clima.api.ts
import type { Clima, Lugar } from '@/features/clima/types'

// open-meteo: gratis, sin clave y sin registro
const GEOCODIFICADOR = 'https://geocoding-api.open-meteo.com/v1/search'
const PRONOSTICO = 'https://api.open-meteo.com/v1/forecast'

// sin internet la peticion no debe quedar colgada
const ESPERA_MS = 8000

type RespuestaLugar = {
  results?: { name: string; latitude: number; longitude: number; country_code: string }[]
}

type RespuestaPronostico = {
  current: { time: string; temperature_2m: number; weather_code: number }
  daily: {
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max: number[]
  }
}

async function pedir<T>(url: string): Promise<T> {
  const respuesta = await fetch(url, { signal: AbortSignal.timeout(ESPERA_MS) })
  if (!respuesta.ok) throw new Error(`el servicio de clima respondio ${respuesta.status}`)
  return (await respuesta.json()) as T
}

// la comuna viene de GET /dte/config, hay que convertirla a coordenadas
export async function buscarLugar(comuna: string, ciudad?: string): Promise<Lugar | null> {
  for (const nombre of [comuna, ciudad]) {
    if (!nombre) continue

    const url = `${GEOCODIFICADOR}?name=${encodeURIComponent(nombre)}&count=10&language=es&format=json`
    const { results } = await pedir<RespuestaLugar>(url)

    // el filtro por pais del servicio no funciona, hay que descartar a mano
    const chileno = results?.find((lugar) => lugar.country_code === 'CL')
    if (chileno) {
      return { nombre: chileno.name, latitud: chileno.latitude, longitud: chileno.longitude }
    }
  }
  return null
}

// temperatura de ahora con la maxima y la minima del dia
export async function obtenerClima(lugar: Lugar): Promise<Clima> {
  const url =
    `${PRONOSTICO}?latitude=${lugar.latitud}&longitude=${lugar.longitud}` +
    '&current=temperature_2m,weather_code' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=America%2FSantiago&forecast_days=1'

  const datos = await pedir<RespuestaPronostico>(url)

  return {
    lugar: lugar.nombre,
    temperatura: Math.round(datos.current.temperature_2m),
    maxima: Math.round(datos.daily.temperature_2m_max[0]),
    minima: Math.round(datos.daily.temperature_2m_min[0]),
    probabilidadLluvia: datos.daily.precipitation_probability_max[0] ?? 0,
    codigo: datos.current.weather_code,
    medidoA: new Date(datos.current.time),
  }
}
