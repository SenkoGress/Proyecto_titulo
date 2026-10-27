// casos/09-autenticacion.mjs
import { enviar, obtener, guardarToken } from '../lib/cliente.mjs'

export const nombre = 'Autenticacion: login, usuarios y permisos'

// credenciales de prueba, se pasan por variables de entorno
const CORREO = process.env.GESTOCK_ADMIN_EMAIL || 'admin@gestock.cl'
const CLAVE = process.env.GESTOCK_ADMIN_PASSWORD || 'admin123'

export async function ejecutar(b) {
  guardarToken(null)
  const login = await enviar('/api/v1/auth/login', { email: 'nadie@ejemplo.cl', password: 'loquesea' })

  if (login.estado === 404) {
    b.omitir('todas las pruebas de autenticacion', 'el backend todavia no expone /api/v1/auth')
    return
  }

  // ---- el login no debe delatar que correos existen
  b.igual('rechaza credenciales inventadas con 401', login.estado, 401)

  const mensajeInventado = mensaje(login)
  if (CORREO) {
    const claveMala = await enviar('/api/v1/auth/login', { email: CORREO, password: 'clave-equivocada' })
    b.igual('rechaza la clave incorrecta con 401', claveMala.estado, 401)
    b.comprobar(
      'el mensaje es el mismo exista o no el correo',
      mensaje(claveMala) === mensajeInventado,
      'si difieren, se puede averiguar que correos estan registrados',
    )
  }

  // ---- sin token no se entra a ninguna parte
  // en desarrollo el backend deja pasar sin token a proposito, en produccion exige
  const sinToken = await obtener('/api/v1/pos/inventory')
  if (sinToken.estado === 401) {
    b.comprobar('sin token no deja consultar el inventario', true)
  } else {
    b.omitir(
      'revisar que sin token no se entre',
      `llego ${sinToken.estado}: la autenticacion no esta exigida (falta ENFORCE_AUTH o NODE_ENV=production)`,
    )
  }

  if (!CORREO || !CLAVE) {
    b.omitir(
      'entrar con un usuario real',
      'falta definir GESTOCK_ADMIN_EMAIL y GESTOCK_ADMIN_PASSWORD',
    )
    return
  }

  // ---- entrar de verdad
  const bueno = await enviar('/api/v1/auth/login', { email: CORREO, password: CLAVE })
  b.estado('POST /auth/login entra con las credenciales correctas', bueno, 200)

  const sesion = bueno.datos?.data
  if (!sesion?.token) {
    b.omitir('el resto de las pruebas', 'el login no devolvio token')
    return
  }

  guardarToken(sesion.token)
  b.alTerminar('la sesion', async () => guardarToken(null))

  b.comprobar('devuelve el token', Boolean(sesion.token))
  b.comprobar('devuelve el usuario con su rol', Boolean(sesion.usuario?.rol), sesion.usuario?.rol)
  b.comprobar(
    'NUNCA devuelve la clave guardada',
    !('password_hash' in (sesion.usuario ?? {})),
    'exponer el hash es una filtracion',
  )

  const perfil = await obtener('/api/v1/auth/me')
  b.estado('GET /auth/me reconoce el token', perfil, 200)

  const usuarios = await obtener('/api/v1/auth/users')
  b.estado('GET /auth/users lista la gente del local', usuarios, 200)

  const lista = usuarios.datos?.data ?? []
  b.comprobar('la lista trae al menos al admin', lista.length > 0, `${lista.length} usuarios`)
  b.comprobar(
    'ningun usuario de la lista expone su clave',
    lista.every((u) => !('password_hash' in u)),
  )

  // ---- con token si se entra
  const conToken = await obtener('/api/v1/pos/inventory')
  b.estado('con token si deja consultar el inventario', conToken, 200)
}

function mensaje(respuesta) {
  return respuesta.datos?.message ?? respuesta.datos?.error ?? ''
}
