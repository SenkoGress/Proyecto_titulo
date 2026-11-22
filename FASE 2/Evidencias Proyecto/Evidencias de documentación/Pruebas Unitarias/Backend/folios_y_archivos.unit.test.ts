import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { defaultSqliteClient } from '../../backend/src/database/sqlite/client';
import { defaultPgClient } from '../../backend/src/database/postgres/client';
import { initializeDatabase } from '../../backend/src/database/init-db';
import { defaultCafManager } from '../../backend/src/dte/caf-manager.service';
import { defaultDteEmitter } from '../../backend/src/dte/dte-emitter.service';
import { defaultRcofService } from '../../backend/src/dte/rcof.service';
import { defaultF29ReportService } from '../../backend/src/dte/f29-report.service';
import { defaultSiiCertification } from '../../backend/src/dte/sii-certification.service';
import { defaultSiiEnvio } from '../../backend/src/dte/sii-envio.service';
import { TipoDTE } from '../../backend/src/dte/types';
import { InvoiceFileStore } from '../../backend/src/invoices/invoice-file.store';
import { fechaLocal } from '../../backend/src/utils/fecha-local';

const TENANT = '00000000-0000-0000-0000-000000000001';

const boleta = () => defaultDteEmitter.emitDocument({
  tenantId: TENANT,
  tipoDte: TipoDTE.BOLETA_ELECTRONICA,
  metodoPago: 'EFECTIVO',
  items: [{ nroLinea: 1, nombre: 'Pan amasado', cantidad: 1, precioUnitario: 1190, subtotal: 1190 }]
});

/** Un CAF con la forma del que entrega el SII, con su propia llave para timbrar. */
function cafDelSii(tipo: number, desde: number, hasta: number): string {
  const claves = crypto.generateKeyPairSync('rsa', {
    modulusLength: 1024,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });
  return [
    '<AUTORIZACION><CAF version="1.0"><DA>',
    `<RE>76123456-0</RE><RS>ALMACEN DE PRUEBA SPA</RS><TD>${tipo}</TD>`,
    `<RNG><D>${desde}</D><H>${hasta}</H></RNG><FA>2026-11-22</FA>`,
    '<RSAPK><M>AQAB</M><E>Aw==</E></RSAPK><IDK>100</IDK></DA>',
    '<FRMA algoritmo="SHA1withRSA">QUJD</FRMA></CAF>',
    `<RSASK>${claves.privateKey}</RSASK></AUTORIZACION>`
  ].join('');
}

const contar = (sql: string, params: unknown[]) => Number(defaultSqliteClient.queryOne<{ n: number }>(sql, params)?.n ?? 0);

/**
 * La revision del 22-11 encontro que el set de prueba escribia documentos reales en los libros,
 * que el CAF del SII chocaba con los folios provisionales ya emitidos y quemaba folios, que el
 * RCOF contaba en UTC, y que la ruta del documento de una factura podia salir de su carpeta.
 */
describe('Pruebas Unitarias: Folios, set de prueba, fecha del RCOF y archivos de facturas', () => {
  beforeAll(async () => {
    defaultPgClient.tripCircuit();
    await initializeDatabase();
  });

  test('el set de prueba deja sus documentos anulados: fuera de la cola, del RCOF y del F29', async () => {
    const pendientesAntes = defaultSiiEnvio.documentosPendientes(TENANT).length;
    const resultado = await defaultSiiCertification.runFullCertificationSuite(TENANT);

    expect(resultado.success).toBe(true);
    expect(resultado.resumen).not.toContain('validados con éxito');
    expect(defaultSiiEnvio.documentosPendientes(TENANT)).toHaveLength(pendientesAntes);
    const delSet = defaultSqliteClient.query<{ tipo_dte: number; estado_sii: string; referencia_folio: number | null }>(
      'SELECT tipo_dte, estado_sii, referencia_folio FROM sii_dte_emitidos WHERE tenant_id = ?', [TENANT]);
    expect(delSet.length).toBe(3);
    expect(delSet.every((d) => d.estado_sii === 'ANULADO')).toBe(true);
    // la nota de credito referencia la boleta del caso 1
    const folioBoleta = delSet.find((d) => Number(d.tipo_dte) === 39) as any;
    const nc = defaultSqliteClient.queryOne<{ referencia_folio: number }>(
      'SELECT referencia_folio FROM sii_dte_emitidos WHERE tenant_id = ? AND tipo_dte = 61', [TENANT]);
    expect(Number(nc?.referencia_folio)).toBeGreaterThan(0);
    expect(folioBoleta).toBeDefined();
    expect(defaultRcofService.generateDailyRcof(TENANT).cantidadBoletas).toBe(0);
  });

  test('la boleta de las 21:30 del ultimo dia del mes cuenta en el RCOF de su dia y en el F29 de su mes', () => {
    // en UTC ya es el dia siguiente, y el mes siguiente
    const hoy = new Date();
    const tarde = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 21, 30, 0, 0);
    const mes = fechaLocal(tarde).slice(0, 7);
    const antes = defaultRcofService.generateDailyRcof(TENANT, fechaLocal(tarde)).cantidadBoletas;
    const brutoAntes = defaultF29ReportService.generateMonthlyF29(TENANT, mes).debitoFiscal.totalBruto;
    // fecha_emision se guarda en UTC, como la deja datetime('now')
    defaultSqliteClient.execute(
      `INSERT INTO sii_dte_emitidos (id, tenant_id, tipo_dte, folio, fecha_emision, rut_emisor, razon_social_emisor,
         rut_receptor, monto_neto, monto_iva, monto_total, ted_xml, dte_xml_completo, qr_code_content, estado_sii)
       VALUES ('rcof-tarde', ?, 39, 987654, ?, '76123456-0', 'ALMACEN', '66666666-6', 1000, 190, 1190, '<TED/>', '<DTE/>', '', 'EMITIDO_LOCAL')`,
      [TENANT, tarde.toISOString().replace('T', ' ').slice(0, 19)]
    );
    try {
      expect(defaultRcofService.generateDailyRcof(TENANT, fechaLocal(tarde)).cantidadBoletas).toBe(antes + 1);
      expect(defaultF29ReportService.generateMonthlyF29(TENANT, mes).debitoFiscal.totalBruto).toBe(brutoAntes + 1190);
    } finally {
      defaultSqliteClient.execute("DELETE FROM sii_dte_emitidos WHERE id = 'rcof-tarde'");
    }
  });

  test('con folios del SII cargados, el set de prueba no corre: los gastaria', async () => {
    const provisionales = [boleta(), boleta(), boleta()];
    const ultimoProvisional = Math.max(...provisionales.map((p) => Number(p.folio)));

    // el CAF real empieza en el 1, igual que el rango provisional
    defaultCafManager.importCafFromXml(TENANT, cafDelSii(39, 1, ultimoProvisional + 3));
    expect(contar(
      "SELECT COUNT(*) AS n FROM sii_caf WHERE tenant_id = ? AND tipo_dte = 39 AND origen = 'PROVISIONAL' AND activo = 1", [TENANT])).toBe(0);

    // la siguiente boleta salta los folios ya usados y es del SII; las anteriores siguen provisionales
    const real = boleta();
    expect(Number(real.folio)).toBe(ultimoProvisional + 1);
    expect(defaultSiiEnvio.folioEsProvisional(TENANT, String(real.dteId))).toBe(false);
    expect(defaultSiiEnvio.folioEsProvisional(TENANT, String(provisionales[0].dteId))).toBe(true);

    const set = await defaultSiiCertification.runFullCertificationSuite(TENANT);
    expect(set.success).toBe(false);
    expect(set.resumen).toContain('folios autorizados por el SII');
  });

  test('el mismo CAF no se carga dos veces, y agotado no vuelve en silencio al rango provisional', () => {
    const caf = defaultSqliteClient.queryOne<{ folio_desde: number; folio_hasta: number }>(
      "SELECT folio_desde, folio_hasta FROM sii_caf WHERE tenant_id = ? AND tipo_dte = 39 AND origen = 'SII'", [TENANT])!;
    expect(() => defaultCafManager.importCafFromXml(TENANT, cafDelSii(39, caf.folio_desde, caf.folio_hasta)))
      .toThrow('se cruzan');

    // el CAF de la prueba tiene pocos folios: antes de 20 boletas tiene que agotarse
    let error = '';
    for (let i = 0; i < 20 && !error; i++) {
      try {
        boleta();
      } catch (err) {
        error = (err as Error).message;
      }
    }
    expect(error).toContain('Se agotaron los folios autorizados por el SII');
    expect(contar(
      "SELECT COUNT(*) AS n FROM sii_caf WHERE tenant_id = ? AND tipo_dte = 39 AND activo = 1 AND origen = 'PROVISIONAL'", [TENANT])).toBe(0);
  });

  test('el F29 suma el impuesto adicional de las facturas y resta el de sus notas de credito', () => {
    const mes = fechaLocal().slice(0, 7);
    const antes = defaultF29ReportService.generateMonthlyF29(TENANT, mes).debitoFiscal.totalIla;
    const fila = (id: string, tipo: number, folio: number, ila: number) => defaultSqliteClient.execute(
      `INSERT INTO sii_dte_emitidos (id, tenant_id, tipo_dte, folio, fecha_emision, rut_emisor, razon_social_emisor,
         rut_receptor, monto_neto, monto_iva, monto_total, monto_ila, ted_xml, dte_xml_completo, qr_code_content, estado_sii)
       VALUES (?, ?, ?, ?, datetime('now'), '76123456-0', 'ALMACEN', '77777777-7', 1000, 190, 1490, ?, '<TED/>', '<DTE/>', '', 'EMITIDO_LOCAL')`,
      [id, TENANT, tipo, folio, ila]
    );
    fila('f29-factura', 33, 880001, 300);
    fila('f29-nota', 61, 880002, 100);
    try {
      expect(defaultF29ReportService.generateMonthlyF29(TENANT, mes).debitoFiscal.totalIla).toBe(antes + 200);
    } finally {
      defaultSqliteClient.execute("DELETE FROM sii_dte_emitidos WHERE id IN ('f29-factura', 'f29-nota')");
    }
  });

  test('si el documento no se puede grabar, su folio no queda gastado', () => {
    const ultimo = () => defaultSqliteClient.queryOne<{ u: number }>(
      "SELECT MAX(ultimo_folio_usado) AS u FROM sii_caf WHERE tenant_id = ? AND tipo_dte = 33", [TENANT])?.u ?? 0;
    const factura = () => defaultDteEmitter.emitDocument({
      tenantId: TENANT,
      tipoDte: TipoDTE.FACTURA_ELECTRONICA,
      metodoPago: 'EFECTIVO',
      receptor: { rut: '77777777-7', razonSocial: 'CLIENTE SPA', giro: 'COMERCIO', direccion: 'CALLE 1', comuna: 'SANTIAGO' },
      items: [{ nroLinea: 1, nombre: 'Harina', cantidad: 1, precioUnitario: 1190, subtotal: 1190 }]
    });
    factura();
    const antes = ultimo();
    const original = defaultSqliteClient.execute.bind(defaultSqliteClient);
    const espia = jest.spyOn(defaultSqliteClient, 'execute').mockImplementation((sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO sii_dte_emitidos')) throw new Error('disco lleno');
      return original(sql, params);
    });
    try {
      expect(factura).toThrow('disco lleno');
    } finally {
      espia.mockRestore();
    }
    expect(ultimo()).toBe(antes);
    expect(Number(factura().folio)).toBe(antes + 1);
  });

  test('una transaccion dentro de otra deshace solo lo suyo si falla', () => {
    defaultSqliteClient.execute('CREATE TABLE IF NOT EXISTS prueba_anidada (v TEXT)');
    defaultSqliteClient.withTransaction(() => {
      defaultSqliteClient.execute("INSERT INTO prueba_anidada (v) VALUES ('exterior')");
      try {
        defaultSqliteClient.withTransaction(() => {
          defaultSqliteClient.execute("INSERT INTO prueba_anidada (v) VALUES ('interior')");
          throw new Error('falla adentro');
        });
      } catch {
        // el exterior sigue
      }
    });
    expect(defaultSqliteClient.query<{ v: string }>('SELECT v FROM prueba_anidada').map((f) => f.v)).toEqual(['exterior']);
  });

  test('la ruta del documento de una factura no sale de la carpeta de facturas', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'facturas-'));
    const afuera = path.join(path.dirname(base), `clave-${path.basename(base)}`);
    fs.writeFileSync(afuera, 'secreto');
    try {
      const almacen = new InvoiceFileStore(base);
      const guardado = almacen.guardar(TENANT, Buffer.from('%PDF-1.4'), 'f.pdf', 'application/pdf');
      expect(almacen.leerBuffer(guardado.ruta).toString()).toBe('%PDF-1.4');

      const salto = `../${path.basename(afuera)}`;
      expect(() => almacen.leerBuffer(salto)).toThrow('fuera de la carpeta');
      expect(() => almacen.leerBase64(salto)).toThrow('fuera de la carpeta');
      expect(almacen.existe(salto)).toBe(false);
      expect(() => almacen.guardar('../otro', Buffer.from('x'), 'f.pdf', 'application/pdf')).toThrow('fuera de la carpeta');
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(afuera, { force: true });
    }
  });
});
