// src/features/notificaciones/pages/NotificacionesPage.tsx
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import { Migas } from '@/shared/components/ui/Migas'
import { useEsModoTecnico } from '@/shared/stores/modoVistaStore'
import { useNotificaciones } from '@/features/notificaciones/hooks/useNotificaciones'
import { useNotificacionesStore } from '@/features/notificaciones/stores/notificacionesStore'
import { ResumenNotificaciones } from '@/features/notificaciones/components/ResumenNotificaciones'
import {
  BarraFiltrosNotificaciones,
  TODAS_CATEGORIAS,
} from '@/features/notificaciones/components/BarraFiltrosNotificaciones'
import { FilaNotificacion } from '@/features/notificaciones/components/FilaNotificacion'
import { DialogoPedidoWhatsApp } from '@/features/proveedores/components/visual/DialogoPedidoWhatsApp'
import { useProveedores } from '@/features/proveedores/hooks/useProveedores'
import { useInventario } from '@/features/inventario/hooks/useInventario'
import { armarFichasProveedores } from '@/features/proveedores/utils/fichaProveedor'
import type { FichaProveedor } from '@/features/proveedores/utils/fichaProveedor'
import type { Notificacion } from '@/features/notificaciones/types'

// centro de avisos: todo lo que el sistema detecta y necesita una decision del local
export function NotificacionesPage() {
  const esModoTecnico = useEsModoTecnico()
  const navegar = useNavigate()

  const { lista, sinVer, cargando } = useNotificaciones()
  const marcarVistas = useNotificacionesStore((estado) => estado.marcarVistas)

  const [filtro, setFiltro] = useState<string>(TODAS_CATEGORIAS)
  const [soloSinVer, setSoloSinVer] = useState(false)
  const [pidiendo, setPidiendo] = useState<FichaProveedor | null>(null)

  const proveedores = useProveedores()
  const inventario = useInventario()

  const fichas = useMemo(
    () => armarFichasProveedores(proveedores.data ?? [], inventario.data ?? [], [], []),
    [proveedores.data, inventario.data],
  )

  const idsSinVer = new Set(sinVer.map((item) => item.id))

  const visibles = lista.filter((item) => {
    const coincideCategoria = filtro === TODAS_CATEGORIAS || item.categoria === filtro
    return coincideCategoria && (!soloSinVer || idsSinVer.has(item.id))
  })

  // los avisos de quiebre abren el pedido al proveedor, el resto lleva a su pantalla
  const alAccionar = (notificacion: Notificacion) => {
    if (notificacion.categoria === 'stock' && notificacion.proveedorId) {
      const ficha = fichas.find((item) => item.id === notificacion.proveedorId)
      if (ficha) {
        setPidiendo(ficha)
        return
      }
    }

    if (notificacion.ruta) navegar(notificacion.ruta)
  }

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Migas rutas={['Notificaciones', esModoTecnico ? 'Centro de alertas' : 'Avisos del local']} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
        <Typography variant="h1">Notificaciones</Typography>
        <Chip
          label={sinVer.length > 0 ? `${sinVer.length} sin ver` : 'Todo revisado'}
          size="small"
          color={sinVer.length > 0 ? 'warning' : 'success'}
          variant="outlined"
        />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Vencimientos, quiebres de stock, turno de caja, visitas de proveedor y estado del terminal, todo en un solo
        lugar.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <ResumenNotificaciones lista={lista} />

        <BarraFiltrosNotificaciones
          lista={lista}
          filtro={filtro}
          soloSinVer={soloSinVer}
          pendientes={sinVer.length}
          onFiltrar={setFiltro}
          onSoloSinVer={setSoloSinVer}
          onMarcarTodas={() => marcarVistas(lista.map((item) => item.id))}
        />

        {cargando && <Skeleton variant="rounded" height={220} />}

        {!cargando && visibles.length === 0 && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircleOutlinedIcon sx={{ fontSize: 44, color: 'success.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mt: 1 }}>
              No hay avisos pendientes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {lista.length === 0
                ? 'El sistema no detecta nada que necesite atencion en este momento.'
                : 'Ningun aviso coincide con el filtro elegido.'}
            </Typography>
          </Paper>
        )}

        {!cargando &&
          visibles.map((notificacion) => (
            <FilaNotificacion
              key={notificacion.id}
              notificacion={notificacion}
              sinVer={idsSinVer.has(notificacion.id)}
              esModoTecnico={esModoTecnico}
              onAccion={alAccionar}
            />
          ))}

        <Typography variant="caption" color="text.secondary">
          Los avisos se calculan en vivo con los datos del backend cada vez que se abre la pantalla. El "visto" se
          guarda solo en este equipo: el backend no tiene donde registrar alertas leidas.
        </Typography>
      </Box>

      {pidiendo && <DialogoPedidoWhatsApp ficha={pidiendo} onCerrar={() => setPidiendo(null)} />}
    </Box>
  )
}
