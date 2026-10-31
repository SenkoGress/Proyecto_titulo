// src/features/configuracion/utils/horarioAviso.ts

// dia_envio viaja en norma ISO: 1 lunes, 7 domingo. No es el getDay() de javascript,
// donde el domingo es 0
export const DIAS_AVISO = [
  { valor: 1, nombre: 'Lunes' },
  { valor: 2, nombre: 'Martes' },
  { valor: 3, nombre: 'Miercoles' },
  { valor: 4, nombre: 'Jueves' },
  { valor: 5, nombre: 'Viernes' },
  { valor: 6, nombre: 'Sabado' },
  { valor: 7, nombre: 'Domingo' },
]

// mismo formato que exige el backend: HH:MM en 24 horas
export function esHoraValida(hora: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hora)
}

export function esDiaValido(dia: number): boolean {
  return Number.isInteger(dia) && dia >= 1 && dia <= 7
}

// resumen en una linea, para no obligar a leer los dos selectores
export function textoHorarioAviso(dia: number, hora: string): string | null {
  const encontrado = DIAS_AVISO.find((opcion) => opcion.valor === dia)
  if (!encontrado || !esHoraValida(hora)) return null
  return `El aviso sale cada ${encontrado.nombre.toLowerCase()} a las ${hora}.`
}
