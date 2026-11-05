import fs from 'node:fs';
import path from 'node:path';
import { defaultSqliteClient, SqliteClient } from './sqlite/client';
import { defaultPgClient, PostgresClient } from './postgres/client';
import { logger } from '../utils/logger';

/**
 * Catalogo de demostracion versionado en el proyecto.
 *
 * La carpeta de datos del usuario se borra para volver a ver el sistema como lo vera quien lo
 * instale, y con ella se va el catalogo. Guardarlo aqui -fuera de esa carpeta y dentro del
 * repositorio- permite recuperarlo cuando haga falta, y que sea el mismo en todos los equipos del
 * equipo de trabajo: lo que se demuestra no depende de lo que cada uno haya tecleado.
 *
 * La carga es aditiva y no pisa nada: un producto que ya existe se deja como esta, de modo que
 * correrla dos veces no duplica el catalogo ni borra lo que el local haya agregado.
 */

export interface ProveedorSembrado {
  id: string;
  rut_proveedor: string;
  nombre_proveedores: string;
  dias_visita_proveedores?: string | null;
  email?: string | null;
  telefono?: string | null;
  whatsapp_contacto?: string | null;
  giro?: string | null;
  direccion?: string | null;
  origen_creacion?: string | null;
}

export interface ProductoSembrado {
  id: string;
  proveedor_id?: string | null;
  sku: string;
  codigo_barra?: string | null;
  nombre: string;
  categoria?: string | null;
  stock_actual: number;
  stock_minimo: number;
  precio_compra: number;
  precio_venta: number;
  impuesto_adicional_codigo?: number;
  impuesto_adicional_tasa?: number;
  fecha_vencimiento?: string | null;
  activo?: number;
}

export interface CatalogoDemo {
  descripcion: string;
  tenant_id: string;
  generado: string;
  proveedores: ProveedorSembrado[];
  productos: ProductoSembrado[];
}

export interface ResultadoCarga {
  cargado: boolean;
  motivo: string;
  proveedores_nuevos: number;
  productos_nuevos: number;
  productos_existentes: number;
}

/** Ubicaciones posibles del catalogo: en el proyecto, y dentro de la aplicacion empaquetada. */
function rutaCatalogo(): string | null {
  const candidatos = [
    process.env.CATALOGO_DEMO,
    path.resolve(process.cwd(), 'semillas', 'catalogo-demo.json'),
    path.join(__dirname, '../../../semillas/catalogo-demo.json'),
    path.join(__dirname, '../../../../semillas/catalogo-demo.json')
  ].filter(Boolean) as string[];

  return candidatos.find((ruta) => fs.existsSync(ruta)) || null;
}

export function leerCatalogoDemo(): CatalogoDemo | null {
  const ruta = rutaCatalogo();
  if (!ruta) return null;

  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8')) as CatalogoDemo;
  } catch (err) {
    logger.warn('CatalogoDemo', 'El archivo del catalogo de demostracion no se pudo leer', {
      ruta,
      error: err instanceof Error ? err.message : String(err)
    });
    return null;
  }
}

export async function cargarCatalogoDemo(
  tenantId?: string,
  sqliteClient: SqliteClient = defaultSqliteClient,
  pgClient: PostgresClient = defaultPgClient
): Promise<ResultadoCarga> {
  const vacio: ResultadoCarga = {
    cargado: false,
    motivo: '',
    proveedores_nuevos: 0,
    productos_nuevos: 0,
    productos_existentes: 0
  };

  const catalogo = leerCatalogoDemo();
  if (!catalogo) {
    return { ...vacio, motivo: 'no se encontro el archivo del catalogo de demostracion' };
  }

  const tenant = tenantId || catalogo.tenant_id;
  const resultado: ResultadoCarga = { ...vacio, cargado: true, motivo: 'catalogo cargado' };

  // Los proveedores van primero: el producto los referencia por clave foranea.
  for (const proveedor of catalogo.proveedores) {
    try {
      const antes = sqliteClient.queryOne<{ total: number }>(
        'SELECT COUNT(*) as total FROM proveedores WHERE id = ?',
        [proveedor.id]
      );
      if (Number(antes?.total ?? 0) > 0) continue;

      sqliteClient.execute(
        `INSERT INTO proveedores
           (id, tenant_id, rut_proveedor, nombre_proveedores, dias_visita_proveedores, email,
            telefono, whatsapp_contacto, giro, direccion, origen_creacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          proveedor.id,
          tenant,
          proveedor.rut_proveedor,
          proveedor.nombre_proveedores,
          proveedor.dias_visita_proveedores ?? null,
          proveedor.email ?? null,
          proveedor.telefono ?? null,
          proveedor.whatsapp_contacto ?? null,
          proveedor.giro ?? null,
          proveedor.direccion ?? null,
          proveedor.origen_creacion ?? 'CATALOGO'
        ]
      );
      resultado.proveedores_nuevos += 1;
    } catch (err) {
      logger.warn('CatalogoDemo', 'No se pudo sembrar el proveedor', {
        proveedor: proveedor.nombre_proveedores,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  for (const producto of catalogo.productos) {
    try {
      const existente = sqliteClient.queryOne<{ total: number }>(
        'SELECT COUNT(*) as total FROM productos WHERE tenant_id = ? AND (id = ? OR sku = ?)',
        [tenant, producto.id, producto.sku]
      );
      if (Number(existente?.total ?? 0) > 0) {
        resultado.productos_existentes += 1;
        continue;
      }

      sqliteClient.execute(
        `INSERT INTO productos
           (id, tenant_id, proveedor_id, codigo_barra, sku, nombre, stock_actual, stock_minimo,
            precio_compra, precio_venta, categoria, impuesto_adicional_codigo,
            impuesto_adicional_tasa, fecha_vencimiento, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          producto.id,
          tenant,
          producto.proveedor_id ?? null,
          producto.codigo_barra ?? null,
          producto.sku,
          producto.nombre,
          producto.stock_actual,
          producto.stock_minimo,
          producto.precio_compra,
          producto.precio_venta,
          producto.categoria ?? null,
          producto.impuesto_adicional_codigo ?? 0,
          producto.impuesto_adicional_tasa ?? 0,
          producto.fecha_vencimiento ?? null
        ]
      );
      resultado.productos_nuevos += 1;
    } catch (err) {
      logger.warn('CatalogoDemo', 'No se pudo sembrar el producto', {
        sku: producto.sku,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  // La nube recibe el mismo catalogo cuando esta disponible, para que los dos motores partan
  // iguales; si no lo esta, el respaldo del catalogo lo sube en la proxima sincronizacion.
  if (pgClient.isCloudAvailable()) {
    for (const proveedor of catalogo.proveedores) {
      try {
        await pgClient.query(
          `INSERT INTO proveedores (id, tenant_id, rut_proveedor, nombre_proveedores, email, origen_creacion)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
          [
            proveedor.id,
            tenant,
            proveedor.rut_proveedor,
            proveedor.nombre_proveedores,
            proveedor.email ?? null,
            proveedor.origen_creacion ?? 'CATALOGO'
          ]
        );
      } catch {}
    }

    for (const producto of catalogo.productos) {
      try {
        await pgClient.query(
          `INSERT INTO productos
             (id, tenant_id, proveedor_id, codigo_barra, sku, nombre, stock_actual, stock_minimo,
              precio_compra, precio_venta, categoria, activo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
           ON CONFLICT (id) DO NOTHING`,
          [
            producto.id,
            tenant,
            producto.proveedor_id ?? null,
            producto.codigo_barra ?? null,
            producto.sku,
            producto.nombre,
            producto.stock_actual,
            producto.stock_minimo,
            producto.precio_compra,
            producto.precio_venta,
            producto.categoria ?? null
          ]
        );
      } catch {}
    }
  }

  logger.info('CatalogoDemo', 'Catalogo de demostracion cargado', {
    productosNuevos: resultado.productos_nuevos,
    productosExistentes: resultado.productos_existentes,
    proveedoresNuevos: resultado.proveedores_nuevos
  });

  return resultado;
}

/** Permite correrlo a mano: npm run datos:demo */
if (require.main === module) {
  cargarCatalogoDemo()
    .then((resultado) => {
      console.log(
        `${resultado.productos_nuevos} productos nuevos, ${resultado.productos_existentes} ya estaban, ` +
          `${resultado.proveedores_nuevos} proveedores nuevos`
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error('No se pudo cargar el catalogo de demostracion:', err);
      process.exit(1);
    });
}
