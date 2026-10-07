import { IMarketIntelligenceProvider } from './market-provider.interface';
import { MarketSource, MarketTrendItem } from './types';
import { logger } from '../utils/logger';

export class MercadoLibreProvider implements IMarketIntelligenceProvider {
  public source: MarketSource = 'MercadoLibre';

  public async fetchTrend(
    tenantId: string,
    sku: string,
    keyword: string,
    simulateFailure = false
  ): Promise<MarketTrendItem> {
    if (simulateFailure) {
      throw new Error('MercadoLibre Trends API Throttled / Connection Timeout');
    }

    logger.info('MercadoLibreProvider', `Fetching demand trend for SKU: ${sku}, keyword: ${keyword}`);

    // Simulación calculada de índice de demanda basado en popularidad
    const demandIndex = parseFloat((65 + (keyword.length * 3) % 30).toFixed(2));
    const averageMarketPrice = parseFloat((1200 + (keyword.length * 45) % 800).toFixed(2));

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

export const defaultMercadoLibreProvider = new MercadoLibreProvider();
