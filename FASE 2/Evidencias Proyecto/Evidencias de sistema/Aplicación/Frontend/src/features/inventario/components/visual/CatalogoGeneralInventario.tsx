// src/features/inventario/components/visual/CatalogoGeneralInventario.tsx
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { useInventario, useVencimientos } from '@/features/inventario/hooks/useInventario'
import { useDialogosProducto } from '@/features/inventario/hooks/useDialogosProducto'
import { TarjetasResumenInventario } from '@/features/inventario/components/visual/TarjetasResumenInventario'
import { BarraHerramientasInventario } from '@/features/inventario/components/visual/BarraHerramientasInventario'
import { TablaInventario } from '@/features/inventario/components/visual/TablaInventario'
import { PanelSugerenciaPedido } from '@/features/inventario/components/visual/PanelSugerenciaPedido'
import { PanelMargenPromedio } from '@/features/inventario/components/visual/PanelMargenPromedio'
import { AlertaSanitaria } from '@/features/inventario/components/compartidos/AlertaSanitaria'
import { calcularResumenInventario } from '@/features/inventario/utils/calculosInventario'
import { TODAS_CATEGORIAS } from '@/features/inventario/utils/categoriasInventario'
import { armarMatrizFefo } from '@/features/inventario/utils/matrizFefo'
import { EN_RIESGO_SANITARIO, filtrarInventarioFefo } from '@/features/inventario/utils/filtrosVencimientos'
import { exportarInventarioCsv } from '@/features/inventario/utils/exportarCsv'

// catalogo general: stock, costos, precios y margen de todo el catalogo
export function CatalogoGeneralInventario() {
  const inventario = useInventario()
  const vencimientos = useVencimientos()
  const acciones = useDialogosProducto()

  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState(TODAS_CATEGORIAS)

  // el semaforo se usa solo para la alerta y el filtro, no para ordenar
  const productos = useMemo(
    () => armarMatrizFefo(inventario.data ?? [], vencimientos.data?.data ?? [], false),
    [inventario.data, vencimientos.data],
  )

  const filtrados = useMemo(
    () => filtrarInventarioFefo(productos, categoria, busqueda),
    [productos, categoria, busqueda],
  )

  const resumen = useMemo(() => calcularResumenInventario(productos), [productos])

  const enRiesgo = categoria === EN_RIESGO_SANITARIO

  if (inventario.isError) return <ErrorBox error={inventario.error} />
  if (inventario.isPending) return <Skeleton variant="rounded" height={400} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* aviso sanitario: va en los dos modos, es lo que exige el decreto */}
      {vencimientos.data && (
        <AlertaSanitaria
          resumen={vencimientos.data.resumen}
          filtroActivo={enRiesgo}
          onVerEnRiesgo={() => setCategoria(enRiesgo ? TODAS_CATEGORIAS : EN_RIESGO_SANITARIO)}
        />
      )}

      <TarjetasResumenInventario resumen={resumen} />

      <BarraHerramientasInventario
        productos={filtrados}
        busqueda={busqueda}
        categoria={categoria}
        onBuscar={setBusqueda}
        onElegirCategoria={setCategoria}
        onExportar={() => exportarInventarioCsv(filtrados)}
        onAgregar={acciones.abrirAgregar}
        onVerMermas={acciones.abrirHistorialMermas}
      />

      <TablaInventario
        productos={filtrados}
        cargando={inventario.isPending}
        onEditar={acciones.abrirEditar}
        onAjustar={acciones.abrirAjuste}
        onMerma={acciones.abrirMerma}
        onHistorial={acciones.abrirMovimientos}
      />

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <PanelSugerenciaPedido />
        <PanelMargenPromedio margenPromedio={resumen.margenPromedio} />
      </Box>

      {acciones.dialogos}
    </Box>
  )
}
