// lib/cliente.mjs
// cliente http para hablar con el backend de GesTock

export const CONFIG = {
  base: process.env.GESTOCK_URL || 'http://localhost:3000',
  tenant: process.env.GESTOCK_TENANT || '00000000-0000-0000-0000-000000000001',
  device: process.env.GESTOCK_DEVICE || 'PRUEBAS-AUTOMATICAS',
  timeout: Number(process.env.GESTOCK_TIMEOUT || 70000),
}

// token que devuelve el login, si alguna prueba lo consigue
let token = null

export function guardarToken(nuevo) {
  token = nuevo
}

export async function autenticarSiEsNecesario() {
  const email = process.env.GESTOCK_ADMIN_EMAIL || 'admin@gestock.cl'
  const password = process.env.GESTOCK_ADMIN_PASSWORD || 'admin123'
  try {
    const res = await pedir('POST', '/api/v1/auth/login', { email, password })
    if (res.ok && res.datos?.data?.token) {
      token = res.datos.data.token
      return token
    }
  } catch {}
  return null
}

// una peticion al backend, devolviendo estado, cuerpo y cuanto demoro
export async function pedir(metodo, ruta, cuerpo) {
  const url = ruta.startsWith('http') ? ruta : CONFIG.base + ruta
  const separador = url.includes('?') ? '&' : '?'
  const conTenant = url.includes('tenant_id=') || url.includes('tenantId=')
    ? url
    : `${url}${separador}tenant_id=${CONFIG.tenant}`

  const cabeceras = {
    'Content-Type': 'application/json',
    'X-Tenant-ID': CONFIG.tenant,
    'X-Device-ID': CONFIG.device,
  }
  if (token) cabeceras.Authorization = `Bearer ${token}`

  // varias rutas leen el tenant del cuerpo, no de la direccion
  const cuerpoFinal =
    cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo) && cuerpo.tenant_id === undefined
      ? { tenant_id: CONFIG.tenant, ...cuerpo }
      : cuerpo

  const partida = performance.now()
  try {
    const respuesta = await fetch(conTenant, {
      method: metodo,
      headers: cabeceras,
      body: cuerpoFinal === undefined ? undefined : JSON.stringify(cuerpoFinal),
      signal: AbortSignal.timeout(CONFIG.timeout),
    })

    const texto = await respuesta.text()
    let datos = null
    try {
      datos = texto ? JSON.parse(texto) : null
    } catch {
      datos = texto
    }

    return {
      estado: respuesta.status,
      ok: respuesta.ok,
      datos,
      ms: Math.round(performance.now() - partida),
    }
  } catch (error) {
    return {
      estado: 0,
      ok: false,
      datos: null,
      error: error.message,
      ms: Math.round(performance.now() - partida),
    }
  }
}

export const obtener = (ruta) => pedir('GET', ruta)
export const enviar = (ruta, cuerpo) => pedir('POST', ruta, cuerpo)
export const reemplazar = (ruta, cuerpo) => pedir('PUT', ruta, cuerpo)
export const parchar = (ruta, cuerpo) => pedir('PATCH', ruta, cuerpo)
