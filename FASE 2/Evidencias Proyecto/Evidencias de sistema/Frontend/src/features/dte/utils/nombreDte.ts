// src/features/dte/utils/nombreDte.ts

// tipos de documento del SII (backend/src/dte/types.ts, enum TipoDTE)
const NOMBRES: Record<number, string> = {
  33: 'FACTURA ELECTRONICA',
  34: 'FACTURA EXENTA',
  39: 'BOLETA ELECTRONICA',
  41: 'BOLETA EXENTA',
  52: 'GUIA DE DESPACHO',
  56: 'NOTA DE DEBITO',
  61: 'NOTA DE CREDITO',
}

// el backend solo rotula bien la boleta, el resto se resuelve aca
export function nombreDocumentoDte(tipoDte: number, nombreDelBackend?: string): string {
  return NOMBRES[tipoDte] ?? nombreDelBackend ?? `DOCUMENTO TIPO ${tipoDte}`
}

// version corta para tablas densas
const CORTOS: Record<number, string> = {
  33: 'FACTURA',
  34: 'FACT. EXENTA',
  39: 'BOLETA',
  41: 'BOLETA EXENTA',
  52: 'GUIA',
  56: 'NOTA DEBITO',
  61: 'NOTA CREDITO',
}

export function nombreCortoDte(tipoDte: number): string {
  return CORTOS[tipoDte] ?? `TIPO ${tipoDte}`
}
