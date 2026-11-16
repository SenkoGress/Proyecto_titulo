// src/features/inventario/components/compartidos/AccionesProducto.tsx
import { useState } from 'react'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import EditOutlined from '@mui/icons-material/EditOutlined'
import InventoryOutlined from '@mui/icons-material/Inventory2Outlined'
import DeleteSweepOutlined from '@mui/icons-material/DeleteSweepOutlined'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'

export type AccionesProductoProps = {
  onEditar: () => void
  onAjustar: () => void
  onMerma: () => void
  onHistorial: () => void
}

// menu de acciones de cada fila del inventario
export function AccionesProducto({ onEditar, onAjustar, onMerma, onHistorial }: AccionesProductoProps) {
  const [ancla, setAncla] = useState<HTMLElement | null>(null)

  function elegir(accion: () => void) {
    setAncla(null)
    accion()
  }

  return (
    <>
      <IconButton size="small" onClick={(evento) => setAncla(evento.currentTarget)}>
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu anchorEl={ancla} open={Boolean(ancla)} onClose={() => setAncla(null)}>
        <MenuItem onClick={() => elegir(onEditar)}>
          <ListItemIcon>
            <EditOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>Editar producto</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => elegir(onAjustar)}>
          <ListItemIcon>
            <InventoryOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>Ajustar stock</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => elegir(onMerma)}>
          <ListItemIcon>
            <DeleteSweepOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>Registrar merma</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => elegir(onHistorial)}>
          <ListItemIcon>
            <HistoryOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>Ver movimientos</ListItemText>
        </MenuItem>
      </Menu>
    </>
  )
}
