// src/features/caja/utils/denominaciones.ts
// billetes y monedas chilenos, solo para ayudar a contar

export type Denominacion = {
  valor: number
  tipo: 'billete' | 'moneda'
}

export const DENOMINACIONES: Denominacion[] = [
  { valor: 20000, tipo: 'billete' },
  { valor: 10000, tipo: 'billete' },
  { valor: 5000, tipo: 'billete' },
  { valor: 2000, tipo: 'billete' },
  { valor: 1000, tipo: 'billete' },
  { valor: 500, tipo: 'moneda' },
  { valor: 100, tipo: 'moneda' },
  { valor: 50, tipo: 'moneda' },
  { valor: 10, tipo: 'moneda' },
]
