// src/features/clima/types.ts

// clima de hoy en la comuna del local
export type Clima = {
  lugar: string
  temperatura: number
  maxima: number
  minima: number
  probabilidadLluvia: number
  codigo: number
  medidoA: Date
}

// comuna del local ya convertida a coordenadas
export type Lugar = {
  nombre: string
  latitud: number
  longitud: number
}
