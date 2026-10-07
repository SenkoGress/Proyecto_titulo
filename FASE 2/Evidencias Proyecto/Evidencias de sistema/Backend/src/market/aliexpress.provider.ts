import { IMarketIntelligenceProvider } from './market-provider.interface';
import { MarketSource, MarketTrendItem } from './types';
import { logger } from '../utils/logger';

export class AliExpressProvider implements IMarketIntelligenceProvider {
  public source: MarketSource = 'AliExpress';

  public async fetchTrend(
    tenantId: string,
    sku: string,
    keyword: string,
    simulateFailure = false
  ): Promise<MarketTrendItem> {
    if (simulateFailure) {
      throw new Error('AliExpress Open Platform API Rate Limit Exceeded');
    }

    logger.info('AliExpressProvider', `Fetching wholesale trend for SKU: ${sku}`);

    const demandIndex = parseFloat((55 + (keyword.length * 2) % 40).toFixed(2));
    const averageMarketPrice = parseFloat((950 + (keyword.length * 35) % 600).toFixed(2));

    return {
      tenantId,
      sku,
      keyword,
      source: this.source,
      demandIndex,
      averageMarketPrice,
      lastUpdated: new Date().toISOString()
    };
  }
}

export const defaultAliExpressProvider = new AliExpressProvider();
