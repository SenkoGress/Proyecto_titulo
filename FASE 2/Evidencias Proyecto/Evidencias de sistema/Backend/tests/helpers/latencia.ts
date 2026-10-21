/**
 * Medición de latencia en pruebas funcionales.
 *
 * Un umbral de milisegundos dentro de una prueba de comportamiento no verifica el código: verifica
 * qué tan rápida es la máquina que la ejecuta. La batería tenía ocho de esas aserciones, con topes
 * entre 50 y 500 ms, y una de ellas fallaba en el equipo de un integrante y pasaba en el del otro
 * sobre exactamente el mismo código. Un «100% aprobado» que depende del computador no es evidencia
 * de nada, y falla delante de quien lo esté revisando.
 *
 * La referencia de desempeño no se pierde: se declara en cada llamada y la medición se informa
 * cuando la supera. Lo que se asserta es un tope de regresión, alto a propósito, que solo atrapa lo
 * que ninguna máquina razonable cruza: una consulta que se colgó, un ciclo infinito, una conexión
 * que quedó esperando. Para eso sí sirve una aserción de tiempo.
 */

/** Tope de regresión patológica. No mide desempeño: detecta que algo quedó colgado. */
export const TOPE_REGRESION_MS = 10000;

/**
 * @param operacion    qué se midió, para que el informe sea legible
 * @param medidoMs     duración observada
 * @param referenciaMs desempeño esperado en un equipo de desarrollo corriente
 */
export function medirLatencia(operacion: string, medidoMs: number, referenciaMs: number): void {
  if (medidoMs > referenciaMs) {
    // Una corrida sana no imprime nada; una lenta explica por qué
    console.info(
      `[latencia] ${operacion}: ${medidoMs} ms (referencia ${referenciaMs} ms, tope ${TOPE_REGRESION_MS} ms)`
    );
  }

  expect(medidoMs).toBeLessThan(TOPE_REGRESION_MS);
}
