// src/app/router/paginas.tsx
import { lazy } from 'react'

// las pantallas llegan al entrar a cada una, asi la caja abre antes
export const IngresoFacturasPage = lazy(() =>
  import('@/features/invoices/pages/IngresoFacturasPage').then((m) => ({
    default: m.IngresoFacturasPage,
  })),
)

export const CierreCajaPage = lazy(() =>
  import('@/features/caja/pages/CierreCajaPage').then((m) => ({ default: m.CierreCajaPage })),
)

export const InventarioPage = lazy(() =>
  import('@/features/inventario/pages/InventarioPage').then((m) => ({ default: m.InventarioPage })),
)

export const ProveedoresPage = lazy(() =>
  import('@/features/proveedores/pages/ProveedoresPage').then((m) => ({
    default: m.ProveedoresPage,
  })),
)

export const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)

export const NotificacionesPage = lazy(() =>
  import('@/features/notificaciones/pages/NotificacionesPage').then((m) => ({
    default: m.NotificacionesPage,
  })),
)

export const VentasPage = lazy(() =>
  import('@/features/ventas/pages/VentasPage').then((m) => ({ default: m.VentasPage })),
)

export const SiiPage = lazy(() =>
  import('@/features/sii/pages/SiiPage').then((m) => ({ default: m.SiiPage })),
)

export const ReabastecimientoPage = lazy(() =>
  import('@/features/replenishment/pages/ReabastecimientoPage').then((m) => ({
    default: m.ReabastecimientoPage,
  })),
)

export const ConfiguracionPage = lazy(() =>
  import('@/features/configuracion/pages/ConfiguracionPage').then((m) => ({
    default: m.ConfiguracionPage,
  })),
)

export const NotFoundPage = lazy(() =>
  import('@/shared/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)
