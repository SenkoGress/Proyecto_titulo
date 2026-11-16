/**
 * Las baterias ejercen la API sin token, de modo que el perimetro estricto las haria fallar
 * enteras. La bandera se fija aqui y no se hereda del .env de cada equipo: desde que el proyecto
 * activo ENFORCE_AUTH=true para la prueba con usuarios, el resultado de las pruebas pasaba a
 * depender de la configuracion local de quien las corriera.
 *
 * El perimetro se verifica aparte: la logica del middleware en `security_and_auth.unit.test.ts`,
 * y el comportamiento real contra el servidor en marcha, documentado en el estado del proyecto.
 */
process.env.ENFORCE_AUTH = 'false';

/**
 * Con USE_REAL_PG=true las pruebas corren contra el PostgreSQL real, pero nunca contra la base de
 * la nube: cada prueba crea su propio comercio y dejaba cientos de tiendas de prueba mezcladas
 * con la de la demostracion. Se apunta a una base aparte, que jest.global-setup.ts crea si falta.
 */
if (process.env.USE_REAL_PG === 'true') {
  process.env.PGDATABASE = process.env.PGDATABASE_TEST || 'gestock_test_db';
  delete process.env.DATABASE_URL;
}
