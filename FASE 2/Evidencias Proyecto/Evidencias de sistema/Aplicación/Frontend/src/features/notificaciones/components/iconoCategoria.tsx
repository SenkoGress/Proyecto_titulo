// src/features/notificaciones/components/iconoCategoria.tsx
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined'
import TrendingDownOutlined from '@mui/icons-material/TrendingDownOutlined'
import SavingsOutlined from '@mui/icons-material/SavingsOutlined'
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined'
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined'
import CloudOutlined from '@mui/icons-material/CloudOutlined'
import type { ReactNode } from 'react'
import type { CategoriaNotificacion } from '@/features/notificaciones/types'

// el icono de cada categoria, el mismo que usa su seccion en el menu
export const ICONO_CATEGORIA: Record<CategoriaNotificacion, ReactNode> = {
  sanitaria: <EventBusyOutlined fontSize="small" />,
  stock: <TrendingDownOutlined fontSize="small" />,
  caja: <SavingsOutlined fontSize="small" />,
  proveedores: <LocalShippingOutlined fontSize="small" />,
  inventario: <Inventory2Outlined fontSize="small" />,
  sistema: <CloudOutlined fontSize="small" />,
}
