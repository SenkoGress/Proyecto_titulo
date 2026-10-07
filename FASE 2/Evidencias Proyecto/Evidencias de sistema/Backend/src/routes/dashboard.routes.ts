import { Router, Request, Response } from 'express';
import { defaultDashboardService } from '../analytics/dashboard.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/dashboard/overview
 * Retorna el conjunto integral de métricas, serie temporal, medios de pago, productos y proveedores
 */
router.get('/overview', (req: Request, res: Response): void => {
  const tenantId = (req.query.tenant_id as string) || '00000000-0000-0000-0000-000000000001';
  const periodo = (req.query.periodo as 'diario' | 'mensual' | 'historico') || 'mensual';

  try {
    const data = defaultDashboardService.getOverview({
      tenantId,
      periodo
    });

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('DashboardRoutes', 'Error generating dashboard overview', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar analítica del dashboard',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export const dashboardRouter = router;
