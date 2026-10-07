import { Router, Request, Response } from 'express';
import { defaultCloudSyncReceiver } from '../sync/cloud-sync-receiver.service';
import { defaultPgClient } from '../database/postgres/client';
import { SyncPushPayload } from '../sync/types';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/sync/push
 * Ingesta de transacciones locales pendientes desde el POS hacia la nube SaaS
 */
router.post('/push', async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as SyncPushPayload;

  if (!payload || !payload.tenant_id || !Array.isArray(payload.sales)) {
    res.status(400).json({
      success: false,
      message: 'Invalid payload: tenant_id and sales array are required'
    });
    return;
  }

  try {
    const result = await defaultCloudSyncReceiver.ingestPushBatch(payload);
    const statusCode = result.success ? 200 : 500;
    res.status(statusCode).json(result);
  } catch (error) {
    logger.error('SyncRoutes', 'Unhandled error during sync push', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during sync push',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/v1/sync/pull
 * Descarga de actualizaciones de catálogo (precios, productos) desde la nube hacia el POS
 */
router.get('/pull', async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.query.tenant_id as string;
  const lastPull = req.query.last_pull as string | undefined;

  if (!tenantId) {
    res.status(400).json({
      success: false,
      message: 'Query parameter tenant_id is required'
    });
    return;
  }

  if (!defaultPgClient.isCloudAvailable()) {
    res.status(503).json({
      success: false,
      message: 'No se puede sincronizar: el servidor en la nube no está disponible (Modo Offline activo)',
      cloud_online: false
    });
    return;
  }

  try {
    const result = await defaultCloudSyncReceiver.getPullUpdates(tenantId, lastPull);
    res.status(200).json(result);
  } catch (error) {
    logger.error('SyncRoutes', 'Unhandled error during sync pull', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during sync pull',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
