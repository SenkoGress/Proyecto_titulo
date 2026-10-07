import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { postgresConfig } from '../../config/database.config';
import { logger } from '../../utils/logger';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Cliente de conexion a PostgreSQL Cloud con soporte de Circuit Breaker.
 * Disenado para sistemas Offline-First donde el nodo POS local no debe
 * bloquear su hilo de ejecucion ante caidas de la conexion con la nube.
 */
export class PostgresClient {
  private pool: Pool;
  private isExternalPool = false;

  private circuitState: CircuitBreakerState = 'CLOSED';
  private lastFailureTime = 0;
  private readonly cooldownPeriodMs = 30000;

  constructor(customPool?: Pool) {
    if (customPool) {
      this.pool = customPool;
      this.isExternalPool = true;
    } else if (postgresConfig.connectionString) {
      this.pool = new Pool({
        connectionString: postgresConfig.connectionString,
        ssl: postgresConfig.ssl ? { rejectUnauthorized: false } : false,
        max: postgresConfig.maxConnections,
        idleTimeoutMillis: postgresConfig.idleTimeoutMillis,
        connectionTimeoutMillis: postgresConfig.connectionTimeoutMillis
      });
    } else {
      this.pool = new Pool({
        host: postgresConfig.host,
        port: postgresConfig.port,
        user: postgresConfig.user,
        password: postgresConfig.password,
        database: postgresConfig.database,
        ssl: postgresConfig.ssl ? { rejectUnauthorized: false } : false,
        max: postgresConfig.maxConnections,
        idleTimeoutMillis: postgresConfig.idleTimeoutMillis,
        connectionTimeoutMillis: postgresConfig.connectionTimeoutMillis
      });
    }

    this.pool.on('error', (err) => {
      logger.error('PostgresClient', 'Error inesperado en pool inactivo de PostgreSQL', err);
      this.tripCircuit();
    });
  }

  private isNetworkError(err: unknown): boolean {
    if (!err) return false;
    const msg = String(err);
    const code = (err as any)?.code;
    return (
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT' ||
      code === 'ENOTFOUND' ||
      code === 'ECONNRESET' ||
      msg.includes('AggregateError') ||
      msg.includes('connection timeout') ||
      msg.includes('connect ECONNREFUSED')
    );
  }

  /**
   * Estado actual del Circuit Breaker.
   */
  public getCircuitState(): CircuitBreakerState {
    return this.circuitState;
  }

  /**
   * Indica si la nube esta disponible para consultas inmediatas.
   */
  public isCloudAvailable(): boolean {
    if (this.isExternalPool) {
      return true;
    }
    if (this.circuitState === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.cooldownPeriodMs) {
        return false;
      }
      this.circuitState = 'HALF_OPEN';
    }
    return true;
  }

  /**
   * Activa el estado OPEN tras un error de conectividad de red.
   */
  public tripCircuit(): void {
    if (this.isExternalPool) return;
    this.circuitState = 'OPEN';
    this.lastFailureTime = Date.now();
  }

  /**
   * Restablece manualmente el estado a CLOSED.
   */
  public resetCircuit(): void {
    this.circuitState = 'CLOSED';
    this.lastFailureTime = 0;
  }

  /**
   * Ejecuta una consulta SQL parametrizada respetando el estado del Circuit Breaker.
   */
  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    if (!this.isCloudAvailable() && this.circuitState === 'OPEN') {
      throw new Error('PostgreSQL Cloud no disponible (Circuit Breaker activo)');
    }

    const start = Date.now();
    try {
      const res = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      logger.debug('PostgresClient', 'Consulta ejecutada', { text, duration, rows: res.rowCount });
      this.circuitState = 'CLOSED';
      return res;
    } catch (error) {
      if (this.isNetworkError(error)) {
        this.tripCircuit();
      }
      logger.error('PostgresClient', 'Fallo al ejecutar consulta', error, { text, params });
      throw error;
    }
  }

  /**
   * Ejecuta una transaccion atomica respetando el estado del Circuit Breaker.
   */
  public async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    if (!this.isCloudAvailable() && this.circuitState === 'OPEN') {
      throw new Error('PostgreSQL Cloud no disponible para transacciones (Circuit Breaker activo)');
    }

    const client = await this.pool.connect();
    const start = Date.now();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      const duration = Date.now() - start;
      logger.debug('PostgresClient', 'Transaccion confirmada exitosamente', { duration });
      this.circuitState = 'CLOSED';
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      if (this.isNetworkError(error)) {
        this.tripCircuit();
      }
      logger.error('PostgresClient', 'Transaccion revertida por error', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Sonda de verificacion de conectividad con timeout rapido (1500 ms por defecto).
   * Si el Circuit Breaker esta en estado OPEN, responde de inmediato false (<1 ms).
   */
  public async healthCheck(probeTimeoutMs = 1500): Promise<boolean> {
    if (!this.isCloudAvailable()) {
      return false;
    }

    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('Timeout de sonda de conectividad PostgreSQL'));
      }, probeTimeoutMs);
    });

    try {
      const queryPromise = this.pool.query('SELECT 1 as alive');
      const res = await Promise.race([queryPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);
      this.circuitState = 'CLOSED';
      return res.rowCount !== null && res.rowCount > 0;
    } catch (error) {
      if (timer) clearTimeout(timer);
      this.tripCircuit();
      logger.warn('PostgresClient', 'Sonda de conectividad con PostgreSQL Cloud fallida', {
        motivo: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  public async close(): Promise<void> {
    if (!this.isExternalPool) {
      await this.pool.end();
      logger.info('PostgresClient', 'Conexiones de pool PostgreSQL cerradas');
    }
  }

  public getPool(): Pool {
    return this.pool;
  }

  public setPool(customPool: Pool): void {
    this.pool = customPool;
    this.isExternalPool = true;
    this.circuitState = 'CLOSED';
  }
}

export const defaultPgClient = new PostgresClient();
