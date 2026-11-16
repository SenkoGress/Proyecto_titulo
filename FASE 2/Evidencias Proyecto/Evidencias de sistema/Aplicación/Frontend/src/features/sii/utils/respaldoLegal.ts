// src/features/sii/utils/respaldoLegal.ts
import { obtenerRespaldoLegal } from '@/features/sii/api/sii.api'

// descarga el json completo que exigen los arts. 17 y 200 del codigo tributario
export async function descargarRespaldoLegal() {
  const respaldo = await obtenerRespaldoLegal()

  const blob = new Blob([JSON.stringify(respaldo, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `respaldo_tributario_gestock_${new Date().toISOString().slice(0, 10)}.json`
  enlace.click()

  URL.revokeObjectURL(url)

  return respaldo.totales_registros
}
