/**
 * Utilidades para cálculo de días de visita y proximidad de proveedores
 */

const DIAS_SEMANA_MAP: Record<string, number> = {
  domingo: 0,
  dom: 0,
  lunes: 1,
  lun: 1,
  martes: 2,
  mar: 2,
  miercoles: 3,
  miércoles: 3,
  mie: 3,
  mié: 3,
  jueves: 4,
  jue: 4,
  viernes: 5,
  vie: 5,
  sabado: 6,
  sábado: 6,
  sab: 6,
  sáb: 6
};

const NOMBRES_DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export interface NextVisitCalculation {
  daysUntil: number;
  nextDate: string; // YYYY-MM-DD
  displayText: string;
  matchedDayName: string;
}

/**
 * Calcula cuántos días faltan para la próxima visita de un proveedor en base a su texto configurado.
 */
export function calculateNextVisit(visitingDaysText?: string | null, fromDate: Date = new Date()): NextVisitCalculation {
  const defaultDateStr = fromDate.toISOString().slice(0, 10);

  if (!visitingDaysText || visitingDaysText.trim().length === 0) {
    return {
      daysUntil: 7,
      nextDate: defaultDateStr,
      displayText: 'Sin día asignado',
      matchedDayName: 'No definido'
    };
  }

  const cleanText = visitingDaysText.toLowerCase();
  const currentDayOfWeek = fromDate.getDay(); // 0 = Domingo, 1 = Lunes, ...

  // Buscar todos los días que aparecen en el texto
  const detectedDays: number[] = [];
  for (const [key, dayIndex] of Object.entries(DIAS_SEMANA_MAP)) {
    if (cleanText.includes(key)) {
      if (!detectedDays.includes(dayIndex)) {
        detectedDays.push(dayIndex);
      }
    }
  }

  if (detectedDays.length === 0) {
    // Si dice algo como "semanal" o "quincenal"
    return {
      daysUntil: 3,
      nextDate: defaultDateStr,
      displayText: visitingDaysText,
      matchedDayName: visitingDaysText
    };
  }

  // Encontrar el día con menor diferencia respecto a hoy
  let minDiff = 999;
  let bestDayIndex = detectedDays[0];

  for (const targetDay of detectedDays) {
    let diff = (targetDay - currentDayOfWeek + 7) % 7;
    // Si diff es 0, significa que visita hoy
    if (diff < minDiff) {
      minDiff = diff;
      bestDayIndex = targetDay;
    }
  }

  const nextDateObj = new Date(fromDate);
  nextDateObj.setDate(fromDate.getDate() + minDiff);
  const nextDateStr = nextDateObj.toISOString().slice(0, 10);
  const dayName = NOMBRES_DIAS[bestDayIndex];

  let displayText = '';
  if (minDiff === 0) {
    displayText = `¡Visita Hoy! (${dayName})`;
  } else if (minDiff === 1) {
    displayText = `Mañana (${dayName})`;
  } else {
    displayText = `En ${minDiff} días (${dayName})`;
  }

  return {
    daysUntil: minDiff,
    nextDate: nextDateStr,
    displayText,
    matchedDayName: dayName
  };
}
