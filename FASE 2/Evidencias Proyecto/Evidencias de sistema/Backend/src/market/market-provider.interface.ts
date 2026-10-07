import { MarketSource, MarketTrendItem } from './types';

export interface IMarketIntelligenceProvider {
  source: MarketSource;
  fetchTrend(tenantId: string, sku: string, keyword: string, simulateFailure?: boolean): Promise<MarketTrendItem>;
}
