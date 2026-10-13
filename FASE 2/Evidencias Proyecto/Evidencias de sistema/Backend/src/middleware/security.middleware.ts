import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { logger } from '../utils/logger';
import { getJwtSecret } from '../config/auth.config';

/**
 * Configuracion de CORS (Cross-Origin Resource Sharing)
 * Restringe el acceso unicamente a origenes autorizados.
 */
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origen (como clientes locales, curl en localhost o misma maquina)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    logger.warn('SecurityMiddleware', `Peticion CORS bloqueada para origen no autorizado: ${origin}`);
    return callback(new Error('Origen no autorizado por politica CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-API-Key']
});

/**
 * Limitador de tasa general para endpoints publicos y de consulta
 * Ajustado a 2000 peticiones por ventana de 15 minutos para permitir navegacion continua en POS
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 2000, // hasta 2000 peticiones
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const tenant = (req.headers['x-tenant-id'] as string) || '';
    const device = (req.headers['x-device-id'] as string) || '';
    const clientIp = ipKeyGenerator(req.ip || '127.0.0.1');
    if (tenant && device) return `${tenant}-${device}`;
    if (tenant) return `${tenant}-${clientIp}`;
    return clientIp;
  },
  message: {
    success: false,
    message: 'Limite de peticiones excedido. Por favor intente mas tarde.'
  }
});

/**
 * Limitador para operaciones criticas de mutacion (ventas, pagos, DTEs, sync)
 */
export const mutationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 300, // hasta 300 transacciones por minuto
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const tenant = (req.headers['x-tenant-id'] as string) || '';
    const device = (req.headers['x-device-id'] as string) || '';
    const clientIp = ipKeyGenerator(req.ip || '127.0.0.1');
    if (tenant && device) return `${tenant}-${device}`;
    if (tenant) return `${tenant}-${clientIp}`;
    return clientIp;
  },
  message: {
    success: false,
    message: 'Demasiadas operaciones concurrentes de transaccion. Reduzca la frecuencia.'
  }
});

/**
 * Middleware para validar presencia y formato seguro del tenant_id y API Key
 */
export const validateTenantAndAuth = (req: Request, res: Response, next: NextFunction): void => {
  // Rutas publicas excluidas de validacion
  if (req.path === '/health' || req.path === '/api' || req.path.startsWith('/css') || req.path.startsWith('/js') || req.path.startsWith('/auth')) {
    return next();
  }

  const tenantId = (
    req.headers['x-tenant-id'] ||
    req.query.tenant_id ||
    req.query.tenantId ||
    req.body?.tenant_id ||
    req.body?.tenantId ||
    req.params?.tenantId
  ) as string | undefined;

  // Si la peticion proviene de un cliente externo que incluye X-API-Key, validarla si esta configurada
  const configuredApiKey = process.env.API_KEY;
  const providedApiKey = req.headers['x-api-key'] as string | undefined;

  if (configuredApiKey && providedApiKey && providedApiKey !== configuredApiKey) {
    logger.warn('SecurityMiddleware', 'Intento de acceso con API Key invalida', { ip: req.ip, path: req.path });
    res.status(401).json({
      success: false,
      message: 'API Key no autorizada o invalida'
    });
    return;
  }

  // Validar formato seguro del tenant_id si esta presente en peticiones API
  if (tenantId) {
    const isSafeFormat = /^[a-zA-Z0-9_-]{1,64}$/.test(tenantId);
    if (!isSafeFormat) {
      logger.warn('SecurityMiddleware', 'Tenant ID con formato invalido rechazado', { tenantId, ip: req.ip });
      res.status(400).json({
        success: false,
        message: 'Formato de Tenant ID invalido'
      });
      return;
    }
  }

  next();
};

/**
 * Tenants que la petición declara (cabecera, query, body o /trends/:tenantId).
 * Se comparan contra el tenant del token para impedir operar sobre otro comercio.
 */
function requestedTenantIds(req: Request, fullPath: string): string[] {
  const candidates: unknown[] = [
    req.headers['x-tenant-id'],
    req.query?.tenant_id,
    req.query?.tenantId,
    req.body?.tenant_id,
    req.body?.tenantId
  ];

  const trendsMatch = req.method === 'GET' ? /^\/api\/v1\/trends\/([^/]+)$/.exec(fullPath) : null;
  if (trendsMatch && trendsMatch[1] !== 'sync') {
    candidates.push(trendsMatch[1]);
  }

  return candidates
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.trim().toLowerCase());
}

/**
 * Rutas DTE que el cajero necesita para entregar el comprobante de una venta
 * (datos del emisor, ticket, XML y envío por correo). El resto de /dte sigue siendo solo admin.
 */
function isCashierDteRoute(method: string | undefined, fullPath: string): boolean {
  if (method === 'GET') {
    return /^\/api\/v1\/dte\/(config|list|[^/]+\/(receipt|xml))$/.test(fullPath);
  }
  return method === 'POST' && fullPath === '/api/v1/dte/send-email';
}

/**
 * Middleware de Control de Acceso Basado en Roles (RBAC) y Seguridad JWT
 * - Rutas exclusivas de administrador: /dashboard, /invoices, /suppliers, /replenishment, /dte, /config
 * - Rutas de cajero / admin: /pos, /caja y las rutas DTE del comprobante de venta (isCashierDteRoute)
 * - Con token, el tenant declarado en la petición debe coincidir con el del token (aislamiento multi-tenant)
 * - Con token, el usuario_id del body se reemplaza por el id del usuario autenticado
 * - Cuando ENFORCE_AUTH=true, exige token en todas las rutas protegidas
 * - Si no está activado ENFORCE_AUTH, respeta peticiones con Bearer token (aplicando RBAC)
 *   o permite paso en modo desarrollo/pruebas si no hay token.
 */
export const rbacAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const fullPath = (req.originalUrl ? req.originalUrl.split('?')[0] : (req.baseUrl || '') + (req.path || '')).toLowerCase();

  // Excluir rutas públicas o de autenticación inicial
  if (
    fullPath === '/health' ||
    fullPath === '/api' ||
    fullPath.startsWith('/css') ||
    fullPath.startsWith('/js') ||
    fullPath.startsWith('/api/v1/auth') ||
    fullPath.startsWith('/auth')
  ) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const hasBearer = authHeader && authHeader.startsWith('Bearer ');
  
  // En producción (NODE_ENV=production), la autenticación está activa POR DEFECTO a menos que
  // se declare explícitamente AUTH_DISABLED=true. En desarrollo, se activa con ENFORCE_AUTH=true.
  const isProduction = process.env.NODE_ENV === 'production';
  const isAuthDisabled = process.env.AUTH_DISABLED === 'true';
  const enforceAuth = process.env.ENFORCE_AUTH === 'true' || (isProduction && !isAuthDisabled);

  let decodedUser: any = null;

  if (hasBearer) {
    const token = authHeader.split(' ')[1];
    try {
      decodedUser = (require('jsonwebtoken') as typeof import('jsonwebtoken')).verify(token, getJwtSecret()) as any;
      (req as any).user = decodedUser;
    } catch {
      res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      });
      return;
    }
  } else if (enforceAuth) {
    res.status(401).json({
      success: false,
      message: 'Autenticación requerida: cabecera Authorization: Bearer requerida'
    });
    return;
  }

  // Verificación estricta de RBAC si el usuario está autenticado
  if (decodedUser) {
    const tokenTenant = String(decodedUser.tenant_id || '').toLowerCase();
    const foreignTenant = requestedTenantIds(req, fullPath).find((tenant) => tenant !== tokenTenant);
    if (foreignTenant) {
      logger.warn('SecurityMiddleware', 'Acceso denegado: tenant solicitado distinto al del token', {
        userId: decodedUser.id,
        tokenTenant,
        requestedTenant: foreignTenant
      });
      res.status(403).json({
        success: false,
        message: 'Acceso denegado: el comercio solicitado no corresponde a la sesion'
      });
      return;
    }

    // El autor de ventas, aperturas de caja y devoluciones es el usuario de la sesion, no el que declare el cliente
    if (req.body && typeof req.body === 'object' && 'usuario_id' in req.body && decodedUser.id) {
      req.body.usuario_id = decodedUser.id;
    }

    const isAdminRoute = /^\/api\/v1\/(dashboard|invoices|suppliers|replenishment|dte|config)(\/|$)/.test(fullPath);
    if (isAdminRoute && decodedUser.rol !== 'admin' && !isCashierDteRoute(req.method, fullPath)) {
      logger.warn('SecurityMiddleware', `Acceso denegado a ruta admin (${fullPath}) para rol ${decodedUser.rol}`, {
        userId: decodedUser.id,
        email: decodedUser.email
      });
      res.status(403).json({
        success: false,
        message: 'Acceso denegado: se requieren permisos de administrador'
      });
      return;
    }
  }

  next();
};

/**
 * Middleware centralizado para captura y sanitizacion de errores de Express
 */
export const globalErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('GlobalErrorHandler', 'Error no capturado en pipeline Express', err);

  const status = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(status).json({
    success: false,
    message: isProduction ? 'Ocurrio un error interno en el servidor' : (err.message || 'Error interno del servidor')
  });
};

