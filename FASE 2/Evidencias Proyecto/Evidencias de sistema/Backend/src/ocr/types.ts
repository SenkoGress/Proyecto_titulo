export interface ExtractedInvoiceItem {
  sku?: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  unidad?: string;
  lote?: string;
  fecha_vencimiento?: string;
}

export interface ExtractedInvoiceData {
  folio_factura: string;
  rut_proveedor: string;
  razon_social: string;
  giro_proveedor?: string;
  direccion_proveedor?: string;
  telefono_proveedor?: string;
  dias_visita_proveedor?: string;
  fecha_emision: string; // Formato YYYY-MM-DD
  items: ExtractedInvoiceItem[];
  total: number;
  metodo_ingreso: string;
  metadata?: Record<string, unknown>;
}

export interface InvoiceInput {
  invoiceData: string | Buffer; // Base64 o Buffer del documento/imagen
  fileName?: string;
  mimeType?: string;
  simulateFailure?: boolean; // Para pruebas controladas de degradación elegante
}
