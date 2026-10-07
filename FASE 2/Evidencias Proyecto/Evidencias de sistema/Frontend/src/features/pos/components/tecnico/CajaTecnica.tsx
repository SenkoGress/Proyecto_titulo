// src/features/pos/components/tecnico/CajaTecnica.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import { BuscadorTecnico } from '@/features/pos/components/tecnico/BuscadorTecnico'
import { BarraAtajos } from '@/features/pos/components/tecnico/BarraAtajos'
import { TablaTicket } from '@/features/pos/components/tecnico/TablaTicket'
import { PanelCobro } from '@/features/pos/components/tecnico/PanelCobro'
import { DialogoAtajos } from '@/features/pos/components/tecnico/DialogoAtajos'
import { DialogoComprobante } from '@/features/pos/components/compartidos/DialogoComprobante'
import { ID_BUSCADOR, idCampoCantidad } from '@/features/pos/components/tecnico/ids'
import { useCobrarVenta } from '@/features/pos/hooks/useCobrarVenta'
import { useAtajosTeclado, type AccionesAtajos } from '@/features/pos/hooks/useAtajosTeclado'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import { METODOS_PAGO } from '@/features/pos/metodosPago'

// caja en modo tecnico: tabla + panel de cobro
export function CajaTecnica() {
  const { cobrar, cerrarComprobante, ventaLista, cobrando, errorCobro } = useCobrarVenta()
  const limpiar = useCarritoStore((estado) => estado.limpiar)
  const cambiarMetodoPago = useCarritoStore((estado) => estado.cambiarMetodoPago)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)

  // ir al buscador
  function enfocarBuscador() {
    document.getElementById(ID_BUSCADOR)?.focus()
  }

  // editar cantidad del ultimo producto
  function editarCantidad() {
    const ultima = useCarritoStore.getState().lineas.at(-1)
    if (!ultima) return
    const campo = document.getElementById(idCampoCantidad(ultima.producto.id))
    if (campo instanceof HTMLInputElement) {
      campo.focus()
      campo.select()
    }
  }

  // acciones de los atajos
  const acciones: AccionesAtajos = {
    ayuda: () => setAyudaAbierta(true),
    buscar: enfocarBuscador,
    editarCantidad,
    cobrar,
    limpiar,
    elegirMetodo: (indice) => {
      const metodo = METODOS_PAGO[indice]
      if (metodo) cambiarMetodoPago(metodo.valor)
    },
  }

  useAtajosTeclado(acciones)

  return (
    <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>
      {/* izquierda: buscador y tabla */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flexGrow: 1, minWidth: 0 }}>
        <BuscadorTecnico />
        <BarraAtajos acciones={acciones} />
        <TablaTicket />
      </Box>

      {/* derecha: cobro */}
      <PanelCobro
        onCobrar={cobrar}
        onCancelar={limpiar}
        cobrando={cobrando}
        errorCobro={errorCobro}
      />

      {ventaLista && (
        <DialogoComprobante
          venta={ventaLista.venta}
          ajusteRedondeo={ventaLista.ajusteRedondeo}
          onCerrar={cerrarComprobante}
        />
      )}
      <DialogoAtajos abierto={ayudaAbierta} onCerrar={() => setAyudaAbierta(false)} />
    </Box>
  )
}
