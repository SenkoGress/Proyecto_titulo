// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// configuracion de vite para el frontend de gestock
export default defineConfig(({ mode }) => {
  // leemos las variables del archivo .env para saber donde esta el backend
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:3000'

  return {
    plugins: [react()],

    // esto permite importar con "@/..." en vez de "../../.."
    resolve: {
      tsconfigPaths: true,
    },

    server: {
      port: 5173,
      // el proxy manda las peticiones al backend, asi no tenemos problemas de CORS
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true },
        '/health': { target: backendUrl, changeOrigin: true },
      },
    },
  }
})
