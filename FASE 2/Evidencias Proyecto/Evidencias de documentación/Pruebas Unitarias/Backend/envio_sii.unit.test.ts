import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { defaultSqliteClient } from '../../backend/src/database/sqlite/client';
import { defaultPgClient } from '../../backend/src/database/postgres/client';
import { initializeDatabase } from '../../backend/src/database/init-db';
import { SiiEnvioService, tipoDeSobre } from '../../backend/src/dte/sii-envio.service';
import { SiiTransportHttp } from '../../backend/src/dte/sii-transport.http';
import { SiiTransport } from '../../backend/src/dte/types';
import { defaultCafManager } from '../../backend/src/dte/caf-manager.service';
import { TipoDTE } from '../../backend/src/dte/types';

const TENANT = '00000000-0000-0000-0000-000000000001';

/**
 * El sistema emite los documentos tributarios solo y los deja firmados en el equipo, pero el
 * envio al SII no existia: ninguna linea hablaba con el servicio, el estado de todo documento
 * era EMITIDO_LOCAL y nada lo movia. Estas pruebas fijan las dos mitades del trato nuevo: el
 * sobre se arma y se firma siempre, y el envio solo se declara cuando ocurrio.
 */
describe('Pruebas Unitarias: Envio de Documentos al SII', () => {
  beforeAll(async () => {
    defaultPgClient.tripCircuit();
    await initializeDatabase();
  });

  const documentos: string[] = [];

  /** Deja un documento emitido, como el que produce el cierre de una venta. */
  function emitirDocumento(folio: number, tipoDte = TipoDTE.BOLETA_ELECTRONICA): string {
    const id = uuidv4();
    documentos.push(id);
    defaultSqliteClient.execute(
      `INSERT INTO sii_dte_emitidos
         (id, tenant_id, tipo_dte, folio, fecha_emision, rut_emisor, razon_social_emisor,
          rut_receptor, monto_neto, monto_iva, monto_total, ted_xml, dte_xml_completo,
          qr_code_content, estado_sii)
       VALUES (?, ?, ?, ?, datetime('now'), '76.123.456-0', 'ALMACEN DE PRUEBA SPA',
               '66666666-6', 1000, 190, 1190, '<TED/>', ?, 'https://www.sii.cl', 'EMITIDO_LOCAL')`,
      [id, TENANT, tipoDte, folio, `<DTE ID="F${folio}T${tipoDte}"><Documento/></DTE>`]
    );
    return id;
  }

  /** Deja cargado el certificado en los dos valores que el transporte lee. */
  function cargarCertificado(): void {
    const claves: [string, string][] = [
      ['sii_certificado_pem', '-----BEGIN CERTIFICATE-----abc-----END CERTIFICATE-----'],
      ['sii_llave_privada_pem', '-----BEGIN PRIVATE KEY-----abc-----END PRIVATE KEY-----']
    ];
    for (const [clave, valor] of claves) {
      defaultSqliteClient.execute(
        `INSERT INTO configuracion_sistema (id, tenant_id, clave, valor, descripcion, actualizado_at)
         VALUES (?, ?, ?, ?, 'prueba', datetime('now'))
         ON CONFLICT (tenant_id, clave) DO UPDATE SET valor = excluded.valor`,
        [`cfg-${clave}`, TENANT, clave, valor]
      );
    }
  }

  function borrarCertificado(): void {
    for (const clave of ['sii_certificado_pem', 'sii_llave_privada_pem']) {
      defaultSqliteClient.execute(
        'DELETE FROM configuracion_sistema WHERE tenant_id = ? AND clave = ?',
        [TENANT, clave]
      );
    }
  }

  function limpiar(): void {
    for (const id of documentos.splice(0)) {
      defaultSqliteClient.execute('DELETE FROM sii_dte_emitidos WHERE id = ?', [id]);
    }
    defaultSqliteClient.execute('DELETE FROM sii_envios WHERE tenant_id = ?', [TENANT]);
  }

  afterEach(limpiar);

  describe('Lo que falta para enviar', () => {
    test('sin certificado ni folios autorizados, lo declara en vez de intentar', () => {
      const servicio = new SiiEnvioService();

      const faltantes = servicio.revisarRequisitos(TENANT);
      const requisitos = faltantes.map((f) => f.requisito);

      expect(requisitos).toContain('Certificado digital del emisor');
      expect(requisitos).toContain('Folios CAF autorizados');
      expect(requisitos).toContain('Transporte hacia el SII');
      // Cada falta explica que gestion tiene pendiente el local, no un codigo de error
      expect(faltantes[0].detalle).toContain('proveedor autorizado');
    });

    test('el folio de un rango provisional se declara como tal', () => {
      // El equipo se provisiona folios para poder vender sin haberlos pedido al SII
      defaultCafManager.getOrCreateActiveCaf(TENANT, TipoDTE.BOLETA_ELECTRONICA);
      emitirDocumento(991001);

      const pendientes = new SiiEnvioService().documentosPendientes(TENANT);
      const nuestro = pendientes.find((d) => d.folio === 991001);

      // Fuera de todo rango conocido tambien cuenta como provisional: lo que no consta
      // autorizado, no lo esta
      expect(nuestro?.folio_provisional).toBe(true);
    });
  });

  describe('El sobre', () => {
    test('se arma firmado con los documentos pendientes y queda registrado', () => {
      const servicio = new SiiEnvioService();
      emitirDocumento(5001);
      emitirDocumento(5002);

      const [sobre] = servicio.prepararSobres(TENANT);

      expect(sobre.documentos).toBe(2);
      expect(sobre.tipoSobre).toBe('EnvioBOLETA');
      expect(sobre.sobreXml).toContain('<EnvioBOLETA version="1.0"');
      expect(sobre.sobreXml).toContain('<Caratula version="1.0">');
      // El receptor del sobre es el SII, no el cliente de la venta
      expect(sobre.sobreXml).toContain('<RutReceptor>60803000-K</RutReceptor>');
      expect(sobre.sobreXml).toContain('<NroDTE>2</NroDTE>');
      expect(sobre.sobreXml).toContain('F5001T39');
      expect(sobre.sobreXml).toContain('<SignatureValue>');

      const guardado = servicio.getSobre(TENANT, sobre.envioId);
      expect(guardado?.estado).toBe('PREPARADO');
      expect(guardado?.tipo_sobre).toBe('EnvioBOLETA');
      expect(guardado?.sobre_xml).toBe(sobre.sobreXml);
    });

    test('las boletas y las facturas viajan en sobres distintos', () => {
      // El SII recibe las boletas en EnvioBOLETA y el resto en EnvioDTE: un sobre que los mezcla
      // es un envio que el servicio rechaza.
      const servicio = new SiiEnvioService();
      emitirDocumento(5101, TipoDTE.BOLETA_ELECTRONICA);
      emitirDocumento(5102, TipoDTE.FACTURA_ELECTRONICA);
      emitirDocumento(5103, TipoDTE.NOTA_CREDITO);

      const sobres = servicio.prepararSobres(TENANT);
      const porTipo = Object.fromEntries(sobres.map((s) => [s.tipoSobre, s]));

      expect(sobres).toHaveLength(2);
      expect(porTipo.EnvioBOLETA.documentos).toBe(1);
      expect(porTipo.EnvioDTE.documentos).toBe(2);
      expect(porTipo.EnvioBOLETA.sobreXml).toContain('<EnvioBOLETA');
      expect(porTipo.EnvioBOLETA.sobreXml).not.toContain('<EnvioDTE');
      // La caratula declara un subtotal por cada tipo que lleva dentro
      expect(porTipo.EnvioDTE.sobreXml).toContain('<TpoDTE>33</TpoDTE><NroDTE>1</NroDTE>');
      expect(porTipo.EnvioDTE.sobreXml).toContain('<TpoDTE>61</TpoDTE><NroDTE>1</NroDTE>');
    });

    test('la clasificacion del sobre sigue el tipo de documento', () => {
      expect(tipoDeSobre(39)).toBe('EnvioBOLETA');
      expect(tipoDeSobre(41)).toBe('EnvioBOLETA');
      expect(tipoDeSobre(33)).toBe('EnvioDTE');
      expect(tipoDeSobre(52)).toBe('EnvioDTE');
      expect(tipoDeSobre(61)).toBe('EnvioDTE');
    });

    test('un documento ya enviado no vuelve a viajar en otro sobre', () => {
      const servicio = new SiiEnvioService();
      emitirDocumento(5003);

      servicio.prepararSobres(TENANT);

      expect(servicio.documentosPendientes(TENANT).some((d) => d.folio === 5003)).toBe(false);
      expect(() => servicio.prepararSobres(TENANT)).toThrow('pendientes de envio');
    });

    test('sin documentos pendientes no arma un sobre vacio', () => {
      expect(() => new SiiEnvioService().prepararSobres(TENANT)).toThrow('pendientes de envio');
    });
  });

  describe('El envio', () => {
    test('sin requisitos no informa un envio: deja el sobre listo y dice que falta', async () => {
      const servicio = new SiiEnvioService();
      emitirDocumento(5004);

      const resultado = await servicio.enviar(TENANT);

      expect(resultado.enviado).toBe(false);
      expect(resultado.mensaje).toContain('quedo preparado y firmado');
      expect(resultado.sobres[0].enviado).toBe(false);
      expect(resultado.faltantes.length).toBeGreaterThan(0);
      expect(resultado.track_id).toBeUndefined();

      // Y el documento no queda marcado como enviado, porque no lo esta
      const estado = defaultSqliteClient.queryOne<{ estado_sii: string }>(
        'SELECT estado_sii FROM sii_dte_emitidos WHERE folio = 5004 AND tenant_id = ?',
        [TENANT]
      );
      expect(estado?.estado_sii).toBe('EMITIDO_LOCAL');
    });

    test('cuando el SII recibe el sobre, el documento queda enviado con su identificador', async () => {
      const transporte: SiiTransport = {
        disponible: () => true,
        async subirSobre() {
          return { trackId: '1234567890' };
        }
      };
      const servicio = new SiiEnvioService(undefined, undefined, undefined, transporte);
      // Con transporte, certificado y folios autorizados no falta nada
      cargarCertificado();
      defaultSqliteClient.execute(
        `UPDATE sii_caf SET origen = 'SII' WHERE tenant_id = ? AND tipo_dte = ?`,
        [TENANT, TipoDTE.BOLETA_ELECTRONICA]
      );
      emitirDocumento(5005);

      const resultado = await servicio.enviar(TENANT);

      expect(resultado.enviado).toBe(true);
      expect(resultado.track_id).toBe('1234567890');

      const fila = defaultSqliteClient.queryOne<{ estado_sii: string; track_id_sii: string }>(
        'SELECT estado_sii, track_id_sii FROM sii_dte_emitidos WHERE folio = 5005 AND tenant_id = ?',
        [TENANT]
      );
      expect(fila?.estado_sii).toBe('ENVIADO_SII');
      expect(fila?.track_id_sii).toBe('1234567890');

      borrarCertificado();
      defaultSqliteClient.execute(
        "UPDATE sii_caf SET origen = 'PROVISIONAL' WHERE tenant_id = ? AND tipo_dte = ?",
        [TENANT, TipoDTE.BOLETA_ELECTRONICA]
      );
    });

    test('si el SII rechaza el sobre, el documento vuelve a quedar pendiente', async () => {
      const transporte: SiiTransport = {
        disponible: () => true,
        async subirSobre() {
          throw new Error('El servicio no acepto el sobre');
        }
      };
      const servicio = new SiiEnvioService(undefined, undefined, undefined, transporte);
      cargarCertificado();
      defaultSqliteClient.execute(
        `UPDATE sii_caf SET origen = 'SII' WHERE tenant_id = ? AND tipo_dte = ?`,
        [TENANT, TipoDTE.BOLETA_ELECTRONICA]
      );
      emitirDocumento(5006);

      const resultado = await servicio.enviar(TENANT);

      expect(resultado.enviado).toBe(false);
      expect(resultado.mensaje).toContain('no recibio el sobre');

      // El documento vuelve a la cola: un rechazo no puede dejarlo fuera para siempre
      const pendientes = servicio.documentosPendientes(TENANT);
      expect(pendientes.some((d) => d.folio === 5006)).toBe(true);

      const envio = defaultSqliteClient.queryOne<{ estado: string; motivo: string }>(
        'SELECT estado, motivo FROM sii_envios WHERE id = ?',
        [resultado.envio_id]
      );
      expect(envio?.estado).toBe('RECHAZADO');
      expect(envio?.motivo).toContain('no acepto el sobre');

      borrarCertificado();
      defaultSqliteClient.execute(
        "UPDATE sii_caf SET origen = 'PROVISIONAL' WHERE tenant_id = ? AND tipo_dte = ?",
        [TENANT, TipoDTE.BOLETA_ELECTRONICA]
      );
    });
  });

  describe('El envio automatico', () => {
    test('sin requisitos no arma sobre ni toca los documentos: quedan en la cola', async () => {
      const servicio = new SiiEnvioService();
      emitirDocumento(7001);

      const resultado = await servicio.intentarEnvioAutomatico(TENANT, 'emision');

      // Armar un sobre que no se puede enviar sacaria el documento de la cola, y la pantalla
      // dejaria de mostrar lo que hay pendiente
      expect(resultado).toBeNull();
      expect(servicio.documentosPendientes(TENANT).some((d) => d.folio === 7001)).toBe(true);
      const sobres = defaultSqliteClient.query<{ id: string }>(
        'SELECT id FROM sii_envios WHERE tenant_id = ?',
        [TENANT]
      );
      expect(sobres).toHaveLength(0);
    });

    test('al emitir viaja la factura; la boleta espera al cierre de la caja', async () => {
      const enviados: string[] = [];
      const transporte: SiiTransport = {
        disponible: () => true,
        async subirSobre(sobreXml: string) {
          enviados.push(sobreXml.includes('<EnvioBOLETA') ? 'EnvioBOLETA' : 'EnvioDTE');
          return { trackId: `TRK-${enviados.length}` };
        }
      };
      const servicio = new SiiEnvioService(undefined, undefined, undefined, transporte);
      cargarCertificado();
      // Los dos rangos tienen que existir y constar como autorizados: el folio que no cae en
      // ninguno se considera provisional, y el envio automatico no lo intenta.
      defaultCafManager.getOrCreateActiveCaf(TENANT, TipoDTE.BOLETA_ELECTRONICA);
      defaultCafManager.getOrCreateActiveCaf(TENANT, TipoDTE.FACTURA_ELECTRONICA);
      defaultSqliteClient.execute("UPDATE sii_caf SET origen = 'SII' WHERE tenant_id = ?", [TENANT]);

      emitirDocumento(2002, TipoDTE.BOLETA_ELECTRONICA);
      emitirDocumento(2003, TipoDTE.FACTURA_ELECTRONICA);

      await servicio.intentarEnvioAutomatico(TENANT, 'emision');

      expect(enviados).toEqual(['EnvioDTE']);
      // La boleta sigue pendiente, esperando el cierre del turno
      expect(servicio.documentosPendientes(TENANT).some((d) => d.folio === 2002)).toBe(true);

      await servicio.intentarEnvioAutomatico(TENANT, 'cierre_caja');

      expect(enviados).toEqual(['EnvioDTE', 'EnvioBOLETA']);
      expect(servicio.documentosPendientes(TENANT).some((d) => d.folio === 2002)).toBe(false);

      borrarCertificado();
      defaultSqliteClient.execute("UPDATE sii_caf SET origen = 'PROVISIONAL' WHERE tenant_id = ?", [TENANT]);
    });

    test('el documento con folio provisional no se intenta enviar', async () => {
      const transporte: SiiTransport = {
        disponible: () => true,
        async subirSobre() {
          throw new Error('no deberia intentarse');
        }
      };
      const servicio = new SiiEnvioService(undefined, undefined, undefined, transporte);
      cargarCertificado();
      // Un CAF autorizado existe, pero este folio cae fuera de su rango
      defaultSqliteClient.execute("UPDATE sii_caf SET origen = 'SII' WHERE tenant_id = ?", [TENANT]);
      emitirDocumento(991234, TipoDTE.FACTURA_ELECTRONICA);

      const resultado = await servicio.intentarEnvioAutomatico(TENANT, 'emision');

      expect(resultado).toBeNull();

      borrarCertificado();
      defaultSqliteClient.execute("UPDATE sii_caf SET origen = 'PROVISIONAL' WHERE tenant_id = ?", [TENANT]);
    });

    test('el cierre de la venta y el de la caja lo disparan', () => {
      const pos = fs.readFileSync(
        path.join(__dirname, '../../backend/src/routes/pos.routes.ts'),
        'utf8'
      );
      const caja = fs.readFileSync(
        path.join(__dirname, '../../backend/src/routes/caja.routes.ts'),
        'utf8'
      );

      expect(pos).toContain("intentarEnvioAutomatico(tenant_id, 'emision')");
      expect(caja).toContain("intentarEnvioAutomatico(tenant_id, 'cierre_caja')");
    });
  });

  describe('El transporte hacia el SII', () => {
    test('sin certificado cargado no esta disponible y no intenta nada', async () => {
      const transporte = new SiiTransportHttp();

      expect(transporte.disponible()).toBe(false);
      await expect(
        transporte.subirSobre('<EnvioDTE/>', 'CERTIFICACION_MAULLIN', '76.123.456-0')
      ).rejects.toThrow('certificado digital');
    });

    test('con el certificado cargado queda disponible', () => {
      const claves = [
        ['cfg-cert-pem', 'sii_certificado_pem', '-----BEGIN CERTIFICATE-----abc-----END CERTIFICATE-----'],
        ['cfg-llave-pem', 'sii_llave_privada_pem', '-----BEGIN PRIVATE KEY-----abc-----END PRIVATE KEY-----']
      ];
      for (const [id, clave, valor] of claves) {
        defaultSqliteClient.execute(
          `INSERT INTO configuracion_sistema (id, tenant_id, clave, valor, descripcion, actualizado_at)
           VALUES (?, ?, ?, ?, 'prueba', datetime('now'))
           ON CONFLICT (tenant_id, clave) DO UPDATE SET valor = excluded.valor`,
          [id, TENANT, clave, valor]
        );
      }

      expect(new SiiTransportHttp().disponible()).toBe(true);
      // Y la cola deja de declarar que falta el certificado
      const faltan = new SiiEnvioService().revisarRequisitos(TENANT).map((f) => f.requisito);
      expect(faltan).not.toContain('Certificado digital del emisor');

      for (const clave of ['sii_certificado_pem', 'sii_llave_privada_pem']) {
        defaultSqliteClient.execute(
          'DELETE FROM configuracion_sistema WHERE tenant_id = ? AND clave = ?',
          [TENANT, clave]
        );
      }
    });
  });

  describe('Origen de los folios', () => {
    test('el rango que el equipo se provisiona no se presenta como autorizado', () => {
      const ruta = fs.readFileSync(
        path.join(__dirname, '../../backend/src/dte/caf-manager.service.ts'),
        'utf8'
      );

      // Antes el registro decia "Auto-generating certified test CAF": nada de eso esta
      // certificado por el SII, y la palabra sostenia lo contrario.
      expect(ruta).not.toContain('certified test CAF');
      expect(ruta).toContain("activo, origen)");
      expect(ruta).toContain("1, 'PROVISIONAL')");
      expect(ruta).toContain("1, 'SII')");
    });
  });
});
