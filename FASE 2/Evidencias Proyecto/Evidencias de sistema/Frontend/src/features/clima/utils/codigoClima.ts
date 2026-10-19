// src/features/clima/utils/codigoClima.ts
import type { Clima } from '@/features/clima/types'

export type TipoClima = 'despejado' | 'nubes' | 'niebla' | 'lluvia' | 'nieve' | 'tormenta'

// codigos wmo que devuelve open-meteo
const POR_CODIGO: Record<number, { texto: string; tipo: TipoClima }> = {
  0: { texto: 'Despejado', tipo: 'despejado' },
  1: { texto: 'Casi despejado', tipo: 'despejado' },
  2: { texto: 'Parcialmente nublado', tipo: 'nubes' },
  3: { texto: 'Nublado', tipo: 'nubes' },
  45: { texto: 'Neblina', tipo: 'niebla' },
  48: { texto: 'Neblina con escarcha', tipo: 'niebla' },
  51: { texto: 'Llovizna suave', tipo: 'lluvia' },
  53: { texto: 'Llovizna', tipo: 'lluvia' },
  55: { texto: 'Llovizna intensa', tipo: 'lluvia' },
  56: { texto: 'Llovizna helada', tipo: 'lluvia' },
  57: { texto: 'Llovizna helada intensa', tipo: 'lluvia' },
  61: { texto: 'Lluvia suave', tipo: 'lluvia' },
  63: { texto: 'Lluvia', tipo: 'lluvia' },
  65: { texto: 'Lluvia fuerte', tipo: 'lluvia' },
  66: { texto: 'Lluvia helada', tipo: 'lluvia' },
  67: { texto: 'Lluvia helada fuerte', tipo: 'lluvia' },
  71: { texto: 'Nieve suave', tipo: 'nieve' },
  73: { texto: 'Nieve', tipo: 'nieve' },
  75: { texto: 'Nieve intensa', tipo: 'nieve' },
  77: { texto: 'Granizo fino', tipo: 'nieve' },
  80: { texto: 'Chubascos', tipo: 'lluvia' },
  81: { texto: 'Chubascos', tipo: 'lluvia' },
  82: { texto: 'Chubascos fuertes', tipo: 'lluvia' },
  85: { texto: 'Chubascos de nieve', tipo: 'nieve' },
  86: { texto: 'Chubascos de nieve fuertes', tipo: 'nieve' },
  95: { texto: 'Tormenta', tipo: 'tormenta' },
  96: { texto: 'Tormenta con granizo', tipo: 'tormenta' },
  99: { texto: 'Tormenta con granizo fuerte', tipo: 'tormenta' },
}

// texto y tipo para un codigo del servicio
export function describirClima(codigo: number): { texto: string; tipo: TipoClima } {
  return POR_CODIGO[codigo] ?? { texto: 'Sin dato', tipo: 'nubes' }
}

// desde estos valores el dia cambia lo que se vende
const CALOR = 28
const FRIO = 8
const LLUVIA_PROBABLE = 60

export type Aviso = {
  corto: string
  detalle: string
  tono: 'calor' | 'frio' | 'lluvia'
}

// aviso para el dueño, solo cuando el dia se sale de lo normal
export function avisoDelDia(clima: Clima): Aviso | null {
  if (clima.maxima >= CALOR) {
    return {
      corto: 'Revisa helados y hielo',
      detalle: `Se esperan ${clima.maxima}°. Con calor suben los helados, las bebidas frias y el hielo.`,
      tono: 'calor',
    }
  }

  if (clima.probabilidadLluvia >= LLUVIA_PROBABLE) {
    return {
      corto: 'Puede llover',
      detalle: `${clima.probabilidadLluvia}% de probabilidad de lluvia. Suele pasar menos gente por el local.`,
      tono: 'lluvia',
    }
  }

  if (clima.minima <= FRIO) {
    return {
      corto: 'Dia frio',
      detalle: `La minima llega a ${clima.minima}°. Con frio suben el cafe, el te y las sopas.`,
      tono: 'frio',
    }
  }

  return null
}
