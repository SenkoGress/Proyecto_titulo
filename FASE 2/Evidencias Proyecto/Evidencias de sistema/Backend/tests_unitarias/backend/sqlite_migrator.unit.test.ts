import fs from 'fs';
import os from 'os';
import path from 'path';
import { SqliteClient } from '../../backend/src/database/sqlite/client';
import { SqliteMigrator } from '../../backend/src/database/sqlite/migrator';

/**
 * SQLite no admite ADD COLUMN IF NOT EXISTS y el migrador ejecuta cada archivo completo dentro de
 * una transaccion. Un ALTER sobre una columna ya presente abortaba la migracion entera, que al no
 * registrarse en _migrations se reintentaba y fallaba en cada arranque.
 */
describe('Pruebas Unitarias: Idempotencia del Migrador de SQLite', () => {
  let dir: string;
  let cliente: SqliteClient;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gestock-migra-'));
    cliente = new SqliteClient(undefined, true);
    cliente.execRaw('CREATE TABLE articulos (id TEXT PRIMARY KEY, nombre TEXT);');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const escribir = (nombre: string, sql: string) => fs.writeFileSync(path.join(dir, nombre), sql, 'utf-8');

  test('aplica un ALTER cuya columna no existe', () => {
    escribir('001_origen.sql', "ALTER TABLE articulos ADD COLUMN origen TEXT DEFAULT 'CATALOGO';");

    const aplicadas = new SqliteMigrator(cliente, dir).migrate();

    expect(aplicadas).toEqual(['001_origen.sql']);
    const columnas = cliente.query<{ name: string }>('PRAGMA table_info(articulos)').map((c) => c.name);
    expect(columnas).toContain('origen');
  });

  test('omite el ALTER si la columna ya esta presente y registra la migracion', () => {
    cliente.execRaw('ALTER TABLE articulos ADD COLUMN origen TEXT;');
    escribir('001_origen.sql', "ALTER TABLE articulos ADD COLUMN origen TEXT DEFAULT 'CATALOGO';");

    const aplicadas = new SqliteMigrator(cliente, dir).migrate();

    expect(aplicadas).toEqual(['001_origen.sql']);
    expect(cliente.query('SELECT name FROM _migrations')).toHaveLength(1);
  });

  test('una migracion mixta aplica lo que falta y omite lo que ya existe', () => {
    cliente.execRaw('ALTER TABLE articulos ADD COLUMN origen TEXT;');
    escribir('001_mixta.sql', [
      'ALTER TABLE articulos ADD COLUMN origen TEXT;',
      'ALTER TABLE articulos ADD COLUMN folio TEXT;',
      'CREATE INDEX IF NOT EXISTS idx_articulos_folio ON articulos(folio);'
    ].join('\n'));

    new SqliteMigrator(cliente, dir).migrate();

    const columnas = cliente.query<{ name: string }>('PRAGMA table_info(articulos)').map((c) => c.name);
    expect(columnas).toContain('origen');
    expect(columnas).toContain('folio');
  });

  test('no se queda en bucle: una segunda corrida no reintenta ni falla', () => {
    escribir('001_origen.sql', 'ALTER TABLE articulos ADD COLUMN origen TEXT;');
    new SqliteMigrator(cliente, dir).migrate();

    const segunda = new SqliteMigrator(cliente, dir).migrate();

    expect(segunda).toEqual([]);
    expect(cliente.query('SELECT name FROM _migrations')).toHaveLength(1);
  });

  test('un error real sigue abortando la migracion sin registrarla', () => {
    escribir('001_rota.sql', 'ALTER TABLE tabla_que_no_existe ADD COLUMN x TEXT;');

    expect(() => new SqliteMigrator(cliente, dir).migrate()).toThrow();
    expect(cliente.query('SELECT name FROM _migrations')).toHaveLength(0);
  });

  test('la tolerancia no encubre errores de sintaxis', () => {
    escribir('001_sintaxis.sql', 'CREAT TABLE mal_escrita (id TEXT);');

    expect(() => new SqliteMigrator(cliente, dir).migrate()).toThrow();
    expect(cliente.query('SELECT name FROM _migrations')).toHaveLength(0);
  });
});
