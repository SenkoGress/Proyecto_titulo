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
function asegurarAdministrador() {
  const archivo = path.join(app.getPath('userData'), 'datos', 'instalacion.json');
  if (fs.existsSync(archivo)) return Promise.resolve();

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

      fs.mkdirSync(path.dirname(archivo), { recursive: true });
      fs.writeFileSync(
        archivo,
        JSON.stringify({ correo, creada: new Date().toISOString() }, null, 2),
        'utf8'
      );

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
      sandbox: true
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

  app.whenReady().then(async () => {
    try {
      configurarEntorno();
      await asegurarAdministrador();
      iniciarBackend();
    } catch (error) {
      dialog.showErrorBox('GesTock no pudo iniciar', String(error && error.message ? error.message : error));
      app.quit();
      return;
    }

    construirMenu();

    const disponible = await esperarAlBackend();
    if (!disponible) {
      dialog.showErrorBox(
        'GesTock no pudo iniciar',
        `El servicio local no respondio en el puerto ${PUERTO}. Revise si otro programa lo esta ocupando.`
      );
      app.quit();
      return;
    }

    crearVentana();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) crearVentana();
    });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
