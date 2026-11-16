// src/app/providers/AppProviders.tsx
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/lib/query/queryClient'
import { crearTema } from '@/app/theme/theme'
import { useModoTema } from '@/shared/stores/temaStore'

type Props = {
  children: ReactNode
}

// providers globales
export function AppProviders({ children }: Props) {
  const modo = useModoTema()

  // solo se recalcula cuando cambia el modo claro/oscuro
  const tema = useMemo(() => crearTema(modo), [modo])

  return (
    <ThemeProvider theme={tema}>
      {/* estilos base */}
      <CssBaseline />

      <QueryClientProvider client={queryClient}>
        {children}
        {/* devtools, solo desarrollo */}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
