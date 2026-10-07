export type MarketSource = 'MercadoLibre' | 'AliExpress';

export interface MarketTrendItem {
  id?: string;
  tenantId: string;
  sku: string;
  keyword: string;
  source: MarketSource;
  demandIndex: number; // Índice de 0 a 100
  averageMarketPrice: number;
  lastUpdated: string;
}

export interface MarketSyncResult {
  processedCount: number;
  updatedCount: number;
  trends: MarketTrendItem[];
  durationMs: number;
}
