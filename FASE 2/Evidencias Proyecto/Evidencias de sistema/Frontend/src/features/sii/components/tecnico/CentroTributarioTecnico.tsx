// src/features/sii/components/tecnico/CentroTributarioTecnico.tsx
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { useQueryClient } from '@tanstack/react-query'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { useFacturasProveedores } from '@/features/proveedores/hooks/useProveedores'
import { useDtesEmitidos } from '@/features/ventas/hooks/useVentas'
import { useF29, useFoliosCaf, useGuias, useRcof } from '@/features/sii/hooks/useSii'
import { resumirCompras } from '@/features/sii/utils/resumenCompras'
import { BarraAccionesSii } from '@/features/sii/components/compartidos/BarraAccionesSii'
import { TarjetasResumenCompras } from '@/features/sii/components/compartidos/TarjetasResumenCompras'
import { TablaFacturasCompra } from '@/features/sii/components/compartidos/TablaFacturasCompra'
import { TablaDtesEmitidos } from '@/features/sii/components/compartidos/TablaDtesEmitidos'
import { PanelF29 } from '@/features/sii/components/compartidos/PanelF29'
import { PanelFoliosCaf } from '@/features/sii/components/compartidos/PanelFoliosCaf'
import { PanelRcof } from '@/features/sii/components/compartidos/PanelRcof'
import { PanelGuias } from '@/features/sii/components/compartidos/PanelGuias'
import { PanelCertificacion } from '@/features/sii/components/compartidos/PanelCertificacion'

// tasa que usa el backend por defecto
const TASA_PPM = 1

const PESTANAS = [
  'Facturas compra (F29)',
  'Boletas y DTEs emitidos',
  'Pre-liquidacion F29',
  'Guias de despacho (52)',
  'Stock de folios CAF',
  'Consumo diario RCOF',
  'Certificacion tecnica (Res. 74)',
]

// centro tributario completo, con todo lo que expone el backend de DTE
export function CentroTributarioTecnico() {
  const [pestana, setPestana] = useState(0)
  const [periodo, setPeriodo] = useState(() => new Date().toISOString().slice(0, 7))

  const clienteQuery = useQueryClient()

  const facturas = useFacturasProveedores()
  const dtes = useDtesEmitidos()
  const f29 = useF29(periodo, TASA_PPM)
  const caf = useFoliosCaf()
  const rcof = useRcof()
  const guias = useGuias()

  const resumen = useMemo(() => resumirCompras(facturas.data ?? []), [facturas.data])

  const actualizando =
    facturas.isFetching || dtes.isFetching || f29.isFetching || caf.isFetching || rcof.isFetching || guias.isFetching

  if (facturas.isError) return <ErrorBox error={facturas.error} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <BarraAccionesSii
        titulo="Centro tributario y facturacion SII (Ley N° 20.727)"
        descripcion="Boletas afectas (39), exentas (41), notas de credito (61), CAF, TED, RCOF y respaldo F29."
        actualizando={actualizando}
        onActualizar={() => {
          clienteQuery.invalidateQueries({ queryKey: ['dte'] })
          clienteQuery.invalidateQueries({ queryKey: ['invoices'] })
        }}
      />

      <Tabs value={pestana} onChange={(_, valor) => setPestana(valor)} variant="scrollable" scrollButtons="auto">
        {PESTANAS.map((titulo) => (
          <Tab key={titulo} label={titulo} sx={{ fontWeight: 600 }} />
        ))}
      </Tabs>

      {pestana === 0 && (
        <>
          <TarjetasResumenCompras resumen={resumen} />
          <TablaFacturasCompra facturas={facturas.data ?? []} cargando={facturas.isPending} tecnico />
        </>
      )}

      {pestana === 1 && <TablaDtesEmitidos dtes={dtes.data ?? []} cargando={dtes.isPending} tecnico />}

      {pestana === 2 && (
        <PanelF29
          reporte={f29.data}
          cargando={f29.isPending}
          periodo={periodo}
          tecnico
          onPeriodo={setPeriodo}
        />
      )}

      {pestana === 3 && <PanelGuias guias={guias.data ?? []} cargando={guias.isPending} />}

      {pestana === 4 && <PanelFoliosCaf folios={caf.data ?? []} cargando={caf.isPending} />}

      {pestana === 5 && <PanelRcof registros={rcof.data ?? []} cargando={rcof.isPending} />}

      {pestana === 6 && <PanelCertificacion />}
    </Box>
  )
}
