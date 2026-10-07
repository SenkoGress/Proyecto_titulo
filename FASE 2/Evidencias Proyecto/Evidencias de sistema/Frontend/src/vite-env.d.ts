// src/vite-env.d.ts
/// <reference types="vite/client" />

// variables del .env
interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string
  readonly VITE_TENANT_ID: string
  readonly VITE_USUARIO_ID: string
  readonly VITE_CAJERO_NOMBRE: string
  readonly VITE_CAJERO_ROL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
