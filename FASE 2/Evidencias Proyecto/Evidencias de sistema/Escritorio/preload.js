const { contextBridge } = require('electron');

/**
 * La interfaz corre aislada del proceso principal: no tiene acceso a Node ni al sistema de
 * archivos, igual que en un navegador. Lo unico que se expone es una marca para que la pantalla
 * pueda saber que esta dentro de la aplicacion de escritorio -por ejemplo, para ofrecer la
 * impresion directa del ticket en lugar del dialogo del navegador-.
 */
contextBridge.exposeInMainWorld('gestock', {
  escritorio: true,
  version: process.versions.electron
});
