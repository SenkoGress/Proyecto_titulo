// src/features/proveedores/components/visual/DirectorioProveedores.tsx
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { useInventario } from '@/features/inventario/hooks/useInventario'
import { useOrdenesCompra } from '@/features/replenishment/hooks/useReplenishment'
import { useFacturasProveedores, useProveedores } from '@/features/proveedores/hooks/useProveedores'
import { BarraHerramientasProveedores } from '@/features/proveedores/components/visual/BarraHerramientasProveedores'
import { TarjetaProveedor } from '@/features/proveedores/components/visual/TarjetaProveedor'
import { DialogoProveedor } from '@/features/proveedores/components/visual/DialogoProveedor'
import { DialogoFacturasProveedor } from '@/features/proveedores/components/visual/DialogoFacturasProveedor'
import { DialogoPedidoWhatsApp } from '@/features/proveedores/components/visual/DialogoPedidoWhatsApp'
import { armarFichasProveedores } from '@/features/proveedores/utils/fichaProveedor'
import { filtrarProveedores, TODOS_LOS_RUBROS } from '@/features/proveedores/utils/filtrarProveedores'
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'

// directorio de proveedores en tarjetas (modo visual)
export function DirectorioProveedores() {
  const proveedores = useProveedores()
  const inventario = useInventario()
  const facturas = useFacturasProveedores()
  const ordenes = useOrdenesCompra()

  const [busqueda, setBusqueda] = useState('')
  const [rubro, setRubro] = useState(TODOS_LOS_RUBROS)

  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState<FichaProveedor | null>(null)
  const [viendoFacturas, setViendoFacturas] = useState<FichaProveedor | null>(null)
  const [pidiendo, setPidiendo] = useState<FichaProveedor | null>(null)

  const fichas = useMemo(
    () =>
      armarFichasProveedores(
        proveedores.data ?? [],
        inventario.data ?? [],
        facturas.data ?? [],
        ordenes.data ?? [],
      ),
    [proveedores.data, inventario.data, facturas.data, ordenes.data],
  )

  const filtradas = useMemo(() => filtrarProveedores(fichas, rubro, busqueda), [fichas, rubro, busqueda])

  const abrirNuevo = () => {
    setEditando(null)
    setFormAbierto(true)
  }

  const abrirEdicion = (ficha: FichaProveedor) => {
    setEditando(ficha)
    setFormAbierto(true)
  }

  if (proveedores.isError) return <ErrorBox error={proveedores.error} />
  if (proveedores.isPending) return <Skeleton variant="rounded" height={420} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <BarraHerramientasProveedores
        fichas={fichas}
        busqueda={busqueda}
        rubro={rubro}
        onBuscar={setBusqueda}
        onElegirRubro={setRubro}
        onNuevo={abrirNuevo}
      />

      {filtradas.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {fichas.length === 0
              ? 'Todavia no hay proveedores registrados.'
              : 'Ningun proveedor coincide con la busqueda.'}
          </Typography>
        </Paper>
      ) : (
        // grilla responsiva: 3 tarjetas por fila en pantalla ancha
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          }}
        >
          {filtradas.map((ficha) => (
            <TarjetaProveedor
              key={ficha.id}
              ficha={ficha}
              onPedir={setPidiendo}
              onVerFacturas={setViendoFacturas}
              onEditar={abrirEdicion}
            />
          ))}
        </Box>
      )}

      {/* se montan recien al abrirse para que el formulario parta siempre limpio */}
      {formAbierto && <DialogoProveedor editando={editando} onCerrar={() => setFormAbierto(false)} />}

      <DialogoFacturasProveedor
        ficha={viendoFacturas}
        facturas={facturas.data ?? []}
        onCerrar={() => setViendoFacturas(null)}
      />

      {pidiendo && <DialogoPedidoWhatsApp ficha={pidiendo} onCerrar={() => setPidiendo(null)} />}
    </Box>
  )
}
