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

/** Reloj del control de vencimientos. Es un objeto para que una prueba pueda fijar la hora. */
export const reloj = { ahora: (): Date => new Date() };

/**
 * Dias que faltan para una fecha guardada en la base, o null si no se puede leer. La fecha del
 * producto es texto libre y hay instalaciones que la guardaron con hora: valen sus diez primeros
 * caracteres.
 */
export function diasHastaVencer(valor: unknown, hoy: Date): number | null {
  const fecha = typeof valor === 'string' ? valor.slice(0, 10) : valor;
  return esFechaDeVencimientoValida(fecha) ? diasParaVencer(fecha, hoy) : null;
}

/**
 * Fecha de vencimiento tal como se guarda en un producto: AAAA-MM-DD, o null si no viene. Devuelve
 * undefined cuando el valor no se puede leer como fecha, para que quien guarda lo rechace: una fecha
 * ilegible guardada queda para siempre como «vence hoy» en el semaforo.
 */
export function fechaDeVencimientoParaGuardar(valor: unknown): string | null | undefined {
  if (valor === undefined || valor === null || valor === '') return null;
  const fecha = typeof valor === 'string' ? valor.slice(0, 10) : valor;
  return esFechaDeVencimientoValida(fecha) ? fecha : undefined;
}

/** Semaforo sanitario del inventario. Vencido es anterior a hoy; lo que vence hoy es urgente. */
export function clasificarSemaforo(dias: number): { estado: string; nivel_riesgo: string } {
  if (dias < 0) return { estado: 'VENCIDO', nivel_riesgo: 'ROJO_CRITICO' };
  if (dias <= 7) return { estado: 'VENCE_ESTA_SEMANA', nivel_riesgo: 'NARANJA_URGENTE' };
  if (dias <= 15) return { estado: 'VENCE_EN_15_DIAS', nivel_riesgo: 'AMARILLO_ALERTA' };
  if (dias <= 30) return { estado: 'VENCE_EN_30_DIAS', nivel_riesgo: 'AMARILLO_PREVENTIVO' };
  return { estado: 'VIGENTE', nivel_riesgo: 'VERDE' };
}

export interface VencidoVendido {
  fecha_vencimiento: string;
  cantidad: number;
}

/**
 * Unidades vencidas que salieron en una venta. Cuenta lo que se desconto de lotes vencidos; las
 * unidades que ningun lote respaldaba se juzgan por la fecha que tenia el producto antes de vender.
 */
export function unidadesVencidasVendidas(
  consumo: { detalle: Array<{ fecha_vencimiento: string; cantidad: number }>; sinRespaldo: number },
  fechaDelProducto: unknown,
  hoy: Date
): VencidoVendido | null {
  const partes = consumo.detalle.map((lote) => ({ fecha: lote.fecha_vencimiento, cantidad: lote.cantidad }));
  if (consumo.sinRespaldo > 0) partes.push({ fecha: fechaDelProducto as string, cantidad: consumo.sinRespaldo });

  let cantidad = 0;
  let masAntigua = '';
  for (const parte of partes) {
    const dias = diasHastaVencer(parte.fecha, hoy);
    if (dias === null || dias >= 0) continue;
    const fecha = parte.fecha.slice(0, 10);
    cantidad += Number(parte.cantidad);
    if (!masAntigua || fecha < masAntigua) masAntigua = fecha;
  }
  return cantidad > 0 ? { fecha_vencimiento: masAntigua, cantidad } : null;
}
