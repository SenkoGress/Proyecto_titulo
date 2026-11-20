import crypto from 'crypto';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { initializeDatabase } from '../../src/database/init-db';
import { defaultSqliteClient } from '../../src/database/sqlite/client';
import { defaultPgClient } from '../../src/database/postgres/client';
import { defaultDteEmitter } from '../../src/dte/dte-emitter.service';
import { bytesDelSobre, defaultSiiEnvio } from '../../src/dte/sii-envio.service';
import { ItemDTE, TipoDTE } from '../../src/dte/types';

/**
 * Los documentos que emite GesTock pasan los esquemas oficiales del SII (schema_dte.zip y
 * schema_envio_bol.zip, descargados de sii.cl el 20-11-2026 y guardados en tests/fixtures/sii-xsd).
 * El esquema revisa la forma del documento, no las reglas de negocio que el SII valida al recibir.
 * El validador y el verificador de firmas son los de .NET que trae Windows, independientes del firmador
 * de GesTock; en otro sistema esas dos pruebas se omiten y quedan las comprobaciones de forma y del timbre.
 */
const TENANT = '00000000-0000-0000-0000-000000000001';
const ESQUEMAS = path.join(__dirname, '..', 'fixtures', 'sii-xsd');
const enWindows = process.platform === 'win32';

function item(nombre: string, precioUnitario: number, cantidad = 1, extra: Partial<ItemDTE> = {}): ItemDTE {
  return { nroLinea: 1, nombre, cantidad, precioUnitario, subtotal: precioUnitario * cantidad, ...extra };
}

const empresa = { rut: '76.555.001-7', razonSocial: 'Comercio Receptor SpA', giro: 'COMERCIO', direccion: 'Calle 1', comuna: 'Santiago', ciudad: 'Santiago' };
const largo = 'X'.repeat(150);
const refFactura = { nroLineaRef: 1, tipoDocRef: 33, folioRef: 1, fechaRef: '2026-11-20', codigoRef: 1, razonRef: 'Anula factura' };
const refBoleta = { nroLineaRef: 1, tipoDocRef: 39, folioRef: 1, fechaRef: '2026-11-20', codigoRef: 1, razonRef: 'Devolucion de la boleta' };
const cerveza = item('Cerveza Lager 350cc', 1990, 3, { codigoIla: 26, tasaIla: 20.5 });

const CASOS: Array<[string, any]> = [
  ['boleta', { tipoDte: 39, items: [item('Leche 1L', 1234), item('Pan', 799, 3), item('Granel', 333.33, 3)] }],
  ['boleta con linea exenta', { tipoDte: 39, items: [item('Leche 1L', 1234), item('Libro', 5000, 1, { exento: true })] }],
  ['boleta exenta', { tipoDte: 41, items: [item('Libro', 5000, 1, { exento: true })] }],
  ['boleta a un cliente identificado con giro', { tipoDte: 39, items: [item('Leche 1L', 1234)], receptor: { ...empresa, rut: '12.345.670-k', giro: largo } }],
  ['boleta con cantidad fraccionaria y nombre largo', { tipoDte: 39, items: [item(largo, 1999, 0.333333333)] }],
  ['factura', { tipoDte: 33, items: [item('Leche 1L', 1234), item('Pan', 799, 3)], receptor: empresa }],
  ['factura con impuesto adicional', { tipoDte: 33, items: [cerveza, item('Pan', 1234)], receptor: empresa }],
  ['factura con exento', { tipoDte: 33, items: [item('Pan', 1234), item('Libro', 5000, 1, { exento: true })], receptor: empresa }],
  ['factura con textos largos', { tipoDte: 33, items: [item('Pan', 1234)], receptor: { ...empresa, razonSocial: largo, giro: largo, direccion: largo, comuna: largo, ciudad: largo } }],
  ['factura con tildes, eñe y texto pegado de otro programa', { tipoDte: 33, items: [item('Café “Especial” – 1 kg…', 4990), item('Ñandú de peluche 20 €', 2500)], receptor: { ...empresa, razonSocial: 'Panadería Ñuñoa Ltda.', giro: 'Elaboración de pan’s' } }],
  ['nota de credito', { tipoDte: 61, items: [item('Leche 1L', 1234)], receptor: empresa, referencia: refFactura }],
  ['nota de credito con impuesto adicional', { tipoDte: 61, items: [cerveza], receptor: empresa, referencia: refFactura }],
  ['nota de credito sobre una boleta', { tipoDte: 61, items: [item('Leche 1L', 1234)], referencia: refBoleta }],
  ['guia con transporte', { tipoDte: 52, items: [item('Leche 1L', 1234), item('Pan', 799, 3)], receptor: empresa, transporte: { indTraslado: 5, patente: 'ABCD12', choferRut: '11.111.111-1', choferNombre: largo, direccionDestino: largo, comunaDestino: largo } }],
  ['guia sin transporte', { tipoDte: 52, items: [item('Leche 1L', 1234)], receptor: empresa }],
  ['guia de traslado sin valor', { tipoDte: 52, items: [item('Caja de traslado', 0, 2)], receptor: empresa, transporte: { indTraslado: 5, patente: 'S/P', choferRut: '11111111-1', choferNombre: 'Chofer' } }]
];

describe('El XML de los documentos tributarios cumple los esquemas oficiales del SII', () => {
  let carpeta: string;
  const documentos = new Map<string, { xml: string; sobre: string; tipoSobre: string; caf: any; archivo: string }>();

  beforeAll(async () => {
    defaultPgClient.tripCircuit();
    await initializeDatabase();
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'gestock-xsd-'));
    for (const [nombre, caso] of CASOS) {
      const r = defaultDteEmitter.emitDocument({ tenantId: TENANT, metodoPago: 'EFECTIVO', modeloEmision: 'MODELO_A', ...caso });
      const [sobre] = defaultSiiEnvio.prepararSobres(TENANT, [String(r.dteId)]);
      const caf = defaultSqliteClient.queryOne<any>(
        'SELECT caf_xml_content, rsapk_public_key, rsask_private_key FROM sii_caf WHERE tenant_id = ? AND tipo_dte = ? AND activo = 1 ORDER BY folio_desde DESC LIMIT 1',
        [TENANT, caso.tipoDte]
      );
      // el archivo lleva los mismos bytes que se suben al SII o se descargan
      const archivo = path.join(carpeta, `${nombre.replace(/[^A-Za-z]+/g, '_')}.xml`);
      fs.writeFileSync(archivo, bytesDelSobre(sobre.sobreXml));
      documentos.set(nombre, { xml: String(r.xmlDte), sobre: sobre.sobreXml, tipoSobre: sobre.tipoSobre, caf, archivo });
    }
  });

  afterAll(() => {
    fs.rmSync(carpeta, { recursive: true, force: true });
  });

  (enWindows ? test.each : test.skip.each)(CASOS.map(([nombre]) => [nombre]))('%s: el sobre pasa el esquema sin errores ni advertencias', (nombre) => {
    const doc = documentos.get(nombre)!;
    const esquema = doc.tipoSobre === 'EnvioBOLETA'
      ? path.join(ESQUEMAS, 'bol', 'EnvioBOLETA_v11.xsd')
      : path.join(ESQUEMAS, 'dte', 'EnvioDTE_v10.xsd');

    const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ESQUEMAS, 'validar.ps1'), '-Xml', doc.archivo, '-Esquema', esquema], { encoding: 'utf8' });

    expect(r.stdout.trim()).toBe('');
    expect(r.status).toBe(0);
  });

  // .NET canonicaliza, recalcula cada digest y verifica cada firma por su cuenta: la del documento y la del sobre
  (enWindows ? test.each : test.skip.each)(CASOS.map(([nombre]) => [nombre]))('%s: .NET verifica las firmas del documento y del sobre', (nombre) => {
    const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ESQUEMAS, 'verificar_firmas.ps1'), '-Xml', documentos.get(nombre)!.archivo], { encoding: 'utf8' });

    expect(r.stdout.trim().split(/\r?\n/).map((l) => l.split(' ')[0])).toEqual(['OK', 'OK']);
    expect(r.status).toBe(0);
  });

  test('ningun RUT viaja con puntos, tampoco en la caratula del sobre', () => {
    for (const { sobre } of documentos.values()) {
      expect(sobre).not.toMatch(/<(RUTEmisor|RUTRecep|RUTTrans|RUTChofer|RutEmisor|RutEnvia|RE|RR)>[^<]*\./);
      expect(sobre).not.toMatch(/<(RUTRecep|RR)>[^<]*k</);
    }
    expect(documentos.get('boleta a un cliente identificado con giro')!.xml).toContain('<RUTRecep>12345670-K</RUTRecep>');
  });

  test('la boleta usa los nodos de su propio esquema y la factura los del DTE', () => {
    const boleta = documentos.get('boleta a un cliente identificado con giro')!.xml;
    const factura = documentos.get('factura')!.xml;

    expect(boleta).toMatch(/<Emisor><RUTEmisor>[^<]+<\/RUTEmisor><RznSocEmisor>[^<]+<\/RznSocEmisor><GiroEmisor>/);
    expect(boleta).not.toMatch(/<Acteco>|<GiroRecep>|<RznSoc>/);
    expect(boleta).toContain('<IndServicio>3</IndServicio>');
    expect(factura).toMatch(/<RznSoc>[^<]+<\/RznSoc><GiroEmis>[^<]+<\/GiroEmis><Acteco>/);
    expect(factura).not.toContain('<IndServicio>');
  });

  test('la guia lleva el transporte dentro del encabezado, antes de los totales', () => {
    const guia = documentos.get('guia con transporte')!.xml;

    expect(guia).toMatch(/<\/Receptor><Transporte>.*<\/Transporte><Totales>/);
    expect(documentos.get('guia sin transporte')!.xml).not.toContain('<Transporte>');
  });

  test('los textos se recortan al largo del esquema y un item sin valor va sin precio', () => {
    const factura = documentos.get('factura con textos largos')!.xml;
    expect(factura).toContain(`<GiroRecep>${'X'.repeat(40)}</GiroRecep>`);
    expect(factura).toContain(`<RznSocRecep>${'X'.repeat(100)}</RznSocRecep>`);
    expect(documentos.get('guia con transporte')!.xml).toContain(`<NombreChofer>${'X'.repeat(30)}</NombreChofer>`);

    const traslado = documentos.get('guia de traslado sin valor')!.xml;
    expect(traslado).not.toContain('<PrcItem>');
    expect(documentos.get('boleta con cantidad fraccionaria y nombre largo')!.xml).toContain('<QtyItem>0.333333</QtyItem>');
  });

  test('el timbre se firma sobre el RUT ya normalizado y su firma sigue siendo valida', () => {
    for (const [nombre, { xml, caf }] of documentos) {
      expect(xml).toContain('<FRMT algoritmo="SHA1withRSA">');
      const dd = /<DD>.*<\/DD>/.exec(xml)![0];
      const firma = /<FRMT algoritmo="SHA1withRSA">([^<]+)<\/FRMT>/.exec(xml)![1];
      const verificador = crypto.createVerify('RSA-SHA1');
      verificador.update(dd);
      const publica = crypto.createPublicKey(caf.rsask_private_key);
      expect([nombre, verificador.verify(publica, firma, 'base64')]).toEqual([nombre, true]);
    }
  });

  test('las tildes y la eñe viajan en ISO-8859-1, y lo que no existe ahi se reemplaza', () => {
    const doc = documentos.get('factura con tildes, eñe y texto pegado de otro programa')!;
    const bytes = fs.readFileSync(doc.archivo);

    expect(doc.xml).toContain('<RznSocRecep>Panadería Ñuñoa Ltda.</RznSocRecep>');
    expect(doc.xml).toContain('<NmbItem>Café Especial - 1 kg...</NmbItem>');
    expect(doc.xml).toContain('<NmbItem>Ñandú de peluche 20 EUR</NmbItem>');
    expect(doc.xml).toContain('<GiroRecep>Elaboración de pans</GiroRecep>');
    // en ISO-8859-1 la Ñ es un solo byte, 0xD1; en UTF-8 serian dos (0xC3 0x91)
    expect(bytes.includes(Buffer.from([0xd1, 0x75, 0xf1, 0x6f, 0x61]))).toBe(true);
    expect(bytes.includes(Buffer.from([0xc3, 0x91]))).toBe(false);
  });

  test('un RUT que no se puede leer no gasta un folio', () => {
    const folio = () =>
      Number(defaultSqliteClient.queryOne<{ u: number }>(
        'SELECT ultimo_folio_usado AS u FROM sii_caf WHERE tenant_id = ? AND tipo_dte = 33 AND activo = 1 ORDER BY folio_desde DESC LIMIT 1',
        [TENANT]
      )?.u);
    const antes = folio();

    expect(() =>
      defaultDteEmitter.emitDocument({ tenantId: TENANT, tipoDte: TipoDTE.FACTURA_ELECTRONICA, metodoPago: 'EFECTIVO', items: [item('Pan', 1234)], receptor: { ...empresa, rut: 'sin rut' } })
    ).toThrow(/RUT/);
    // un RUT con el digito verificador equivocado tampoco
    expect(() =>
      defaultDteEmitter.emitDocument({ tenantId: TENANT, tipoDte: TipoDTE.FACTURA_ELECTRONICA, metodoPago: 'EFECTIVO', items: [item('Pan', 1234)], receptor: { ...empresa, rut: '76.555.001-9' } })
    ).toThrow(/RUT/);
    expect(folio()).toBe(antes);
  });

  test('el RUT del chofer se revisa antes de gastar el folio de la guia', () => {
    const folio = () =>
      Number(defaultSqliteClient.queryOne<{ u: number }>(
        'SELECT ultimo_folio_usado AS u FROM sii_caf WHERE tenant_id = ? AND tipo_dte = 52 AND activo = 1 ORDER BY folio_desde DESC LIMIT 1',
        [TENANT]
      )?.u);
    const antes = folio();

    expect(() =>
      defaultDteEmitter.emitDocument({
        tenantId: TENANT, tipoDte: TipoDTE.GUIA_DESPACHO, metodoPago: 'EFECTIVO', items: [item('Pan', 1234)], receptor: empresa,
        transporte: { indTraslado: 5, patente: 'ABCD12', choferRut: '11.111.111-2', choferNombre: 'Chofer' }
      })
    ).toThrow(/RUT/);
    expect(folio()).toBe(antes);
  });
});
