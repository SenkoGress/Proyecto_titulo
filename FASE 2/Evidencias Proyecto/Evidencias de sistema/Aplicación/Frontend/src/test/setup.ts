// src/test/setup.ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// las pruebas que montan la caja o la pantalla de facturas leen estas variables al
// importarse, y sin ellas el archivo entero no alcanza a cargar. Como .env no se
// versiona, se declaran aca para que no dependan de la maquina de cada uno
const ENTORNO_DE_PRUEBA: Record<string, string> = {
  VITE_BACKEND_URL: 'http://localhost:3000',
  VITE_TENANT_ID: '00000000-0000-0000-0000-000000000001',
  VITE_USUARIO_ID: '00000000-0000-0000-0000-000000000002',
  VITE_CAJERO_NOMBRE: 'Admin Demo',
  VITE_CAJERO_ROL: 'Cajero Turno',
  VITE_DEVICE_ID: 'POS-LOCAL-DEVICE-01',
  VITE_AUTH_ACTIVA: 'true',
}

for (const [clave, valor] of Object.entries(ENTORNO_DE_PRUEBA)) {
  if (!import.meta.env[clave]) vi.stubEnv(clave, valor)
}

// cada prueba parte con el dom limpio
afterEach(cleanup)
