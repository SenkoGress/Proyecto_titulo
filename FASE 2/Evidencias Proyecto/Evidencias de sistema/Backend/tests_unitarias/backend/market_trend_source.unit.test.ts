import { defaultSqliteClient } from '../../backend/src/database/sqlite/client';
import { initializeDatabase } from '../../backend/src/database/init-db';
import { defaultPgClient } from '../../backend/src/database/postgres/client';
import { MarketTrendsService } from '../../backend/src/market/market-trends.service';
import { IMarketIntelligenceProvider } from '../../backend/src/market/market-provider.interface';
import { defaultMockMarketProvider } from '../../backend/src/market/mock-market.provider';
import { MarketSource, MarketTrendItem } from '../../backend/src/market/types';

const TENANT = '00000000-0000-0000-0000-000000000001';

/** Reproduce el comportamiento real: el proveedor externo no responde. */
const proveedorCaido: IMarketIntelligenceProvider = {
  source: 'MercadoLibre' as MarketSource,
  async fetchTrend(): Promise<MarketTrendItem> {
    throw new Error('MercadoLibre Trends API Throttled / Connection Timeout');
  }
};

const proveedorQueResponde: IMarketIntelligenceProvider = {
  source: 'MercadoLibre' as MarketSource,
  async fetchTrend(tenantId, sku, keyword): Promise<MarketTrendItem> {
    return {
      tenantId,
      sku,
      keyword,
      source: 'MercadoLibre',
      demandIndex: 88,
      averageMarketPrice: 1290,
      lastUpdated: new Date().toISOString()
    };
  }
};

function servicio(primario: IMarketIntelligenceProvider): MarketTrendsService {
  const mapa = new Map<MarketSource, IMarketIntelligenceProvider>([['MercadoLibre', primario]]);
  return new MarketTrendsService(undefined, mapa);
}

describe('Pruebas Unitarias: Trazabilidad del Origen de las Tendencias', () => {
  beforeAll(async () => {
    defaultPgClient.tripCircuit();
    await initializeDatabase();
  });

  afterEach(() => {
    defaultSqliteClient.execute('DELETE FROM market_trends WHERE tenant_id = ?', [TENANT]);
  });

  test('el proveedor de contingencia se declara Simulado, no MercadoLibre', () => {
    // Antes devolvia source = 'MercadoLibre' para un dato que calcula el propio sistema
    expect(defaultMockMarketProvider.source).toBe('Simulado');
  });

  test('cuando el proveedor externo falla, la tendencia NO queda atribuida a el', async () => {
    const trend = await servicio(proveedorCaido).syncMarketTrend(TENANT, 'SKU-001', 'Bebida Cola 1.5L');

    // El servicio hacia trend.source = source, sellando el dato simulado con la fuente externa
    expect(trend.source).toBe('Simulado');
    expect(trend.source).not.toBe('MercadoLibre');
  });

  test('la fuente simulada queda persistida como tal en el nodo local', async () => {
    await servicio(proveedorCaido).syncMarketTrend(TENANT, 'SKU-002', 'Arroz Grado 1');

    const fila = defaultSqliteClient.queryOne<{ fuente_api: string }>(
      'SELECT fuente_api FROM market_trends WHERE tenant_id = ? AND sku_referencia = ?',
      [TENANT, 'SKU-002']
    );

    // La restriccion de la tabla solo admitia MercadoLibre y AliExpress: la migracion 014
    // incorpora Simulado para que el origen sea trazable en la base y no solo en memoria
    expect(fila?.fuente_api).toBe('Simulado');
  });

  test('una lectura real conserva la fuente externa que la entrego', async () => {
    const trend = await servicio(proveedorQueResponde).syncMarketTrend(TENANT, 'SKU-003', 'Cerveza Lata');

    expect(trend.source).toBe('MercadoLibre');
    expect(trend.demandIndex).toBe(88);
  });

  test('el dato simulado y el real no se sobreescriben entre si', async () => {
    await servicio(proveedorQueResponde).syncMarketTrend(TENANT, 'SKU-004', 'Pan Molde');
    await servicio(proveedorCaido).syncMarketTrend(TENANT, 'SKU-004', 'Pan Molde');

    const filas = defaultSqliteClient.query<{ fuente_api: string }>(
      'SELECT fuente_api FROM market_trends WHERE tenant_id = ? AND sku_referencia = ? ORDER BY fuente_api',
      [TENANT, 'SKU-004']
    );

    // Con ambos bajo la misma fuente, la contingencia reemplazaba la ultima lectura buena
    expect(filas.map((f) => f.fuente_api)).toEqual(['MercadoLibre', 'Simulado']);
  });
});
