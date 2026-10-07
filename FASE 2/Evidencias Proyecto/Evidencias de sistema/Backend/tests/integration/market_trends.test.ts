import { PostgresClient } from '../../src/database/postgres/client';
import { MarketTrendsService } from '../../src/market/market-trends.service';
import { createTestPostgresClient } from '../helpers/db-test-helper';
import {
  createFixtureIds,
  sampleProducto,
  sampleTenant
} from '../helpers/fixtures';

describe('Market Intelligence Trends & Replenishment Integration', () => {
  let pgClient: PostgresClient;
  let trendsService: MarketTrendsService;

  beforeAll(async () => {
    const pgSetup = await createTestPostgresClient();
    pgClient = pgSetup.client;
    trendsService = new MarketTrendsService(pgClient);
  });

  afterAll(async () => {
    await pgClient.close();
  });

  test('1. Sincroniza tendencias de MercadoLibre y AliExpress y las persiste en market_trends en <200ms', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const prod = sampleProducto(ids.productoId, ids.tenantId);

    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
    await pgClient.query(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta)
       VALUES ($1, $2, $3, $4, 50.0, 500, 1000)`,
      [prod.id, prod.tenant_id, prod.sku, prod.nombre]
    );

    const startTime = Date.now();

    // 1. Sincronizar desde MercadoLibre
    const meliTrend = await trendsService.syncMarketTrend(
      ids.tenantId,
      prod.sku,
      'bebida cola pack mayorista',
      'MercadoLibre'
    );

    // 2. Sincronizar desde AliExpress
    const aliTrend = await trendsService.syncMarketTrend(
      ids.tenantId,
      prod.sku,
      'cola soft drink bulk wholesale',
      'AliExpress'
    );

    const duration = Date.now() - startTime;

    // Validación de latencia < 200ms
    expect(duration).toBeLessThan(200);

    expect(meliTrend.source).toBe('MercadoLibre');
    expect(meliTrend.demandIndex).toBeGreaterThan(0);
    expect(meliTrend.averageMarketPrice).toBeGreaterThan(0);

    expect(aliTrend.source).toBe('AliExpress');
    expect(aliTrend.demandIndex).toBeGreaterThan(0);

    // 3. Verificar persistencia en base de datos
    const savedTrends = await trendsService.getTrends(ids.tenantId);
    expect(savedTrends.length).toBe(2);

    const meliSaved = savedTrends.find((t) => t.source === 'MercadoLibre');
    expect(meliSaved).toBeDefined();
    expect(meliSaved?.sku).toBe(prod.sku);

    const aliSaved = savedTrends.find((t) => t.source === 'AliExpress');
    expect(aliSaved).toBeDefined();
    expect(aliSaved?.sku).toBe(prod.sku);
  });

  test('2. Degradación Elegante: Caída de la API de MercadoLibre activa proveedor Mock sin fallar', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const prod = sampleProducto(ids.productoId, ids.tenantId);

    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);

    // Inducir caída de la API
    const fallbackTrend = await trendsService.syncMarketTrend(
      ids.tenantId,
      prod.sku,
      'producto tendencia caida api',
      'MercadoLibre',
      true // simulateFailure = true
    );

    expect(fallbackTrend).toBeDefined();
    expect(fallbackTrend.source).toBe('MercadoLibre');
    expect(fallbackTrend.demandIndex).toBe(70.0); // Valor del mock de contingencia
    expect(fallbackTrend.averageMarketPrice).toBe(1500.0);

    // Comprobar que a pesar de la caída se persistió en la tabla
    const trendsInDb = await trendsService.getTrends(ids.tenantId);
    expect(trendsInDb.some((t) => t.sku === prod.sku)).toBe(true);
  });

  test('3. Acople con Inventario Predictivo: Alto índice de demanda amplifica el factor de seguridad de stock', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const viralSku = 'SKU-VIRAL-DEMAND-HIGH';
    const normalSku = 'SKU-NORMAL-DEMAND-LOW';

    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);

    // Producto viral con índice de demanda 92.0 (> 80)
    await pgClient.query(
      `INSERT INTO market_trends (id, tenant_id, fuente_api, sku_referencia, palabra_clave, indice_demanda, precio_promedio_mercado)
       VALUES ($1, $2, 'MercadoLibre', $3, 'viral product trend', 92.0, 3500.0)`,
      [createFixtureIds().configId, ids.tenantId, viralSku]
    );

    // Producto regular con índice de demanda 45.0 (< 60)
    await pgClient.query(
      `INSERT INTO market_trends (id, tenant_id, fuente_api, sku_referencia, palabra_clave, indice_demanda, precio_promedio_mercado)
       VALUES ($1, $2, 'MercadoLibre', $3, 'regular product', 45.0, 1000.0)`,
      [createFixtureIds().configId, ids.tenantId, normalSku]
    );

    const viralMultiplier = await trendsService.getDemandMultiplierForSku(ids.tenantId, viralSku);
    const normalMultiplier = await trendsService.getDemandMultiplierForSku(ids.tenantId, normalSku);

    // El producto viral debe tener un multiplicador amplificado de 1.5x (50% extra de seguridad)
    expect(viralMultiplier).toBe(1.5);
    // El producto regular mantiene multiplicador estándar 1.0x
    expect(normalMultiplier).toBe(1.0);
  });
});
