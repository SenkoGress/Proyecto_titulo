import {
  clasificarSemaforo,
  diasHastaVencer,
  fechaDeVencimientoParaGuardar,
  unidadesVencidasVendidas
} from '../../backend/src/inventory/vencimiento';

describe('Pruebas Unitarias: Semaforo de vencimientos y vencidos vendidos', () => {
  // Las 22:30 del 19 de noviembre en el reloj del equipo: en UTC ya es el dia siguiente
  const noche = new Date(2026, 10, 19, 22, 30);

  test('los dias se cuentan en el calendario del equipo, sin importar la hora', () => {
    expect(diasHastaVencer('2026-11-19', noche)).toBe(0);
    expect(diasHastaVencer('2026-11-18', noche)).toBe(-1);
    expect(diasHastaVencer('2026-12-19', noche)).toBe(30);
  });

  test('una fecha guardada con hora vale por sus diez primeros caracteres', () => {
    expect(diasHastaVencer('2026-11-18 00:00:00', noche)).toBe(-1);
    expect(diasHastaVencer('2026-11-20T03:00:00.000Z', noche)).toBe(1);
  });

  test('lo que no es una fecha no da un numero falso', () => {
    expect(diasHastaVencer('pronto', noche)).toBeNull();
    expect(diasHastaVencer('2026-02-30', noche)).toBeNull();
    expect(diasHastaVencer(null, noche)).toBeNull();
    expect(diasHastaVencer(20261119, noche)).toBeNull();
  });

  test('el semaforo tiene cinco estados y sus limites no cambian', () => {
    const estado = (dias: number) => clasificarSemaforo(dias).estado;
    expect(estado(-1)).toBe('VENCIDO');
    expect(estado(0)).toBe('VENCE_ESTA_SEMANA');
    expect(estado(7)).toBe('VENCE_ESTA_SEMANA');
    expect(estado(8)).toBe('VENCE_EN_15_DIAS');
    expect(estado(15)).toBe('VENCE_EN_15_DIAS');
    expect(estado(16)).toBe('VENCE_EN_30_DIAS');
    expect(estado(30)).toBe('VENCE_EN_30_DIAS');
    expect(estado(31)).toBe('VIGENTE');
    expect(clasificarSemaforo(-1).nivel_riesgo).toBe('ROJO_CRITICO');
    expect(clasificarSemaforo(31).nivel_riesgo).toBe('VERDE');
  });

  test('de una venta cuenta solo lo que salio de lotes vencidos', () => {
    const consumo = {
      sinRespaldo: 0,
      detalle: [
        { fecha_vencimiento: '2026-11-10', cantidad: 2 },
        { fecha_vencimiento: '2026-11-18', cantidad: 1 },
        { fecha_vencimiento: '2026-11-19', cantidad: 4 },
        { fecha_vencimiento: '2026-12-30', cantidad: 5 }
      ]
    };

    expect(unidadesVencidasVendidas(consumo, '2026-11-10', noche)).toEqual({ fecha_vencimiento: '2026-11-10', cantidad: 3 });
  });

  test('lo que ningun lote respalda se juzga por la fecha del producto', () => {
    const sinLotes = { sinRespaldo: 2, detalle: [] };

    expect(unidadesVencidasVendidas(sinLotes, '2026-11-01', noche)).toEqual({ fecha_vencimiento: '2026-11-01', cantidad: 2 });
    expect(unidadesVencidasVendidas(sinLotes, '2026-12-01', noche)).toBeNull();
    expect(unidadesVencidasVendidas(sinLotes, null, noche)).toBeNull();
    expect(unidadesVencidasVendidas(sinLotes, 'pronto', noche)).toBeNull();
  });

  test('al guardar, la fecha queda en AAAA-MM-DD, vacia queda en null y la ilegible se rechaza', () => {
    expect(fechaDeVencimientoParaGuardar('2026-12-01')).toBe('2026-12-01');
    expect(fechaDeVencimientoParaGuardar('2026-12-01T03:00:00.000Z')).toBe('2026-12-01');
    expect(fechaDeVencimientoParaGuardar('')).toBeNull();
    expect(fechaDeVencimientoParaGuardar(null)).toBeNull();
    expect(fechaDeVencimientoParaGuardar(undefined)).toBeNull();
    expect(fechaDeVencimientoParaGuardar('18/11/2025')).toBeUndefined();
    expect(fechaDeVencimientoParaGuardar('2026-02-30')).toBeUndefined();
    expect(fechaDeVencimientoParaGuardar(20261201)).toBeUndefined();
  });
});
