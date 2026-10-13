// src/features/invoices/pages/IngresoFacturasPage.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { Migas } from '@/shared/components/ui/Migas'
import { useEsModoTecnico } from '@/shared/stores/modoVistaStore'
import { SubirFactura } from '@/features/invoices/components/compartidos/SubirFactura'
import { FacturaEncolada } from '@/features/invoices/components/compartidos/FacturaEncolada'
import { PanelColaFacturas } from '@/features/invoices/components/compartidos/PanelColaFacturas'
import { FacturaIlegible } from '@/features/invoices/components/compartidos/FacturaIlegible'
import { noSePudoLeer } from '@/features/invoices/utils/lecturaFactura'
import { DialogoIngresoExitoso } from '@/features/invoices/components/compartidos/DialogoIngresoExitoso'
import { RevisionFacturaVisual } from '@/features/invoices/components/visual/RevisionFacturaVisual'
import { RevisionFacturaTecnica } from '@/features/invoices/components/tecnico/RevisionFacturaTecnica'
import { useConfirmarFactura } from '@/features/invoices/hooks/useInvoices'
import { recalcularFila } from '@/features/invoices/utils/calculosFactura'
import type { ItemFactura, PrevisualizacionFactura, ResultadoEscaneo } from '@/features/invoices/types'

// fila en blanco para cuando el ocr se salto un producto de la factura
function filaVacia(): ItemFactura {
  return {
    sku: '',
    codigo_barra: '',
    descripcion: '',
    cantidad: 1,
    unidad: 'UNI',
    precio_unitario: 0,
    subtotal: 0,
    precio_venta_sugerido: 0,
    es_nuevo: true,
    stock_actual: 0,
    stock_proyectado: 1,
  }
}

// paso 1 subir, paso 2 revisar lo que leyo la ia y confirmar (visual o tecnico)
export function IngresoFacturasPage() {
  const esModoTecnico = useEsModoTecnico()

  const [preview, setPreview] = useState<PrevisualizacionFactura | null>(null)
  const [encolada, setEncolada] = useState<Extract<ResultadoEscaneo, { tipo: 'encolada' }> | null>(null)
  const [ilegible, setIlegible] = useState<string | null>(null)
  const [items, setItems] = useState<ItemFactura[]>([])
  const [totalDeclarado, setTotalDeclarado] = useState(0)

  const confirmar = useConfirmarFactura()

  // el ocr termino, quedo en cola, o la imagen no se entendio
  function alEscanear(resultado: ResultadoEscaneo, nombreArchivo: string) {
    if (resultado.tipo === 'encolada') {
      setEncolada(resultado)
      return
    }

    // el ocr respondio bien pero sin productos: no sirve de nada seguir
    if (noSePudoLeer(resultado.preview)) {
      setIlegible(nombreArchivo)
      return
    }

    setPreview(resultado.preview)
    setItems(resultado.preview.items)
    setTotalDeclarado(resultado.preview.total_factura)
  }

  function cambiarFila(indice: number, cambios: Partial<ItemFactura>) {
    setItems((actual) => actual.map((item, i) => (i === indice ? recalcularFila(item, cambios) : item)))
  }

  function eliminarFila(indice: number) {
    setItems((actual) => actual.filter((_, i) => i !== indice))
  }

  function agregarFila() {
    setItems((actual) => [...actual, filaVacia()])
  }

  // volver a la pantalla de subir sin guardar nada
  function cancelar() {
    setPreview(null)
    setEncolada(null)
    setIlegible(null)
    setItems([])
    confirmar.reset()
  }

  // enviar la version revisada al backend
  function confirmarIngreso() {
    if (!preview) return

    confirmar.mutate({
      datos: {
        ...preview.raw_data,
        total: totalDeclarado,
        items: items.map((item) => ({
          sku: item.sku,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal,
          unidad: item.unidad,
        })),
      },
      documento: preview.documento,
    })
  }

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Migas rutas={['Facturas', 'Recepción de Mercadería', 'Lectura con IA']} />

      <Typography variant="h1" sx={{ mb: 2 }}>
        Ingreso de Facturas de Proveedores
      </Typography>

      {!preview && !encolada && !ilegible && (
        <>
          <PanelColaFacturas />
          <SubirFactura onEscaneada={alEscanear} />
        </>
      )}

      {ilegible && <FacturaIlegible nombreArchivo={ilegible} onSubirOtra={cancelar} />}

      {encolada && (
        <FacturaEncolada
          cola={encolada.cola}
          mensaje={encolada.mensaje}
          onSubirOtra={cancelar}
        />
      )}

      {preview &&
        (esModoTecnico ? (
          <RevisionFacturaTecnica
            preview={preview}
            items={items}
            totalDeclarado={totalDeclarado}
            onCambiarFila={cambiarFila}
            onEliminarFila={eliminarFila}
            onAgregarFila={agregarFila}
            onCambiarTotal={setTotalDeclarado}
            onCancelar={cancelar}
            onConfirmar={confirmarIngreso}
            confirmando={confirmar.isPending}
            errorConfirmar={confirmar.error}
          />
        ) : (
          <RevisionFacturaVisual
            preview={preview}
            items={items}
            totalDeclarado={totalDeclarado}
            onCambiarFila={cambiarFila}
            onEliminarFila={eliminarFila}
            onAgregarFila={agregarFila}
            onCambiarTotal={setTotalDeclarado}
            onCancelar={cancelar}
            onConfirmar={confirmarIngreso}
            confirmando={confirmar.isPending}
            errorConfirmar={confirmar.error}
          />
        ))}

      <DialogoIngresoExitoso resultado={confirmar.data ?? null} onCerrar={cancelar} />
    </Box>
  )
}
