// src/features/inventario/components/compartidos/permisosInventario.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AccionesProducto } from '@/features/inventario/components/compartidos/AccionesProducto'
import { BarraHerramientasInventario } from '@/features/inventario/components/visual/BarraHerramientasInventario'
import { BarraHerramientasInventarioTecnico } from '@/features/inventario/components/tecnico/BarraHerramientasInventarioTecnico'

let esAdmin = true
vi.mock('@/features/auth/stores/sesionStore', () => ({ usePuedeAdministrar: () => esAdmin }))
vi.mock('@/shared/components/layout/BotonSincronizar', () => ({ BotonSincronizar: () => null }))

const nada = () => {}
const barra = { productos: [], busqueda: '', categoria: '', onBuscar: nada, onElegirCategoria: nada, onExportar: nada, onAgregar: nada, onVerMermas: nada }

function menu() {
  render(<AccionesProducto onEditar={nada} onAjustar={nada} onMerma={nada} onHistorial={nada} />)
  fireEvent.click(screen.getByRole('button'))
  return screen.getAllByRole('menuitem').map((item) => item.textContent)
}

function botonesDeLasBarras() {
  render(
    <MemoryRouter>
      <BarraHerramientasInventario {...barra} />
      <BarraHerramientasInventarioTecnico {...barra} cantidadSeleccionada={0} onImprimirEtiquetas={nada} />
    </MemoryRouter>,
  )
  return document.body.textContent ?? ''
}

// rf-04: el cajero consulta el inventario y registra mermas; dar de alta, editar y ajustar es del admin
describe('Inventario segun el rol', () => {
  beforeEach(() => {
    esAdmin = true
    // el menu de mui devuelve el foco al cerrarse: necesita un elemento que lo reciba
    const campo = document.createElement('input')
    document.body.appendChild(campo)
    campo.focus()
  })
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('el administrador ve todas las acciones del producto', () => {
    expect(menu()).toEqual(['Editar producto', 'Ajustar stock', 'Registrar merma', 'Ver movimientos'])
  })

  it('el cajero solo registra mermas y ve movimientos', () => {
    esAdmin = false
    expect(menu()).toEqual(['Registrar merma', 'Ver movimientos'])
  })

  it('el cajero no ve el alta de productos ni la recepcion de mercaderia', () => {
    esAdmin = false
    const texto = botonesDeLasBarras()

    expect(texto).not.toContain('Añadir producto')
    expect(texto).not.toContain('Alta de producto')
    expect(texto).not.toContain('Recepcion mercaderia')
    expect(texto).toContain('Mermas')
  })

  it('el administrador si los ve', () => {
    const texto = botonesDeLasBarras()

    expect(texto).toContain('Añadir producto')
    expect(texto).toContain('Alta de producto')
    expect(texto).toContain('Recepcion mercaderia')
  })
})
