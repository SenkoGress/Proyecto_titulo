// 'Simulado' identifica al proveedor de contingencia. Sin ese valor el dato que el
// sistema calcula localmente queda registrado bajo la fuente externa solicitada.
export type MarketSource = 'MercadoLibre' | 'AliExpress' | 'Simulado';

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
