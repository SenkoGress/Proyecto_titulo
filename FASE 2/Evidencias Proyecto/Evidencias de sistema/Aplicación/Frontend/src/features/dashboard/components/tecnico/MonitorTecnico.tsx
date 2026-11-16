// src/features/dashboard/components/tecnico/MonitorTecnico.tsx
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { useProveedores } from '@/features/proveedores/hooks/useProveedores'
import { useResumenDashboard } from '@/features/dashboard/hooks/useDashboard'
import { EncabezadoDashboard } from '@/features/dashboard/components/compartidos/EncabezadoDashboard'
import { TarjetasKpiDashboard } from '@/features/dashboard/components/compartidos/TarjetasKpiDashboard'
import { GraficoEvolucion } from '@/features/dashboard/components/compartidos/GraficoEvolucion'
import { GraficoMediosPago } from '@/features/dashboard/components/compartidos/GraficoMediosPago'
import { GraficoTopProductos } from '@/features/dashboard/components/compartidos/GraficoTopProductos'
import { GraficoComprasProveedor } from '@/features/dashboard/components/compartidos/GraficoComprasProveedor'
import { TablaArticulosLideres } from '@/features/dashboard/components/compartidos/TablaArticulosLideres'
import { TablaProveedoresVisitas } from '@/features/dashboard/components/compartidos/TablaProveedoresVisitas'
import { DesglosePorCategoria } from '@/features/dashboard/components/compartidos/DesglosePorCategoria'
import { proximasVisitas } from '@/features/dashboard/utils/visitasProveedor'
import { etiquetaPeriodo } from '@/features/dashboard/utils/periodos'
import type { PeriodoDashboard } from '@/features/dashboard/types'

// modo tecnico: la misma analitica del visual, con el detalle contable
export function MonitorTecnico() {
  const [periodo, setPeriodo] = useState<PeriodoDashboard>('mensual')

  const resumen = useResumenDashboard(periodo)
  const proveedores = useProveedores()

  const visitas = useMemo(() => proximasVisitas(proveedores.data ?? []), [proveedores.data])

  if (resumen.isError) return <ErrorBox error={resumen.error} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <EncabezadoDashboard
        titulo="Analitica global del negocio"
        descripcion="Ventas brutas y netas, utilidades, medios de pago, rotacion de productos y compras a proveedores."
        periodo={periodo}
        actualizando={resumen.isFetching}
        onCambiarPeriodo={setPeriodo}
        onActualizar={() => resumen.refetch()}
      />

      {resumen.isPending || !resumen.data ? (
        <Skeleton variant="rounded" height={140} />
      ) : (
        <TarjetasKpiDashboard kpis={resumen.data.kpis} etiquetaPeriodo={etiquetaPeriodo(periodo)} tecnico />
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
            <TablaArticulosLideres productos={resumen.data.topProducts} conParticipacion />
            <TablaProveedoresVisitas proveedores={resumen.data.suppliersAnalytics} visitas={visitas} />
          </Box>

          <DesglosePorCategoria categorias={resumen.data.categoryBreakdown} />
        </>
      )}
    </Box>
  )
}
