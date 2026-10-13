// src/app/router/router.tsx
import { createBrowserRouter } from 'react-router'
import { MainLayout } from '@/shared/components/layout/MainLayout'
import { RutaDeAdmin, RutaProtegida } from '@/app/router/RutaProtegida'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { CajaPage } from '@/features/pos/pages/CajaPage'
import {
  CierreCajaPage,
  ConfiguracionPage,
  DashboardPage,
  IngresoFacturasPage,
  InventarioPage,
  NotFoundPage,
  NotificacionesPage,
  ProveedoresPage,
  ReabastecimientoPage,
  SiiPage,
  VentasPage,
} from '@/app/router/paginas'

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
