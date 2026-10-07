// src/features/proveedores/components/tecnico/LogisticaRop.tsx
import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { useInventario } from '@/features/inventario/hooks/useInventario'
import { useOrdenesCompra, useSugerenciaPedido } from '@/features/replenishment/hooks/useReplenishment'
import { useConfigRopStore } from '@/shared/stores/configRopStore'
import { useFacturasProveedores, useProveedores } from '@/features/proveedores/hooks/useProveedores'
import { TarjetasKpiProveedores } from '@/features/proveedores/components/tecnico/TarjetasKpiProveedores'
import { BarraHerramientasProveedoresTecnica } from '@/features/proveedores/components/tecnico/BarraHerramientasProveedoresTecnica'
import { TablaProveedoresTecnica } from '@/features/proveedores/components/tecnico/TablaProveedoresTecnica'
import { PanelRegistroRop } from '@/features/proveedores/components/tecnico/PanelRegistroRop'
import { PanelCalendarioVisitas } from '@/features/proveedores/components/tecnico/PanelCalendarioVisitas'
import { PanelEnvioOrdenes } from '@/features/replenishment/components/compartidos/PanelEnvioOrdenes'
import { DialogoProveedor } from '@/features/proveedores/components/visual/DialogoProveedor'
import { DialogoPedidoWhatsApp } from '@/features/proveedores/components/visual/DialogoPedidoWhatsApp'
import { armarFichasProveedores } from '@/features/proveedores/utils/fichaProveedor'
import { filtrarProveedores, TODOS_LOS_RUBROS } from '@/features/proveedores/utils/filtrarProveedores'
import { calcularMetricas, indexarOrdenesSugeridas } from '@/features/proveedores/utils/metricasProveedores'
import { exportarProveedoresCsv } from '@/features/proveedores/utils/exportarProveedoresCsv'
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

// modo tecnico: directorio denso arriba y motor de reposicion (rop) abajo
export function LogisticaRop() {
  const proveedores = useProveedores()
  const inventario = useInventario()
  const facturas = useFacturasProveedores()
  const ordenesCompra = useOrdenesCompra()

  // los parametros del rop viven en configuracion y los comparten todas las pantallas
  const configRop = useConfigRopStore((estado) => estado.config)
  const setConfigRop = useConfigRopStore((estado) => estado.cambiarConfig)
  const sugerencia = useSugerenciaPedido(configRop)

  const [busqueda, setBusqueda] = useState('')
  const [rubro, setRubro] = useState(TODOS_LOS_RUBROS)

  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState<FichaProveedor | null>(null)
  const [pidiendo, setPidiendo] = useState<FichaProveedor | null>(null)

  const abrirNuevo = () => {
    setEditando(null)
    setFormAbierto(true)
  }

  // F4 para dar de alta un proveedor, como el resto de atajos del modo tecnico
  useEffect(() => {
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key !== 'F4') return
      evento.preventDefault()
      setEditando(null)
      setFormAbierto(true)
    }

    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [])

  const fichas = useMemo(
    () =>
      armarFichasProveedores(
        proveedores.data ?? [],
        inventario.data ?? [],
        facturas.data ?? [],
        ordenesCompra.data ?? [],
      ),
    [proveedores.data, inventario.data, facturas.data, ordenesCompra.data],
  )

  const filtradas = useMemo(() => filtrarProveedores(fichas, rubro, busqueda), [fichas, rubro, busqueda])

  const metricas = useMemo(() => calcularMetricas(fichas, facturas.data ?? []), [fichas, facturas.data])

  const ordenesSugeridas = useMemo(() => sugerencia.data?.suggested_orders ?? [], [sugerencia.data])

  const ordenesPorProveedor = useMemo(() => indexarOrdenesSugeridas(ordenesSugeridas), [ordenesSugeridas])

  if (proveedores.isError) return <ErrorBox error={proveedores.error} />
  if (proveedores.isPending) return <Skeleton variant="rounded" height={420} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TarjetasKpiProveedores metricas={metricas} resumenRop={sugerencia.data?.resumen} />

      <BarraHerramientasProveedoresTecnica
        fichas={filtradas}
        busqueda={busqueda}
        rubro={rubro}
        configRop={configRop}
        onBuscar={setBusqueda}
        onElegirRubro={setRubro}
        onCambiarRop={setConfigRop}
        onExportar={() => exportarProveedoresCsv(filtradas)}
        onNuevo={abrirNuevo}
      />

      {filtradas.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">Ningun proveedor coincide con la busqueda.</Typography>
        </Paper>
      ) : (
        <TablaProveedoresTecnica
          fichas={filtradas}
          ordenesPorProveedor={ordenesPorProveedor}
          onEditar={(ficha) => {
            setEditando(ficha)
            setFormAbierto(true)
          }}
          onPedir={setPidiendo}
        />
      )}

      <Typography variant="caption" color="text.secondary">
        Mostrando {filtradas.length} de {fichas.length} proveedores · datos cruzados con el catalogo POS
      </Typography>

      {/* motor rop y logistica de visitas, en tres columnas para que no queden apilados */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        }}
      >
        <PanelRegistroRop ordenes={ordenesSugeridas} cargando={sugerencia.isPending} />
        <PanelEnvioOrdenes cantidadOrdenes={ordenesSugeridas.length} />
        <PanelCalendarioVisitas fichas={fichas} />
      </Box>

      {formAbierto && <DialogoProveedor editando={editando} onCerrar={() => setFormAbierto(false)} />}
      {pidiendo && <DialogoPedidoWhatsApp ficha={pidiendo} onCerrar={() => setPidiendo(null)} />}
    </Box>
  )
}
