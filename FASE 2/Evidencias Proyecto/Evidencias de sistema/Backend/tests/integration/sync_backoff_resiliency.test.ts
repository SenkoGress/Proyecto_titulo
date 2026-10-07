import { SqliteClient } from '../../src/database/sqlite/client';
import { ExponentialBackoff } from '../../src/sync/exponential-backoff';
import { PosSyncEngineService } from '../../src/sync/pos-sync-engine.service';
import { createTestSqliteClient } from '../helpers/db-test-helper';
import {
  createFixtureIds,
  sampleProducto,
  sampleTenant,
  sampleUsuario
} from '../helpers/fixtures';

describe('Network Outage Resiliency & Exponential Backoff', () => {
  let sqliteClient: SqliteClient;
  let posEngine: PosSyncEngineService;
  let backoff: ExponentialBackoff;

  beforeAll(() => {
    const sqliteSetup = createTestSqliteClient();
    sqliteClient = sqliteSetup.client;
    backoff = new ExponentialBackoff({
      initialDelayMs: 1000,
      maxDelayMs: 16000,
      multiplier: 2.0,
      jitterFactor: 0.05 // 5% jitter
    });
    posEngine = new PosSyncEngineService(sqliteClient, backoff);
  });

  afterAll(() => {
    sqliteClient.close();
  });

  test('1. Algoritmo de Exponential Backoff: Los tiempos de reintento escalan exponencialmente', () => {
    const delay1 = backoff.calculateDelay(1);
    const delay2 = backoff.calculateDelay(2);
    const delay3 = backoff.calculateDelay(3);
    const delay4 = backoff.calculateDelay(4);

    // Intento 1 ~ 1.000 ms (con 5% de jitter: 950 - 1050 ms)
    expect(delay1).toBeGreaterThanOrEqual(900);
    expect(delay1).toBeLessThanOrEqual(1100);

    // Intento 2 ~ 2.000 ms
    expect(delay2).toBeGreaterThanOrEqual(1800);
    expect(delay2).toBeLessThanOrEqual(2200);

    // Intento 3 ~ 4.000 ms
    expect(delay3).toBeGreaterThanOrEqual(3700);
    expect(delay3).toBeLessThanOrEqual(4300);

    // Intento 4 ~ 8.000 ms
    expect(delay4).toBeGreaterThanOrEqual(7500);
    expect(delay4).toBeLessThanOrEqual(8500);

    // Intento 10: debe estar acotado por maxDelayMs (16.000 ms)
    const delayCapped = backoff.calculateDelay(10);
    expect(delayCapped).toBeLessThanOrEqual(17000);
  });

  test('2. Resiliencia ante caída de red: Incrementa intentos, programa reintento y no interrumpe el POS', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const user = sampleUsuario(ids.usuarioCajeroId, ids.tenantId, 'cajero');
    const prod = sampleProducto(ids.productoId, ids.tenantId);
    const saleId = createFixtureIds().ventaId;

    sqliteClient.execute('INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)', [tenant.id, tenant.nombre, tenant.estado]);
    sqliteClient.execute('INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?, ?)', [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);
    sqliteClient.execute(
      `INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta)
       VALUES (?, ?, ?, ?, 50.0, 500, 1000)`,
      [prod.id, prod.tenant_id, prod.sku, prod.nombre]
    );

    // Registrar venta offline
    sqliteClient.execute(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, is_dirty, sync_attempts, sync_status)
       VALUES (?, ?, ?, 'FOLIO-BACKOFF-01', 1000.0, 1.0, 'COMPLETADA', 1, 0, 'PENDING')`,
      [saleId, ids.tenantId, ids.usuarioCajeroId]
    );
    sqliteClient.execute(
      `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
       VALUES (?, ?, ?, 1.0, 1000.0, 1000.0)`,
      [createFixtureIds().detalleVentaId, saleId, prod.id]
    );

    // SIMULACIÓN 1: Corte total de red (Transport lanza error)
    const failTransport = async () => {
      throw new Error('ECONNREFUSED: No connection to Cloud SaaS endpoint');
    };

    const firstResult = await posEngine.syncPush(ids.tenantId, failTransport);

    expect(firstResult.success).toBe(false);
    expect(firstResult.failed_ids).toContain(saleId);

    // Verificar en SQLite que la venta sigue intacta pero con sync_attempts = 1 y sync_status = 'FAILED'
    const saleAfterFail1 = sqliteClient.queryOne<{ sync_attempts: number; sync_status: string; is_dirty: number }>(
      'SELECT sync_attempts, sync_status, is_dirty FROM transacciones_venta WHERE id = ?',
      [saleId]
    );
    expect(saleAfterFail1?.sync_attempts).toBe(1);
    expect(saleAfterFail1?.sync_status).toBe('FAILED');
    expect(saleAfterFail1?.is_dirty).toBe(1); // Mantiene bandera dirty para el próximo reintento

    // SIMULACIÓN 2: Segundo intento mientras la red sigue caída
    const secondResult = await posEngine.syncPush(ids.tenantId, failTransport);
    expect(secondResult.success).toBe(false);

    const saleAfterFail2 = sqliteClient.queryOne<{ sync_attempts: number; sync_status: string }>(
      'SELECT sync_attempts, sync_status FROM transacciones_venta WHERE id = ?',
      [saleId]
    );
    expect(saleAfterFail2?.sync_attempts).toBe(2);

    // SIMULACIÓN 3: Restauración de conexión (Transport exitoso)
    const successTransport = async () => ({
      success: true,
      synced_ids: [saleId],
      failed_ids: [],
      processed_at: new Date().toISOString(),
      message: 'Batch processed successfully after reconnection'
    });

    const recoveredResult = await posEngine.syncPush(ids.tenantId, successTransport);
    expect(recoveredResult.success).toBe(true);
    expect(recoveredResult.synced_ids).toContain(saleId);

    // Verificar en SQLite que el estado dirty se limpió y el contador de reintentos se reseteó a 0
    const saleAfterRecover = sqliteClient.queryOne<{ sync_attempts: number; sync_status: string; is_dirty: number }>(
      'SELECT sync_attempts, sync_status, is_dirty FROM transacciones_venta WHERE id = ?',
      [saleId]
    );
    expect(saleAfterRecover?.is_dirty).toBe(0);
    expect(saleAfterRecover?.sync_status).toBe('SYNCED');
    expect(saleAfterRecover?.sync_attempts).toBe(0);
  });
});
