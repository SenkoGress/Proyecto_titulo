import { OcrDispatcherService } from '../../backend/src/ocr/ocr-dispatcher.service';
import { IOcrProvider } from '../../backend/src/ocr/ocr-provider.interface';
import { ExtractedInvoiceData } from '../../backend/src/ocr/types';

const proveedorCaido: IOcrProvider = {
  name: 'GeminiStubCaido',
  async extractInvoiceData(): Promise<ExtractedInvoiceData> {
    throw new Error('Sin conexion con el servicio de IA');
  }
};

const simulador: IOcrProvider = {
  name: 'MockStub',
  async extractInvoiceData(): Promise<ExtractedInvoiceData> {
    return {
      folio_factura: 'FAC-SIMULADA-001',
      rut_proveedor: '76.123.456-0',
      razon_social: 'Proveedor Inventado SpA',
      fecha_emision: '2026-10-08',
      // Con detalle real: el simulador devuelve una factura completa, y una extraccion sin items
      // ni folio se considera documento ilegible
      items: [{ descripcion: 'Bebida Cola 1.5L', cantidad: 6, precio_unitario: 850, subtotal: 5100 }],
      total: 5100,
      metodo_ingreso: 'SIMULADO'
    };
  }
};

describe('Pruebas Unitarias: Politica de Fallback del OCR de Facturas', () => {
  const entorno = { ...process.env };
  let dispatcher: OcrDispatcherService;

  // Entrada que no es un PDF valido, para que tampoco la resuelva el extractor nativo
  const entrada = { invoiceData: 'bm8tZXMtdW4tcGRm', fileName: 'factura.jpg', mimeType: 'image/jpeg' };

  beforeEach(() => {
    dispatcher = new OcrDispatcherService(proveedorCaido, simulador);
    delete process.env.ENABLE_MOCK_OCR;
    delete process.env.GEMINI_API_KEY;
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env = entorno;
  });

  test('sin ENABLE_MOCK_OCR devuelve error honesto en vez de inventar la factura', async () => {
    await expect(dispatcher.processInvoice(entrada)).rejects.toThrow(/No fue posible digitalizar/);
  });

  test('con ENABLE_MOCK_OCR=true el simulador si participa', async () => {
    process.env.ENABLE_MOCK_OCR = 'true';

    const resultado = await dispatcher.processInvoice(entrada);

    expect(resultado.usedFallback).toBe(true);
    expect(resultado.providerName).toBe('MockStub');
    expect(resultado.data.folio_factura).toBe('FAC-SIMULADA-001');
  });

  test('ENABLE_MOCK_OCR con cualquier otro valor no habilita el simulador', async () => {
    process.env.ENABLE_MOCK_OCR = 'false';
    await expect(dispatcher.processInvoice(entrada)).rejects.toThrow(/No fue posible digitalizar/);

    process.env.ENABLE_MOCK_OCR = '1';
    await expect(dispatcher.processInvoice(entrada)).rejects.toThrow(/No fue posible digitalizar/);
  });

  test('simulateFailure habilita el simulador solo fuera de produccion', async () => {
    const conSimulacion = { ...entrada, simulateFailure: true };

    const enPruebas = await dispatcher.processInvoice(conSimulacion);
    expect(enPruebas.usedFallback).toBe(true);

    // simulateFailure viaja en el cuerpo de la peticion: en produccion un cliente no debe
    // poder forzar una factura inventada que la pantalla mostraria como real
    process.env.NODE_ENV = 'production';
    await expect(dispatcher.processInvoice(conSimulacion)).rejects.toThrow(/No fue posible digitalizar/);
  });

  test('en produccion solo la configuracion del servidor habilita el simulador', async () => {
    process.env.NODE_ENV = 'production';
    await expect(dispatcher.processInvoice(entrada)).rejects.toThrow(/No fue posible digitalizar/);

    process.env.ENABLE_MOCK_OCR = 'true';
    const resultado = await dispatcher.processInvoice(entrada);
    expect(resultado.usedFallback).toBe(true);
  });

  test('tener GEMINI_API_KEY ya no decide por si misma la politica del simulador', async () => {
    process.env.GEMINI_API_KEY = 'clave-de-prueba';
    await expect(dispatcher.processInvoice(entrada)).rejects.toThrow(/No fue posible digitalizar/);

    process.env.ENABLE_MOCK_OCR = 'true';
    const resultado = await dispatcher.processInvoice(entrada);
    expect(resultado.usedFallback).toBe(true);
  });
});
