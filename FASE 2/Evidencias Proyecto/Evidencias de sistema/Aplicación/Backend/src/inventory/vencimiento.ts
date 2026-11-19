/** Dias desde los que el sistema avisa que un producto esta por vencer (D.S. 977/96, MINSAL). */
export const DIAS_AVISO_VENCIMIENTO = 15;

export interface ItemConVencimiento {
  descripcion: string;
  cantidad?: number;
  fecha_vencimiento?: string | null;
  no_vence?: boolean;
}

export interface AvisoVencimiento {
  descripcion: string;
  fecha_vencimiento: string;
  cantidad: number;
  dias_restantes: number;
}

export interface AlertaVencimiento {
  vencidos: AvisoVencimiento[];
  por_vencer: AvisoVencimiento[];
}

/** Solo AAAA-MM-DD de calendario real: es lo que guardan los dos motores sin interpretarlo. */
export function esFechaDeVencimientoValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia;
}

/** Negativo si ya vencio; cero si vence hoy. Se cuenta en dias de calendario del equipo. */
export function diasParaVencer(fecha: string, hoy: Date): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const inicioDeHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((new Date(anio, mes - 1, dia).getTime() - inicioDeHoy.getTime()) / 86_400_000);
}

/**
 * Productos a los que les falta declarar el vencimiento: cada uno necesita una fecha valida o la
 * marca de que no vence, y no las dos cosas a la vez.
 */
export function itemsSinVencimientoDeclarado(items: ItemConVencimiento[]): string[] {
  return items
    .filter((item) => {
      const tieneFecha = item.fecha_vencimiento !== undefined && item.fecha_vencimiento !== null && item.fecha_vencimiento !== '';
      // la marca es un booleano: "false" o 1 se leerian como marcada mas adelante y borrarian la fecha
      if (item.no_vence !== undefined && item.no_vence !== null && typeof item.no_vence !== 'boolean') return true;
      if (item.no_vence === true) return tieneFecha;
      return !esFechaDeVencimientoValida(item.fecha_vencimiento);
    })
    .map((item) => item.descripcion);
}

/** Vencido es anterior a hoy; lo que vence hoy todavia se puede vender y cuenta como por vencer. */
export function armarAlertaVencimiento(items: ItemConVencimiento[], hoy: Date): AlertaVencimiento {
  const alerta: AlertaVencimiento = { vencidos: [], por_vencer: [] };
  for (const item of items) {
    if (item.no_vence || !esFechaDeVencimientoValida(item.fecha_vencimiento)) continue;
    const dias = diasParaVencer(item.fecha_vencimiento, hoy);
    if (dias > DIAS_AVISO_VENCIMIENTO) continue;
    const aviso = {
      descripcion: item.descripcion,
      fecha_vencimiento: item.fecha_vencimiento,
      cantidad: Number(item.cantidad) || 0,
      dias_restantes: dias
    };
    (dias < 0 ? alerta.vencidos : alerta.por_vencer).push(aviso);
  }
  return alerta;
}
