import fs from 'fs';
import os from 'os';
import path from 'path';
import { defaultSqliteClient } from '../../backend/src/database/sqlite/client';
import { initializeDatabase } from '../../backend/src/database/init-db';
import { PostgresClient } from '../../backend/src/database/postgres/client';
import { InvoiceIngestionService } from '../../backend/src/invoices/invoice-ingestion.service';
import { InvoiceFileStore } from '../../backend/src/invoices/invoice-file.store';

const TENANT = '00000000-0000-0000-0000-000000000001';

interface ConsultaRegistrada {
  sql: string;
  params: unknown[];
}

/**
 * Nube simulada: registra lo que recibe para comprobar que la factura, el proveedor y los bytes
 * del documento viajan de verdad. El recorrido contra un PostgreSQL real se verifica aparte con
 * docker compose, porque pg-mem no admite parametros binarios para BYTEA.
 */
function nubeSimulada(opciones: { disponible?: boolean; proveedorExistente?: string; falla?: boolean } = {}) {
  const consultas: ConsultaRegistrada[] = [];
  const cliente = {
    isCloudAvailable: () => opciones.disponible !== false,
    async query(sql: string, params: unknown[] = []) {
      consultas.push({ sql, params });
      if (opciones.falla) throw new Error('Cloud unreachable');
      if (sql.includes('SELECT id FROM proveedores')) {
        return { rows: opciones.proveedorExistente ? [{ id: opciones.proveedorExistente }] : [], rowCount: 0 };
      }
      if (sql.includes('SELECT archivo_contenido')) {
        return { rows: [{ archivo_contenido: Buffer.from('documento-desde-la-nube') }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }
  };
  return { cliente: cliente as unknown as PostgresClient, consultas };
}

describe('Pruebas Unitarias: Respaldo de Facturas en la Nube', () => {
  let directorio: string;
  let store: InvoiceFileStore;
  let rutaDocumento: string;
  const FACTURA_ID = 'fact-respaldo-0001';
  const PROVEEDOR_ID = 'prov-respaldo-0001';

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(() => {
    directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'gestock-nube-'));
    store = new InvoiceFileStore(directorio, 10);

    const guardado = store.guardar(TENANT, Buffer.from('contenido-del-respaldo').toString('base64'), 'compra.pdf', 'application/pdf');
    rutaDocumento = guardado.ruta;

    defaultSqliteClient.execute(
      `INSERT OR REPLACE INTO proveedores (id, tenant_id, rut_proveedor, nombre_proveedores, origen_creacion)
       VALUES (?, ?, '82.111.222-3', 'Proveedor Offline Ltda', 'FACTURA')`,
      [PROVEEDOR_ID, TENANT]
    );
    defaultSqliteClient.execute(
      `INSERT OR REPLACE INTO factura_ingresos
         (id, tenant_id, proveedor_id, numero_factura, fecha_ingreso, estado, cantidad, total,
          archivo_ruta, archivo_nombre, archivo_mime, archivo_respaldado)
       VALUES (?, ?, ?, 'FAC-RESP-1', date('now'), 'PROCESSED', 1, 5000, ?, 'compra.pdf', 'application/pdf', 0)`,
      [FACTURA_ID, TENANT, PROVEEDOR_ID, rutaDocumento]
    );
  });

  afterEach(() => {
    defaultSqliteClient.execute('DELETE FROM factura_ingresos WHERE id = ?', [FACTURA_ID]);
    defaultSqliteClient.execute('DELETE FROM proveedores WHERE id = ?', [PROVEEDOR_ID]);
    fs.rmSync(directorio, { recursive: true, force: true });
  });

  const pendientes = () =>
    defaultSqliteClient.queryOne<{ archivo_respaldado: number }>(
      'SELECT archivo_respaldado FROM factura_ingresos WHERE id = ?',
      [FACTURA_ID]
    );

  test('sube la factura con los bytes del documento y marca el respaldo en local', async () => {
    const { cliente, consultas } = nubeSimulada();
    const servicio = new InvoiceIngestionService(cliente, undefined, store);

    const resumen = await servicio.respaldarFacturasEnNube(TENANT);

    expect(resumen).toEqual({ respaldados: 1, pendientes: 0, omitidos: 0 });

    const insercion = consultas.find((c) => c.sql.includes('INSERT INTO factura_ingresos'));
    expect(insercion).toBeDefined();
    const bytes = insercion!.params.find((p) => Buffer.isBuffer(p)) as Buffer;
    expect(bytes.toString()).toBe('contenido-del-respaldo');
    expect(insercion!.sql).toContain('ON CONFLICT (id) DO UPDATE');

    expect(pendientes()?.archivo_respaldado).toBe(1);
  });

  test('replica el proveedor nacido offline antes de la factura, por la clave foranea', async () => {
    const { cliente, consultas } = nubeSimulada();

    await new InvoiceIngestionService(cliente, undefined, store).respaldarFacturasEnNube(TENANT);

    const indiceProveedor = consultas.findIndex((c) => c.sql.includes('INSERT INTO proveedores'));
    const indiceFactura = consultas.findIndex((c) => c.sql.includes('INSERT INTO factura_ingresos'));
    expect(indiceProveedor).toBeGreaterThanOrEqual(0);
    expect(indiceProveedor).toBeLessThan(indiceFactura);
    expect(consultas[indiceProveedor].params).toContain('FACTURA');
  });

  test('si el proveedor ya existe en la nube reutiliza su id en vez de duplicarlo', async () => {
    const { cliente, consultas } = nubeSimulada({ proveedorExistente: 'prov-en-la-nube' });

    await new InvoiceIngestionService(cliente, undefined, store).respaldarFacturasEnNube(TENANT);

    expect(consultas.some((c) => c.sql.includes('INSERT INTO proveedores'))).toBe(false);
    const insercion = consultas.find((c) => c.sql.includes('INSERT INTO factura_ingresos'));
    expect(insercion!.params[2]).toBe('prov-en-la-nube');
  });

  test('sin conexion no intenta nada y reporta la factura como pendiente', async () => {
    const { cliente, consultas } = nubeSimulada({ disponible: false });

    const resumen = await new InvoiceIngestionService(cliente, undefined, store).respaldarFacturasEnNube(TENANT);

    expect(consultas).toHaveLength(0);
    expect(resumen.respaldados).toBe(0);
    expect(resumen.pendientes).toBe(1);
    expect(pendientes()?.archivo_respaldado).toBe(0);
  });

  test('un fallo de la nube deja la factura pendiente para el proximo intento', async () => {
    const { cliente } = nubeSimulada({ falla: true });

    const resumen = await new InvoiceIngestionService(cliente, undefined, store).respaldarFacturasEnNube(TENANT);

    expect(resumen.respaldados).toBe(0);
    expect(resumen.omitidos).toBe(1);
    expect(pendientes()?.archivo_respaldado).toBe(0);
  });

  test('si el documento no esta en disco la factura se omite, sin marcarla respaldada', async () => {
    fs.rmSync(path.join(directorio, rutaDocumento));
    const { cliente, consultas } = nubeSimulada();

    const resumen = await new InvoiceIngestionService(cliente, undefined, store).respaldarFacturasEnNube(TENANT);

    expect(resumen.omitidos).toBe(1);
    expect(consultas).toHaveLength(0);
    expect(pendientes()?.archivo_respaldado).toBe(0);
  });

  test('las facturas en cola no se respaldan: todavia no son una compra registrada', async () => {
    defaultSqliteClient.execute("UPDATE factura_ingresos SET estado = 'PENDIENTE_OCR' WHERE id = ?", [FACTURA_ID]);
    const { cliente, consultas } = nubeSimulada();

    const resumen = await new InvoiceIngestionService(cliente, undefined, store).respaldarFacturasEnNube(TENANT);

    expect(resumen.respaldados).toBe(0);
    expect(consultas).toHaveLength(0);
  });

  test('recupera el documento desde la nube cuando el equipo local lo perdio', async () => {
    const { cliente } = nubeSimulada();

    const recuperado = await new InvoiceIngestionService(cliente, undefined, store).recuperarDocumentoDeNube(TENANT, FACTURA_ID);

    expect(recuperado).not.toBeNull();
    expect(recuperado!.toString()).toBe('documento-desde-la-nube');
  });

  test('sin conexion la recuperacion devuelve null en vez de fingir un respaldo', async () => {
    const { cliente } = nubeSimulada({ disponible: false });

    const recuperado = await new InvoiceIngestionService(cliente, undefined, store).recuperarDocumentoDeNube(TENANT, FACTURA_ID);

    expect(recuperado).toBeNull();
  });
});
