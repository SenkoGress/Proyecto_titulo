// src/app/router/router.tsx
import { createBrowserRouter } from 'react-router'
import { MainLayout } from '@/shared/components/layout/MainLayout'
import { RutaDeAdmin, RutaProtegida } from '@/app/router/RutaProtegida'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { CajaPage } from '@/features/pos/pages/CajaPage'
import { IngresoFacturasPage } from '@/features/invoices/pages/IngresoFacturasPage'
import { CierreCajaPage } from '@/features/caja/pages/CierreCajaPage'
import { InventarioPage } from '@/features/inventario/pages/InventarioPage'
import { ProveedoresPage } from '@/features/proveedores/pages/ProveedoresPage'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { NotificacionesPage } from '@/features/notificaciones/pages/NotificacionesPage'
import { VentasPage } from '@/features/ventas/pages/VentasPage'
import { SiiPage } from '@/features/sii/pages/SiiPage'
import { ReabastecimientoPage } from '@/features/replenishment/pages/ReabastecimientoPage'
import { ConfiguracionPage } from '@/features/configuracion/pages/ConfiguracionPage'
import { NotFoundPage } from '@/shared/pages/NotFoundPage'

// rutas de la app
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> }, // entrar o crear cuenta
  {
    element: <RutaProtegida />,
    children: [
      {
        path: '/',
        element: <MainLayout />,
        children: [
          // las ve cualquiera con sesion abierta
          { index: true, element: <CajaPage /> }, // caja
          { path: 'caja/cierre', element: <CierreCajaPage /> }, // arqueo y cierre de turno
          { path: 'inventario', element: <InventarioPage /> }, // catalogo general
          { path: 'notificaciones', element: <NotificacionesPage /> }, // avisos del local
          { path: 'ventas', element: <VentasPage /> }, // historial de ventas y devoluciones
          { path: 'configuracion', element: <ConfiguracionPage /> }, // apariencia para todos, reglas solo admin

          // solo el administrador
          {
            element: <RutaDeAdmin />,
            children: [
              { path: 'dashboard', element: <DashboardPage /> }, // panel general
              { path: 'facturas', element: <IngresoFacturasPage /> }, // ocr de facturas
              { path: 'proveedores', element: <ProveedoresPage /> }, // directorio de proveedores
              { path: 'reabastecimiento', element: <ReabastecimientoPage /> }, // ordenes sugeridas
              { path: 'sii', element: <SiiPage /> }, // respaldo tributario y f29
            ],
          },

          { path: '*', element: <NotFoundPage /> }, // ruta no existe
        ],
      },
    ],
  },
])
