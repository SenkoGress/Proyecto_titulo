import { v4 as uuidv4 } from 'uuid';
import { aplicarRedondeoChileno, calcularPrecioVenta, desglosarIvaChileno } from '../../src/utils/pricing';
import { defaultCierreCajaService } from '../../src/caja/cierre-caja.service';
import { defaultTenantConfigService } from '../../src/config/tenant-config.service';
import { defaultSqliteClient } from '../../src/database/sqlite/client';

import { initializeDatabase } from '../../src/database/init-db';

describe('Pricing Rounding Law, Admin Margin & Cash Closing (Balance Z)', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const usuarioId = '00000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    await initializeDatabase();
  });

  describe('1. Ley de Redondeo Chilena (Ley N° 20.956) y Fijación de Precios', () => {
    it('debe redondear hacia abajo a la decena si el último dígito termina en 1, 2, 3 o 4', () => {
      expect(aplicarRedondeoChileno(1621)).toBe(1620);
      expect(aplicarRedondeoChileno(1622)).toBe(1620);
      expect(aplicarRedondeoChileno(1623)).toBe(1620);
      expect(aplicarRedondeoChileno(1624)).toBe(1620);
      expect(aplicarRedondeoChileno(994)).toBe(990);
    });

    it('debe redondear hacia arriba a la decena si el último dígito termina en 5, 6, 7, 8 o 9', () => {
      expect(aplicarRedondeoChileno(1625)).toBe(1630);
      expect(aplicarRedondeoChileno(1626)).toBe(1630);
      expect(aplicarRedondeoChileno(1627)).toBe(1630);
      expect(aplicarRedondeoChileno(1628)).toBe(1630);
      expect(aplicarRedondeoChileno(1629)).toBe(1630);
      expect(aplicarRedondeoChileno(995)).toBe(1000);
    });

    it('debe conservar el valor exacto si termina en 0', () => {
      expect(aplicarRedondeoChileno(1620)).toBe(1620);
      expect(aplicarRedondeoChileno(5000)).toBe(5000);
    });

    it('debe calcular el precio de venta comercial con margen configurable y redondeo legal', () => {
      // Costo $1.200 con margen 35%: 1200 * 1.35 = 1620
      expect(calcularPrecioVenta(1200, 35)).toBe(1620);
      // Costo $833 con margen 40%: 833 * 1.40 = 1166.2 -> Redondeo chileno a la decena: 1170
      expect(calcularPrecioVenta(833, 40)).toBe(1170);
      // Costo $1.002 con margen 25%: 1002 * 1.25 = 1252.5 -> Redondeo chileno: 1250
      expect(calcularPrecioVenta(1002, 25)).toBe(1250);
    });

    it('debe desglosar correctamente el IVA Crédito/Débito del 19% en facturas', () => {
      // Total $119.000 -> Neto $100.000 + IVA $19.000
      const tax = desglosarIvaChileno(119000);
      expect(tax.neto).toBe(100000);
      expect(tax.iva).toBe(19000);
      expect(tax.total).toBe(119000);
    });
  });

  describe('2. Margen de Ganancia Configurable por Administrador', () => {
    it('debe guardar y recuperar el margen de ganancia asignado por el admin', async () => {
      await defaultTenantConfigService.setProfitMargin(tenantId, 45);
      const retrieved = await defaultTenantConfigService.getProfitMargin(tenantId);
      expect(retrieved).toBe(45);

      // Reestablecer a 35% para no alterar tests subsiguientes
      await defaultTenantConfigService.setProfitMargin(tenantId, 35);
      expect(await defaultTenantConfigService.getProfitMargin(tenantId)).toBe(35);
    });
  });

  describe('3. Módulo de Cierre de Caja (Arqueo y Balance Z)', () => {
    it('debe gestionar el ciclo de vida completo de un turno de caja', async () => {
      // 1. Limpiar sesiones abiertas previas para este tenant en el test
      defaultSqliteClient.execute(
        "UPDATE cierres_caja SET estado = 'CERRADA' WHERE tenant_id = ? AND estado = 'ABIERTA'",
        [tenantId]
      );

      // 2. Abrir caja con fondo de $30.000
      const fondoInicial = 30000;
      const sesion = await defaultCierreCajaService.abrirCaja(tenantId, usuarioId, fondoInicial);
      expect(sesion.estado).toBe('ABIERTA');
      expect(sesion.monto_apertura).toBe(fondoInicial);
      expect(sesion.monto_esperado_efectivo).toBe(fondoInicial);

      // 3. Simular una venta en efectivo de $5.000 realizada en el turno
      const ventaId = uuidv4();
      defaultSqliteClient.execute(
        `INSERT INTO transacciones_venta 
         (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, metodo_pago_id, is_dirty, sync_status, fecha)
         VALUES (?, ?, ?, 'FOLIO-TEST-CAJA', 5000, 1, 'COMPLETADA', '11111111-0000-0000-0000-000000000001', 0, 'SYNCED', datetime('now'))`,
        [ventaId, tenantId, usuarioId]
      );

      // 4. Obtener resumen del turno actual
      const resumen = await defaultCierreCajaService.obtenerResumenTurnoActual(tenantId);
      expect(resumen).not.toBeNull();
      expect(resumen?.ventas_efectivo).toBeGreaterThanOrEqual(5000);
      expect(resumen?.monto_esperado_efectivo).toBe(fondoInicial + (resumen?.ventas_efectivo || 0));

      // 5. Cerrar caja: Se cuenta el efectivo real (ej. $35.000 -> Cuadrada)
      const montoRealContado = resumen?.monto_esperado_efectivo || 35000;
      const cierre = await defaultCierreCajaService.cerrarCaja(
        tenantId,
        usuarioId,
        montoRealContado,
        'Cierre de turno normal test'
      );

      expect(cierre.estado).toBe('CERRADA');
      expect(cierre.diferencia_efectivo).toBe(0); // Cuadratura exacta

      // 6. Verificar que el historial registre la sesión cerrada
      const historial = await defaultCierreCajaService.obtenerHistorialCierres(tenantId);
      expect(historial.length).toBeGreaterThan(0);
      expect(historial[0].estado).toBe('CERRADA');
    });
  });
});
