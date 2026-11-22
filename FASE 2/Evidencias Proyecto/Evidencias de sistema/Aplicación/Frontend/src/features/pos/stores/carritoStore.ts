// src/features/pos/stores/carritoStore.ts
import { create } from 'zustand'
import type { MetodoPago, Producto, ReceptorEmpresa, TipoComprobante, TipoTarjeta } from '@/features/pos/types'
import { diasParaVencer, esFechaDeVencimientoValida } from '@/features/invoices/utils/vencimientoFactura'

// d.s. 977/96: vencido es anterior a hoy. la fecha puede venir con hora, valen sus diez primeros caracteres
function estaVencido(producto: Producto): boolean {
  const fecha = producto.fecha_vencimiento?.slice(0, 10)
  return esFechaDeVencimientoValida(fecha) && diasParaVencer(fecha, new Date()) < 0
}

// linea del ticket
export type LineaCarrito = {
  producto: Producto
  cantidad: number
}

type CarritoState = {
  lineas: LineaCarrito[]
  metodoPago: MetodoPago
  edadVerificada: boolean // ley 19.925
  rutCliente: string | null // formato sii: 12345678-K
  tipoComprobante: TipoComprobante
  receptorEmpresa: ReceptorEmpresa | null // datos del cliente cuando es factura
  porConfirmarVencido: Producto | null // producto vencido que espera la decision del cajero
  montoRecibido: number // con cuanto paga el cliente en efectivo
  tipoTarjeta: TipoTarjeta | null // credito o debito, cuando se cobra con tarjeta

  agregar: (producto: Producto) => void
  confirmarVencido: () => void
  descartarVencido: () => void
  quitarUno: (productoId: string) => void
  fijarCantidad: (productoId: string, cantidad: number) => void
  eliminarLinea: (productoId: string) => void
  limpiar: () => void
  cambiarMetodoPago: (metodo: MetodoPago) => void
  marcarEdadVerificada: (verificada: boolean) => void
  asociarRut: (rut: string | null) => void
  cambiarTipoComprobante: (tipo: TipoComprobante) => void
  fijarReceptorEmpresa: (receptor: ReceptorEmpresa | null) => void
  fijarMontoRecibido: (monto: number) => void
  cambiarTipoTarjeta: (tipo: TipoTarjeta | null) => void
}

// estado inicial del ticket
const ticketVacio = {
  lineas: [],
  metodoPago: 'EFECTIVO' as MetodoPago,
  edadVerificada: false,
  rutCliente: null,
  tipoComprobante: 'BOLETA' as TipoComprobante,
  receptorEmpresa: null,
  porConfirmarVencido: null,
  montoRecibido: 0,
  tipoTarjeta: null,
}

// carrito de la venta actual
export const useCarritoStore = create<CarritoState>((set) => ({
  ...ticketVacio,

  // agregar producto (sin pasar el stock)
  agregar: (producto) =>
    set((estado) => {
      const existente = estado.lineas.find((linea) => linea.producto.id === producto.id)

      if (!existente) {
        if (producto.stock_actual <= 0) return {}
        // un vencido no entra solo: se pregunta una vez, al agregarlo a la venta
        if (estaVencido(producto)) return { porConfirmarVencido: producto }
        return { lineas: [...estado.lineas, { producto, cantidad: 1 }] }
      }

      if (existente.cantidad >= producto.stock_actual) return {}

      return {
        lineas: estado.lineas.map((linea) =>
          linea.producto.id === producto.id ? { ...linea, cantidad: linea.cantidad + 1 } : linea,
        ),
      }
    }),

  // el cajero decidio vender el vencido de todos modos
  confirmarVencido: () =>
    set((estado) => {
      const producto = estado.porConfirmarVencido
      if (!producto) return {}
      return { porConfirmarVencido: null, lineas: [...estado.lineas, { producto, cantidad: 1 }] }
    }),

  descartarVencido: () => set({ porConfirmarVencido: null }),

  // restar uno (si llega a 0 se borra)
  quitarUno: (productoId) =>
    set((estado) => ({
      lineas: estado.lineas
        .map((linea) =>
          linea.producto.id === productoId ? { ...linea, cantidad: linea.cantidad - 1 } : linea,
        )
        .filter((linea) => linea.cantidad > 0),
    })),

  // escribir cantidad (entre 1 y el stock)
  fijarCantidad: (productoId, cantidad) =>
    set((estado) => ({
      lineas: estado.lineas.map((linea) => {
        if (linea.producto.id !== productoId) return linea
        const maximo = Math.max(1, linea.producto.stock_actual)
        const valida = Math.min(Math.max(1, Math.floor(cantidad) || 1), maximo)
        return { ...linea, cantidad: valida }
      }),
    })),

  // borrar linea
  eliminarLinea: (productoId) =>
    set((estado) => ({
      lineas: estado.lineas.filter((linea) => linea.producto.id !== productoId),
    })),

  // vaciar ticket
  limpiar: () => set(ticketVacio),

  cambiarMetodoPago: (metodo) => set({ metodoPago: metodo }),

  // no se borra al cambiar el ticket: si el total sube, el boton vuelve a pedir lo que falta
  fijarMontoRecibido: (monto) => set({ montoRecibido: Math.max(0, Math.round(monto) || 0) }),

  cambiarTipoTarjeta: (tipo) => set({ tipoTarjeta: tipo }),

  marcarEdadVerificada: (verificada) => set({ edadVerificada: verificada }),

  asociarRut: (rut) => set({ rutCliente: rut }),

  // boleta o factura: la factura necesita los datos del receptor
  cambiarTipoComprobante: (tipo) =>
    set((estado) => ({
      tipoComprobante: tipo,
      receptorEmpresa: tipo === 'BOLETA' ? null : estado.receptorEmpresa,
    })),

  fijarReceptorEmpresa: (receptor) => set({ receptorEmpresa: receptor }),
}))
