import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { defaultSqliteClient } from '../database/sqlite/client';
import { defaultPgClient } from '../database/postgres/client';
import { logger } from '../utils/logger';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_gestock_2026_change_in_production';

interface UserRow {
  id: string;
  tenant_id: string;
  nombre: string;
  email: string;
  password_hash: string;
  rol: 'admin' | 'cajero';
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
        'SELECT id, tenant_id, nombre, email, password_hash, rol FROM usuarios WHERE tenant_id = ? AND LOWER(email) = LOWER(?)',
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
            'SELECT id, tenant_id, nombre, email, password_hash, rol FROM usuarios WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)',
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

    // 3. Comparar clave con Bcrypt
    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      res.status(401).json({ success: false, message: 'El correo o la clave no son correctos' });
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
      JWT_SECRET,
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
    const decoded = jwt.verify(token, JWT_SECRET) as any;
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

    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
      return;
    }

    const tenant = tenant_id || auth.user?.tenant_id || (req.headers['x-tenant-id'] as string) || '00000000-0000-0000-0000-000000000001';
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

    const tenant = (req.headers['x-tenant-id'] as string) || auth.user?.tenant_id || (req.query.tenant_id as string) || '00000000-0000-0000-0000-000000000001';

    let users: any[] = [];
    try {
      users = defaultSqliteClient.query<Omit<UserRow, 'password_hash'> & { created_at?: string; updated_at?: string }>(
        'SELECT id, tenant_id, nombre, email, rol, created_at, updated_at FROM usuarios WHERE tenant_id = ? ORDER BY created_at DESC, nombre ASC',
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
            'SELECT id, tenant_id, nombre, email, rol, created_at, updated_at FROM usuarios WHERE tenant_id = $1 ORDER BY created_at DESC, nombre ASC',
            [tenant]
          );
          users = pgRes.rows;
        }
      } catch (err) {
        logger.warn('AuthRoute', 'Error listando usuarios en PostgreSQL', { error: String(err) });
      }
    }

    res.status(200).json({
      success: true,
      data: users
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

export default router;
