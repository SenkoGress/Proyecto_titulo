import { v4 as uuidv4 } from 'uuid';
import { PostgresClient, defaultPgClient } from '../database/postgres/client';
import { defaultSqliteClient, SqliteClient } from '../database/sqlite/client';
import { logger } from '../utils/logger';

export interface MovimientoCaja {
  id: string;
  tenant_id: string;
  sesion_caja_id: string;
  tipo: 'INGRESO' | 'EGRESO';
  monto: number;
  motivo: string;
  usuario_id?: string;
  created_at: string;
}

export interface SesionCaja {
  id: string;
  tenant_id: string;
  usuario_id: string;
  cajero_nombre?: string;
  fecha_apertura: string;
  fecha_cierre?: string | null;
  monto_apertura: number;
  ventas_efectivo: number;
  ventas_transbank: number;
  ventas_mercadopago: number;
  ventas_sumup: number;
  ventas_rutpay?: number;
  total_ila?: number;
  monto_ila?: number;
  total_ingresos_caja: number;
  total_egresos_caja: number;
  total_ventas: number;
  monto_esperado_efectivo: number;
  monto_real_efectivo?: number | null;
  diferencia_efectivo?: number | null;
  estado: 'ABIERTA' | 'CERRADA';
  observaciones?: string | null;
  transacciones_count?: number;
  movimientos?: MovimientoCaja[];
}

export class CierreCajaService {
  private pgClient: PostgresClient;
  private sqliteClient: SqliteClient;

  constructor(pg?: PostgresClient, sqlite?: SqliteClient) {
    this.pgClient = pg || defaultPgClient;
    this.sqliteClient = sqlite || defaultSqliteClient;
  }

  /**
   * Registra un movimiento de caja (retiro/gasto menor o ingreso de sencillo)
   */
  public async registrarMovimiento(
    tenantId: string,
    sesionId: string,
    tipo: 'INGRESO' | 'EGRESO',
    monto: number,
    motivo: string,
    usuarioId?: string
  ): Promise<MovimientoCaja> {
    if (isNaN(monto) || monto <= 0) {
      throw new Error('El monto del movimiento de caja debe ser mayor a 0');
    }
    if (!motivo || motivo.trim().length === 0) {
      throw new Error('Debe indicar un motivo para el movimiento de caja');
    }

    const movId = uuidv4();
    const fecha = new Date().toISOString();

    this.sqliteClient.execute(
      `INSERT INTO caja_movimientos (id, tenant_id, sesion_caja_id, tipo, monto, motivo, usuario_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [movId, tenantId, sesionId, tipo, monto, motivo.trim(), usuarioId || null]
    );

    try {
      await this.pgClient.query(
        `INSERT INTO caja_movimientos (id, tenant_id, sesion_caja_id, tipo, monto, motivo, usuario_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [movId, tenantId, sesionId, tipo, monto, motivo.trim(), usuarioId || null]
      );
    } catch {}

    logger.info('CierreCajaService', `Movimiento registrado: ${tipo} de $${monto} en sesión ${sesionId} (${motivo})`);

    return {
      id: movId,
      tenant_id: tenantId,
      sesion_caja_id: sesionId,
      tipo,
      monto,
      motivo,
      usuario_id: usuarioId,
      created_at: fecha
    };
  }

  /**
   * Obtiene los movimientos registrados para una sesión de caja
   */
  public obtenerMovimientos(sesionId: string): MovimientoCaja[] {
    try {
      return this.sqliteClient.query<MovimientoCaja>(
        `SELECT * FROM caja_movimientos WHERE sesion_caja_id = ? ORDER BY created_at ASC`,
        [sesionId]
      );
    } catch {
      return [];
    }
  }

  /**
   * Abre una nueva sesión de caja registrando el fondo inicial en efectivo.
   */
  public async abrirCaja(tenantId: string, usuarioId: string, montoApertura: number): Promise<SesionCaja> {
    if (isNaN(montoApertura) || montoApertura < 0) {
      throw new Error('El monto de apertura de caja debe ser mayor o igual a 0');
    }

    // Verificar si ya existe una caja abierta para este tenant
    const abiertaExistente = this.sqliteClient.queryOne<any>(
      "SELECT id FROM cierres_caja WHERE tenant_id = ? AND estado = 'ABIERTA' ORDER BY fecha_apertura DESC LIMIT 1",
      [tenantId]
    );

    if (abiertaExistente) {
      throw new Error('Ya existe un turno de caja abierto para este local. Debe cerrarse antes de abrir uno nuevo.');
    }

    const sesionId = uuidv4();
    const fechaApertura = new Date().toISOString();

    // 1. Guardar en SQLite local
    this.sqliteClient.execute(
      `INSERT INTO cierres_caja 
       (id, tenant_id, usuario_id, fecha_apertura, monto_apertura, ventas_efectivo, ventas_transbank, ventas_mercadopago, ventas_sumup, total_ventas, monto_esperado_efectivo, estado, is_dirty, sync_status)
       VALUES (?, ?, ?, datetime('now'), ?, 0, 0, 0, 0, 0, ?, 'ABIERTA', 1, 'PENDING')`,
      [sesionId, tenantId, usuarioId, montoApertura, montoApertura]
    );

    // 2. Espejo en PostgreSQL Cloud
    try {
      await this.pgClient.query(
        `INSERT INTO cierres_caja 
         (id, tenant_id, usuario_id, fecha_apertura, monto_apertura, ventas_efectivo, ventas_transbank, ventas_mercadopago, ventas_sumup, total_ventas, monto_esperado_efectivo, estado)
         VALUES ($1, $2, $3, now(), $4, 0, 0, 0, 0, 0, $5, 'ABIERTA')
         ON CONFLICT (id) DO NOTHING`,
        [sesionId, tenantId, usuarioId, montoApertura, montoApertura]
      );
    } catch (pgErr) {
      logger.warn('CierreCajaService', 'Failed to mirror cash opening to PostgreSQL Cloud, will sync later', { pgErr });
    }

    logger.info('CierreCajaService', `Cash session opened: ${sesionId} with $${montoApertura} initial cash`);

    return {
      id: sesionId,
      tenant_id: tenantId,
      usuario_id: usuarioId,
      fecha_apertura: fechaApertura,
      monto_apertura: montoApertura,
      ventas_efectivo: 0,
      ventas_transbank: 0,
      ventas_mercadopago: 0,
      ventas_sumup: 0,
      total_ingresos_caja: 0,
      total_egresos_caja: 0,
      total_ventas: 0,
      monto_esperado_efectivo: montoApertura,
      estado: 'ABIERTA',
      movimientos: []
    };
  }

  /**
   * Obtiene el balance y resumen en tiempo real del turno de caja actual.
   */
  public async obtenerResumenTurnoActual(tenantId: string): Promise<SesionCaja | null> {
    const sesion = this.sqliteClient.queryOne<any>(
      `SELECT c.*, u.nombre as cajero_nombre 
       FROM cierres_caja c
       LEFT JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.tenant_id = ? AND c.estado = 'ABIERTA' 
       ORDER BY c.fecha_apertura DESC LIMIT 1`,
      [tenantId]
    );

    if (!sesion) {
      return null;
    }

    // Consultar las ventas realizadas desde la fecha de apertura de esta sesión
    const ventas = this.sqliteClient.query<any>(
      `SELECT v.id, v.total, v.monto_ila, v.metodo_pago_id, mp.pasarela 
       FROM transacciones_venta v
       LEFT JOIN metodos_pago mp ON v.metodo_pago_id = mp.id
       WHERE v.tenant_id = ? AND v.estado IN ('COMPLETADA', 'PAGADA') AND v.fecha >= ?`,
      [tenantId, sesion.fecha_apertura]
    );

    let efectivo = 0;
    let transbank = 0;
    let mercadopago = 0;
    let sumup = 0;
    let rutpay = 0;
    let totalIla = 0;
    let total = 0;

    for (const v of ventas) {
      const monto = Number(v.total) || 0;
      total += monto;
      totalIla += Number(v.monto_ila) || 0;

      const pasarela = (v.pasarela || '').toUpperCase();
      if (pasarela === 'TRANSBANK') {
        transbank += monto;
      } else if (pasarela === 'MERCADOPAGO') {
        mercadopago += monto;
      } else if (pasarela === 'SUMUP') {
        sumup += monto;
      } else if (pasarela === 'RUTPAY') {
        rutpay += monto;
      } else if (pasarela === 'EFECTIVO' || !pasarela) {
        efectivo += monto;
      } else {
        // Cualquier otra pasarela electrónica no presencial se clasifica como digital
        rutpay += monto;
      }
    }

    // Consultar movimientos de caja registrados durante esta sesión
    const movimientos = this.obtenerMovimientos(sesion.id);
    let totalIngresos = 0;
    let totalEgresos = 0;

    for (const m of movimientos) {
      if (m.tipo === 'INGRESO') {
        totalIngresos += Number(m.monto) || 0;
      } else if (m.tipo === 'EGRESO') {
        totalEgresos += Number(m.monto) || 0;
      }
    }

    const montoApertura = Number(sesion.monto_apertura) || 0;
    const esperadoEfectivo = montoApertura + efectivo + totalIngresos - totalEgresos;

    return {
      id: sesion.id,
      tenant_id: sesion.tenant_id,
      usuario_id: sesion.usuario_id,
      cajero_nombre: sesion.cajero_nombre || 'Cajero en Turno',
      fecha_apertura: sesion.fecha_apertura,
      fecha_cierre: null,
      monto_apertura: montoApertura,
      ventas_efectivo: efectivo,
      ventas_transbank: transbank,
      ventas_mercadopago: mercadopago,
      ventas_sumup: sumup,
      ventas_rutpay: rutpay,
      total_ila: totalIla,
      monto_ila: totalIla,
      total_ingresos_caja: totalIngresos,
      total_egresos_caja: totalEgresos,
      total_ventas: total,
      monto_esperado_efectivo: esperadoEfectivo,
      estado: 'ABIERTA',
      transacciones_count: ventas.length,
      movimientos
    };
  }

  /**
   * Ejecuta el Arqueo y Cierre de Caja (Balance Z) comparando el efectivo real contado con el esperado.
   */
  public async cerrarCaja(
    tenantId: string,
    usuarioId: string,
    montoRealEfectivo: number,
    observaciones?: string
  ): Promise<SesionCaja> {
    const resumen = await this.obtenerResumenTurnoActual(tenantId);
    if (!resumen) {
      throw new Error('No hay ninguna sesión de caja abierta actualmente para cerrar');
    }

    if (isNaN(montoRealEfectivo) || montoRealEfectivo < 0) {
      throw new Error('El monto real contado en efectivo debe ser un número válido');
    }

    // Diferencia: Positivo = Sobrante, Negativo = Faltante, 0 = Cuadrada
    const diferencia = montoRealEfectivo - resumen.monto_esperado_efectivo;
    const fechaCierre = new Date().toISOString();

    // 1. Actualizar en SQLite local
    this.sqliteClient.execute(
      `UPDATE cierres_caja 
       SET fecha_cierre = datetime('now'),
           ventas_efectivo = ?,
           ventas_transbank = ?,
           ventas_mercadopago = ?,
           ventas_sumup = ?,
           total_ventas = ?,
           monto_esperado_efectivo = ?,
           monto_real_efectivo = ?,
           diferencia_efectivo = ?,
           estado = 'CERRADA',
           observaciones = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [
        resumen.ventas_efectivo,
        resumen.ventas_transbank,
        resumen.ventas_mercadopago,
        resumen.ventas_sumup,
        resumen.total_ventas,
        resumen.monto_esperado_efectivo,
        montoRealEfectivo,
        diferencia,
        observaciones || null,
        resumen.id
      ]
    );

    // 2. Espejo en PostgreSQL Cloud
    try {
      await this.pgClient.query(
        `UPDATE cierres_caja 
         SET fecha_cierre = now(),
             ventas_efectivo = $1,
             ventas_transbank = $2,
             ventas_mercadopago = $3,
             ventas_sumup = $4,
             total_ventas = $5,
             monto_esperado_efectivo = $6,
             monto_real_efectivo = $7,
             diferencia_efectivo = $8,
             estado = 'CERRADA',
             observaciones = $9,
             updated_at = now()
         WHERE id = $10`,
        [
          resumen.ventas_efectivo,
          resumen.ventas_transbank,
          resumen.ventas_mercadopago,
          resumen.ventas_sumup,
          resumen.total_ventas,
          resumen.monto_esperado_efectivo,
          montoRealEfectivo,
          diferencia,
          observaciones || null,
          resumen.id
        ]
      );
    } catch (pgErr) {
      logger.warn('CierreCajaService', 'Failed to update cash closing in PostgreSQL Cloud', { pgErr });
    }

    logger.info(
      'CierreCajaService',
      `Cash closing Z completed for session ${resumen.id}. Expected: $${resumen.monto_esperado_efectivo}, Real: $${montoRealEfectivo}, Diff: $${diferencia}`
    );

    return {
      ...resumen,
      fecha_cierre: fechaCierre,
      monto_real_efectivo: montoRealEfectivo,
      diferencia_efectivo: diferencia,
      estado: 'CERRADA',
      observaciones: observaciones || null
    };
  }

  /**
   * Obtiene el historial de todos los cierres de caja realizados.
   */
  public async obtenerHistorialCierres(tenantId: string): Promise<SesionCaja[]> {
    try {
      const rows = this.sqliteClient.query<any>(
        `SELECT c.*, u.nombre as cajero_nombre 
         FROM cierres_caja c
         LEFT JOIN usuarios u ON c.usuario_id = u.id
         WHERE c.tenant_id = ?
         ORDER BY c.fecha_apertura DESC LIMIT 50`,
        [tenantId]
      );
      return rows;
    } catch {
      return [];
    }
  }
}

export const defaultCierreCajaService = new CierreCajaService();
