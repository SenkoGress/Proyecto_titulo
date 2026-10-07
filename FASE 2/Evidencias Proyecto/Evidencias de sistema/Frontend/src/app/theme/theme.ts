// src/app/theme/theme.ts
import { createTheme } from '@mui/material/styles'

// los dos temas que ofrece la app (la opcion "sistema" se resuelve antes de llegar aca)
export type ModoTema = 'claro' | 'oscuro'

// colores del menu lateral, siempre oscuro
export function obtenerColoresMenu(modo: ModoTema) {
  return {
    fondo: modo === 'oscuro' ? '#020617' : '#0f172a',
    fondoItemActivo: '#2563eb',
    texto: '#e2e8f0',
    textoApagado: '#94a3b8',
    borde: '#1e293b',
  }
}

// paleta segun el modo
function paleta(modo: ModoTema) {
  if (modo === 'oscuro') {
    return {
      mode: 'dark' as const,
      primary: { main: '#3b82f6' },
      success: { main: '#22c55e' },
      warning: { main: '#f59e0b' },
      error: { main: '#ef4444' },
      info: { main: '#38bdf8' },
      background: { default: '#0f172a', paper: '#1e293b' },
      text: { primary: '#e2e8f0', secondary: '#94a3b8' },
      divider: '#334155',
    }
  }

  return {
    mode: 'light' as const,
    primary: { main: '#2563eb' },
    success: { main: '#16a34a' },
    warning: { main: '#d97706' },
    error: { main: '#dc2626' },
    info: { main: '#0891b2' },
    background: { default: '#f1f5f9', paper: '#ffffff' },
    text: { primary: '#0f172a', secondary: '#64748b' },
    divider: '#e2e8f0',
  }
}

// tema de gestock
export function crearTema(modo: ModoTema) {
  return createTheme({
    palette: paleta(modo),

    typography: {
      fontFamily: 'Roboto, system-ui, sans-serif',
      h1: { fontSize: '1.6rem', fontWeight: 700 },
      button: { textTransform: 'none', fontWeight: 600 },
    },

    shape: { borderRadius: 10 },

    components: {
      // tarjetas con borde suave, del color de division del tema
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({ border: `1px solid ${theme.palette.divider}` }),
        },
      },
    },
  })
}
