// ============================================================================
// GesTock SII & DTE Core Types (Ley 20.727, Res. 74, Res. 176, Res. 53)
// ============================================================================

export enum TipoDTE {
  FACTURA_ELECTRONICA = 33,
  FACTURA_EXENTA = 34,
  BOLETA_ELECTRONICA = 39,
  BOLETA_EXENTA = 41,
  GUIA_DESPACHO = 52,
  NOTA_CREDITO = 61,
  NOTA_DEBITO = 56
}

export type SiiModeloEmision = 'MODELO_A' | 'MODELO_B';
// MODELO_A: "Siempre emito Boleta Electrónica aun cuando reciba pago con tarjeta" (POS Integrado oficial)
// MODELO_B: "El voucher de tarjeta reemplaza la boleta electrónica" (Res. Ex. N° 176 del SII - evita doble IVA en RCV)

export type TipoDocumentoVenta = 'BOLETA_ELECTRONICA' | 'VOUCHER_TRANSBANK' | 'FACTURA' | 'NOTA_CREDITO';

export interface EmisorFiscal {
  rut: string;
  razonSocial: string;
  giro: string;
  acteco?: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  telefono?: string;
  correoEmisor?: string;
}

export interface ReceptorFiscal {
  rut: string;
  razonSocial: string;
  giro?: string;
  direccion?: string;
  comuna?: string;
  ciudad?: string;
  correoReceptor?: string;
}

export interface ReferenciaDTE {
  nroLineaRef: number;
  tipoDocRef: number; // 33, 39, etc.
  folioRef: number;
  fechaRef: string; // YYYY-MM-DD
  codigoRef: number; // 1: Anula, 2: Corrige texto, 3: Corrige montos
  razonRef: string;
}

export interface DatosTransporte {
  indTraslado: number; // 1: Venta, 5: Traslado interno no venta, 6: Otros
  patente?: string;
  choferRut?: string;
  choferNombre?: string;
  direccionDestino?: string;
  comunaDestino?: string;
}

export interface ItemDTE {
  nroLinea: number;
  nombre: string;
  sku?: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  exento?: boolean;
  codigoIla?: number; // 25: analcohólica 10%, 26: analcohólica 18%, 27: cerveza/vino 20.5%, 28: licores 31.5%
  tasaIla?: number;
  montoIla?: number;
}

export interface DesgloseILA {
  codigo: number;
  nombre: string;
  tasa: number;
  monto: number;
}

export interface TotalesDTE {
  montoNeto: number;
  tasaIva: number; // 19.00
  montoIva: number;
  montoExento: number;
  montoIla?: number;
  desgloseIla?: DesgloseILA[];
  montoTotal: number;
  redondeoChileno?: number; // Ley N° 20.956
}

export interface SiiCafRecord {
  id: string;
  tenant_id: string;
  tipo_dte: number;
  folio_desde: number;
  folio_hasta: number;
  ultimo_folio_usado: number;
  fecha_autorizacion: string;
  rsask_private_key: string;
  rsapk_public_key?: string;
  caf_xml_content: string;
  activo: number;
  created_at: string;
  updated_at: string;
}

export interface TedResult {
  tedXml: string;
  firmaSha1RsaBase64: string;
  timestamp: string;
}

export interface DteEmitidoRecord {
  id: string;
  tenant_id: string;
  venta_id?: string | null;
  tipo_dte: number;
  folio: number;
  fecha_emision: string;
  rut_emisor: string;
  razon_social_emisor: string;
  rut_receptor: string;
  razon_social_receptor: string;
  monto_neto: number;
  monto_iva: number;
  monto_exento: number;
  monto_total: number;
  referencia_tipo_dte?: number;
  referencia_folio?: number;
  referencia_codigo?: number;
  referencia_razon?: string;
  monto_ila?: number;
  ted_xml: string;
  dte_xml_completo: string;
  qr_code_content: string;
  estado_sii: 'EMITIDO_LOCAL' | 'ENVIADO_SII' | 'ACEPTADO_SII' | 'RECHAZADO_SII' | 'ANULADO';
  track_id_sii?: string | null;
  created_at: string;
}

export interface EmisionDteRequest {
  tenantId: string;
  ventaId?: string;
  tipoDte: TipoDTE;
  emisor?: EmisorFiscal;
  receptor?: ReceptorFiscal;
  items: ItemDTE[];
  metodoPago: string;
  modeloEmision?: SiiModeloEmision;
  fechaEmision?: string;
  referencia?: ReferenciaDTE;
  transporte?: DatosTransporte;
}

export interface EmisionDteResponse {
  tipoDocumento: TipoDocumentoVenta;
  esTributarioDte: boolean;
  dteId?: string;
  folio?: number;
  tipoDte?: TipoDTE;
  xmlDte?: string;
  tedXml?: string;
  qrUrl?: string;
  mensajeLegal: string;
  totales: TotalesDTE;
  emisor: EmisorFiscal;
  receptor: ReceptorFiscal;
  items: ItemDTE[];
  referencia?: ReferenciaDTE;
  transporte?: DatosTransporte;
  fecha: string;
}

export interface RcofDaySummary {
  fechaReporte: string;
  secuencia: number;
  cantidadBoletas: number;
  montoNeto: number;
  montoIva: number;
  montoExento: number;
  montoTotal: number;
  folioInicial: number;
  folioFinal: number;
  xmlRcof: string;
}

export interface SiiCertificationResult {
  suiteName: string;
  passed: boolean;
  tipoDte: number;
  foliosGenerados: number[];
  xmlOutputs: string[];
  detalles: string;
  timestamp: string;
}

export interface ResumenF29Item {
  tipoDocumento: string;
  tipoDte?: number;
  cantidad: number;
  montoNeto: number;
  montoIva: number;
  montoTotal: number;
}

export interface F29Statement {
  periodo: string; // YYYY-MM
  tenantId: string;
  debitoFiscal: {
    items: ResumenF29Item[];
    totalNeto: number;
    totalIvaDebito: number;
    totalIla: number;
    totalBruto: number;
  };
  creditoFiscal: {
    items: ResumenF29Item[];
    totalNeto: number;
    totalIvaCredito: number;
    totalBruto: number;
  };
  balance: {
    ivaDeterminadoAPagar: number; // max(0, debito - credito)
    remanenteCreditoFiscal: number; // max(0, credito - debito)
    tasaPpm: number; // ej: 1.0%
    montoPpm: number;
    totalImpuestoPagarF29: number; // ivaDeterminado + ppm + ila
  };
}
