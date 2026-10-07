// src/features/inventario/components/tecnico/TrazabilidadFefo.tsx
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import type { GridRowSelectionModel } from '@mui/x-data-grid'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { useInventario, useVencimientos } from '@/features/inventario/hooks/useInventario'
import { useDialogosProducto } from '@/features/inventario/hooks/useDialogosProducto'
import { TarjetasResumenInventario } from '@/features/inventario/components/visual/TarjetasResumenInventario'
import { PanelSugerenciaPedido } from '@/features/inventario/components/visual/PanelSugerenciaPedido'
import { PanelMargenPromedio } from '@/features/inventario/components/visual/PanelMargenPromedio'
import { BarraHerramientasInventarioTecnico } from '@/features/inventario/components/tecnico/BarraHerramientasInventarioTecnico'
import { TablaInventarioTecnico } from '@/features/inventario/components/tecnico/TablaInventarioTecnico'
import { PanelAlertasFefo } from '@/features/inventario/components/tecnico/PanelAlertasFefo'
import { ProtocoloFefoInfo } from '@/features/inventario/components/tecnico/ProtocoloFefoInfo'
import { AlertaSanitaria } from '@/features/inventario/components/compartidos/AlertaSanitaria'
import { DialogoEtiquetas } from '@/features/inventario/components/tecnico/DialogoEtiquetas'
import { armarMatrizFefo } from '@/features/inventario/utils/matrizFefo'
import { calcularResumenInventario } from '@/features/inventario/utils/calculosInventario'
import { TODAS_CATEGORIAS } from '@/features/inventario/utils/categoriasInventario'
import { EN_RIESGO_SANITARIO, filtrarInventarioFefo } from '@/features/inventario/utils/filtrosVencimientos'
import { exportarInventarioCsv } from '@/features/inventario/utils/exportarCsv'
import { filasSeleccionadas, SELECCION_VACIA } from '@/shared/utils/seleccionGrid'

// inventario tecnico: catalogo con estado fefo y alertas al lado
export function TrazabilidadFefo() {
  const inventario = useInventario()
  const vencimientos = useVencimientos()
  const acciones = useDialogosProducto()

  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState(TODAS_CATEGORIAS)
  const [seleccion, setSeleccion] = useState<GridRowSelectionModel>(SELECCION_VACIA)
  const [imprimiendo, setImprimiendo] = useState(false)

  const matriz = useMemo(
    () => armarMatrizFefo(inventario.data ?? [], vencimientos.data?.data ?? []),
    [inventario.data, vencimientos.data],
  )

  const filtrados = useMemo(() => filtrarInventarioFefo(matriz, filtro, busqueda), [matriz, filtro, busqueda])

  const resumenStock = useMemo(() => calcularResumenInventario(matriz), [matriz])

  // los productos marcados en la tabla, para imprimir sus etiquetas
  const seleccionados = useMemo(() => filasSeleccionadas(matriz, seleccion), [matriz, seleccion])

  const enRiesgo = filtro === EN_RIESGO_SANITARIO

  if (inventario.isError) return <ErrorBox error={inventario.error} />
  if (vencimientos.isError) return <ErrorBox error={vencimientos.error} />
  if (inventario.isPending || vencimientos.isPending) return <Skeleton variant="rounded" height={400} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* aviso sanitario del decreto, arriba de todo */}
      {vencimientos.data && (
        <AlertaSanitaria
          resumen={vencimientos.data.resumen}
          filtroActivo={enRiesgo}
          onVerEnRiesgo={() => setFiltro(enRiesgo ? TODAS_CATEGORIAS : EN_RIESGO_SANITARIO)}
        />
      )}

      {/* mismas 4 tarjetas que el catalogo visual: total, valor, bajo stock, sin stock */}
      <TarjetasResumenInventario resumen={resumenStock} />

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* tabla principal: todo el catalogo, con el estado fefo como una columna mas */}
        <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <BarraHerramientasInventarioTecnico
            productos={filtrados}
            busqueda={busqueda}
            categoria={filtro}
            onBuscar={setBusqueda}
            onElegirCategoria={setFiltro}
            onExportar={() => exportarInventarioCsv(filtrados)}
            cantidadSeleccionada={seleccionados.length}
            onImprimirEtiquetas={() => setImprimiendo(true)}
            onAgregar={acciones.abrirAgregar}
            onVerMermas={acciones.abrirHistorialMermas}
          />

          <TablaInventarioTecnico
            productos={filtrados}
            cargando={inventario.isPending}
            seleccion={seleccion}
            onCambiarSeleccion={setSeleccion}
            onEditar={acciones.abrirEditar}
            onAjustar={acciones.abrirAjuste}
            onMerma={acciones.abrirMerma}
            onHistorial={acciones.abrirMovimientos}
          />
        </Box>

        {/* panel lateral: alertas de vencimiento + sugerencia de pedido + margen */}
        <Box sx={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {vencimientos.data && <PanelAlertasFefo resumen={vencimientos.data.resumen} totalProductos={matriz.length} />}
          <PanelSugerenciaPedido />
          <PanelMargenPromedio margenPromedio={resumenStock.margenPromedio} />
          <ProtocoloFefoInfo />
        </Box>
      </Box>

      {imprimiendo && <DialogoEtiquetas productos={seleccionados} onCerrar={() => setImprimiendo(false)} />}

      {acciones.dialogos}
    </Box>
  )
}
