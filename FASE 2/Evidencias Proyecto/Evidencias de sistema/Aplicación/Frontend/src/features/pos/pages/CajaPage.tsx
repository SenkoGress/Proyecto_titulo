// src/features/pos/pages/CajaPage.tsx
import { CajaVisual } from '@/features/pos/components/visual/CajaVisual'
import { CajaTecnica } from '@/features/pos/components/tecnico/CajaTecnica'
import { useEsModoTecnico } from '@/shared/stores/modoVistaStore'

// caja segun el modo elegido
export function CajaPage() {
  const esModoTecnico = useEsModoTecnico()
  return esModoTecnico ? <CajaTecnica /> : <CajaVisual />
}
