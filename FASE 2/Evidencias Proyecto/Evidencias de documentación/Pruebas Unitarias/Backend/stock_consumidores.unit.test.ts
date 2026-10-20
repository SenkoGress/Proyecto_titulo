import fs from 'fs';
import path from 'path';

/**
 * El stock se descuenta hoy en tres lugares: la venta, la merma y la ingesta de facturas. Cada uno
 * avisa al servicio de lotes. El riesgo no es que esos tres se rompan, sino que aparezca un cuarto
 * que no avise: los lotes se desincronizarian en silencio, sin error y sin prueba que falle.
 *
 * Esta suite no ejercita comportamiento, revisa el codigo fuente. Si alguien agrega una sentencia
 * que mueve `stock_actual` en un archivo que no esta declarado abajo, falla y obliga a decidir
 * explicitamente si ese lugar debe consumir lotes o no.
 */

const RAIZ = path.resolve(__dirname, '../../backend/src');

/** Archivos autorizados a mover stock, con el motivo por el que lo hacen. */
const CONSUMIDORES_DECLARADOS: Record<string, string> = {
  'routes/pos.routes.ts': 'Venta en caja y merma: ambas llaman a consumirFefo',
  'invoices/invoice-ingestion.service.ts': 'Ingesta de facturas: suma stock y registra el lote',
  'sync/cloud-sync-receiver.service.ts': 'Sincronizacion en la nube: descuenta y consume lote despues de confirmar',
  'database/init-db.ts': 'Siembra inicial de datos de demostracion',
  'replenishment/replenishment.service.ts': 'Solo lee stock para calcular el punto de reorden'
};

/** Mueve `stock_actual` en una sentencia de escritura. */
const MUEVE_STOCK = /(UPDATE\s+productos[\s\S]{0,400}?stock_actual\s*=)|(stock_actual\s*=\s*stock_actual\s*[+-])/i;

function archivosTs(dir: string, acumulado: string[] = []): string[] {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) archivosTs(completo, acumulado);
    else if (entrada.name.endsWith('.ts')) acumulado.push(completo);
  }
  return acumulado;
}

function relativo(absoluto: string): string {
  return path.relative(RAIZ, absoluto).split(path.sep).join('/');
}

describe('Pruebas Unitarias: Todo Consumidor de Stock Declara su Relacion con los Lotes', () => {
  const archivos = archivosTs(RAIZ);

  test('1. Ningun archivo mueve stock sin estar declarado', () => {
    const noDeclarados = archivos
      .filter((a) => MUEVE_STOCK.test(fs.readFileSync(a, 'utf8')))
      .map(relativo)
      .filter((r) => !(r in CONSUMIDORES_DECLARADOS));

    // Si esta lista deja de estar vacia: o el archivo nuevo llama a LotesService, o se agrega
    // arriba con el motivo por el que no corresponde que lo haga
    expect(noDeclarados).toEqual([]);
  });

  test('2. Los consumidores que descuentan stock avisan al servicio de lotes', () => {
    const descuentan = [
      'routes/pos.routes.ts',
      'sync/cloud-sync-receiver.service.ts'
    ];

    for (const relativoArchivo of descuentan) {
      const contenido = fs.readFileSync(path.join(RAIZ, relativoArchivo), 'utf8');
      expect(contenido).toMatch(/LotesService|consumirFefo/);
    }
  });

  test('3. La ingesta registra el lote de lo que entra', () => {
    const contenido = fs.readFileSync(path.join(RAIZ, 'invoices/invoice-ingestion.service.ts'), 'utf8');

    expect(contenido).toMatch(/defaultLotesService\.registrar\(/);
    expect(contenido).toMatch(/registrarEnNube/);
  });

  test('4. La declaracion no acumula archivos que ya no existen', () => {
    const inexistentes = Object.keys(CONSUMIDORES_DECLARADOS).filter(
      (r) => !fs.existsSync(path.join(RAIZ, r))
    );

    // Una lista de excepciones que envejece deja de proteger y empieza a estorbar
    expect(inexistentes).toEqual([]);
  });

  test('5. El servicio de lotes nunca interrumpe la operacion que lo invoca', () => {
    const contenido = fs.readFileSync(path.join(RAIZ, 'inventory/lotes.service.ts'), 'utf8');

    // consumirFefo atrapa su propio error y devuelve el faltante en vez de propagarlo
    expect(contenido).toMatch(/catch \(error\)[\s\S]{0,400}return vacio;/);
    expect(contenido).not.toMatch(/throw new Error/);
  });
});
