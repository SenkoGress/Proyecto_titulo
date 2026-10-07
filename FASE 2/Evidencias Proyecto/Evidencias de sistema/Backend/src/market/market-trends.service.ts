import { v4 as uuidv4 } from 'uuid';
import { PostgresClient, defaultPgClient } from '../database/postgres/client';
import { defaultSqliteClient } from '../database/sqlite/client';
import { logger } from '../utils/logger';
import { defaultAliExpressProvider } from './aliexpress.provider';
import { IMarketIntelligenceProvider } from './market-provider.interface';
import { defaultMercadoLibreProvider } from './mercadolibre.provider';
import { defaultMockMarketProvider } from './mock-market.provider';
import { MarketSource, MarketSyncResult, MarketTrendItem } from './types';

export class MarketTrendsService {
  private pgClient: PostgresClient;
  private providers: Map<MarketSource, IMarketIntelligenceProvider>;
  private fallbackProvider: IMarketIntelligenceProvider;

  constructor(
    customPgClient?: PostgresClient,
    customProviders?: Map<MarketSource, IMarketIntelligenceProvider>
  ) {
    this.pgClient = customPgClient || defaultPgClient;
    this.fallbackProvider = defaultMockMarketProvider;

    this.providers = customProviders || new Map<MarketSource, IMarketIntelligenceProvider>([
      ['MercadoLibre', defaultMercadoLibreProvider],
      ['AliExpress', defaultAliExpressProvider]
    ]);
  }

  public async syncMarketTrend(
    tenantId: string,
    sku: string,
    keyword: string,
    source: MarketSource = 'MercadoLibre',
    simulateFailure = false
  ): Promise<MarketTrendItem> {
    const provider = this.providers.get(source) || defaultMercadoLibreProvider;
    let trend: MarketTrendItem;

    try {
      trend = await provider.fetchTrend(tenantId, sku, keyword, simulateFailure);
    } catch (err) {
      // Conmutacion a proveedor simulado ante indisponibilidad de APIs externas
      logger.warn('MarketTrendsService', `Market API ${source} no respondio. Activando proveedor simulado de contingencia.`, {
        error: err instanceof Error ? err.message : String(err)
      });
      trend = await this.fallbackProvider.fetchTrend(tenantId, sku, keyword);
      trend.source = source;
    }

    const trendId = uuidv4();

    // Persistir en PostgreSQL Cloud si esta disponible
    if (this.pgClient.isCloudAvailable()) {
      try {
        await this.pgClient.query(
          `INSERT INTO market_trends 
           (id, tenant_id, fuente_api, sku_referencia, palabra_clave, indice_demanda, precio_promedio_mercado, ultima_actualizacion)
           VALUES ($1, $2, $3, $4, $5, $6, $7, now())
           ON CONFLICT (tenant_id, fuente_api, sku_referencia)
           DO UPDATE SET 
             palabra_clave = EXCLUDED.palabra_clave,
             indice_demanda = EXCLUDED.indice_demanda,
             precio_promedio_mercado = EXCLUDED.precio_promedio_mercado,
             ultima_actualizacion = now()`,
          [
            trendId,
            tenantId,
            trend.source,
            trend.sku,
            trend.keyword,
            trend.demandIndex,
            trend.averageMarketPrice
          ]
        );
      } catch (pgErr) {
        logger.warn('MarketTrendsService', 'No fue posible sincronizar tendencia a PostgreSQL Cloud, se persistira en local', {
          error: pgErr instanceof Error ? pgErr.message : String(pgErr)
        });
      }
    }
    // Persistir también en SQLite local si la tabla existe
    try {
      const hasTable = defaultSqliteClient.queryOne<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='market_trends'"
      );
      if (hasTable) {
        defaultSqliteClient.execute(
          `INSERT OR REPLACE INTO market_trends 
           (id, tenant_id, fuente_api, sku_referencia, palabra_clave, indice_demanda, precio_promedio_mercado, ultima_actualizacion)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [trendId, tenantId, trend.source, trend.sku, trend.keyword, trend.demandIndex, trend.averageMarketPrice]
        );
      }
    } catch {
      // Ignorar si falla SQLite
    }

    trend.id = trendId;
    return trend;
  }

  public async getTrends(tenantId: string): Promise<MarketTrendItem[]> {
    // 1. Consultar todos los productos activos del tenant para asegurar cobertura total
    let productos: Array<{ id: string; sku: string; nombre: string; precio_venta: number }> = [];
    try {
      productos = defaultSqliteClient.query<any>(
        'SELECT id, sku, nombre, precio_venta FROM productos WHERE tenant_id = ? AND activo = 1',
        [tenantId]
      );
    } catch {}

    // 2. Obtener tendencias existentes desde PostgreSQL Cloud si esta disponible, o SQLite local
    let existingTrends: MarketTrendItem[] = [];
    if (this.pgClient.isCloudAvailable()) {
      try {
        const res = await this.pgClient.query<{
          id: string;
          tenant_id: string;
          fuente_api: MarketSource;
          sku_referencia: string;
          palabra_clave: string;
          indice_demanda: string;
          precio_promedio_mercado: string;
          ultima_actualizacion: string;
        }>('SELECT * FROM market_trends WHERE tenant_id = $1 ORDER BY indice_demanda DESC', [tenantId]);

        if (res.rows.length > 0) {
          existingTrends = res.rows.map((r) => ({
            id: r.id,
            tenantId: r.tenant_id,
            source: r.fuente_api,
            sku: r.sku_referencia,
            keyword: r.palabra_clave,
            demandIndex: parseFloat(r.indice_demanda),
            averageMarketPrice: parseFloat(r.precio_promedio_mercado),
            lastUpdated: r.ultima_actualizacion
          }));
        }
      } catch {
        // Fallback inmediato a SQLite
      }
    }

    if (existingTrends.length === 0) {
      try {
        const localRows = defaultSqliteClient.query<any>(
          'SELECT * FROM market_trends WHERE tenant_id = ? ORDER BY indice_demanda DESC',
          [tenantId]
        );

        existingTrends = localRows.map((r) => ({
          id: r.id,
          tenantId: r.tenant_id,
          source: r.fuente_api,
          sku: r.sku_referencia,
          keyword: r.palabra_clave,
          demandIndex: parseFloat(r.indice_demanda),
          averageMarketPrice: parseFloat(r.precio_promedio_mercado),
          lastUpdated: r.ultima_actualizacion
        }));
      } catch {}
    }

    // 3. Garantizar que todos los productos del catálogo tengan tendencia evaluada
    const trackedSkus = new Set(existingTrends.map((t) => t.sku));
    for (const prod of productos) {
      if (!trackedSkus.has(prod.sku)) {
        try {
          const autoTrend = await this.syncMarketTrend(tenantId, prod.sku, prod.nombre);
          existingTrends.push(autoTrend);
          trackedSkus.add(prod.sku);
        } catch {
          // Si falla sync individual, continuar con los demás
        }
      }
    }

    return existingTrends.sort((a, b) => b.demandIndex - a.demandIndex);
  }

  /**
   * Acople con Abastecimiento Predictivo:
   * Si el índice de demanda externa supera 80 (tendencia viral o alta rotación en e-commerce),
   * amplifica el factor de seguridad de inventario para evitar quiebres anticipados.
   */
  public async getDemandMultiplierForSku(tenantId: string, sku: string): Promise<number> {
    const res = await this.pgClient.query<{ indice_demanda: string }>(
      'SELECT indice_demanda FROM market_trends WHERE tenant_id = $1 AND sku_referencia = $2 ORDER BY indice_demanda DESC LIMIT 1',
      [tenantId, sku]
    );

    if (res.rows.length === 0) {
      return 1.0;
    }

    const demandIndex = parseFloat(res.rows[0].indice_demanda);
    if (demandIndex >= 80.0) {
      return 1.5; // 50% extra de stock de seguridad
    } else if (demandIndex >= 60.0) {
      return 1.25; // 25% extra de stock de seguridad
    }
    return 1.0;
  }
}

export const defaultMarketTrendsService = new MarketTrendsService();
