import { PostgresClient } from './client';
import { PostgresMigrator } from './migrator';

const pendientes = new WeakMap<PostgresClient, Promise<void>>();

/**
 * Las migraciones de la nube se aplican al arrancar solo si la nube esta disponible. Una caja que
 * arranco sin conexion escribiria columnas que la nube todavia no tiene: toda escritura a la nube
 * espera esto antes. Corre una vez por cliente y, si falla, se reintenta en la escritura siguiente.
 */
export function asegurarMigracionesNube(cliente: PostgresClient): Promise<void> {
  let promesa = pendientes.get(cliente);
  if (!promesa) {
    promesa = new PostgresMigrator(cliente).migrate().then(
      () => undefined,
      (err) => {
        pendientes.delete(cliente);
        throw err;
      }
    );
    pendientes.set(cliente, promesa);
  }
  return promesa;
}
