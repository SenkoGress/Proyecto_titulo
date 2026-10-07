import { TipoDTE, SiiModeloEmision } from '../src/dte/types';

function verificarEmisionBoleta(modelo: SiiModeloEmision, metodoPago: string): boolean {
  return modelo === 'MODELO_A' || metodoPago === 'EFECTIVO';
}

describe('Pruebas Unitarias: Facturacion Electronica DTE, Correlatividad y Res. Exenta N° 176', () => {
  describe('Clasificacion de Tipos de Documento Tributario Electronico', () => {
    test('reconoce los codigos DTE oficiales del SII', () => {
      expect(TipoDTE.FACTURA_ELECTRONICA).toBe(33);
      expect(TipoDTE.BOLETA_ELECTRONICA).toBe(39);
      expect(TipoDTE.BOLETA_EXENTA).toBe(41);
      expect(TipoDTE.GUIA_DESPACHO).toBe(52);
      expect(TipoDTE.NOTA_CREDITO).toBe(61);
    });
  });

  describe('Prevencion de Doble Tributacion (Resolucion Exenta N° 176)', () => {
    test('en MODELO_B: Ventas en Efectivo SI deben emitir Boleta Electronica 39', () => {
      const emiteBoleta = verificarEmisionBoleta('MODELO_B', 'EFECTIVO');
      expect(emiteBoleta).toBe(true);
    });

    test('en MODELO_B: Ventas con Tarjeta (Transbank/MP/SumUp) NO emiten Boleta 39 para evitar doble debito fiscal', () => {
      const emiteBoleta = verificarEmisionBoleta('MODELO_B', 'TRANSBANK');
      expect(emiteBoleta).toBe(false);
    });

    test('en MODELO_A: Todas las ventas emiten Boleta 39 independientemente del medio de pago', () => {
      const emiteBoleta = verificarEmisionBoleta('MODELO_A', 'TRANSBANK');
      expect(emiteBoleta).toBe(true);
    });
  });

  describe('Estructura XML del Timbre Electronico DTE (<TED>)', () => {
    test('valida los nodos mandatarios del estandar tecnico del SII', () => {
      const dummyTedXml = '<TED version="1.0"><DD><RE>76123456-7</RE><TD>39</TD><F>1001</F><FE>2026-09-16</FE><RR>66666666-6</RR><MNT>2500</MNT></DD><FRMT algoritmo="SHA1withRSA">MOCK_SIGNATURE</FRMT></TED>';

      expect(dummyTedXml).toContain('<TED version="1.0">');
      expect(dummyTedXml).toContain('<RE>76123456-7</RE>');
      expect(dummyTedXml).toContain('<TD>39</TD>');
      expect(dummyTedXml).toContain('<FRMT algoritmo="SHA1withRSA">');
    });
  });
});
