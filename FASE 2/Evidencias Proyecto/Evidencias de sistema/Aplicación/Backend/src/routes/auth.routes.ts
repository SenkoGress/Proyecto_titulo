import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { defaultSqliteClient } from '../database/sqlite/client';
import { defaultPgClient } from '../database/postgres/client';
import { logger } from '../utils/logger';
import { getJwtSecret } from '../config/auth.config';
import { estadoVigente } from '../middleware/security.middleware';
import { defaultEmailService } from '../notifications/email.service';
import { redactarCodigoRecuperacion } from '../notifications/aviso-recuperacion';
import { defaultRecuperacionClave } from '../auth/recuperacion-clave';

const router = Router();
const MIN_PASSWORD_LENGTH = 8;

interface UserRow {
  id: string;
  tenant_id: string;
  nombre: string;
  email: string;
  password_hash: string;
  rol: 'admin' | 'cajero';
  activo?: number | boolean;
}

/**
 * POST /api/v1/auth/login
 * Autenticación mediante tenant_id, email y password. Retorna JWT (24h) y perfil.
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenant_id, email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });
      return;
    }

    const tenant = tenant_id || (req.headers['x-tenant-id'] as string) || '00000000-0000-0000-0000-000000000001';

    // 1. Buscar usuario en SQLite local
    let user: UserRow | null | undefined = null;
    try {
      user = defaultSqliteClient.queryOne<UserRow>(
        'SELECT id, tenant_id, nombre, email, password_hash, rol, activo FROM usuarios WHERE tenant_id = ? AND LOWER(email) = LOWER(?)',
        [tenant, email.trim()]
      );
    } catch (err) {
      logger.warn('AuthRoute', 'Error buscando usuario en SQLite', { error: String(err) });
    }

    // 2. Si no está en SQLite, intentar en Postgres si está online
    if (!user) {
      try {
        const pgOnline = await defaultPgClient.healthCheck();
        if (pgOnline) {
          const pgRes = await defaultPgClient.query<UserRow>(
            'SELECT id, tenant_id, nombre, email, password_hash, rol, activo FROM usuarios WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)',
            [tenant, email.trim()]
          );
          if (pgRes.rows.length > 0) {
            user = pgRes.rows[0];
          }
        }
      } catch (err) {
        logger.warn('AuthRoute', 'Error buscando usuario en PostgreSQL', { error: String(err) });
      }
    }

    if (!user) {
      // Mensaje unificado anti-enumeración (RF-01)
      res.status(401).json({ success: false, message: 'El correo o la clave no son correctos' });
      return;
    }

    // Las claves de demostracion son publicas: estan en el repositorio. En produccion no abren
    // ninguna cuenta, tampoco una que haya quedado en la nube
    if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_USERS !== 'true'
      && ['admin123', 'cajero123'].includes(password)) {
      res.status(401).json({ success: false, message: 'El correo o la clave no son correctos' });
      return;
    }

    // 3. Comparar clave con Bcrypt
    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      res.status(401).json({ success: false, message: 'El correo o la clave no son correctos' });
      return;
    }
    if (!estaActivo(user)) {
      res.status(403).json({ success: false, message: 'Esta cuenta fue desactivada por el administrador' });
      return;
    }

    // 4. Generar token JWT firmado (HS256, 24 horas)
    const token = jwt.sign(
      {
        id: user.id,
        tenant_id: user.tenant_id,
        email: user.email,
        rol: user.rol,
        nombre: user.nombre
      },
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    const safeUser = {
      id: user.id,
      tenant_id: user.tenant_id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol
    };

    res.status(200).json({
      success: true,
      data: {
        token,
        usuario: safeUser
      },
      token,
      usuario: safeUser
    });
  } catch (error) {
    logger.error('AuthRoute', 'Error en login', error);
    res.status(500).json({ success: false, message: 'Error interno en autenticación' });
  }
});

function extractAndVerifyToken(req: Request): { valid: boolean; status: number; message?: string; user?: any } {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, status: 401, message: 'Cabecera Authorization: Bearer requerida' };
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    // Las rutas de /auth verifican el token por su cuenta: aplican el mismo estado vigente que el middleware
    const vigente = estadoVigente(decoded?.id);
    if (vigente && !vigente.activo) {
      return { valid: false, status: 401, message: 'Esta cuenta fue desactivada por el administrador' };
    }
    if (vigente) decoded.rol = vigente.rol;
    return { valid: true, status: 200, user: decoded };
  } catch {
    return { valid: false, status: 401, message: 'Token inválido o expirado' };
  }
}

/**
 * POST /api/v1/auth/register
 * Registro de usuario en el tenant con contraseña Bcrypt (work factor 10).
 * Requiere token de administrador. Retorna datos del usuario creado sin emitir token.
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const auth = extractAndVerifyToken(req);
    if (!auth.valid) {
      res.status(auth.status).json({ success: false, message: auth.message });
      return;
    }
    if (auth.user?.rol !== 'admin') {
      res.status(403).json({ success: false, message: 'Acceso denegado: solo administradores pueden registrar usuarios' });
      return;
    }

    const { tenant_id, nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password) {
      res.status(400).json({ success: false, message: 'Nombre, email y contraseña requeridos' });
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ success: false, message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` });
      return;
    }

    // El usuario se crea siempre en el comercio del administrador autenticado
    const tenant = auth.user?.tenant_id as string;
    if (!tenant || (tenant_id && tenant_id !== tenant)) {
      res.status(403).json({ success: false, message: 'Acceso denegado: solo se pueden registrar usuarios del propio comercio' });
      return;
    }
    const userRole = (rol === 'admin' ? 'admin' : 'cajero') as 'admin' | 'cajero';

    // Verificar duplicado por tenant y email
    const existing = defaultSqliteClient.queryOne<{ id: string }>(
      'SELECT id FROM usuarios WHERE tenant_id = ? AND LOWER(email) = LOWER(?)',
      [tenant, email.trim()]
    );

    if (existing) {
      res.status(409).json({ success: false, message: 'El usuario ya existe en este comercio' });
      return;
    }

    const newId = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);

    // Inserción en SQLite
    defaultSqliteClient.execute(
      `INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newId, tenant, nombre.trim(), email.trim().toLowerCase(), passwordHash, userRole]
    );

    // Replicación en PostgreSQL si está disponible
    try {
      const pgOnline = await defaultPgClient.healthCheck();
      if (pgOnline) {
        await defaultPgClient.query(
          `INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
          [newId, tenant, nombre.trim(), email.trim().toLowerCase(), passwordHash, userRole]
        );
      }
    } catch {
      // Silencioso: nodo local retiene la persistencia
    }

    const safeUser = {
      id: newId,
      tenant_id: tenant,
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      rol: userRole
    };

    res.status(201).json({
      success: true,
      data: {
        usuario: safeUser
      },
      usuario: safeUser
    });
  } catch (error) {
    logger.error('AuthRoute', 'Error en registro', error);
    res.status(500).json({ success: false, message: 'Error interno en registro' });
  }
});

/**
 * GET /api/v1/auth/users
 * Lista de usuarios del tenant (sin password_hash). Requiere rol de administrador.
 */
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const auth = extractAndVerifyToken(req);
    if (!auth.valid) {
      res.status(auth.status).json({ success: false, message: auth.message });
      return;
    }
    if (auth.user?.rol !== 'admin') {
      res.status(403).json({ success: false, message: 'Acceso denegado: solo administradores pueden consultar usuarios' });
      return;
    }

    const tenant = auth.user?.tenant_id as string;

    let users: any[] = [];
    try {
      users = defaultSqliteClient.query<Omit<UserRow, 'password_hash'> & { created_at?: string; updated_at?: string }>(
        'SELECT id, tenant_id, nombre, email, rol, activo, created_at, updated_at FROM usuarios WHERE tenant_id = ? ORDER BY created_at DESC, nombre ASC',
        [tenant]
      );
    } catch (err) {
      logger.warn('AuthRoute', 'Error listando usuarios en SQLite', { error: String(err) });
    }

    if (users.length === 0) {
      try {
        const pgOnline = await defaultPgClient.healthCheck();
        if (pgOnline) {
          const pgRes = await defaultPgClient.query<Omit<UserRow, 'password_hash'> & { created_at?: string; updated_at?: string }>(
            'SELECT id, tenant_id, nombre, email, rol, activo, created_at, updated_at FROM usuarios WHERE tenant_id = $1 ORDER BY created_at DESC, nombre ASC',
            [tenant]
          );
          users = pgRes.rows;
        }
      } catch (err) {
        logger.warn('AuthRoute', 'Error listando usuarios en PostgreSQL', { error: String(err) });
      }
    }

    // SQLite entrega 1/0 y PostgreSQL true/false: la interfaz recibe siempre 1/0
    res.status(200).json({
      success: true,
      data: users.map((u) => ({ ...u, activo: estaActivo(u) ? 1 : 0 }))
    });
  } catch (error) {
    logger.error('AuthRoute', 'Error en consulta de usuarios', error);
    res.status(500).json({ success: false, message: 'Error interno consultando usuarios' });
  }
});

/**
 * GET /api/v1/auth/me
 * Verificación de token Bearer y sesión activa.
 */
router.get('/me', (req: Request, res: Response): void => {
  const auth = extractAndVerifyToken(req);
  if (!auth.valid) {
    res.status(auth.status).json({ success: false, message: auth.message });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      usuario: auth.user
    },
    usuario: auth.user
  });
});

/**
 * PUT /api/v1/auth/password
 * Cambio de contraseña del usuario autenticado. Exige la contraseña actual.
 */
router.put('/password', async (req: Request, res: Response): Promise<void> => {
  try {
    const auth = extractAndVerifyToken(req);
    if (!auth.valid) {
      res.status(auth.status).json({ success: false, message: auth.message });
      return;
    }

    const { password_actual, password_nueva } = req.body;
    if (!password_actual || !password_nueva) {
      res.status(400).json({ success: false, message: 'Contraseña actual y nueva requeridas' });
      return;
    }
    if (typeof password_nueva !== 'string' || password_nueva.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ success: false, message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` });
      return;
    }
    if (password_nueva === password_actual) {
      res.status(400).json({ success: false, message: 'La contraseña nueva debe ser distinta a la actual' });
      return;
    }

    const user = defaultSqliteClient.queryOne<UserRow>(
      'SELECT id, tenant_id, nombre, email, password_hash, rol FROM usuarios WHERE id = ? AND tenant_id = ?',
      [auth.user?.id, auth.user?.tenant_id]
    );
    if (!user || !bcrypt.compareSync(password_actual, user.password_hash)) {
      res.status(401).json({ success: false, message: 'La contraseña actual no es correcta' });
      return;
    }

    await guardarClave(user, password_nueva);

    res.status(200).json({ success: true, message: 'Contraseña actualizada' });
  } catch (error) {
    logger.error('AuthRoute', 'Error en cambio de contraseña', error);
    res.status(500).json({ success: false, message: 'Error interno en cambio de contraseña' });
  }
});

async function guardarClave(user: Pick<UserRow, 'id' | 'tenant_id'>, claveNueva: string): Promise<void> {
  const passwordHash = bcrypt.hashSync(claveNueva, 10);
  defaultSqliteClient.execute(
    "UPDATE usuarios SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
    [passwordHash, user.id]
  );

  try {
    const pgOnline = await defaultPgClient.healthCheck();
    if (pgOnline) {
      await defaultPgClient.query(
        'UPDATE usuarios SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3',
        [passwordHash, user.id, user.tenant_id]
      );
    }
  } catch (err) {
    logger.warn('AuthRoute', 'No se pudo replicar el cambio de contraseña en PostgreSQL', { error: String(err) });
  }
}

const TENANT_POR_DEFECTO = '00000000-0000-0000-0000-000000000001';

/** Solo los administradores activos recuperan la clave por correo: a un cajero se la cambia el administrador. */
function adminParaRecuperar(req: Request): UserRow | null {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (!email) return null;
  const tenant = req.body?.tenant_id || (req.headers['x-tenant-id'] as string) || TENANT_POR_DEFECTO;
  const user = defaultSqliteClient.queryOne<UserRow>(
    'SELECT id, tenant_id, nombre, email, password_hash, rol, activo FROM usuarios WHERE tenant_id = ? AND LOWER(email) = LOWER(?)',
    [tenant, email]
  );
  return user && user.rol === 'admin' && estaActivo(user) ? user : null;
}

/**
 * POST /api/v1/auth/password/olvide
 * Envia un codigo de un solo uso al correo del administrador. La respuesta es la misma exista o no
 * la cuenta, para no revelar que correos son de un administrador: por eso el servidor de correo se
 * comprueba antes de mirar la cuenta, y el envio no se espera.
 */
router.post('/password/olvide', async (req: Request, res: Response): Promise<void> => {
  try {
    if (typeof req.body?.email !== 'string' || !req.body.email.trim()) {
      res.status(400).json({ success: false, message: 'Correo requerido' });
      return;
    }
    if (!defaultEmailService.estaConfigurado()) {
      res.status(503).json({
        success: false,
        message: 'Este equipo no tiene configurado el envio de correo, asi que no puede mandar el codigo.'
      });
      return;
    }

    const servidorDeCorreo = await defaultEmailService.verificar();
    if (!servidorDeCorreo.enviado) {
      res.status(502).json({
        success: false,
        message: 'No se pudo conectar con el servidor de correo. Revisa la conexion a internet y vuelve a intentar.'
      });
      return;
    }

    const admin = adminParaRecuperar(req);
    const codigo = admin ? defaultRecuperacionClave.emitir(admin.id) : null;
    if (admin && codigo) {
      const aviso = redactarCodigoRecuperacion(admin.nombre, codigo);
      void defaultEmailService.enviar({ para: admin.email, ...aviso }).then((envio) => {
        // sin codigo vivo, el administrador puede pedir otro de inmediato
        if (!envio.enviado) defaultRecuperacionClave.anular(admin.id);
      });
    }

    res.status(200).json({
      success: true,
      message:
        'Si ese correo es de un administrador del local, le enviamos un codigo que vence en 15 minutos. ' +
        'Si pediste uno hace menos de un minuto, ese sigue vigente: revisa tu correo antes de pedir otro.'
    });
  } catch (error) {
    logger.error('AuthRoute', 'Error al pedir el codigo de recuperacion', error);
    res.status(500).json({ success: false, message: 'Error interno al pedir el codigo' });
  }
});

/**
 * POST /api/v1/auth/password/restablecer
 * Cambia la clave del administrador con el codigo que recibio por correo.
 */
router.post('/password/restablecer', async (req: Request, res: Response): Promise<void> => {
  try {
    const { codigo, password_nueva } = req.body || {};
    if (!codigo || !password_nueva) {
      res.status(400).json({ success: false, message: 'Codigo y clave nueva requeridos' });
      return;
    }
    if (typeof password_nueva !== 'string' || password_nueva.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ success: false, message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` });
      return;
    }

    const admin = adminParaRecuperar(req);
    const canje = admin ? defaultRecuperacionClave.canjear(admin.id, String(codigo)) : 'invalido';
    if (canje === 'bloqueado') {
      res.status(429).json({ success: false, message: 'Demasiados intentos con ese codigo. Pide uno nuevo en un minuto.' });
      return;
    }
    if (!admin || canje !== 'ok') {
      res.status(400).json({ success: false, message: 'El codigo no es correcto o ya vencio' });
      return;
    }

    await guardarClave(admin, password_nueva);
    logger.info('AuthRoute', 'Clave restablecida con codigo de recuperacion', { usuario: admin.id });
    res.status(200).json({ success: true, message: 'Clave actualizada. Ya puedes entrar con la nueva.' });
  } catch (error) {
    logger.error('AuthRoute', 'Error al restablecer la clave', error);
    res.status(500).json({ success: false, message: 'Error interno al restablecer la clave' });
  }
});

/** Las filas anteriores a la migracion 020 no traen la columna y cuentan como activas. */
function estaActivo(user: { activo?: number | boolean | null }): boolean {
  return user.activo === undefined || user.activo === null || Boolean(user.activo);
}

/** Un usuario con ventas o cierres de caja se desactiva: borrarlo perderia registro tributario. */
function tieneHistorialLocal(usuarioId: string): boolean {
  return Boolean(defaultSqliteClient.queryOne(
    `SELECT 1 FROM transacciones_venta WHERE usuario_id = ?
     UNION ALL SELECT 1 FROM cierres_caja WHERE usuario_id = ? LIMIT 1`,
    [usuarioId, usuarioId]
  ));
}

/** Administradores activos del comercio sin contar al usuario indicado. */
function otrosAdminsActivos(tenantId: string, usuarioId: string): number {
  const fila = defaultSqliteClient.queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM usuarios WHERE tenant_id = ? AND rol = 'admin' AND activo = 1 AND id <> ?",
    [tenantId, usuarioId]
  );
  return Number(fila?.total) || 0;
}

function exigirAdmin(req: Request, res: Response, accion: string): any | null {
  const auth = extractAndVerifyToken(req);
  if (!auth.valid) {
    res.status(auth.status).json({ success: false, message: auth.message });
    return null;
  }
  if (auth.user?.rol !== 'admin') {
    res.status(403).json({ success: false, message: `Acceso denegado: solo administradores pueden ${accion}` });
    return null;
  }
  return auth.user;
}

/**
 * PUT /api/v1/auth/users/:id
 * Edita nombre, correo, rol, estado o clave de un usuario del propio comercio. Requiere administrador.
 * No permite dejar al comercio sin un administrador activo.
 */
router.put('/users/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = exigirAdmin(req, res, 'editar usuarios');
    if (!admin) return;

    const tenant = admin.tenant_id as string;
    const id = String(req.params.id);
    const actual = defaultSqliteClient.queryOne<UserRow>(
      'SELECT id, tenant_id, nombre, email, password_hash, rol, activo FROM usuarios WHERE id = ? AND tenant_id = ?',
      [id, tenant]
    );
    if (!actual) {
      res.status(404).json({ success: false, message: 'El usuario no existe en este comercio' });
      return;
    }

    const { nombre, email, rol, password, activo } = req.body || {};
    if (password !== undefined && (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH)) {
      res.status(400).json({ success: false, message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` });
      return;
    }
    if (nombre !== undefined && (typeof nombre !== 'string' || !nombre.trim())) {
      res.status(400).json({ success: false, message: 'El nombre no puede quedar vacío' });
      return;
    }
    if (email !== undefined && (typeof email !== 'string' || !email.trim())) {
      res.status(400).json({ success: false, message: 'El correo no puede quedar vacío' });
      return;
    }

    const nuevo = {
      nombre: nombre !== undefined ? nombre.trim() : actual.nombre,
      email: email !== undefined ? email.trim().toLowerCase() : actual.email,
      rol: rol === undefined ? actual.rol : (rol === 'admin' ? 'admin' : 'cajero'),
      activo: activo === undefined ? estaActivo(actual) : Boolean(activo),
      password_hash: password !== undefined ? bcrypt.hashSync(password, 10) : actual.password_hash
    };

    const dejaDeSerAdmin = actual.rol === 'admin' && estaActivo(actual) && (nuevo.rol !== 'admin' || !nuevo.activo);
    if (dejaDeSerAdmin && otrosAdminsActivos(tenant, id) === 0) {
      res.status(409).json({ success: false, message: 'El comercio no puede quedar sin un administrador activo' });
      return;
    }

    const duplicado = defaultSqliteClient.queryOne<{ id: string }>(
      'SELECT id FROM usuarios WHERE tenant_id = ? AND LOWER(email) = LOWER(?) AND id <> ?',
      [tenant, nuevo.email, id]
    );
    if (duplicado) {
      res.status(409).json({ success: false, message: 'Ya existe otro usuario con ese correo en este comercio' });
      return;
    }

    defaultSqliteClient.execute(
      `UPDATE usuarios SET nombre = ?, email = ?, rol = ?, activo = ?, password_hash = ?, updated_at = datetime('now')
       WHERE id = ? AND tenant_id = ?`,
      [nuevo.nombre, nuevo.email, nuevo.rol, nuevo.activo ? 1 : 0, nuevo.password_hash, id, tenant]
    );

    try {
      if (await defaultPgClient.healthCheck()) {
        await defaultPgClient.query(
          `UPDATE usuarios SET nombre = $1, email = $2, rol = $3, activo = $4, password_hash = $5, updated_at = NOW()
           WHERE id = $6 AND tenant_id = $7`,
          [nuevo.nombre, nuevo.email, nuevo.rol, nuevo.activo, nuevo.password_hash, id, tenant]
        );
      }
    } catch (err) {
      logger.warn('AuthRoute', 'No se pudo replicar la edición del usuario en PostgreSQL', { error: String(err) });
    }

    const usuario = { id, tenant_id: tenant, nombre: nuevo.nombre, email: nuevo.email, rol: nuevo.rol, activo: nuevo.activo };
    res.status(200).json({ success: true, data: { usuario }, usuario });
  } catch (error) {
    logger.error('AuthRoute', 'Error editando usuario', error);
    res.status(500).json({ success: false, message: 'Error interno editando usuario' });
  }
});

/**
 * DELETE /api/v1/auth/users/:id
 * Elimina un usuario del propio comercio. Si tiene ventas o cierres de caja lo desactiva en su
 * lugar, porque esos registros deben conservar a su autor. Requiere administrador.
 */
router.delete('/users/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = exigirAdmin(req, res, 'eliminar usuarios');
    if (!admin) return;

    const tenant = admin.tenant_id as string;
    const id = String(req.params.id);
    if (id === admin.id) {
      res.status(409).json({ success: false, message: 'No puedes eliminar tu propia cuenta' });
      return;
    }
    const actual = defaultSqliteClient.queryOne<UserRow>(
      'SELECT id, rol, activo FROM usuarios WHERE id = ? AND tenant_id = ?',
      [id, tenant]
    );
    if (!actual) {
      res.status(404).json({ success: false, message: 'El usuario no existe en este comercio' });
      return;
    }
    if (actual.rol === 'admin' && estaActivo(actual) && otrosAdminsActivos(tenant, id) === 0) {
      res.status(409).json({ success: false, message: 'El comercio no puede quedar sin un administrador activo' });
      return;
    }

    const desactivado = tieneHistorialLocal(id);
    if (desactivado) {
      defaultSqliteClient.execute(
        "UPDATE usuarios SET activo = 0, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
        [id, tenant]
      );
    } else {
      defaultSqliteClient.execute('DELETE FROM usuarios WHERE id = ? AND tenant_id = ?', [id, tenant]);
    }

    // La nube decide por su propio historial: puede tener ventas de este usuario hechas en otra caja
    try {
      if (await defaultPgClient.healthCheck()) {
        const historial = await defaultPgClient.query(
          `SELECT 1 FROM transacciones_venta WHERE usuario_id = $1
           UNION ALL SELECT 1 FROM cierres_caja WHERE usuario_id = $1 LIMIT 1`,
          [id]
        );
        await defaultPgClient.query(
          historial.rows.length > 0
            ? 'UPDATE usuarios SET activo = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2'
            : 'DELETE FROM usuarios WHERE id = $1 AND tenant_id = $2',
          [id, tenant]
        );
      }
    } catch (err) {
      logger.warn('AuthRoute', 'No se pudo replicar la baja del usuario en PostgreSQL', { error: String(err) });
    }

    res.status(200).json({
      success: true,
      desactivado,
      message: desactivado
        ? 'El usuario tiene ventas o cierres registrados: quedó desactivado y ya no puede entrar'
        : 'Usuario eliminado'
    });
  } catch (error) {
    logger.error('AuthRoute', 'Error eliminando usuario', error);
    res.status(500).json({ success: false, message: 'Error interno eliminando usuario' });
  }
});

export default router;
