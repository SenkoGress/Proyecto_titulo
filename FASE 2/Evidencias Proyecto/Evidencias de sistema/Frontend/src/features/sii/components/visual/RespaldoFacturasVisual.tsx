// src/features/sii/components/visual/RespaldoFacturasVisual.tsx
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Alert from '@mui/material/Alert'
import { useQueryClient } from '@tanstack/react-query'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { useFacturasProveedores } from '@/features/proveedores/hooks/useProveedores'
import { useDtesEmitidos } from '@/features/ventas/hooks/useVentas'
import { useF29, useFoliosCaf } from '@/features/sii/hooks/useSii'
import { resumirCompras } from '@/features/sii/utils/resumenCompras'
import { BarraAccionesSii } from '@/features/sii/components/compartidos/BarraAccionesSii'
import { TarjetasResumenCompras } from '@/features/sii/components/compartidos/TarjetasResumenCompras'
import { TablaFacturasCompra } from '@/features/sii/components/compartidos/TablaFacturasCompra'
import { TablaDtesEmitidos } from '@/features/sii/components/compartidos/TablaDtesEmitidos'
import { PanelF29 } from '@/features/sii/components/compartidos/PanelF29'
import { PanelFoliosCaf } from '@/features/sii/components/compartidos/PanelFoliosCaf'

// tasa que usa el backend por defecto
const TASA_PPM = 1

const PESTANAS = ['Facturas que me dieron', 'Boletas que emiti', 'Lo que tengo que declarar', 'Folios disponibles']

// version simple: solo lo que el dueno del local necesita para el contador
export function RespaldoFacturasVisual() {
  const [pestana, setPestana] = useState(0)
  const [periodo, setPeriodo] = useState(() => new Date().toISOString().slice(0, 7))

  const clienteQuery = useQueryClient()

  const facturas = useFacturasProveedores()
  const dtes = useDtesEmitidos()
  const f29 = useF29(periodo, TASA_PPM)
  const caf = useFoliosCaf()

  const resumen = useMemo(() => resumirCompras(facturas.data ?? []), [facturas.data])

  if (facturas.isError) return <ErrorBox error={facturas.error} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <BarraAccionesSii
        titulo="Respaldo de facturas y documentos"
        descripcion="Todo lo que necesita tu contador, guardado y listo para descargar."
        actualizando={facturas.isFetching || dtes.isFetching || f29.isFetching}
        onActualizar={() => {
          clienteQuery.invalidateQueries({ queryKey: ['dte'] })
          clienteQuery.invalidateQueries({ queryKey: ['invoices'] })
        }}
      />

      <Alert severity="info">
        La ley obliga a guardar estos documentos por 6 anios (Codigo Tributario, arts. 17 y 200). El boton de
        respaldo baja todo en un solo archivo.
      </Alert>

      <Tabs value={pestana} onChange={(_, valor) => setPestana(valor)} variant="scrollable" scrollButtons="auto">
        {PESTANAS.map((titulo) => (
          <Tab key={titulo} label={titulo} sx={{ fontWeight: 600 }} />
        ))}
      </Tabs>

      {pestana === 0 && (
        <>
          <TarjetasResumenCompras resumen={resumen} />
          <TablaFacturasCompra facturas={facturas.data ?? []} cargando={facturas.isPending} tecnico={false} />
        </>
      )}

      {pestana === 1 && <TablaDtesEmitidos dtes={dtes.data ?? []} cargando={dtes.isPending} tecnico={false} />}

      {pestana === 2 && (
        <PanelF29
          reporte={f29.data}
          cargando={f29.isPending}
          periodo={periodo}
          tecnico={false}
          onPeriodo={setPeriodo}
        />
      )}

      {pestana === 3 && <PanelFoliosCaf folios={caf.data ?? []} cargando={caf.isPending} />}
    </Box>
  )
}
