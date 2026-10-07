import { IMarketIntelligenceProvider } from './market-provider.interface';
import { MarketSource, MarketTrendItem } from './types';
import { logger } from '../utils/logger';

export class MockMarketProvider implements IMarketIntelligenceProvider {
  public source: MarketSource = 'MercadoLibre';

  public async fetchTrend(
    tenantId: string,
    sku: string,
    keyword: string
  ): Promise<MarketTrendItem> {
    logger.warn('MockMarketProvider', `Providing offline fallback market trend for ${sku}`);

    return {
      tenantId,
      sku,
      keyword,
      source: this.source,
      demandIndex: 70.0,
      averageMarketPrice: 1500.0,
      lastUpdated: new Date().toISOString()
    };
  }
}

export const defaultMockMarketProvider = new MockMarketProvider();
