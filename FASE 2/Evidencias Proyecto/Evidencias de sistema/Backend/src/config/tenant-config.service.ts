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

  /**
   * Dia de la semana del aviso automatico, en norma ISO: 1 lunes, 7 domingo. Es la misma
   * convencion que ya usan los dias de visita de proveedor.
   */
  public async getDiaEnvio(tenantId: string): Promise<number> {
    try {
      const row = this.sqliteClient.queryOne<{ valor: string }>(
        "SELECT valor FROM configuracion_sistema WHERE tenant_id = ? AND clave = 'dia_envio_rop_email'",
        [tenantId]
      );
      const dia = Number(row?.valor);
      if (dia >= 1 && dia <= 7) return dia;
    } catch {}
    return 1;
  }

  /** Hora del aviso en formato de 24 horas, HH:MM. */
  public async getHoraEnvio(tenantId: string): Promise<string> {
    try {
      const row = this.sqliteClient.queryOne<{ valor: string }>(
        "SELECT valor FROM configuracion_sistema WHERE tenant_id = ? AND clave = 'hora_envio_rop_email'",
        [tenantId]
      );
      if (row?.valor && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.valor)) return row.valor;
    } catch {}
    return '08:00';
  }

  public async setHorarioEnvio(
    tenantId: string,
    dia?: number | string,
    hora?: string
  ): Promise<{ dia_envio: number; hora_envio: string }> {
    if (dia !== undefined && dia !== null && dia !== '') {
      const valor = Number(dia);
      if (!Number.isInteger(valor) || valor < 1 || valor > 7) {
        throw new Error('dia_envio debe ser un numero entre 1 y 7, donde 1 es lunes');
      }
      await this.guardarClave(tenantId, 'dia_envio_rop_email', String(valor),
        'Dia de la semana del aviso automatico de reposicion (1 lunes, 7 domingo)');
    }

    if (hora !== undefined && hora !== null && hora !== '') {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
        throw new Error('hora_envio debe tener el formato HH:MM en 24 horas');
      }
      await this.guardarClave(tenantId, 'hora_envio_rop_email', hora,
        'Hora del aviso automatico de reposicion, en formato de 24 horas');
    }

    return { dia_envio: await this.getDiaEnvio(tenantId), hora_envio: await this.getHoraEnvio(tenantId) };
  }

  /**
   * Fecha del ultimo aviso automatico despachado, en formato YYYY-MM-DD, o cadena vacia si
   * nunca se envio. Sirve para no repetir el aviso si el proceso se reinicia el mismo dia.
   */
  public async getUltimoAvisoEnviado(tenantId: string): Promise<string> {
    try {
      const row = this.sqliteClient.queryOne<{ valor: string }>(
        "SELECT valor FROM configuracion_sistema WHERE tenant_id = ? AND clave = 'ultimo_aviso_rop_email'",
        [tenantId]
      );
      return row?.valor || '';
    } catch {
      return '';
    }
  }

  public async marcarAvisoEnviado(tenantId: string, fecha: string): Promise<void> {
    await this.guardarClave(tenantId, 'ultimo_aviso_rop_email', fecha,
      'Fecha del ultimo aviso automatico de reposicion despachado');
  }

  /** Guarda una clave de configuracion en los dos motores, sin que uno impida al otro. */
  private async guardarClave(tenantId: string, clave: string, valor: string, descripcion: string): Promise<void> {
    try {
      this.sqliteClient.execute(
        `INSERT INTO configuracion_sistema (id, tenant_id, clave, valor, descripcion, actualizado_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT (tenant_id, clave) DO UPDATE SET valor = excluded.valor, actualizado_at = datetime('now')`,
        [uuidv4(), tenantId, clave, valor, descripcion]
      );
    } catch (err) {
      logger.warn('TenantConfigService', 'No se pudo guardar la configuracion en el nodo local', {
        clave,
        error: err instanceof Error ? err.message : String(err)
      });
    }

    try {
      await this.pgClient.query(
        `INSERT INTO configuracion_sistema (id, tenant_id, clave, valor, descripcion, actualizado_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (tenant_id, clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_at = now()`,
        [uuidv4(), tenantId, clave, valor, descripcion]
      );
    } catch (err) {
      logger.warn('TenantConfigService', 'No se pudo guardar la configuracion en la nube', {
        clave,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

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
