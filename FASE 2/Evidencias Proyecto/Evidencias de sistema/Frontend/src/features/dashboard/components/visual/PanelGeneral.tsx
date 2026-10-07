// src/features/dashboard/components/visual/PanelGeneral.tsx
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { useInventario } from '@/features/inventario/hooks/useInventario'
import { useProveedores } from '@/features/proveedores/hooks/useProveedores'
import { useResumenDashboard, useTendencias } from '@/features/dashboard/hooks/useDashboard'
import { useTransacciones } from '@/features/ventas/hooks/useVentas'
import { EncabezadoDashboard } from '@/features/dashboard/components/compartidos/EncabezadoDashboard'
import { TarjetasKpiDashboard } from '@/features/dashboard/components/compartidos/TarjetasKpiDashboard'
import { GraficoEvolucion } from '@/features/dashboard/components/compartidos/GraficoEvolucion'
import { GraficoMediosPago } from '@/features/dashboard/components/compartidos/GraficoMediosPago'
import { GraficoTopProductos } from '@/features/dashboard/components/compartidos/GraficoTopProductos'
import { GraficoComprasProveedor } from '@/features/dashboard/components/compartidos/GraficoComprasProveedor'
import { TablaArticulosLideres } from '@/features/dashboard/components/compartidos/TablaArticulosLideres'
import { TablaProveedoresVisitas } from '@/features/dashboard/components/compartidos/TablaProveedoresVisitas'
import { UltimasTransacciones } from '@/features/dashboard/components/visual/UltimasTransacciones'
import { TendenciasMercado } from '@/features/dashboard/components/visual/TendenciasMercado'
import { proximasVisitas } from '@/features/dashboard/utils/visitasProveedor'
import { etiquetaPeriodo } from '@/features/dashboard/utils/periodos'
import { compararConMercado } from '@/features/dashboard/utils/comparacionMercado'
import type { PeriodoDashboard } from '@/features/dashboard/types'

// panel general del minimarket: como va el negocio (las alertas viven en Notificaciones)
export function PanelGeneral() {
  const [periodo, setPeriodo] = useState<PeriodoDashboard>('diario')

  const resumen = useResumenDashboard(periodo)
  const transacciones = useTransacciones()
  const tendencias = useTendencias()
  const inventario = useInventario()
  const proveedores = useProveedores()

  const visitas = useMemo(() => proximasVisitas(proveedores.data ?? []), [proveedores.data])

  const tendenciasComparadas = useMemo(
    () => compararConMercado(tendencias.data ?? [], inventario.data ?? []),
    [tendencias.data, inventario.data],
  )

  if (resumen.isError) return <ErrorBox error={resumen.error} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <EncabezadoDashboard
        titulo="Como va el negocio"
        descripcion="Ventas, ganancia, rotacion de productos y compras a proveedores."
        periodo={periodo}
        actualizando={resumen.isFetching}
        onCambiarPeriodo={setPeriodo}
        onActualizar={() => resumen.refetch()}
      />

      {resumen.isPending || !resumen.data ? (
        <Skeleton variant="rounded" height={140} />
      ) : (
        <TarjetasKpiDashboard kpis={resumen.data.kpis} etiquetaPeriodo={etiquetaPeriodo(periodo)} tecnico={false} />
      )}

      {resumen.data && (
        <>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' } }}>
            <GraficoEvolucion
              timeline={resumen.data.timelineChart}
              medios={resumen.data.paymentsBreakdown}
              totalVentas={resumen.data.kpis.totalVentasBruto}
              periodo={periodo}
            />

            <GraficoMediosPago medios={resumen.data.paymentsBreakdown} />
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' } }}>
            <GraficoTopProductos productos={resumen.data.topProducts} />
            <GraficoComprasProveedor proveedores={resumen.data.suppliersAnalytics} />
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' } }}>
            <TablaArticulosLideres productos={resumen.data.topProducts} conParticipacion={false} />
            <TablaProveedoresVisitas proveedores={resumen.data.suppliersAnalytics} visitas={visitas} />
          </Box>
        </>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' } }}>
        <UltimasTransacciones transacciones={transacciones.data ?? []} cargando={transacciones.isPending} />

        <TendenciasMercado tendencias={tendenciasComparadas} cargando={tendencias.isPending} />
      </Box>
    </Box>
  )
}
