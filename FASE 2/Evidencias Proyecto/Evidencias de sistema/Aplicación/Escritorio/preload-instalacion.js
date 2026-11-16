const { contextBridge, ipcRenderer } = require('electron');

/**
 * Puente de la ventana de primer inicio. Entrega al proceso principal el correo y la clave del
 * administrador, que es lo unico que esa ventana necesita hacer: no se expone nada mas.
 */
contextBridge.exposeInMainWorld('instalacion', {
  crearAdministrador: (datos) => ipcRenderer.send('crear-administrador', datos)
});
