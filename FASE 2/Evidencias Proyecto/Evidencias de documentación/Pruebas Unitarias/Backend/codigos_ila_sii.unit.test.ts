import { readFileSync } from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

/**
 * La migracion 022 reescribe los codigos de impuesto adicional ya guardados. Un UPDATE encadenado
 * mal ordenado convertiria el 25 en 27 y despues ese 27 en 26; esta prueba fija que cada fila se
 * lea con su codigo anterior.
 */
describe('Pruebas Unitarias: migracion de los codigos ILA a la tabla del SII', () => {
  const sql = readFileSync(
    path.join(__dirname, '../../backend/src/database/sqlite/migrations/022_codigos_ila_sii.sql'),
    'utf-8'
  );

  test('cada codigo anterior pasa al del SII, sin encadenar cambios', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE productos (id TEXT, nombre TEXT, impuesto_adicional_codigo INTEGER)');
    const filas: Array<[string, string, number]> = [
      ['a', 'Coca Cola Zero', 25],
      ['b', 'Crush Naranja', 26],
      ['c', 'Cerveza Bock', 27],
      ['d', 'Vino Tinto Reserva', 27],
      ['e', 'Pisco 35', 28],
      ['f', 'Arroz', 0],
    ];
    const insertar = db.prepare('INSERT INTO productos VALUES (?, ?, ?)');
    for (const fila of filas) insertar.run(...fila);

    db.exec(sql);

    const codigos = Object.fromEntries(
      (db.prepare('SELECT id, impuesto_adicional_codigo AS c FROM productos').all() as Array<{ id: string; c: number }>)
        .map((f) => [f.id, f.c])
    );
    expect(codigos).toEqual({ a: 27, b: 271, c: 26, d: 25, e: 24, f: 0 });
  });

  test('la migracion de la nube es la misma sentencia', () => {
    const nube = readFileSync(
      path.join(__dirname, '../../backend/src/database/postgres/migrations/022_codigos_ila_sii.sql'),
      'utf-8'
    );
    const cuerpo = (s: string) => s.slice(s.indexOf('UPDATE'));
    expect(cuerpo(nube)).toBe(cuerpo(sql));
  });
});
