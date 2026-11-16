// src/app/App.tsx
import { RouterProvider } from 'react-router/dom'
import { AppProviders } from '@/app/providers/AppProviders'
import { router } from '@/app/router/router'
import { useValidarSesion } from '@/features/auth/hooks/useValidarSesion'

// componente principal
export function App() {
  useValidarSesion()

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
