// src/features/ventas/components/tecnico/AuditoriaVentasTecnica.tsx
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { useDtesEmitidos, useTransacciones } from '@/features/ventas/hooks/useVentas'
import { armarFilasVenta } from '@/features/ventas/utils/filaVenta'
import { filtrarVentas } from '@/features/ventas/utils/filtrosVentas'
import { resumirVentas } from '@/features/ventas/utils/resumenVentas'
import { exportarVentasCsv } from '@/features/ventas/utils/exportarVentasCsv'
import { BarraHerramientasVentas } from '@/features/ventas/components/compartidos/BarraHerramientasVentas'
import { TarjetasResumenVentas } from '@/features/ventas/components/compartidos/TarjetasResumenVentas'
import { DialogoTicketVenta } from '@/features/ventas/components/compartidos/DialogoTicketVenta'
import { DialogoDevolucion } from '@/features/ventas/components/compartidos/DialogoDevolucion'
import { TablaVentasTecnica } from '@/features/ventas/components/tecnico/TablaVentasTecnica'
import { PanelAuditoriaDte } from '@/features/ventas/components/tecnico/PanelAuditoriaDte'
import type { FilaVenta } from '@/features/ventas/utils/filaVenta'
import type { RangoFecha, TipoMovimiento } from '@/features/ventas/utils/filtrosVentas'

// registro cronologico y auditoria de documentos
export function AuditoriaVentasTecnica() {
  const transacciones = useTransacciones()
  const dtes = useDtesEmitidos()

  const [busqueda, setBusqueda] = useState('')
  const [tipo, setTipo] = useState<TipoMovimiento>('todos')
  const [rango, setRango] = useState<RangoFecha>('todo')

  const [viendoTicket, setViendoTicket] = useState<FilaVenta | null>(null)
  const [devolviendo, setDevolviendo] = useState<FilaVenta | null>(null)

  const filas = useMemo(
    () => armarFilasVenta(transacciones.data ?? [], dtes.data ?? []),
    [transacciones.data, dtes.data],
  )

  const visibles = useMemo(() => filtrarVentas(filas, busqueda, tipo, rango), [filas, busqueda, tipo, rango])
  const resumen = useMemo(() => resumirVentas(visibles), [visibles])

  if (transacciones.isError) return <ErrorBox error={transacciones.error} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TarjetasResumenVentas resumen={resumen} tecnico />

      <BarraHerramientasVentas
        busqueda={busqueda}
        tipo={tipo}
        rango={rango}
        actualizando={transacciones.isFetching}
        onBuscar={setBusqueda}
        onTipo={setTipo}
        onRango={setRango}
        onActualizar={() => transacciones.refetch()}
        onExportar={() => exportarVentasCsv(visibles)}
      />

      <TablaVentasTecnica
        ventas={visibles}
        cargando={transacciones.isPending}
        onVerTicket={setViendoTicket}
        onDevolver={setDevolviendo}
      />

      <PanelAuditoriaDte dtes={dtes.data ?? []} />

      <Typography variant="caption" color="text.secondary">
        GET /pos/transactions entrega las ultimas 100 filas de transacciones_venta sin filtro por fecha ni
        paginacion: los filtros de esta pantalla trabajan sobre esas 100.
      </Typography>

      {viendoTicket && <DialogoTicketVenta venta={viendoTicket} onCerrar={() => setViendoTicket(null)} />}
      {devolviendo && <DialogoDevolucion venta={devolviendo} onCerrar={() => setDevolviendo(null)} />}
    </Box>
  )
}
