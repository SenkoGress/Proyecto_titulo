import { v4 as uuidv4 } from 'uuid';
import { PostgresClient, defaultPgClient } from '../database/postgres/client';
import { defaultSqliteClient, SqliteClient } from '../database/sqlite/client';
import { logger } from '../utils/logger';

export class TenantConfigService {
  private pgClient: PostgresClient;
  private sqliteClient: SqliteClient;

  constructor(pg?: PostgresClient, sqlite?: SqliteClient) {
    this.pgClient = pg || defaultPgClient;
    this.sqliteClient = sqlite || defaultSqliteClient;
  }

  /**
   * Obtiene el porcentaje de margen de ganancia configurado para el tenant (por defecto 35%).
   */
  public async getProfitMargin(tenantId: string): Promise<number> {
    const DEFAULT_MARGIN = 35;

    // 1. Intentar leer desde SQLite local para baja latencia
    try {
      const sqliteRow = this.sqliteClient.queryOne<{ valor: string }>(
        "SELECT valor FROM configuracion_sistema WHERE tenant_id = ? AND clave = 'margen_ganancia_default'",
        [tenantId]
      );
      if (sqliteRow && sqliteRow.valor) {
        const parsed = parseFloat(sqliteRow.valor);
        if (!isNaN(parsed) && parsed >= 0) {
          return parsed;
        }
      }
    } catch {}

    // 2. Intentar leer desde PostgreSQL Cloud
    try {
      const pgRes = await this.pgClient.query<{ valor: string }>(
        "SELECT valor FROM configuracion_sistema WHERE tenant_id = $1 AND clave = 'margen_ganancia_default'",
        [tenantId]
      );
      if (pgRes.rows.length > 0) {
        const parsed = parseFloat(pgRes.rows[0].valor);
        if (!isNaN(parsed) && parsed >= 0) {
          return parsed;
        }
      }
    } catch (err) {
      logger.warn('TenantConfigService', 'Failed to read profit margin from cloud database', { err });
    }

    return DEFAULT_MARGIN;
  }

  /**
   * Actualiza el margen de ganancia predeterminado configurado por el Administrador.
   */
  public async setProfitMargin(tenantId: string, margin: number): Promise<number> {
    if (isNaN(margin) || margin < 0) {
      throw new Error('El margen de ganancia debe ser un número mayor o igual a 0');
    }

    const marginStr = margin.toString();

    // 1. Guardar en SQLite local
    try {
      this.sqliteClient.execute(
        `INSERT INTO configuracion_sistema (id, tenant_id, clave, valor, descripcion, actualizado_at)
         VALUES (?, ?, 'margen_ganancia_default', ?, 'Margen de ganancia comercial asignado por el admin (%)', datetime('now'))
         ON CONFLICT (tenant_id, clave) DO UPDATE SET valor = excluded.valor, actualizado_at = datetime('now')`,
        [uuidv4(), tenantId, marginStr]
      );
    } catch (sqliteErr) {
      logger.error('TenantConfigService', 'Error saving margin to SQLite', sqliteErr);
    }

    // 2. Guardar en PostgreSQL Cloud
    try {
      await this.pgClient.query(
        `INSERT INTO configuracion_sistema (id, tenant_id, clave, valor, descripcion, actualizado_at)
         VALUES ($1, $2, 'margen_ganancia_default', $3, 'Margen de ganancia comercial asignado por el admin (%)', now())
         ON CONFLICT (tenant_id, clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_at = now()`,
        [uuidv4(), tenantId, marginStr]
      );
    } catch (pgErr) {
      logger.warn('TenantConfigService', 'Error saving margin to Postgres Cloud', { error: String(pgErr) });
    }

    logger.info('TenantConfigService', `Profit margin updated to ${margin}% for tenant ${tenantId}`);
    return margin;
  }

  /**
   * Obtiene el correo electrónico configurado para recibir órdenes de compra
   */
  public async getOrderNotificationEmail(tenantId: string): Promise<string | null> {
    try {
      const row = this.sqliteClient.queryOne<{ valor: string }>(
        "SELECT valor FROM configuracion_sistema WHERE tenant_id = ? AND clave = 'email_notificaciones_pedidos'",
        [tenantId]
      );
      if (row && row.valor) return row.valor;
    } catch {}

    try {
      const pgRes = await this.pgClient.query<{ valor: string }>(
        "SELECT valor FROM configuracion_sistema WHERE tenant_id = $1 AND clave = 'email_notificaciones_pedidos'",
        [tenantId]
      );
      if (pgRes.rows.length > 0) return pgRes.rows[0].valor;
    } catch {}

    return null;
  }

  /**
   * Guarda el correo electrónico configurado para órdenes de compra
   */
  public async setOrderNotificationEmail(tenantId: string, email: string): Promise<string> {
    const cleanEmail = email.trim();
    if (!cleanEmail.includes('@')) {
      throw new Error('Debes ingresar una dirección de correo electrónico válida');
    }

    try {
      this.sqliteClient.execute(
        `INSERT INTO configuracion_sistema (id, tenant_id, clave, valor, descripcion, actualizado_at)
         VALUES (?, ?, 'email_notificaciones_pedidos', ?, 'Correo para envío automático de órdenes de compra', datetime('now'))
         ON CONFLICT (tenant_id, clave) DO UPDATE SET valor = excluded.valor, actualizado_at = datetime('now')`,
        [uuidv4(), tenantId, cleanEmail]
      );
    } catch {}

    try {
      await this.pgClient.query(
        `INSERT INTO configuracion_sistema (id, tenant_id, clave, valor, descripcion, actualizado_at)
         VALUES ($1, $2, 'email_notificaciones_pedidos', $3, 'Correo para envío automático de órdenes de compra', now())
         ON CONFLICT (tenant_id, clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_at = now()`,
        [uuidv4(), tenantId, cleanEmail]
      );
    } catch {}

    logger.info('TenantConfigService', `Order notification email updated to ${cleanEmail}`);
    return cleanEmail;
  }

  /**
   * Obtiene si el envío automático de órdenes de compra está habilitado
   */
  public async getAutoSendOrders(tenantId: string): Promise<boolean> {
    try {
      const row = this.sqliteClient.queryOne<{ valor: string }>(
        "SELECT valor FROM configuracion_sistema WHERE tenant_id = ? AND clave = 'auto_enviar_rop_email'",
        [tenantId]
      );
      if (row && row.valor !== undefined) return row.valor === 'true' || row.valor === '1';
    } catch {}
    return true; // Por defecto habilitado si hay correo configurado
  }

  /**
   * Configura la bandera de envío automático de órdenes
   */
  public async setAutoSendOrders(tenantId: string, enabled: boolean): Promise<boolean> {
    const val = enabled ? 'true' : 'false';
    try {
      this.sqliteClient.execute(
        `INSERT INTO configuracion_sistema (id, tenant_id, clave, valor, descripcion, actualizado_at)
         VALUES (?, ?, 'auto_enviar_rop_email', ?, 'Envío automático de órdenes de compra al detectar bajo stock', datetime('now'))
         ON CONFLICT (tenant_id, clave) DO UPDATE SET valor = excluded.valor, actualizado_at = datetime('now')`,
        [uuidv4(), tenantId, val]
      );
    } catch {}

    try {
      await this.pgClient.query(
        `INSERT INTO configuracion_sistema (id, tenant_id, clave, valor, descripcion, actualizado_at)
         VALUES ($1, $2, 'auto_enviar_rop_email', $3, 'Envío automático de órdenes de compra al detectar bajo stock', now())
         ON CONFLICT (tenant_id, clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_at = now()`,
        [uuidv4(), tenantId, val]
      );
    } catch {}

    return enabled;
  }
}

export const defaultTenantConfigService = new TenantConfigService();
