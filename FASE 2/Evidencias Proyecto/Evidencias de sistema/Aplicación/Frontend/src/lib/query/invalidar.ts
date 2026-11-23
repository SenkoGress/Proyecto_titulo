// src/lib/query/invalidar.ts
import type { QueryClient } from '@tanstack/react-query'

/**
 * Que pantallas quedan viejas despues de cada accion.
 *
 * Una venta no cambia solo el catalogo: tambien el stock, el semaforo de vencimientos, la
 * reposicion, el historial, la caja, el panel y los documentos emitidos. Como cada consulta da por
 * buena su ultima respuesta durante un minuto, si no se avisa aca el cajero vende la ultima unidad
 * y el inventario se la sigue mostrando, o entra a Ventas y la venta que acaba de hacer no esta.
 *
 * Avisar de mas no cuesta peticiones: invalidateQueries solo vuelve a pedir lo que esta en
 * pantalla, y lo demas queda marcado para la proxima vez que se abra.
 */
function invalidar(cliente: QueryClient, claves: string[][]) {
  for (const queryKey of claves) {
    cliente.invalidateQueries({ queryKey })
  }
}

// una venta o una devolucion
export function trasVender(cliente: QueryClient) {
  invalidar(cliente, [
    ['pos', 'productos'],
    ['pos', 'estado'],
    ['pos', 'transacciones'],
    ['caja', 'resumen'],
    ['inventario'],
    ['replenishment'],
    ['dashboard'],
    ['dte', 'lista'],
  ])
}

// recibir mercaderia: entra stock y cambian los vencimientos
export function trasIngresarFactura(cliente: QueryClient) {
  invalidar(cliente, [
    ['invoices'],
    ['pos', 'productos'],
    ['inventario'],
    ['replenishment'],
    ['dashboard'],
  ])
}

// abrir, cerrar o mover la caja
export function trasMoverCaja(cliente: QueryClient) {
  invalidar(cliente, [
    ['caja', 'resumen'],
    ['caja', 'historial'],
  ])
}
