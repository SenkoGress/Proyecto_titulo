const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');

/**
 * Proceso principal de la aplicacion de escritorio.
 *
 * El backend corre dentro de este mismo proceso y no como un servicio aparte: el POS es un solo
 * programa en el mostrador, y dos procesos significarian dos cosas que pueden quedar a medias al
 * cerrar. La interfaz la entrega el propio backend, de modo que la ventana abre una direccion
 * local y las peticiones salen al mismo origen.
 *
 * La base de datos vive en la carpeta de datos del usuario y no junto al ejecutable: en Windows,
 * el directorio de instalacion es de solo lectura para quien no es administrador, y la caja no
 * puede depender de eso para registrar una venta.
 */

app.setName('GesTock');

const PUERTO = Number(process.env.PORT) || 3000;

/** Sitios que la pantalla de mercado puede mostrar dentro de la aplicacion. */
const SITIOS_MERCADO = ['mercadolibre.cl', 'aliexpress.com'];

function sitioPermitido(url) {
  try {
    const host = new URL(url).hostname;
    return SITIOS_MERCADO.some((dominio) => host === dominio || host.endsWith('.' + dominio));
  } catch {
    return false;
  }
}

function logger(mensaje, detalle) {
  console.warn(`[GesTock] ${mensaje}${detalle ? ': ' + detalle : ''}`);
}
// Dentro del paquete, el codigo vive en un archivo asar que Electron lee como si fuera una
// carpeta. La base de datos y los documentos NO van ahi: son de solo lectura y cambian con el uso.
const raizAplicacion = app.getAppPath();

function configurarEntorno() {
  const carpetaDatos = app.getPath('userData');
  const carpetaBase = path.join(carpetaDatos, 'datos');
  fs.mkdirSync(carpetaBase, { recursive: true });

  process.env.SQLITE_DB_PATH =
    process.env.SQLITE_DB_PATH || path.join(carpetaBase, 'gestock_local_pos.sqlite');
  process.env.INVOICE_STORAGE_DIR =
    process.env.INVOICE_STORAGE_DIR || path.join(carpetaBase, 'facturas');
  process.env.FRONTEND_DIST =
    process.env.FRONTEND_DIST || path.join(raizAplicacion, 'front-end', 'dist');
  process.env.PORT = String(PUERTO);

  // El perimetro estricto queda activo en la aplicacion instalada: el equipo del local esta en
  // una sala de ventas y cualquiera que llegue a el no deberia operar sin identificarse.
  process.env.NODE_ENV = process.env.NODE_ENV || 'production';
  process.env.JWT_SECRET = process.env.JWT_SECRET || claveDeSesion(carpetaBase);
}

/**
 * Clave con la que se firman las sesiones, propia de cada instalacion.
 *
 * No puede venir dentro del instalador: una clave repartida con el programa sirve para firmar
 * tokens validos en todas las instalaciones, de modo que cualquiera que abra el ejecutable podria
 * entrar a la caja de otro local. Se genera al azar la primera vez y queda guardada junto a la
 * base de datos, que es la carpeta del usuario; al borrarla solo se cierran las sesiones abiertas.
 */
function claveDeSesion(carpetaBase) {
  const archivo = path.join(carpetaBase, 'clave-sesion');

  try {
    const guardada = fs.readFileSync(archivo, 'utf8').trim();
    if (guardada.length >= 32) return guardada;
  } catch {
    // primera ejecucion, o el archivo se perdio
  }

  const nueva = crypto.randomBytes(48).toString('base64url');
  fs.writeFileSync(archivo, nueva, { encoding: 'utf8', mode: 0o600 });
  return nueva;
}

/**
 * Primer inicio: la instalacion nace sin cuentas y el perimetro exige identificarse, de modo que
 * sin administrador nadie puede entrar. Se pide una vez, antes de levantar el backend, porque es
 * la inicializacion de la base la que crea esa cuenta a partir del entorno.
 *
 * La clave no se guarda en ninguna parte: viaja al backend, que la almacena cifrada con el resto
 * de las cuentas. En el archivo de instalacion queda solo el correo y la fecha, para saber que el
 * paso ya ocurrio.
 */
/**
 * Si la base tiene un administrador, la instalacion esta completa.
 *
 * Antes la decision salia del archivo instalacion.json, y una marca escrita por una instalacion
 * anterior hacia saltar el formulario sobre una base sin usuarios: la aplicacion abria en un login
 * donde no habia con quien entrar, y el local no tiene como saber que debe borrar una carpeta. El
 * archivo pasa a ser el registro de cuando se instalo; quien manda es la tabla.
 */
function hayAdministrador() {
  const base = process.env.SQLITE_DB_PATH;
  if (!base || !fs.existsSync(base)) return false;

  let db = null;
  try {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(base, { readOnly: true });
    return Boolean(db.prepare("SELECT 1 AS hay FROM usuarios WHERE rol = 'admin' LIMIT 1").get());
  } catch {
    // Sin tabla de usuarios la instalacion quedo a medias, que cuenta como sin administrador
    return false;
  } finally {
    try {
      if (db) db.close();
    } catch {}
  }
}

function asegurarAdministrador() {
  const archivo = path.join(app.getPath('userData'), 'datos', 'instalacion.json');
  if (hayAdministrador()) return Promise.resolve();

  return new Promise((listo, fallo) => {
    const ventana = new BrowserWindow({
      width: 520,
      height: 620,
      resizable: false,
      title: 'GesTock',
      backgroundColor: '#f4f6fb',
      webPreferences: {
        preload: path.join(__dirname, 'preload-instalacion.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    let creado = false;

    ipcMain.once('crear-administrador', (_evento, datos) => {
      const correo = String((datos && datos.correo) || '').trim().toLowerCase();
      const clave = String((datos && datos.clave) || '');

      if (!correo.includes('@') || clave.length < 8) {
        fallo(new Error('La cuenta de administrador no es valida'));
        ventana.close();
        return;
      }

      process.env.INITIAL_ADMIN_EMAIL = correo;
      process.env.INITIAL_ADMIN_PASSWORD = clave;
      // El catalogo de demostracion solo se siembra si el usuario lo pide: una instalacion real
      // empieza con su propia mercaderia.
      process.env.CARGAR_CATALOGO_DEMO = datos && datos.demo ? 'true' : 'false';

      // La marca NO se escribe aqui: si el arranque falla, el proximo intento tiene que volver a
      // mostrar esta ventana. Escribirla al teclear la cuenta dejaba la instalacion sin forma de
      // reintentar, y borrar la carpeta de datos a mano no es algo que un local sepa hacer.
      cuentaPendiente = { archivo, correo };
      creado = true;
      ventana.close();
      listo();
    });

    ventana.on('closed', () => {
      if (!creado) fallo(new Error('GesTock no se abrio porque no se creo la cuenta de administrador'));
    });

    ventana.loadFile(path.join(__dirname, 'primer-arranque.html'));
  });
}

/**
 * Las migraciones viajan junto al backend compilado. Si faltan, la base queda sin tablas y la
 * aplicacion no sirve para nada: se comprueba antes de levantar, para poder decir que pasa en vez
 * de abrir una ventana sobre un sistema vacio.
 */
function comprobarMigraciones() {
  const faltantes = ['sqlite', 'postgres'].filter((motor) => {
    const carpeta = path.join(raizAplicacion, 'dist', 'backend', 'src', 'database', motor, 'migrations');
    return !fs.existsSync(carpeta) || !fs.readdirSync(carpeta).some((f) => f.endsWith('.sql'));
  });

  if (faltantes.length > 0) {
    throw new Error(
      `La instalacion esta incompleta: faltan las migraciones de ${faltantes.join(' y ')}. ` +
        'Vuelva a instalar GesTock desde un instalador completo.'
    );
  }
}

function iniciarBackend() {
  const compilado = path.join(raizAplicacion, 'dist', 'backend', 'src', 'index.js');

  if (!fs.existsSync(compilado)) {
    throw new Error(
      `No se encontro el backend compilado en ${compilado}. Ejecute "npm run build" antes de empaquetar.`
    );
  }

  require(compilado);
}

/** El servidor tarda en aceptar conexiones; la ventana espera a que conteste. */
async function esperarAlBackend(intentos = 40) {
  for (let intento = 0; intento < intentos; intento += 1) {
    try {
      const respuesta = await fetch(`http://127.0.0.1:${PUERTO}/api`);
      if (respuesta.ok) return true;
    } catch {
      // todavia no levanta
    }
    await new Promise((listo) => setTimeout(listo, 250));
  }
  return false;
}

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#f4f6fb',
    title: 'GesTock',
    icon: path.join(raizAplicacion, 'front-end', 'dist', 'logo-gestock.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // La pantalla de mercado muestra el sitio del proveedor dentro de la aplicacion. Se habilita
      // la etiqueta, y abajo se acota lo que puede hacer: sin acceso a nada nuestro y solo esos
      // dos dominios.
      webviewTag: true
    }
  });

  ventana.webContents.on('will-attach-webview', (evento, preferencias, parametros) => {
    // El sitio externo no recibe nada de la aplicacion: ni puente, ni Node, ni nuestra sesion.
    delete preferencias.preload;
    preferencias.nodeIntegration = false;
    preferencias.contextIsolation = true;
    preferencias.sandbox = true;
    preferencias.partition = 'persist:mercado';

    if (!sitioPermitido(parametros.src)) {
      logger('Visor del mercado: direccion no permitida', parametros.src);
      evento.preventDefault();
    }
  });

  ventana.once('ready-to-show', () => ventana.show());
  ventana.loadURL(`http://127.0.0.1:${PUERTO}/`);

  // Un enlace externo abre en el navegador del sistema y no dentro de la caja
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return ventana;
}

function construirMenu() {
  const plantilla = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Carpeta de datos',
          click: () => shell.openPath(path.join(app.getPath('userData'), 'datos'))
        },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { role: 'resetZoom', label: 'Tamano normal' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(plantilla));
}

/** Cuenta tecleada en el primer inicio, a la espera de que el backend confirme que arranco. */
let cuentaPendiente = null;

/** Hasta que la ventana principal existe, quedarse sin ventanas es parte del arranque. */
let arranqueTerminado = false;

function confirmarInstalacion() {
  if (!cuentaPendiente) return;

  fs.mkdirSync(path.dirname(cuentaPendiente.archivo), { recursive: true });
  fs.writeFileSync(
    cuentaPendiente.archivo,
    JSON.stringify(
      {
        correo: cuentaPendiente.correo,
        creada: new Date().toISOString(),
        catalogo_demo: process.env.CARGAR_CATALOGO_DEMO === 'true'
      },
      null,
      2
    ),
    'utf8'
  );
  cuentaPendiente = null;
}

// Una sola instancia: dos ventanas abririan dos veces la misma base de datos local.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [ventana] = BrowserWindow.getAllWindows();
    if (ventana) {
      if (ventana.isMinimized()) ventana.restore();
      ventana.focus();
    }
  });

  app.on('web-contents-created', (_evento, contenido) => {
    if (contenido.getType() !== 'webview') return;

    contenido.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    contenido.on('will-navigate', (evento, url) => {
      if (sitioPermitido(url)) return;
      logger('Visor del mercado: navegacion bloqueada', url);
      evento.preventDefault();
    });
  });

  app.whenReady().then(async () => {
    try {
      configurarEntorno();
      comprobarMigraciones();
      await asegurarAdministrador();
      iniciarBackend();
    } catch (error) {
      dialog.showErrorBox('GesTock no pudo iniciar', String(error && error.message ? error.message : error));
      app.exit(1);
      return;
    }

    construirMenu();

    const disponible = await esperarAlBackend();
    if (!disponible) {
      dialog.showErrorBox(
        'GesTock no pudo iniciar',
        `El servicio local no respondio en el puerto ${PUERTO}. Revise si otro programa lo esta ocupando.`
      );
      app.exit(1);
      return;
    }

    confirmarInstalacion();
    crearVentana();
    arranqueTerminado = true;

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) crearVentana();
    });
  });

  app.on('window-all-closed', () => {
    // Durante el primer inicio la ventana del formulario se cierra ANTES de que exista la
    // principal, de modo que este evento llega con cero ventanas abiertas: salir aqui mataba la
    // aplicacion justo despues de crear la cuenta, con la base ya lista y sin mostrar nada.
    if (!arranqueTerminado) return;
    app.quit();
  });
}
