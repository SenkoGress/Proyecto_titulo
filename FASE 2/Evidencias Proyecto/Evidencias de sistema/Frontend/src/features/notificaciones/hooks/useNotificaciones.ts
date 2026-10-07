// src/features/notificaciones/hooks/useNotificaciones.ts
import { useMemo } from 'react'
import { useInventario, useVencimientos } from '@/features/inventario/hooks/useInventario'
import { useSugerenciaPedido } from '@/features/replenishment/hooks/useReplenishment'
import { useHistorialCaja, useResumenCaja } from '@/features/caja/hooks/useCaja'
import { useProveedores } from '@/features/proveedores/hooks/useProveedores'
import { useEstadoPos } from '@/features/pos/hooks/usePos'
import { useCorreo } from '@/features/configuracion/hooks/useConfiguracion'
import { useConfigRopStore } from '@/shared/stores/configRopStore'
import { useNotificacionesStore } from '@/features/notificaciones/stores/notificacionesStore'
import {
  notificacionesCaja,
  notificacionesInventario,
  notificacionesProveedores,
  notificacionesSistema,
  notificacionesStock,
  notificacionesVencimiento,
} from '@/features/notificaciones/utils/armarNotificaciones'
import { ordenarNotificaciones } from '@/features/notificaciones/utils/severidad'

// junta en una sola lista todo lo que el backend ya sabe y merece aviso
export function useNotificaciones() {
  const configRop = useConfigRopStore((estado) => estado.config)

  const vencimientos = useVencimientos()
  const sugerencia = useSugerenciaPedido(configRop)
  const caja = useResumenCaja()
  const historial = useHistorialCaja()
  const proveedores = useProveedores()
  const inventario = useInventario()
  const estadoPos = useEstadoPos()
  const correo = useCorreo()

  const sesion = caja.data?.activa ? caja.data.data : null

  const lista = useMemo(
    () =>
      ordenarNotificaciones([
        ...notificacionesVencimiento(vencimientos.data?.data ?? []),
        ...notificacionesStock(
          sugerencia.data?.suggested_orders ?? [],
          sugerencia.data?.low_stock_products ?? [],
        ),
        ...notificacionesCaja(sesion, historial.data ?? []),
        ...notificacionesProveedores(proveedores.data ?? [], inventario.data ?? []),
        ...notificacionesInventario(inventario.data ?? []),
        ...notificacionesSistema(estadoPos.data, correo.data?.email),
      ]),
    [
      vencimientos.data,
      sugerencia.data,
      sesion,
      historial.data,
      proveedores.data,
      inventario.data,
      estadoPos.data,
      correo.data,
    ],
  )

  const vistas = useNotificacionesStore((estado) => estado.vistas)
  const sinVer = useMemo(() => lista.filter((item) => !vistas.includes(item.id)), [lista, vistas])

  return {
    lista,
    sinVer,
    cargando: vencimientos.isPending || sugerencia.isPending || inventario.isPending,
  }
}
