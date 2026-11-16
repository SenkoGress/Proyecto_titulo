/**
 * Fecha y hora del reloj local del equipo. toISOString() da la fecha UTC, que en Chile va tres o
 * cuatro horas adelantada: una boleta emitida a las 22:00 salia fechada al dia siguiente y el panel
 * del dia cambiaba de dia a las 21:00. Las comparaciones en SQLite usan el modificador 'localtime',
 * que lee el mismo reloj, para que las dos mitades no se desfasen.
 */
const dos = (n: number) => String(n).padStart(2, '0');

/** AAAA-MM-DD en hora local. */
export function fechaLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** AAAA-MM en hora local. */
export function mesLocal(d: Date = new Date()): string {
  return fechaLocal(d).slice(0, 7);
}

/** AAAA-MM-DDTHH:MM:SS en hora local, el formato de las marcas de tiempo del SII. */
export function marcaLocal(d: Date = new Date()): string {
  return `${fechaLocal(d)}T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}
