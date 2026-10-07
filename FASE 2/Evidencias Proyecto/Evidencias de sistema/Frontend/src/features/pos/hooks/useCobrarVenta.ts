// src/features/pos/hooks/useCobrarVenta.ts
import { useState } from 'react'
import { env } from '@/config/env'
import { desglosarImpuestos } from '@/shared/utils/impuestos'
import { useRegistrarVenta } from '@/features/pos/hooks/usePos'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import { tieneAlcohol } from '@/features/pos/utils/alcohol'
import type { ItemCheckout, VentaRegistrada } from '@/features/pos/types'

// la venta cobrada y su redondeo, que se pierde al vaciar el carrito
export type VentaCobrada = {
  venta: VentaRegistrada
  ajusteRedondeo: number
}

// cobrar venta (lo usan los dos modos)
export function useCobrarVenta() {
  const registrarVenta = useRegistrarVenta()
  const [ventaLista, setVentaLista] = useState<VentaCobrada | null>(null)

  // enviar venta al backend
  function cobrar() {
    const { lineas, metodoPago, rutCliente, edadVerificada, tipoComprobante, receptorEmpresa, limpiar } =
      useCarritoStore.getState()

    // nada que cobrar o ya cobrando
    if (lineas.length === 0 || registrarVenta.isPending) return

    // falta verificar edad
    if (tieneAlcohol(lineas) && !edadVerificada) return

    // la factura no se puede emitir sin los datos del receptor
    if (tipoComprobante === 'FACTURA' && !receptorEmpresa) return

    // el redondeo de la ley 20.956 solo corre en efectivo
    const desglose = desglosarImpuestos(
      lineas.map((linea) => ({
        subtotal: linea.producto.precio_venta * linea.cantidad,
        tasaIla: Number(linea.producto.impuesto_adicional_tasa) || 0,
      })),
      metodoPago === 'EFECTIVO',
    )

    // items como los pide el checkout
    const items: ItemCheckout[] = lineas.map((linea) => ({
      producto_id: linea.producto.id,
      cantidad: linea.cantidad,
      precio_unitario: linea.producto.precio_venta,
      nombre: linea.producto.nombre,
      sku: linea.producto.sku,
      codigo_ila: linea.producto.impuesto_adicional_codigo ?? undefined,
    }))

    registrarVenta.mutate(
      {
        tenant_id: env.tenantId,
        usuario_id: env.usuarioId,
        items,
        metodo_pago: metodoPago,
        tipo_comprobante: tipoComprobante,
        rut_cliente: rutCliente ?? undefined,
        receptor_empresa: receptorEmpresa ?? undefined,
      },
      {
        onSuccess: (venta) => {
          setVentaLista({ venta, ajusteRedondeo: desglose.redondeo }) // mostrar comprobante
          limpiar() // ticket nuevo
        },
      },
    )
  }

  // cerrar comprobante
  function cerrarComprobante() {
    setVentaLista(null)
    registrarVenta.reset()
  }

  return {
    cobrar,
    cerrarComprobante,
    ventaLista,
    cobrando: registrarVenta.isPending,
    errorCobro: registrarVenta.error,
  }
}
