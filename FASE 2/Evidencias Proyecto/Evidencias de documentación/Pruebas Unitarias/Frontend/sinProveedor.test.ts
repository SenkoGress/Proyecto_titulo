// src/features/replenishment/utils/sinProveedor.test.ts
import { describe, expect, it } from 'vitest'
import { esOrdenSinProveedor } from '@/features/replenishment/utils/sinProveedor'
import type { OrdenSugerida } from '@/features/replenishment/types'

// desde el 04-11 el backend ya no les inventa un proveedor a estos productos
function orden(proveedorId: string, total: number): OrdenSugerida {
  return { proveedor_id: proveedorId, total_estimado: total } as OrdenSugerida
}

describe('esOrdenSinProveedor', () => {
  it('reconoce la orden que el backend dejo sin proveedor', () => {
    expect(esOrdenSinProveedor(orden('UNASSIGNED', 0))).toBe(true)
  })

  it('no confunde a un proveedor de verdad', () => {
    expect(esOrdenSinProveedor(orden('7f3c1a90-0000-4000-8000-000000000001', 9990))).toBe(false)
  })
})
