import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { logger } from '../utils/logger';

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
