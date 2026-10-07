// src/features/ventas/components/visual/RegistroVentasVisual.tsx
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
import { TablaVentas } from '@/features/ventas/components/visual/TablaVentas'
import type { FilaVenta } from '@/features/ventas/utils/filaVenta'
import type { RangoFecha, TipoMovimiento } from '@/features/ventas/utils/filtrosVentas'

// historial de ventas para el dueno del local
export function RegistroVentasVisual() {
  const transacciones = useTransacciones()
  const dtes = useDtesEmitidos()

  const [busqueda, setBusqueda] = useState('')
  const [tipo, setTipo] = useState<TipoMovimiento>('todos')
  const [rango, setRango] = useState<RangoFecha>('semana')
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(10)

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
      <TarjetasResumenVentas resumen={resumen} tecnico={false} />

      <BarraHerramientasVentas
        busqueda={busqueda}
        tipo={tipo}
        rango={rango}
        actualizando={transacciones.isFetching}
        onBuscar={(texto) => {
          setBusqueda(texto)
          setPagina(0)
        }}
        onTipo={(valor) => {
          setTipo(valor)
          setPagina(0)
        }}
        onRango={(valor) => {
          setRango(valor)
          setPagina(0)
        }}
        onActualizar={() => transacciones.refetch()}
        onExportar={() => exportarVentasCsv(visibles)}
      />

      <TablaVentas
        ventas={visibles}
        cargando={transacciones.isPending}
        pagina={pagina}
        porPagina={porPagina}
        onPagina={setPagina}
        onPorPagina={setPorPagina}
        onVerTicket={setViendoTicket}
        onDevolver={setDevolviendo}
      />

      <Typography variant="caption" color="text.secondary">
        El backend entrega las ultimas 100 ventas, sin filtro por fecha: los filtros de esta pantalla trabajan sobre
        esas 100.
      </Typography>

      {viendoTicket && <DialogoTicketVenta venta={viendoTicket} onCerrar={() => setViendoTicket(null)} />}
      {devolviendo && <DialogoDevolucion venta={devolviendo} onCerrar={() => setDevolviendo(null)} />}
    </Box>
  )
}
