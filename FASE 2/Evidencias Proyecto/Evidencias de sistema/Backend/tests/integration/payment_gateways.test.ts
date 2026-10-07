import { PostgresClient } from '../../src/database/postgres/client';
import { PaymentDispatcherService } from '../../src/payments/payment-dispatcher.service';
import { createTestPostgresClient } from '../helpers/db-test-helper';
import {
  createFixtureIds,
  sampleMetodoPago,
  sampleProducto,
  sampleTenant,
  sampleUsuario
} from '../helpers/fixtures';

describe('External Payment Gateways & Offline Contingency Fallback', () => {
  let pgClient: PostgresClient;
  let dispatcher: PaymentDispatcherService;

  beforeAll(async () => {
    const pgSetup = await createTestPostgresClient();
    pgClient = pgSetup.client;
    dispatcher = new PaymentDispatcherService(pgClient);
  });

  afterAll(async () => {
    await pgClient.close();
  });

  test('1. Flujo completo Transbank Webpay: Inicia, confirma y persiste transacción en <200ms', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const user = sampleUsuario(ids.usuarioCajeroId, ids.tenantId);
    const prod = sampleProducto(ids.productoId, ids.tenantId);
    const saleId = createFixtureIds().ventaId;

    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
    await pgClient.query(`INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5, $6)`, [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);
    await pgClient.query(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, sync_status)
       VALUES ($1, $2, $3, 'FOLIO-TBK-01', 5990.0, 2.0, 'COMPLETADA', 'SYNCED')`,
      [saleId, ids.tenantId, user.id]
    );

    const startTime = Date.now();

    // 1. Iniciar pago con Transbank
    const initRes = await dispatcher.initiatePayment({
      saleId,
      tenantId: ids.tenantId,
      amount: 5990.0,
      gateway: 'Transbank'
    });

    expect(initRes.token).toBeDefined();
    expect(initRes.gateway).toBe('Transbank');
    expect(initRes.usedFallback).toBe(false);

    // 2. Confirmar pago
    const confirmRes = await dispatcher.confirmPayment({
      token: initRes.token,
      saleId,
      tenantId: ids.tenantId,
      gateway: 'Transbank'
    });

    const duration = Date.now() - startTime;

    // Validación de latencia < 200ms
    expect(duration).toBeLessThan(200);

    expect(confirmRes.status).toBe('APPROVED');
    expect(confirmRes.amount).toBe(5990.0);
    expect(confirmRes.gateway).toBe('Transbank');
    expect(confirmRes.usedFallback).toBe(false);

    // 3. Verificar persistencia en payment_transactions
    const txRow = await pgClient.query<{ id: string; pasarela: string; monto: string; estado_transaccion: string }>(
      'SELECT id, pasarela, monto, estado_transaccion FROM payment_transactions WHERE sale_id = $1',
      [saleId]
    );
    expect(txRow.rows.length).toBe(1);
    expect(txRow.rows[0].pasarela).toBe('Transbank');
    expect(Number(txRow.rows[0].monto)).toBe(5990.0);
    expect(txRow.rows[0].estado_transaccion).toBe('APPROVED');

    // 4. Verificar que la venta cambió a PAGADA
    const saleRow = await pgClient.query<{ estado: string }>(
      'SELECT estado FROM transacciones_venta WHERE id = $1',
      [saleId]
    );
    expect(saleRow.rows[0].estado).toBe('PAGADA');
  });

  test('2. Pagos con MercadoPago y SumUp completan con estado APPROVED', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const user = sampleUsuario(ids.usuarioCajeroId, ids.tenantId);

    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
    await pgClient.query(`INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5, $6)`, [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);

    // Prueba MercadoPago
    const saleIdMp = createFixtureIds().ventaId;
    await pgClient.query(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, sync_status)
       VALUES ($1, $2, $3, 'FOLIO-MP-01', 12000.0, 3.0, 'COMPLETADA', 'SYNCED')`,
      [saleIdMp, ids.tenantId, user.id]
    );

    const initMp = await dispatcher.initiatePayment({ saleId: saleIdMp, tenantId: ids.tenantId, amount: 12000.0, gateway: 'MercadoPago' });
    const confirmMp = await dispatcher.confirmPayment({ token: initMp.token, saleId: saleIdMp, tenantId: ids.tenantId, gateway: 'MercadoPago' });
    expect(confirmMp.status).toBe('APPROVED');
    expect(confirmMp.gateway).toBe('MercadoPago');

    // Prueba SumUp
    const saleIdSumUp = createFixtureIds().ventaId;
    await pgClient.query(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, sync_status)
       VALUES ($1, $2, $3, 'FOLIO-SUMUP-01', 3500.0, 1.0, 'COMPLETADA', 'SYNCED')`,
      [saleIdSumUp, ids.tenantId, user.id]
    );

    const initSumUp = await dispatcher.initiatePayment({ saleId: saleIdSumUp, tenantId: ids.tenantId, amount: 3500.0, gateway: 'SumUp' });
    const confirmSumUp = await dispatcher.confirmPayment({ token: initSumUp.token, saleId: saleIdSumUp, tenantId: ids.tenantId, gateway: 'SumUp' });
    expect(confirmSumUp.status).toBe('APPROVED');
    expect(confirmSumUp.gateway).toBe('SumUp');
  });

  test('3. Degradación Elegante Fallo de pasarela externa activa inmediatamente voucher offline sin bloquear la caja', async () => {
    const ids = createFixtureIds();
    const tenant = sampleTenant(ids.tenantId);
    const user = sampleUsuario(ids.usuarioCajeroId, ids.tenantId);
    const saleId = createFixtureIds().ventaId;

    await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
    await pgClient.query(`INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5, $6)`, [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);
    await pgClient.query(
      `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, sync_status)
       VALUES ($1, $2, $3, 'FOLIO-OFFLINE-FAILOVER', 8500.0, 2.0, 'COMPLETADA', 'SYNCED')`,
      [saleId, ids.tenantId, user.id]
    );

    // Inducir caída en Transbank durante confirmación (simulando timeout 503)
    const initRes = await dispatcher.initiatePayment({
      saleId,
      tenantId: ids.tenantId,
      amount: 8500.0,
      gateway: 'Transbank'
    });

    const confirmFallback = await dispatcher.confirmPayment({
      token: initRes.token,
      saleId,
      tenantId: ids.tenantId,
      gateway: 'Transbank',
      simulateFailure: true // Activa fallo simulado de pasarela
    });

    // La operación se rescata con el Mock Gateway de contingencia
    expect(confirmFallback.usedFallback).toBe(true);
    expect(confirmFallback.status).toBe('APPROVED');
    expect(confirmFallback.authorizationCode).toBe('OFFLINE-CONTINGENCY-AUTH');

    // Verificar que en payment_transactions quedó registrada la transacción de contingencia
    const savedFallback = await pgClient.query<{ pasarela: string; monto: string }>(
      'SELECT pasarela, monto FROM payment_transactions WHERE sale_id = $1',
      [saleId]
    );
    expect(savedFallback.rows.length).toBe(1);
    expect(savedFallback.rows[0].pasarela).toBe('MockGateway');
    expect(Number(savedFallback.rows[0].monto)).toBe(8500.0);
  });
});
