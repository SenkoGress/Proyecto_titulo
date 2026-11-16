// src/shared/hooks/useReloj.ts
import { useEffect, useState } from 'react'

// hora actual, se actualiza cada segundo
export function useReloj(): Date {
  const [ahora, setAhora] = useState(() => new Date())

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(intervalo)
  }, [])

  return ahora
}
