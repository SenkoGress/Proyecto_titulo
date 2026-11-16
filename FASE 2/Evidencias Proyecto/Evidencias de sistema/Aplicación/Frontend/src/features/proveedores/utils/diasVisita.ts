// src/features/proveedores/utils/diasVisita.ts

// mismo mapa que usa el backend en utils/supplier.utils.ts para leer el texto de dias de visita
const ALIAS_POR_DIA: Record<number, string[]> = {
  1: ['lunes', 'lun'],
  2: ['martes', 'mar'],
  3: ['miercoles', 'miércoles', 'mie', 'mié'],
  4: ['jueves', 'jue'],
  5: ['viernes', 'vie'],
  6: ['sabado', 'sábado', 'sab', 'sáb'],
  0: ['domingo', 'dom'],
}

// los 6 dias habiles que muestra la tabla, en orden
export const DIAS_SEMANA = [
  { indice: 1, sigla: 'LUN' },
  { indice: 2, sigla: 'MAR' },
  { indice: 3, sigla: 'MIE' },
  { indice: 4, sigla: 'JUE' },
  { indice: 5, sigla: 'VIE' },
  { indice: 6, sigla: 'SAB' },
]

// que dias aparecen en el texto libre del proveedor ("Martes y Jueves" -> {2, 4})
export function diasActivos(textoDiasVisita: string): Set<number> {
  const texto = textoDiasVisita.toLowerCase()
  const activos = new Set<number>()

  for (const [dia, alias] of Object.entries(ALIAS_POR_DIA)) {
    if (alias.some((palabra) => texto.includes(palabra))) activos.add(Number(dia))
  }

  return activos
}

// dia de la semana de hoy, para resaltar la columna actual
export function diaDeHoy(): number {
  return new Date().getDay()
}
