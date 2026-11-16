import { codigoValido, consultarCodigo } from '../../backend/src/inventory/open-food-facts.service';

function respuesta(status: number, cuerpo: unknown, tipo = 'application/json') {
  const bytes = typeof cuerpo === 'string' || Buffer.isBuffer(cuerpo) ? Buffer.from(cuerpo as any) : null;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? tipo : null) },
    json: async () => cuerpo,
    // Copia solo los bytes del contenido: un Buffer chico comparte memoria con otros
    arrayBuffer: async () => new Uint8Array(bytes ?? Buffer.alloc(0)).buffer
  } as unknown as Response;
}

describe('Pruebas Unitarias: Consulta de codigos en Open Food Facts', () => {
  test('acepta solo codigos de 8 a 14 digitos', () => {
    expect(codigoValido('7801610001196')).toBe(true);
    expect(codigoValido('12345678')).toBe(true);
    expect(codigoValido('1234567')).toBe(false);
    expect(codigoValido('PRUEBA-1234')).toBe(false);
    expect(codigoValido('780161000119612')).toBe(false);
  });

  test('completa nombre en espanol, primera marca, contenido e imagen incrustada', async () => {
    const pedidas: string[] = [];
    const buscar = (async (url: string) => {
      pedidas.push(url);
      if (url.includes('/api/v2/product/')) {
        return respuesta(200, {
          status: 1,
          product: {
            product_name: 'Cream',
            product_name_es: 'Crema de leche',
            brands: 'Nestlé, La Lechera',
            quantity: '200 ml',
            image_front_small_url: 'https://images.openfoodfacts.org/crema.jpg'
          }
        });
      }
      return respuesta(200, 'jpg', 'image/jpeg');
    }) as unknown as typeof fetch;

    const resultado = await consultarCodigo('7613035000000', buscar);

    expect(resultado.estado).toBe('encontrado');
    if (resultado.estado !== 'encontrado') return;
    expect(resultado.producto).toMatchObject({
      codigo: '7613035000000',
      nombre: 'Crema de leche',
      marca: 'Nestlé',
      contenido: '200 ml',
      fuente: 'Open Food Facts'
    });
    expect(resultado.producto.imagen).toBe(`data:image/jpeg;base64,${Buffer.from('jpg').toString('base64')}`);
    expect(pedidas[0]).toContain('/7613035000000.json');
  });

  test('un codigo que la base no tiene es no_encontrado, por 404 o por status 0', async () => {
    const con404 = (async () => respuesta(404, {})) as unknown as typeof fetch;
    const conStatus0 = (async () => respuesta(200, { status: 0 })) as unknown as typeof fetch;
    expect((await consultarCodigo('7800000000001', con404)).estado).toBe('no_encontrado');
    expect((await consultarCodigo('7800000000001', conStatus0)).estado).toBe('no_encontrado');
  });

  test('sin red responde sin_conexion en vez de lanzar', async () => {
    const sinRed = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const resultado = await consultarCodigo('7800000000001', sinRed);
    expect(resultado).toEqual({ estado: 'sin_conexion', motivo: 'fetch failed' });
  });

  test('si la imagen falla o no es imagen, el producto se completa igual sin ella', async () => {
    const buscar = (async (url: string) =>
      url.includes('/api/v2/product/')
        ? respuesta(200, { status: 1, product: { product_name: 'Galletas', image_front_small_url: 'https://x/img' } })
        : respuesta(200, '<html>', 'text/html')) as unknown as typeof fetch;
    const resultado = await consultarCodigo('7800000000001', buscar);
    expect(resultado.estado).toBe('encontrado');
    if (resultado.estado === 'encontrado') expect(resultado.producto.imagen).toBeNull();
  });
});
