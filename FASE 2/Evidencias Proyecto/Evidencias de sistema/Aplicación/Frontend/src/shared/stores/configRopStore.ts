// src/shared/stores/configRopStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CONFIG_ROP_POR_DEFECTO } from '@/features/replenishment/types'
import type { ConfigRop } from '@/features/replenishment/types'

type ConfigRopState = {
  config: ConfigRop
  cambiarConfig: (config: ConfigRop) => void
  restaurar: () => void
}

// parametros del rop, compartidos por todas las pantallas
export const useConfigRopStore = create<ConfigRopState>()(
  persist(
    (set) => ({
      config: CONFIG_ROP_POR_DEFECTO,
      cambiarConfig: (config) => set({ config }),
      restaurar: () => set({ config: CONFIG_ROP_POR_DEFECTO }),
    }),
    { name: 'gestock-config-rop' },
  ),
)
