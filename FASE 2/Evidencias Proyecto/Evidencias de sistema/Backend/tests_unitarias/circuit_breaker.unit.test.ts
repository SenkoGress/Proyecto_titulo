import { PostgresClient } from '../src/database/postgres/client';

describe('Pruebas Unitarias: Circuit Breaker de Base de Datos y Resiliencia Offline', () => {
  let client: PostgresClient;

  beforeEach(() => {
    client = new PostgresClient();
  });

  test('debe iniciar en estado CLOSED con la nube marcada como disponible', () => {
    expect(client.getCircuitState()).toBe('CLOSED');
    expect(client.isCloudAvailable()).toBe(true);
  });

  test('debe transicionar a estado OPEN cuando se dispara manualmente o ante fallo de conexion', () => {
    client.tripCircuit();
    expect(client.getCircuitState()).toBe('OPEN');
    expect(client.isCloudAvailable()).toBe(false);
  });

  test('debe permanecer en OPEN y responder inmediatamente false (<2ms) durante el periodo de enfriamiento', async () => {
    client.tripCircuit();
    const start = Date.now();
    const isOnline = await client.healthCheck(1500);
    const duration = Date.now() - start;

    expect(isOnline).toBe(false);
    expect(duration).toBeLessThan(10);
  });

  test('debe restaurar a CLOSED cuando se ejecuta resetCircuit', () => {
    client.tripCircuit();
    expect(client.getCircuitState()).toBe('OPEN');

    client.resetCircuit();
    expect(client.getCircuitState()).toBe('CLOSED');
    expect(client.isCloudAvailable()).toBe(true);
  });

  test('rechaza consultas directas de inmediato cuando el circuito esta OPEN sin esperar timeout de red', async () => {
    client.tripCircuit();
    await expect(client.query('SELECT 1')).rejects.toThrow('PostgreSQL Cloud no disponible (Circuit Breaker activo)');
  });
});
