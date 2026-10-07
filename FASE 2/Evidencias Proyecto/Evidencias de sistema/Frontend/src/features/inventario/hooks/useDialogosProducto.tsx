// src/features/inventario/hooks/useDialogosProducto.tsx
import { useState } from 'react'
import { DialogoProducto } from '@/features/inventario/components/compartidos/DialogoProducto'
import { DialogoAjusteStock } from '@/features/inventario/components/compartidos/DialogoAjusteStock'
import { DialogoMerma } from '@/features/inventario/components/compartidos/DialogoMerma'
import { DialogoHistorialMermas } from '@/features/inventario/components/compartidos/DialogoHistorialMermas'
import { DialogoHistorialProducto } from '@/features/inventario/components/compartidos/DialogoHistorialProducto'
import type { ProductoInventario } from '@/features/inventario/types'

type Cual = 'producto' | 'ajuste' | 'merma' | 'historial' | 'movimientos' | null

// acciones de inventario, compartidas por el modo visual y el tecnico
export function useDialogosProducto() {
  const [cual, setCual] = useState<Cual>(null)
  const [elegido, setElegido] = useState<ProductoInventario | null>(null)
  // cambia en cada apertura para que el formulario se monte limpio
  const [turno, setTurno] = useState(0)

  function abrir(tipo: Exclude<Cual, null>, producto: ProductoInventario | null) {
    setElegido(producto)
    setCual(tipo)
    setTurno((previo) => previo + 1)
  }

  const dialogos = (
    <>
      <DialogoProducto
        key={`producto-${turno}`}
        abierto={cual === 'producto'}
        onCerrar={() => setCual(null)}
        producto={elegido}
      />
      <DialogoAjusteStock
        key={`ajuste-${turno}`}
        abierto={cual === 'ajuste'}
        onCerrar={() => setCual(null)}
        producto={elegido}
      />
      <DialogoMerma
        key={`merma-${turno}`}
        abierto={cual === 'merma'}
        onCerrar={() => setCual(null)}
        producto={elegido}
      />
      <DialogoHistorialMermas abierto={cual === 'historial'} onCerrar={() => setCual(null)} />
      <DialogoHistorialProducto
        abierto={cual === 'movimientos'}
        onCerrar={() => setCual(null)}
        producto={elegido}
      />
    </>
  )

  return {
    dialogos,
    abrirAgregar: () => abrir('producto', null),
    abrirEditar: (producto: ProductoInventario) => abrir('producto', producto),
    abrirAjuste: (producto: ProductoInventario) => abrir('ajuste', producto),
    abrirMerma: (producto: ProductoInventario) => abrir('merma', producto),
    abrirHistorialMermas: () => abrir('historial', null),
    abrirMovimientos: (producto: ProductoInventario) => abrir('movimientos', producto),
  }
}
