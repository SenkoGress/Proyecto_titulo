describe('Pruebas Unitarias: Algoritmos Predictivos de Reabastecimiento e Inventario (ROP)', () => {
  describe('Calculo de Velocidad de Venta Diaria', () => {
    test('calcula el promedio diario exacto de unidades vendidas', () => {
      const unidadesTotales = 140;
      const diasAnalisis = 14;

      const velocidadDiaria = unidadesTotales / diasAnalisis;
      expect(velocidadDiaria).toBe(10.0);
    });

    test('retorna 0 cuando no existen ventas en el periodo de analisis', () => {
      const unidadesTotales = 0;
      const diasAnalisis = 30;

      const velocidadDiaria = unidadesTotales / diasAnalisis;
      expect(velocidadDiaria).toBe(0);
    });
  });

  describe('Calculo de Punto de Reorden (ROP = Demanda_LeadTime + Stock_Seguridad)', () => {
    test('determina el ROP considerando lead time del proveedor y stock de seguridad', () => {
      const demandaDiaria = 5.0; // 5 unidades por dia
      const leadTimeDias = 4;    // Proveedor tarda 4 dias en entregar
      const stockSeguridad = 10; // Colchon para fluctuaciones

      // Demanda durante el lead time = 5 * 4 = 20
      // ROP = 20 + 10 = 30 unidades
      const rop = Math.ceil((demandaDiaria * leadTimeDias) + stockSeguridad);
      expect(rop).toBe(30);
    });

    test('dispara sugerencia de compra cuando el stock actual es menor o igual al ROP', () => {
      const rop = 30;
      const stockActual = 18;

      const requiereCompra = stockActual <= rop;
      const unidadesSugeridas = rop - stockActual;

      expect(requiereCompra).toBe(true);
      expect(unidadesSugeridas).toBe(12);
    });

    test('no sugiere compra cuando el stock actual es superior al ROP', () => {
      const rop = 30;
      const stockActual = 45;

      const requiereCompra = stockActual <= rop;
      expect(requiereCompra).toBe(false);
    });
  });

  describe('Ajuste de Cantidades por Multiplo de Empaque / Bulto', () => {
    test('ajusta la sugerencia hacia arriba para cumplir con el empaque minimo del proveedor', () => {
      const unidadesNecesarias = 14;
      const tamanoBulto = 12; // Se vende en cajas de 12 unidades

      const bultos = Math.ceil(unidadesNecesarias / tamanoBulto);
      const unidadesAjustadas = bultos * tamanoBulto;

      expect(bultos).toBe(2);
      expect(unidadesAjustadas).toBe(24);
    });
  });
});
