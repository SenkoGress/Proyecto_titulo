import { Router, Request, Response } from 'express';
import { defaultMarketTrendsService } from '../market/market-trends.service';
import { MarketSource } from '../market/types';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/trends/sync
 * Sincroniza tendencias de demanda de producto desde MercadoLibre o AliExpress
 */
router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  const { tenant_id, sku, keyword, source, simulate_failure } = req.body;

  if (!tenant_id || !sku || !keyword || !source) {
    res.status(400).json({
      success: false,
      message: 'tenant_id, sku, keyword and source are required'
    });
    return;
  }

  try {
    const trend = await defaultMarketTrendsService.syncMarketTrend(
      tenant_id,
      sku,
      keyword,
      source as MarketSource,
      simulate_failure === true
    );
    res.status(200).json({ success: true, trend });
  } catch (error) {
    logger.error('MarketRoutes', 'Failed to sync market trend', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error syncing market trend',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/v1/trends y GET /api/v1/trends/:tenantId
 * Consulta las tendencias de mercado registradas para el tenant
 */
const handleGetTrends = async (req: Request, res: Response): Promise<void> => {
  const tenantId = (req.params.tenantId || req.query.tenant_id) as string;

  if (!tenantId) {
    res.status(400).json({ success: false, message: 'tenant_id parameter is required' });
    return;
  }

  try {
    const trends = await defaultMarketTrendsService.getTrends(tenantId);
    res.status(200).json({ success: true, data: trends, trends });
  } catch (error) {
    logger.error('MarketRoutes', 'Failed to get market trends', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error retrieving market trends',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

router.get('/', handleGetTrends);
router.get('/:tenantId', handleGetTrends);

export default router;
