import fs from 'fs';
import path from 'path';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { defaultPgClient } from './database/postgres/client';
import { defaultSqliteClient } from './database/sqlite/client';
import invoiceRoutes from './routes/invoice.routes';
import paymentRoutes from './routes/payment.routes';
import posRoutes from './routes/pos.routes';
import replenishmentRoutes from './routes/replenishment.routes';
import syncRoutes from './routes/sync.routes';
import cajaRoutes from './routes/caja.routes';
import configRoutes from './routes/config.routes';
import supplierRoutes from './routes/supplier.routes';
import { dteRouter } from './routes/dte.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import authRoutes from './routes/auth.routes';
import { logger } from './utils/logger';
import { assertAuthConfig } from './config/auth.config';

import {
  corsMiddleware,
  generalRateLimiter,
  mutationRateLimiter,
  validateTenantAndAuth,
  rbacAuthMiddleware,
  globalErrorHandler
} from './middleware/security.middleware';

// Detiene el arranque en produccion si la firma JWT no es segura
assertAuthConfig();

const app = express();
const PORT = process.env.PORT || 3000;

// Politicas de seguridad de cabeceras HTTP (Content Security Policy)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Politica restrictiva de CORS para origenes autorizados
app.use(corsMiddleware);

// Limitador de tasa general para endpoints de la API
app.use('/api', generalRateLimiter);

// Limitador estricto para transacciones criticas de venta, pagos y DTEs
app.use('/api/v1/pos/checkout', mutationRateLimiter);
app.use('/api/v1/pos/sync', mutationRateLimiter);
app.use('/api/v1/dte', mutationRateLimiter);

app.use(express.json({ limit: '10mb' }));

// Middleware de validacion de Tenant ID y autenticacion para clientes externos
app.use('/api/v1', validateTenantAndAuth);
app.use('/api/v1', rbacAuthMiddleware);

/**
 * Interfaz del POS servida por el propio backend.
 *
 * La caja abre una sola direccion y las peticiones salen al mismo origen, de modo que no hay
 * politica de CORS que resolver ni una segunda direccion que configurar en el equipo del local.
 * Es tambien lo que permite empaquetar el sistema como una aplicacion de escritorio sin levantar
 * un servidor aparte para la interfaz.
 *
 * Se busca primero la interfaz construida; si no esta, se cae a la carpeta publica historica, que
 * es la que usa el entorno de desarrollo cuando la interfaz corre con su propio servidor.
 */
const candidatosFrontend = [
  process.env.FRONTEND_DIST,
  path.resolve(process.cwd(), 'front-end', 'dist'),
  path.join(__dirname, '../../../front-end/dist'),
  path.resolve(process.cwd(), 'backend/public'),
  path.join(__dirname, '../public')
].filter(Boolean) as string[];

const publicDir = candidatosFrontend.find((ruta) => fs.existsSync(path.join(ruta, 'index.html')))
  || candidatosFrontend[candidatosFrontend.length - 1];

app.use(express.static(publicDir));

// Montaje de rutas de modulos de negocio
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/pos', posRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/replenishment', replenishmentRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/caja', cajaRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/dte', dteRouter);
app.use('/api/v1/dashboard', dashboardRouter);

/**
 * Salud del servicio.
 *
 * El sistema es offline-first: un local sin internet esta funcionando bien, vende, emite sus
 * documentos y guarda todo para sincronizar despues. Responder 503 porque la nube no contesta
 * hacia que cualquier supervisor diera por caido un punto de venta que opera con normalidad, de
 * modo que el codigo lo decide el nodo local y el estado de la nube viaja en el detalle.
 */
app.get('/health', async (_req: Request, res: Response): Promise<void> => {
  const pgHealthy = await defaultPgClient.healthCheck();
  const sqliteHealthy = defaultSqliteClient.healthCheck();

  const estado = !sqliteHealthy ? 'DOWN' : pgHealthy ? 'UP' : 'DEGRADED';

  res.status(sqliteHealthy ? 200 : 503).json({
    status: estado,
    timestamp: new Date().toISOString(),
    services: {
      cloud_postgres: pgHealthy ? 'HEALTHY' : 'UNAVAILABLE',
      local_sqlite: sqliteHealthy ? 'HEALTHY' : 'UNAVAILABLE'
    },
    // DEGRADED significa que la caja opera y la nube no esta: las ventas quedan pendientes de
    // sincronizar, que es el funcionamiento previsto y no una falla del punto de venta.
    operativo: sqliteHealthy
  });
});

app.get('/api', (_req: Request, res: Response): void => {
  res.json({
    name: 'Gestock SaaS & Offline-First POS API',
    version: '0.1.0',
    status: 'ONLINE',
    modules: [
      'Multi-Tenant Core',
      'Dual Persistence Engine (PostgreSQL & SQLite)',
      'Offline-First Sync Engine',
      'Smart OCR Invoice Ingestion',
      'Predictive Replenishment & Purchase Orders',
      'Scheduled Replenishment Notice (SMTP)',
      'Payment Gateways (Transbank, MercadoPago, SumUp)',
      'POS Terminal & Predictive Dashboard SPA'
    ]
  });
});

// Middleware global para captura y sanitizacion de errores no controlados
app.use(globalErrorHandler);

/**
 * La interfaz resuelve sus rutas en el navegador, de modo que al recargar en /login el servidor
 * recibe una peticion que no corresponde a ningun archivo. Se devuelve la pagina y el enrutador
 * del cliente hace el resto. Solo para navegaciones: lo que empieza en /api o /health sigue su
 * camino, y una peticion que no acepta HTML tampoco se responde con la pagina.
 */
app.get(/^\/(?!api|health).*/, (req, res, next) => {
  const indice = path.join(publicDir, 'index.html');
  if (req.method !== 'GET' || !req.accepts('html') || !fs.existsSync(indice)) return next();
  res.sendFile(indice);
});

import { initializeDatabase } from './database/init-db';

import { defaultProgramadorAvisos } from './notifications/programador-avisos';

if (process.env.NODE_ENV !== 'test') {
  initializeDatabase()
    .then(() => {
      // El reloj parte despues de la base porque su primera revision consulta los locales
      defaultProgramadorAvisos.iniciar();
    })
    .catch((err) => {
      logger.error('Server', 'Database initialization error', err);
    });
}

export const server = process.env.NODE_ENV !== 'test'
  ? app.listen(PORT, () => {
      logger.info('Server', `Gestock backend server running on port ${PORT}`);
    })
  : null;

export default app;
