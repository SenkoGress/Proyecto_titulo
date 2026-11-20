import http from 'http';
import app from '../../src/index';
import { initializeDatabase } from '../../src/database/init-db';
import { defaultSqliteClient } from '../../src/database/sqlite/client';
import { defaultDteEmitter } from '../../src/dte/dte-emitter.service';
import { ItemDTE, TipoDTE } from '../../src/dte/types';
import { defaultF29ReportService } from '../../src/dte/f29-report.service';
import { mesLocal } from '../../src/utils/fecha-local';

const TENANT = '00000000-0000-0000-0000-000000000001';
const USUARIO = '00000000-0000-0000-0000-000000000002';

/** Lee un numero de un nodo del XML; 0 si el nodo no esta. */
function nodo(xml: string, nombre: string): number {
  const m = new RegExp(`<${nombre}>([^<]*)</${nombre}>`).exec(xml);
  return m ? Number(m[1]) : 0;
}
function todos(xml: string, nombre: string): number[] {
  return [...xml.matchAll(new RegExp(`<${nombre}>([^<]*)</${nombre}>`, 'g'))].map((m) => Number(m[1]));
}

/** Lo que valida el SII sobre el XML firmado, no sobre el calculo interno. */
function cuadraElXml(xml: string) {
  const totales = /<Totales>(.*?)<\/Totales>/.exec(xml)![1];
  const suma = nodo(totales, 'MntNeto') + nodo(totales, 'IVA') + nodo(totales, 'MntExe') + todos(totales, 'MontoImp').reduce((a, b) => a + b, 0);
  return { suma, total: nodo(totales, 'MntTotal'), detalle: todos(xml, 'MontoItem').reduce((a, b) => a + b, 0) };
}

function item(nombre: string, precioUnitario: number, cantidad = 1, extra: Partial<ItemDTE> = {}): ItemDTE {
  return { nroLinea: 1, nombre, cantidad, precioUnitario, subtotal: precioUnitario * cantidad, ...extra };
}

describe('Documento tributario que cuadra y escrituras del catalogo solo para el administrador', () => {
  let servidor: http.Server;
  let base: string;
  let tokenAdmin = '';
  let tokenCajero = '';
  const productoId = 'cccccccc-0000-4000-8000-000000000c01';

  const pedir = async (metodo: string, ruta: string, cuerpo?: unknown, token?: string) => {
    const res = await fetch(`${base}/api/v1${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    });
    const texto = await res.text();
    let json: any = texto;
    try {
      json = JSON.parse(texto);
    } catch {
      // respuesta sin json
    }
    return { status: res.status, json };
  };
  const producto = () =>
    defaultSqliteClient.queryOne<{ precio_venta: number; stock_actual: number }>(
      'SELECT precio_venta, stock_actual FROM productos WHERE id = ?',
      [productoId]
    )!;

  beforeAll(async () => {
    await initializeDatabase();
    defaultSqliteClient.execute(
      `INSERT OR REPLACE INTO productos (id, tenant_id, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, activo)
       VALUES (?, ?, 'CUADRA-1234', 'Producto de 1.234', 50, 1, 600, 1234, 1)`,
      [productoId, TENANT]
    );
    await new Promise<void>((listo) => {
      servidor = app.listen(0, () => {
        base = `http://127.0.0.1:${(servidor.address() as any).port}`;
        listo();
      });
    });
    await pedir('POST', '/caja/abrir', { tenant_id: TENANT, usuario_id: USUARIO, monto_apertura: 20000 });
    tokenAdmin = (await pedir('POST', '/auth/login', { tenant_id: TENANT, email: 'admin@gestock.cl', password: 'admin123' })).json.token;
    tokenCajero = (await pedir('POST', '/auth/login', { tenant_id: TENANT, email: 'cajero@gestock.cl', password: 'cajero123' })).json.token;
  });

  afterAll(async () => {
    await new Promise((listo) => servidor.close(listo));
  });

  describe('el XML firmado cuadra', () => {
    const empresa = { rut: '76.555.001-9', razonSocial: 'Comercio Receptor', giro: 'COMERCIO', comuna: 'Santiago', ciudad: 'Santiago' };
    const referencia = { nroLineaRef: 1, tipoDocRef: 33, folioRef: 1, fechaRef: '2026-11-20', codigoRef: 1, razonRef: 'Prueba' };
    const emitir = (tipoDte: TipoDTE, items: ItemDTE[]) =>
      String(
        defaultDteEmitter.emitDocument({
          tenantId: TENANT,
          tipoDte,
          items,
          metodoPago: 'EFECTIVO',
          receptor: tipoDte === TipoDTE.BOLETA_ELECTRONICA || tipoDte === TipoDTE.BOLETA_EXENTA ? undefined : empresa,
          referencia: tipoDte === TipoDTE.NOTA_CREDITO ? referencia : undefined
        }).xmlDte
      );
    const totalesDe = (xml: string) => /<Totales>(.*?)<\/Totales>/.exec(xml)![1];
    const cerveza = item('Cerveza', 1990, 3, { codigoIla: 26, tasaIla: 20.5 });

    // [caso, tipo, items, lleva MntBruto, el detalle va en neto]
    test.each([
      ['boleta con montos que no terminan en cero', TipoDTE.BOLETA_ELECTRONICA, [item('A', 1234), item('B', 799, 3), item('C', 1005)], false, false],
      ['boleta con una linea exenta', TipoDTE.BOLETA_ELECTRONICA, [item('A', 1234), item('Exento', 5000, 1, { exento: true })], false, false],
      ['boleta exenta', TipoDTE.BOLETA_EXENTA, [item('Exento', 5000, 1, { exento: true })], false, false],
      ['factura sin impuesto adicional', TipoDTE.FACTURA_ELECTRONICA, [item('A', 1234), item('B', 799, 3)], true, false],
      ['nota de credito sin impuesto adicional', TipoDTE.NOTA_CREDITO, [item('A', 1234)], true, false],
      ['factura con impuesto adicional', TipoDTE.FACTURA_ELECTRONICA, [cerveza, item('Pan', 1234)], false, true],
      ['nota de credito con impuesto adicional', TipoDTE.NOTA_CREDITO, [cerveza], false, true],
      ['guia de despacho', TipoDTE.GUIA_DESPACHO, [item('A', 1234), item('B', 799, 3)], false, true]
    ] as Array<[string, TipoDTE, ItemDTE[], boolean, boolean]>)('%s', (_caso, tipoDte, items, bruto, detalleNeto) => {
      const xml = emitir(tipoDte, items);
      const { suma, total, detalle } = cuadraElXml(xml);
      const vendido = items.reduce((a, it) => a + Math.round(it.cantidad * it.precioUnitario), 0);

      // la cabecera cuadra y declara lo que se vendio
      expect(suma).toBe(total);
      expect(total).toBe(vendido);
      // MntBruto es solo para documentos sin impuestos adicionales y no aplica a la guia (formato DTE del SII)
      expect(xml.includes('<MntBruto>1</MntBruto>')).toBe(bruto);
      // con montos brutos el detalle suma el total; con detalle neto suma el neto mas lo exento
      const totales = totalesDe(xml);
      expect(detalle).toBe(detalleNeto ? nodo(totales, 'MntNeto') + nodo(totales, 'MntExe') : total);
      // cada linea cumple cantidad por precio
      const lineas = [...xml.matchAll(/<QtyItem>([^<]*)<\/QtyItem><PrcItem>([^<]*)<\/PrcItem>(?:<CodImpAdic>\d+<\/CodImpAdic>)?<MontoItem>([^<]*)<\/MontoItem>/g)];
      expect(lineas).toHaveLength(items.length);
      for (const [, qty, prc, monto] of lineas) expect(Math.round(Number(qty) * Number(prc))).toBe(Number(monto));
    });

    test('el detalle sigue el orden del esquema: IndExe antes del nombre y CodImpAdic justo antes del monto', () => {
      const xml = emitir(TipoDTE.FACTURA_ELECTRONICA, [cerveza, item('Exento', 5000, 1, { exento: true })]);

      expect(xml).toMatch(/<NroLinDet>2<\/NroLinDet><IndExe>1<\/IndExe><NmbItem>/);
      expect(xml).toMatch(/<\/PrcItem><CodImpAdic>26<\/CodImpAdic><MontoItem>/);
      // una linea exenta no lleva impuesto adicional
      expect(todos(xml, 'CodImpAdic')).toEqual([26]);
    });

    test('la boleta no lleva TasaIVA, y la exenta tampoco neto ni IVA', () => {
      const boleta = totalesDe(emitir(TipoDTE.BOLETA_ELECTRONICA, [item('A', 1234)]));
      const exenta = totalesDe(emitir(TipoDTE.BOLETA_EXENTA, [item('Exento', 5000, 1, { exento: true })]));
      const factura = totalesDe(emitir(TipoDTE.FACTURA_ELECTRONICA, [item('A', 1234)]));

      expect(boleta).not.toContain('<TasaIVA>');
      expect(boleta).toContain('<MntNeto>');
      expect(exenta).not.toMatch(/<MntNeto>|<IVA>|<TasaIVA>/);
      expect(exenta).toContain('<MntExe>5000</MntExe>');
      expect(factura).toContain('<TasaIVA>19</TasaIVA>');
    });

    test('un precio con decimales viaja con sus decimales', () => {
      const xml = emitir(TipoDTE.BOLETA_ELECTRONICA, [item('Granel', 333.33, 3)]);

      expect(xml).toContain('<PrcItem>333.33</PrcItem>');
      expect(xml).toContain('<MontoItem>1000</MontoItem>');
    });

    test('un impuesto adicional sin codigo, o sin tasa, no cuenta', () => {
      const sinCodigo = emitir(TipoDTE.FACTURA_ELECTRONICA, [item('A', 1990, 1, { tasaIla: 20.5 })]);
      const sinTasa = emitir(TipoDTE.FACTURA_ELECTRONICA, [item('A', 1990, 1, { codigoIla: 26 })]);

      for (const xml of [sinCodigo, sinTasa]) {
        expect(xml).not.toContain('<CodImpAdic>');
        expect(xml).not.toContain('<ImptoReten>');
        expect(cuadraElXml(xml).suma).toBe(1990);
      }
    });

    test('con tarjeta el documento declara lo mismo que con efectivo: el monto real', () => {
      const conTarjeta = defaultDteEmitter.emitDocument({ tenantId: TENANT, tipoDte: TipoDTE.BOLETA_ELECTRONICA, items: [item('A', 1234)], metodoPago: 'TARJETA', modeloEmision: 'MODELO_A' });
      expect(conTarjeta.totales.montoTotal).toBe(1234);
    });

    test('la emision directa y la guia rechazan cantidades y precios negativos', async () => {
      const directa = await pedir('POST', '/dte/emit', { tenantId: TENANT, tipoDte: 39, items: [{ nombre: 'A', cantidad: -1, precioUnitario: 1000 }] });
      const guia = await pedir('POST', '/dte/guias/emitir', {
        tenantId: TENANT, receptorRut: '76.555.001-9', receptorRazonSocial: 'X', direccionDestino: 'Calle 1',
        items: [{ nombre: 'A', cantidad: 1, precioUnitario: -500 }]
      });

      expect(directa.status).toBe(400);
      expect(guia.status).toBe(400);
    });
  });

  describe('el cobro en efectivo y el documento', () => {
    test('la venta guarda lo cobrado con redondeo y la boleta declara el monto real', async () => {
      const res = await pedir('POST', '/pos/checkout', {
        tenant_id: TENANT,
        usuario_id: USUARIO,
        metodo_pago: 'EFECTIVO',
        items: [{ producto_id: productoId, cantidad: 1 }]
      });

      expect(res.status).toBe(201);
      // Ley 20.956: 1.234 en efectivo se paga 1.230
      expect(res.json.data.total).toBe(1230);
      const venta = defaultSqliteClient.queryOne<{ total: number }>('SELECT total FROM transacciones_venta WHERE id = ?', [res.json.data.saleId]);
      expect(Number(venta?.total)).toBe(1230);
      const dte = defaultSqliteClient.queryOne<{ monto_total: number; monto_neto: number; monto_iva: number }>(
        'SELECT monto_total, monto_neto, monto_iva FROM sii_dte_emitidos WHERE venta_id = ?',
        [res.json.data.saleId]
      );
      expect(Number(dte?.monto_total)).toBe(1234);
      expect(Number(dte?.monto_neto) + Number(dte?.monto_iva)).toBe(1234);
    });

    test('el cierre Z suma lo cobrado y el F29 los documentos: difieren en el redondeo', async () => {
      const resumen = async () => (await pedir('GET', `/caja/resumen?tenant_id=${TENANT}`)).json.data;
      const boletasF29 = () =>
        defaultF29ReportService.generateMonthlyF29(TENANT, mesLocal()).debitoFiscal.items.find((i: any) => i.tipoDte === 39)?.montoTotal ?? 0;
      const efectivoAntes = Number((await resumen()).ventas_efectivo);
      const f29Antes = Number(boletasF29());

      const venta = await pedir('POST', '/pos/checkout', {
        tenant_id: TENANT, usuario_id: USUARIO, metodo_pago: 'EFECTIVO', items: [{ producto_id: productoId, cantidad: 1 }]
      });
      expect(venta.status).toBe(201);

      expect(Number((await resumen()).ventas_efectivo) - efectivoAntes).toBe(1230);
      expect(Number(boletasF29()) - f29Antes).toBe(1234);
    });
  });

  describe('solo el administrador escribe en el catalogo', () => {
    test('el cajero no da de alta, no edita precios y no ajusta stock, ni con una barra al final', async () => {
      const antes = producto();
      const intentos = [
        await pedir('POST', '/pos/products', { tenant_id: TENANT, nombre: 'Intento', sku: `CAJ-${Date.now()}`, precio_venta: 1 }, tokenCajero),
        await pedir('POST', '/pos/products/', { tenant_id: TENANT, nombre: 'Intento', sku: `CAJ2-${Date.now()}`, precio_venta: 1 }, tokenCajero),
        await pedir('PUT', `/pos/products/${productoId}`, { tenant_id: TENANT, precio_venta: 1 }, tokenCajero),
        await pedir('PUT', `/pos/products/${productoId}/`, { tenant_id: TENANT, precio_venta: 1 }, tokenCajero),
        await pedir('PATCH', `/pos/products/${productoId}/stock`, { tenant_id: TENANT, nuevo_stock: 999, motivo: 'x' }, tokenCajero),
        await pedir('PATCH', `/pos/products/${productoId}/stock/`, { tenant_id: TENANT, nuevo_stock: 999, motivo: 'x' }, tokenCajero)
      ];

      expect(intentos.map((r) => r.status)).toEqual([403, 403, 403, 403, 403, 403]);
      expect(producto()).toEqual(antes);
    });

    test('el cajero sigue consultando el catalogo y registrando mermas', async () => {
      expect((await pedir('GET', `/pos/products?tenant_id=${TENANT}`, undefined, tokenCajero)).status).toBe(200);
      expect((await pedir('GET', `/pos/products/${productoId}/history?tenant_id=${TENANT}`, undefined, tokenCajero)).status).not.toBe(403);

      const stock = producto().stock_actual;
      const merma = await pedir('POST', '/pos/mermas', { tenant_id: TENANT, producto_id: productoId, cantidad: 1, motivo: 'vencimiento' }, tokenCajero);
      expect(merma.status).not.toBe(403);
      expect(producto().stock_actual).toBe(stock - 1);
    });

    test('el administrador da de alta, edita precios y ajusta stock', async () => {
      const alta = await pedir('POST', '/pos/products', { tenant_id: TENANT, nombre: 'Alta del administrador', sku: `ADM-${Date.now()}`, precio_venta: 990 }, tokenAdmin);
      expect(alta.status).toBe(201);

      const edicion = await pedir('PUT', `/pos/products/${productoId}`, { tenant_id: TENANT, precio_venta: 1250 }, tokenAdmin);
      expect(edicion.status).toBe(200);
      expect(Number(producto().precio_venta)).toBe(1250);

      const ajuste = await pedir('PATCH', `/pos/products/${productoId}/stock`, { tenant_id: TENANT, nuevo_stock: 40, motivo: 'conteo' }, tokenAdmin);
      expect(ajuste.status).toBe(200);
      expect(Number(producto().stock_actual)).toBe(40);

      // deja el precio como estaba para las demas pruebas
      await pedir('PUT', `/pos/products/${productoId}`, { tenant_id: TENANT, precio_venta: 1234 }, tokenAdmin);
    });

    test('el cajero sigue haciendo devoluciones', async () => {
      const venta = await pedir('POST', '/pos/checkout', {
        tenant_id: TENANT, usuario_id: USUARIO, metodo_pago: 'EFECTIVO', items: [{ producto_id: productoId, cantidad: 1 }]
      }, tokenCajero);
      expect(venta.status).toBe(201);

      const devolucion = await pedir('POST', '/pos/devolucion', { tenant_id: TENANT, usuario_id: USUARIO, venta_id: venta.json.data.saleId, motivo: 'prueba' }, tokenCajero);
      expect(devolucion.status).toBe(200);
    });
  });
});
