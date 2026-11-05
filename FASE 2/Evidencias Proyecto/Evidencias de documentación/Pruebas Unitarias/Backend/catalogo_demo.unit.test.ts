import fs from 'fs';
import path from 'path';
import { defaultSqliteClient } from '../../backend/src/database/sqlite/client';
import { defaultPgClient } from '../../backend/src/database/postgres/client';
import { initializeDatabase } from '../../backend/src/database/init-db';
import {
  cargarCatalogoDemo,
  leerCatalogoDemo
} from '../../backend/src/database/cargar-catalogo-demo';

const TENANT = '00000000-0000-0000-0000-000000000001';

/**
 * La carpeta de datos del usuario se borra para volver a ver el sistema como lo vera quien lo
 * instale, y con ella se va el catalogo. El de demostracion vive en el repositorio, fuera de esa
 * carpeta, de modo que se puede recuperar y es el mismo en todos los equipos.
 */
describe('Pruebas Unitarias: Catalogo de Demostracion', () => {
  beforeAll(async () => {
    defaultPgClient.tripCircuit();
    await initializeDatabase();
  });

  describe('El archivo del catalogo', () => {
    test('vive en el proyecto y no en la carpeta de datos del usuario', () => {
      const ruta = path.join(__dirname, '../../semillas/catalogo-demo.json');
      expect(fs.existsSync(ruta)).toBe(true);
    });

    test('trae productos y proveedores completos, con precios y existencias', () => {
      const catalogo = leerCatalogoDemo();

      expect(catalogo).not.toBeNull();
      expect(catalogo!.productos.length).toBeGreaterThanOrEqual(15);
      expect(catalogo!.proveedores.length).toBeGreaterThanOrEqual(3);

      for (const producto of catalogo!.productos) {
        expect(producto.sku).toBeTruthy();
        expect(producto.nombre).toBeTruthy();
        expect(producto.precio_venta).toBeGreaterThan(0);
        expect(producto.precio_compra).toBeGreaterThan(0);
        expect(producto.stock_minimo).toBeGreaterThan(0);
        // El precio de venta no puede estar bajo el de compra: seria vender con perdida
        expect(producto.precio_venta).toBeGreaterThanOrEqual(producto.precio_compra);
      }
    });

    test('no lleva productos de prueba automatica', () => {
      const catalogo = leerCatalogoDemo();

      const basura = catalogo!.productos.filter(
        (p) => p.sku.startsWith('PRUEBA-') || /borrar/i.test(p.nombre)
      );
      expect(basura).toEqual([]);
    });

    test('cada producto apunta a un proveedor que el propio catalogo trae', () => {
      const catalogo = leerCatalogoDemo();
      const proveedores = new Set(catalogo!.proveedores.map((p) => p.id));

      for (const producto of catalogo!.productos) {
        if (!producto.proveedor_id) continue;
        // Si apuntara a un proveedor ausente, la clave foranea rechazaria la fila al sembrar
        expect(proveedores.has(producto.proveedor_id)).toBe(true);
      }
    });

    test('deja productos bajo el punto de reorden, para que el aviso tenga que mostrar', () => {
      const catalogo = leerCatalogoDemo();

      const bajoReorden = catalogo!.productos.filter((p) => p.stock_actual <= p.stock_minimo);
      expect(bajoReorden.length).toBeGreaterThan(0);
    });
  });

  describe('La carga', () => {
    test('es aditiva: correrla dos veces no duplica el catalogo', async () => {
      const contar = () =>
        Number(
          defaultSqliteClient.queryOne<{ total: number }>(
            'SELECT COUNT(*) as total FROM productos WHERE tenant_id = ?',
            [TENANT]
          )?.total ?? 0
        );

      await cargarCatalogoDemo(TENANT);
      const despuesDeLaPrimera = contar();

      const segunda = await cargarCatalogoDemo(TENANT);

      expect(contar()).toBe(despuesDeLaPrimera);
      expect(segunda.productos_nuevos).toBe(0);
      expect(segunda.productos_existentes).toBeGreaterThan(0);
    });

    test('deja el catalogo consultable con su proveedor', async () => {
      await cargarCatalogoDemo(TENANT);
      const catalogo = leerCatalogoDemo();
      const muestra = catalogo!.productos.find((p) => p.proveedor_id);

      const fila = defaultSqliteClient.queryOne<{ nombre: string; proveedor: string }>(
        `SELECT p.nombre, v.nombre_proveedores as proveedor
           FROM productos p LEFT JOIN proveedores v ON v.id = p.proveedor_id
          WHERE p.sku = ? AND p.tenant_id = ?`,
        [muestra!.sku, TENANT]
      );

      expect(fila?.nombre).toBe(muestra!.nombre);
      expect(fila?.proveedor).toBeTruthy();
    });
  });

  describe('Quien decide sembrarlo', () => {
    test('la inicializacion no lo siembra sola: hace falta pedirlo', () => {
      const init = fs.readFileSync(
        path.join(__dirname, '../../backend/src/database/init-db.ts'),
        'utf8'
      );

      // Una instalacion real empieza con su propia mercaderia: sembrar productos de ejemplo sin
      // preguntar seria dejarle al local existencias que no tiene.
      expect(init).toContain("process.env.CARGAR_CATALOGO_DEMO === 'true'");
    });

    test('la aplicacion de escritorio lo ofrece en el primer inicio', () => {
      const formulario = fs.readFileSync(
        path.join(__dirname, '../../electron/primer-arranque.html'),
        'utf8'
      );
      const principal = fs.readFileSync(
        path.join(__dirname, '../../electron/main.js'),
        'utf8'
      );

      expect(formulario).toContain('type="checkbox"');
      expect(formulario).toContain('catalogo de demostracion');
      expect(principal).toContain('CARGAR_CATALOGO_DEMO');
    });

    test('el catalogo viaja dentro del instalador', () => {
      const paquete = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')
      );

      expect(paquete.build.files).toContain('semillas/**/*');
      expect(paquete.scripts['datos:demo']).toContain('cargar-catalogo-demo');
    });
  });
});
