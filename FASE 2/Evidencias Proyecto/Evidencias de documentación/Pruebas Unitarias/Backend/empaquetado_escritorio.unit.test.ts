import fs from 'fs';
import path from 'path';

const RAIZ = path.join(__dirname, '../..');

function leer(relativo: string): string {
  return fs.readFileSync(path.join(RAIZ, relativo), 'utf8');
}

/**
 * El POS se entrega como una aplicacion de escritorio instalable. Estas pruebas fijan las
 * decisiones del empaquetado que, si se pierden, rompen la instalacion de un local sin que
 * ninguna otra prueba lo note: dato escrito en una carpeta de solo lectura, clave de sesion
 * repartida dentro del instalador, o una instalacion sin forma de entrar.
 */
describe('Pruebas Unitarias: Empaquetado de Escritorio', () => {
  const paquete = JSON.parse(leer('package.json'));
  const principal = leer('electron/main.js');

  describe('Configuracion del instalador', () => {
    test('el punto de entrada del paquete es el proceso principal de escritorio', () => {
      expect(paquete.main).toBe('electron/main.js');
      expect(fs.existsSync(path.join(RAIZ, 'electron/main.js'))).toBe(true);
      expect(fs.existsSync(path.join(RAIZ, 'electron/preload.js'))).toBe(true);
    });

    test('el paquete lleva el backend compilado, la interfaz construida y nada mas', () => {
      const archivos: string[] = paquete.build.files;

      expect(archivos).toContain('dist/backend/**/*');
      expect(archivos).toContain('front-end/dist/**/*');
      expect(archivos).toContain('electron/**/*');
      // El codigo fuente, las pruebas y la documentacion no viajan al equipo del local
      expect(archivos.some((a) => a.startsWith('backend/src'))).toBe(false);
      expect(archivos.some((a) => a.startsWith('tests_unitarias'))).toBe(false);
      expect(archivos.some((a) => a.startsWith('docs'))).toBe(false);
    });

    test('el instalador de Windows deja elegir la carpeta y no exige administrador', () => {
      expect(paquete.build.win.target).toContain('nsis');
      expect(paquete.build.nsis.oneClick).toBe(false);
      expect(paquete.build.nsis.perMachine).toBe(false);
      expect(paquete.build.nsis.allowToChangeInstallationDirectory).toBe(true);
    });

    test('la construccion copia las migraciones junto al backend compilado', () => {
      // tsc solo compila TypeScript: sin este paso los .sql se quedan en backend/src y el
      // instalador sale sin esquema, de modo que una instalacion limpia arranca con una base
      // vacia y la aplicacion no abre. Paso en el equipo del companero, no en el de desarrollo,
      // porque alli la carpeta del proyecto existe y el migrador la encuentra.
      expect(paquete.scripts.build).toContain('copiar-migraciones');
      expect(fs.existsSync(path.join(RAIZ, 'scripts/copiar-migraciones.js'))).toBe(true);

      const copiador = leer('scripts/copiar-migraciones.js');
      expect(copiador).toContain("'sqlite'");
      expect(copiador).toContain("'postgres'");
      // Si no copia ninguna, falla la construccion en vez de producir un instalador inservible
      expect(copiador).toContain('process.exit(1)');
    });

    test('el backend compilado lleva las migraciones de los dos motores', () => {
      const motores = ['sqlite', 'postgres'];
      const compilado = path.join(RAIZ, 'dist/backend/src/database');

      if (!fs.existsSync(compilado)) {
        // Sin construir no hay nada que comprobar; la orden de construccion ya quedo fijada arriba
        return;
      }

      for (const motor of motores) {
        const carpeta = path.join(compilado, motor, 'migrations');
        expect(fs.existsSync(carpeta)).toBe(true);
        const fuente = fs.readdirSync(path.join(RAIZ, 'backend/src/database', motor, 'migrations'))
          .filter((f) => f.endsWith('.sql'));
        const copiadas = fs.readdirSync(carpeta).filter((f) => f.endsWith('.sql'));
        expect(copiadas.sort()).toEqual(fuente.sort());
      }
    });

    test('las ordenes de construccion compilan las dos mitades antes de empaquetar', () => {
      expect(paquete.scripts['build:desktop']).toContain('npm run build');
      expect(paquete.scripts['build:desktop']).toContain('build:frontend');
      expect(paquete.scripts['dist:win']).toContain('build:desktop');
      expect(paquete.scripts['dist:win']).toContain('electron-builder');
    });
  });

  describe('Lo que el proceso principal garantiza', () => {
    test('los datos del local viven en la carpeta del usuario, no junto al ejecutable', () => {
      // El directorio de instalacion es de solo lectura para quien no es administrador: una
      // venta no puede depender de eso.
      expect(principal).toContain("app.getPath('userData')");
      expect(principal).toContain('process.env.SQLITE_DB_PATH');
      expect(principal).toContain('process.env.INVOICE_STORAGE_DIR');
    });

    test('la clave de sesion se genera por instalacion y no viaja en el instalador', () => {
      expect(principal).toContain('crypto.randomBytes');
      expect(principal).toContain('process.env.JWT_SECRET');
      // Ninguna clave escrita a mano en el codigo
      expect(principal).not.toMatch(/JWT_SECRET\s*=\s*['"][^'"]{8,}['"]/);
    });

    test('la instalacion nueva pide la cuenta de administrador antes de abrir', () => {
      // Con el perimetro activo, una instalacion sin administrador no deja entrar a nadie
      expect(principal).toContain('asegurarAdministrador');
      expect(principal).toContain('INITIAL_ADMIN_EMAIL');
      expect(principal).toContain('INITIAL_ADMIN_PASSWORD');
      expect(principal).toContain('instalacion.json');

      const formulario = leer('electron/primer-arranque.html');
      expect(formulario).toContain('minlength="8"');
      expect(formulario).toContain('type="password"');
    });

    test('la ventana corre aislada del sistema, como un navegador', () => {
      expect(principal).toContain('contextIsolation: true');
      expect(principal).toContain('nodeIntegration: false');
      expect(principal).toContain('sandbox: true');
    });

    test('comprueba el esquema antes de abrir, y lo dice si falta', () => {
      expect(principal).toContain('comprobarMigraciones');
      expect(principal).toContain('La instalacion esta incompleta');
      // Un arranque fallido termina el proceso: app.quit espera a que se cierren las ventanas y
      // dejaba ejecutables colgados que bloqueaban el siguiente intento por la instancia unica.
      expect(principal).toContain('app.exit(1)');
    });

    test('la marca de instalacion se escribe cuando la base quedo lista, no antes', () => {
      // Escribirla al teclear la cuenta dejaba la instalacion sin forma de reintentar: el
      // siguiente arranque ya no mostraba la ventana, fallaba igual y se cerraba.
      expect(principal).toContain('cuentaPendiente');
      expect(principal).toContain('confirmarInstalacion');

      const marca = principal.indexOf('confirmarInstalacion();');
      const espera = principal.indexOf('await esperarAlBackend');
      expect(espera).toBeGreaterThan(0);
      expect(marca).toBeGreaterThan(espera);
    });

    test('quedarse sin ventanas durante el arranque no cierra la aplicacion', () => {
      // En el primer inicio la ventana del formulario se cierra antes de que exista la
      // principal: salir ahi mataba la aplicacion con la cuenta ya creada y la base lista, sin
      // mostrar nada. Es lo que se vio al instalar, y ninguna prueba podia notarlo.
      expect(principal).toContain('arranqueTerminado');

      const guarda = principal.indexOf('if (!arranqueTerminado) return;');
      const cierre = principal.indexOf("app.on('window-all-closed'");
      expect(cierre).toBeGreaterThan(0);
      expect(guarda).toBeGreaterThan(cierre);
    });

    test('una sola instancia, porque dos abririan la misma base local', () => {
      expect(principal).toContain('requestSingleInstanceLock');
    });
  });

  describe('La interfaz la entrega el propio backend', () => {
    const servidor = leer('backend/src/index.ts');

    test('busca la interfaz construida y cae a la carpeta publica historica', () => {
      expect(servidor).toContain('FRONTEND_DIST');
      expect(servidor).toContain("'front-end', 'dist'");
      expect(servidor).toContain('express.static(publicDir)');
    });

    test('una recarga en una ruta del navegador devuelve la pagina, no un 404', () => {
      expect(servidor).toMatch(/app\.get\(\/\^\\\/\(\?!api\|health\)/);
      expect(servidor).toContain("res.sendFile(indice)");
    });
  });
});
