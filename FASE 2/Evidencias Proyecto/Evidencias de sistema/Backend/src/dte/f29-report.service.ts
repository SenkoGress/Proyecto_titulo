// ============================================================================
// GesTock F29 Monthly Report Service (Pre-Liquidación Mensual de Impuestos)
// D.L. N° 825, Res. Ex. N° 176 y Ley N° 20.727
// ============================================================================

import { defaultSqliteClient } from '../database/sqlite/client';
import { logger } from '../utils/logger';
import { F29Statement, ResumenF29Item } from './types';

export class F29ReportService {
  /**
   * Genera la pre-liquidación mensual del Formulario 29 para un tenant y periodo (YYYY-MM).
   */
  public generateMonthlyF29(tenantId: string, periodo: string, tasaPpm = 1.0): F29Statement {
    // Normalizar periodo a formato YYYY-MM
    const match = periodo.match(/^(\d{4})-(\d{2})/);
    const targetMonth = match ? `${match[1]}-${match[2]}` : new Date().toISOString().substring(0, 7);

    logger.info('F29ReportService', `Generando pre-liquidación F29 para tenant ${tenantId}, periodo ${targetMonth}`);

    // 1. DÉBITO FISCAL (VENTAS): DTEs Emitidos en el periodo
    const dtes = defaultSqliteClient.query<any>(
      `SELECT tipo_dte, monto_neto, monto_iva, monto_total, monto_ila 
       FROM sii_dte_emitidos 
       WHERE tenant_id = ? AND strftime('%Y-%m', fecha_emision) = ? AND estado_sii != 'ANULADO'`,
      [tenantId, targetMonth]
    );

    let boletasCount = 0;
    let boletasNeto = 0;
    let boletasIva = 0;
    let boletasTotal = 0;
    let boletasIla = 0;

    let facturasCount = 0;
    let facturasNeto = 0;
    let facturasIva = 0;
    let facturasTotal = 0;

    let ncCount = 0;
    let ncNeto = 0;
    let ncIva = 0;
    let ncTotal = 0;

    for (const d of dtes) {
      const neto = Number(d.monto_neto) || 0;
      const iva = Number(d.monto_iva) || 0;
      const total = Number(d.monto_total) || 0;
      const ila = Number(d.monto_ila) || 0;

      if (d.tipo_dte === 39 || d.tipo_dte === 41) {
        boletasCount++;
        boletasNeto += neto;
        boletasIva += iva;
        boletasTotal += total;
        boletasIla += ila;
      } else if (d.tipo_dte === 33 || d.tipo_dte === 34) {
        facturasCount++;
        facturasNeto += neto;
        facturasIva += iva;
        facturasTotal += total;
      } else if (d.tipo_dte === 61) {
        ncCount++;
        ncNeto += neto;
        ncIva += iva;
        ncTotal += total;
      }
    }

    // 2. Vouchers de Tarjeta (Res. Ex. N° 176) que reemplazan boleta
    const vouchers = defaultSqliteClient.query<any>(
      `SELECT total FROM transacciones_venta 
       WHERE tenant_id = ? 
         AND tipo_documento_tributario = 'VOUCHER_TRANSBANK'
         AND estado IN ('COMPLETADA', 'PAGADA')
         AND strftime('%Y-%m', fecha) = ?`,
      [tenantId, targetMonth]
    );

    let vouchersCount = vouchers.length;
    let vouchersTotal = 0;
    let vouchersNeto = 0;
    let vouchersIva = 0;

    for (const v of vouchers) {
      const t = Number(v.total) || 0;
      const n = Math.round(t / 1.19);
      const i = t - n;
      vouchersTotal += t;
      vouchersNeto += n;
      vouchersIva += i;
    }

    const debitoItems: ResumenF29Item[] = [
      {
        tipoDocumento: 'Boletas Electrónicas (Tipo 39)',
        tipoDte: 39,
        cantidad: boletasCount,
        montoNeto: boletasNeto,
        montoIva: boletasIva,
        montoTotal: boletasTotal
      },
      {
        tipoDocumento: 'Facturas Electrónicas Emitidas (Tipo 33)',
        tipoDte: 33,
        cantidad: facturasCount,
        montoNeto: facturasNeto,
        montoIva: facturasIva,
        montoTotal: facturasTotal
      },
      {
        tipoDocumento: 'Vouchers Tarjetas / POS (Res. Ex. N° 176)',
        cantidad: vouchersCount,
        montoNeto: vouchersNeto,
        montoIva: vouchersIva,
        montoTotal: vouchersTotal
      }
    ];

    if (ncCount > 0) {
      debitoItems.push({
        tipoDocumento: 'Notas de Crédito Emitidas (Resta Débito - Tipo 61)',
        tipoDte: 61,
        cantidad: ncCount,
        montoNeto: -ncNeto,
        montoIva: -ncIva,
        montoTotal: -ncTotal
      });
    }

    const totalVentasNeto = boletasNeto + facturasNeto + vouchersNeto - ncNeto;
    const totalIvaDebito = boletasIva + facturasIva + vouchersIva - ncIva;
    const totalVentasBruto = boletasTotal + facturasTotal + vouchersTotal - ncTotal;
    const totalIla = boletasIla;

    // 3. CRÉDITO FISCAL (COMPRAS): Facturas de proveedores respaldadas en factura_ingresos
    const compras = defaultSqliteClient.query<any>(
      `SELECT total, fecha_ingreso 
       FROM factura_ingresos 
       WHERE tenant_id = ? AND strftime('%Y-%m', fecha_ingreso) = ?`,
      [tenantId, targetMonth]
    );

    let comprasCount = compras.length;
    let comprasNeto = 0;
    let comprasIva = 0;
    let comprasTotal = 0;

    for (const c of compras) {
      const tot = Number(c.total) || 0;
      const net = Math.round(tot / 1.19);
      const iv = tot - net;
      comprasTotal += tot;
      comprasNeto += net;
      comprasIva += iv;
    }

    const creditoItems: ResumenF29Item[] = [
      {
        tipoDocumento: 'Facturas de Compra Proveedores (Crédito Fiscal)',
        tipoDte: 33,
        cantidad: comprasCount,
        montoNeto: comprasNeto,
        montoIva: comprasIva,
        montoTotal: comprasTotal
      }
    ];

    // 4. BALANCE Y DETERMINACIÓN DE IMPUESTO
    const ivaDiferencia = totalIvaDebito - comprasIva;
    const ivaDeterminadoAPagar = Math.max(0, ivaDiferencia);
    const remanenteCreditoFiscal = ivaDiferencia < 0 ? Math.abs(ivaDiferencia) : 0;

    // PPM: Pago Provisional Mensual = % sobre ventas netas
    const montoPpm = Math.max(0, Math.round(totalVentasNeto * (tasaPpm / 100)));
    const totalImpuestoPagarF29 = ivaDeterminadoAPagar + montoPpm + totalIla;

    return {
      periodo: targetMonth,
      tenantId,
      debitoFiscal: {
        items: debitoItems,
        totalNeto: totalVentasNeto,
        totalIvaDebito,
        totalIla,
        totalBruto: totalVentasBruto
      },
      creditoFiscal: {
        items: creditoItems,
        totalNeto: comprasNeto,
        totalIvaCredito: comprasIva,
        totalBruto: comprasTotal
      },
      balance: {
        ivaDeterminadoAPagar,
        remanenteCreditoFiscal,
        tasaPpm,
        montoPpm,
        totalImpuestoPagarF29
      }
    };
  }
}

export const defaultF29ReportService = new F29ReportService();
