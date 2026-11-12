// src/features/inventario/utils/celdaApilada.ts
// celda de dos lineas de la tabla de inventario: la segunda linea se salia de la fila porque el
// alto es fijo y el relleno de la grilla comoda se sumaba al del contenido
export const CELDA_APILADA = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  height: '100%',
  minWidth: 0,
  overflow: 'hidden',
  '& .MuiTypography-root': { lineHeight: 1.35 },
} as const
