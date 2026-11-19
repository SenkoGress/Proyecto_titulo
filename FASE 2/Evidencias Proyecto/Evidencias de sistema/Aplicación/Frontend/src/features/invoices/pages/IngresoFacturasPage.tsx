// src/features/invoices/pages/IngresoFacturasPage.tsx
import { useRef, useState } from 'react'
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
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import AlertTitle from '@mui/material/AlertTitle'
import { formatFechaSola } from '@/shared/utils/formatFecha'
import { facturaYaIngresada } from '@/features/invoices/utils/facturaDuplicada'
import { RevisionFacturaVisual } from '@/features/invoices/components/visual/RevisionFacturaVisual'
import { RevisionFacturaTecnica } from '@/features/invoices/components/tecnico/RevisionFacturaTecnica'
import { useConfirmarFactura,
  useFacturas } from '@/features/invoices/hooks/useInvoices'
import { recalcularFila } from '@/features/invoices/utils/calculosFactura'
import { DialogoDatosProveedor } from '@/features/invoices/components/compartidos/DialogoDatosProveedor'
import { DialogoAlertaVencimiento } from '@/features/invoices/components/compartidos/DialogoAlertaVencimiento'
import { productosVencidos, faltaVencimiento } from '@/features/invoices/utils/vencimientoFactura'
import {
  camposParaConfirmar,
  datosDesdeFactura,
  faltanDatos,
  type DatosProveedorFactura,
} from '@/features/invoices/utils/datosProveedor'
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
    fecha_vencimiento: null,
    no_vence: false,
  }
}

// los datos que el usuario ya completo, con los nombres de la previsualizacion
function camposVista(datos: DatosProveedorFactura) {
  return {
    giro_proveedor: datos.giro,
    direccion_proveedor: datos.direccion,
    telefono_proveedor: datos.telefono,
    email_proveedor: datos.email,
    dias_visita_proveedor: datos.dias_visita,
  }
}

// paso 1 subir, paso 2 revisar lo que leyo la ia y confirmar (visual o tecnico)
export function IngresoFacturasPage() {
  const esModoTecnico = useEsModoTecnico()
  const facturas = useFacturas()

  const [preview, setPreview] = useState<PrevisualizacionFactura | null>(null)
  const [encolada, setEncolada] = useState<Extract<ResultadoEscaneo, { tipo: 'encolada' }> | null>(null)
  const [ilegible, setIlegible] = useState<string | null>(null)
  const [items, setItems] = useState<ItemFactura[]>([])
  const [totalDeclarado, setTotalDeclarado] = useState(0)
  const [proveedor, setProveedor] = useState<DatosProveedorFactura | null>(null)
  const [pidiendoProveedor, setPidiendoProveedor] = useState(false)
  // factura que viene de la cola: al confirmar se retira su ticket
  const [colaId, setColaId] = useState<string | null>(null)
  const [avisandoVencidos, setAvisandoVencidos] = useState(false)
  const [intentoSinFechas, setIntentoSinFechas] = useState(false)

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

    cargarVista(resultado.preview)
  }

  // deja la factura leida en la pantalla de revision
  function cargarVista(vista: PrevisualizacionFactura) {
    setPreview(vista)
    setItems(vista.items)
    setTotalDeclarado(vista.total_factura)
    // proveedor nuevo al que le faltan datos: se piden ahora, antes de revisar los productos
    setProveedor(datosDesdeFactura(vista))
    setPidiendoProveedor(faltanDatos(vista))
  }

  // una factura que la cola ya leyo: se revisa igual que una recien subida
  function revisarDeCola(vista: PrevisualizacionFactura, id: string) {
    setColaId(id)
    cargarVista(vista)
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
    setProveedor(null)
    setPidiendoProveedor(false)
    setColaId(null)
    setAvisandoVencidos(false)
    setIntentoSinFechas(false)
    confirmar.reset()
  }

  // d.s. 977/96: sin la fecha de cada producto, o la marca de que no vence, no se ingresa
  const avisoVencimientos = useRef<HTMLDivElement>(null)
  const sinVencimiento = items.filter(faltaVencimiento)
  const vencidos = productosVencidos(items, new Date())

  function confirmarIngreso() {
    if (!preview) return

    if (sinVencimiento.length > 0) {
      setIntentoSinFechas(true)
      // el aviso queda arriba, fuera de la vista de quien esta en el boton
      avisoVencimientos.current?.scrollIntoView({ block: 'center' })
      return
    }

    // un producto vencido se avisa antes de ingresar, pero no se bloquea
    if (vencidos.length > 0) {
      setAvisandoVencidos(true)
      return
    }

    enviarIngreso()
  }

  // enviar la version revisada al backend
  function enviarIngreso() {
    if (!preview) return
    setAvisandoVencidos(false)

    confirmar.mutate({
      datos: {
        ...preview.raw_data,
        ...(proveedor ? camposParaConfirmar(proveedor) : {}),
        total: totalDeclarado,
        items: items.map((item) => ({
          sku: item.sku,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal,
          unidad: item.unidad,
          fecha_vencimiento: item.no_vence ? null : item.fecha_vencimiento || null,
          no_vence: item.no_vence === true,
        })),
      },
      documento: preview.documento,
      colaId: colaId ?? undefined,
    })
  }

  // misma factura del mismo proveedor que ya entro antes
  const duplicada = preview
    ? facturaYaIngresada(
        preview.raw_data.folio_factura,
        preview.raw_data.rut_proveedor,
        facturas.data ?? [],
      )
    : null

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Migas rutas={['Facturas', 'Recepción de Mercadería', 'Lectura con IA']} />

      <Typography variant="h1" sx={{ mb: 2 }}>
        Ingreso de Facturas de Proveedores
      </Typography>

      {!preview && !encolada && !ilegible && (
        <>
          <PanelColaFacturas onRevisar={revisarDeCola} />
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

      {/* el backend todavia no rechaza una factura repetida: sin este aviso el
          stock sube de nuevo por una compra que ya se ingreso */}
      {preview && duplicada && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>Esta factura ya fue ingresada</AlertTitle>
          El folio {duplicada.numero_factura} de {duplicada.proveedor_nombre ?? 'este proveedor'} se
          ingreso el {formatFechaSola(duplicada.fecha_ingreso)}. Si la confirmas de nuevo, el stock vuelve
          a subir por una compra que ya esta contada.
        </Alert>
      )}

      {preview && (
        <Alert
          ref={avisoVencimientos}
          severity={sinVencimiento.length === 0 ? 'success' : intentoSinFechas ? 'error' : 'warning'}
          sx={{ mb: 2 }}
        >
          <AlertTitle>Vencimientos (D.S. N° 977/96, Reglamento Sanitario de los Alimentos)</AlertTitle>
          {sinVencimiento.length === 0
            ? 'Todos los productos tienen su fecha de vencimiento o la marca de que no vencen.'
            : `${sinVencimiento.length === 1 ? 'Falta 1 producto' : `Faltan ${sinVencimiento.length} productos`} por declarar: ` +
              'escribe la fecha de vencimiento o marca «No vence». Sin eso la factura no se puede ingresar.'}
        </Alert>
      )}

      {preview && avisandoVencidos && (
        <DialogoAlertaVencimiento
          vencidos={vencidos}
          onVolver={() => setAvisandoVencidos(false)}
          onIngresar={enviarIngreso}
        />
      )}

      {preview?.es_proveedor_nuevo && proveedor && (
        <Alert
          severity={faltanDatos({ ...preview, ...camposVista(proveedor) }) ? 'info' : 'success'}
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setPidiendoProveedor(true)}>
              Datos del proveedor
            </Button>
          }
        >
          {faltanDatos({ ...preview, ...camposVista(proveedor) })
            ? `${preview.razon_social} es un proveedor nuevo y le faltan datos de contacto.`
            : `Los datos de ${preview.razon_social} estan completos.`}
        </Alert>
      )}

      {preview && proveedor && pidiendoProveedor && (
        <DialogoDatosProveedor
          razonSocial={preview.razon_social}
          rut={preview.rut_proveedor}
          datos={proveedor}
          onGuardar={(datos) => {
            setProveedor(datos)
            setPidiendoProveedor(false)
          }}
          onCerrar={() => setPidiendoProveedor(false)}
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
