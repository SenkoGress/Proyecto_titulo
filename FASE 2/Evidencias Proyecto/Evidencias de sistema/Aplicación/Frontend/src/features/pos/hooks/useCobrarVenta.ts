// src/features/pos/hooks/useCobrarVenta.ts
import { useState } from 'react'
import { useRegistrarVenta } from '@/features/pos/hooks/usePos'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import { tieneAlcohol } from '@/features/pos/utils/alcohol'
import { tipoTarjetaParaCobro } from '@/features/pos/utils/tipoTarjeta'
import { faltaElMontoRecibido } from '@/features/pos/utils/pagoEnEfectivo'
import { cobroSinVenta } from '@/features/pos/utils/errorVenta'
import { totalCobrado } from '@/features/pos/utils/totalCobrado'
import type { ItemCheckout, VentaRegistrada } from '@/features/pos/types'
import { tenantActual, usuarioActualId } from '@/features/auth/utils/identidad'

// cobrar venta (lo usan los dos modos)
export function useCobrarVenta() {
  const registrarVenta = useRegistrarVenta()
  const [ventaLista, setVentaLista] = useState<VentaRegistrada | null>(null)

  // enviar venta al backend
  function cobrar() {
    const {
      lineas,
      metodoPago,
      tipoTarjeta,
      rutCliente,
      edadVerificada,
      tipoComprobante,
      receptorEmpresa,
      montoRecibido,
      limpiar,
      marcarCobrando,
    } = useCarritoStore.getState()

    // nada que cobrar o ya cobrando
    if (lineas.length === 0 || registrarVenta.isPending) return

    // la tarjeta quedo cobrada y la venta no se guardo: cobrar de nuevo le cobra dos veces al
    // cliente. El boton se bloquea, pero el atajo F4 entraba igual por aca
    if (cobroSinVenta(registrarVenta.error)) return

    // en efectivo hay que anotar con cuanto paga: el boton ya lo exige y el atajo tambien
    if (faltaElMontoRecibido(metodoPago, montoRecibido, totalCobrado(lineas, metodoPago, tipoComprobante))) return

    // falta verificar edad
    if (tieneAlcohol(lineas) && !edadVerificada) return

    // la factura no se puede emitir sin los datos del receptor
    if (tipoComprobante === 'FACTURA' && !receptorEmpresa) return

    // items como los pide el checkout
    const items: ItemCheckout[] = lineas.map((linea) => ({
      producto_id: linea.producto.id,
      cantidad: linea.cantidad,
      precio_unitario: linea.producto.precio_venta,
      nombre: linea.producto.nombre,
      sku: linea.producto.sku,
      codigo_ila: linea.producto.impuesto_adicional_codigo ?? undefined,
    }))

    // el ticket queda congelado hasta que la maquina responda: lo que se agregara en ese rato se
    // perderia al vaciarlo, y Escape lo dejaba vacio a medio cobrar
    marcarCobrando(true)

    registrarVenta.mutate(
      {
        tenant_id: tenantActual(),
        usuario_id: usuarioActualId(),
        items,
        metodo_pago: metodoPago,
        tipo_comprobante: tipoComprobante,
        rut_cliente: rutCliente ?? undefined,
        receptor_empresa: receptorEmpresa ?? undefined,
        tipo_tarjeta: tipoTarjetaParaCobro(metodoPago, tipoTarjeta),
      },
      {
        onSettled: () => marcarCobrando(false),
        onSuccess: (venta) => {
          setVentaLista(venta) // mostrar comprobante
          marcarCobrando(false) // se apaga antes de vaciar: limpiar no actua mientras se cobra
          limpiar() // ticket nuevo
        },
      },
    )
  }

  // con el cobro ya hecho y la venta perdida, la unica salida segura es partir un ticket nuevo:
  // si no, el boton queda bloqueado y el cajero no puede atender al siguiente cliente
  function empezarDeNuevo() {
    // si el cobro quedo a medias la marca puede seguir puesta, y sin apagarla no se vacia
    useCarritoStore.getState().marcarCobrando(false)
    useCarritoStore.getState().limpiar()
    registrarVenta.reset()
  }

  // cerrar comprobante
  function cerrarComprobante() {
    setVentaLista(null)
    registrarVenta.reset()
  }

  return {
    cobrar,
    cerrarComprobante,
    empezarDeNuevo,
    ventaLista,
    cobrando: registrarVenta.isPending,
    errorCobro: registrarVenta.error,
  }
}
