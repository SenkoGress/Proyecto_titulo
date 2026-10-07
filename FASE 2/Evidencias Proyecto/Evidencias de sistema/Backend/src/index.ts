import fs from 'fs';
import path from 'path';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { defaultPgClient } from './database/postgres/client';
import { defaultSqliteClient } from './database/sqlite/client';
import invoiceRoutes from './routes/invoice.routes';
import marketRoutes from './routes/market.routes';
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

import {
  corsMiddleware,
  generalRateLimiter,
  mutationRateLimiter,
  validateTenantAndAuth,
  globalErrorHandler
} from './middleware/security.middleware';

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

// Servir frontend estatico del POS
const publicDir = fs.existsSync(path.resolve(process.cwd(), 'backend/public'))
  ? path.resolve(process.cwd(), 'backend/public')
  : path.join(__dirname, '../public');
app.use(express.static(publicDir));

// Montaje de rutas de modulos de negocio
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/pos', posRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/replenishment', replenishmentRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/trends', marketRoutes);
app.use('/api/v1/caja', cajaRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/dte', dteRouter);
app.use('/api/v1/dashboard', dashboardRouter);

app.get('/health', async (_req: Request, res: Response): Promise<void> => {
  const pgHealthy = await defaultPgClient.healthCheck();
  const sqliteHealthy = defaultSqliteClient.healthCheck();

  const isHealthy = pgHealthy && sqliteHealthy;
  const status = isHealthy ? 200 : 503;

  res.status(status).json({
    status: isHealthy ? 'UP' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    services: {
      cloud_postgres: pgHealthy ? 'HEALTHY' : 'UNAVAILABLE',
      local_sqlite: sqliteHealthy ? 'HEALTHY' : 'UNAVAILABLE'
    }
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
      'Payment Gateways (Transbank, MercadoPago, SumUp)',
      'Market Trends Intelligence (MercadoLibre, AliExpress)',
      'POS Terminal & Predictive Dashboard SPA'
    ]
  });
});

// Middleware global para captura y sanitizacion de errores no controlados
app.use(globalErrorHandler);

import { initializeDatabase } from './database/init-db';

if (process.env.NODE_ENV !== 'test') {
  initializeDatabase().catch((err) => {
    logger.error('Server', 'Database initialization error', err);
  });
}

export const server = process.env.NODE_ENV !== 'test'
  ? app.listen(PORT, () => {
      logger.info('Server', `Gestock backend server running on port ${PORT}`);
    })
  : null;

export default app;
