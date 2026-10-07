// src/features/invoices/utils/proveedorOcr.ts

// nombre del motor que proceso la factura (backend/src/ocr/ocr-dispatcher.service.ts)
export function nombreMotorOcr(proveedor: string): string {
  switch (proveedor) {
    case 'GoogleAiGemini':
      return 'Google AI Studio (Gemini)'
    case 'ChileanPdfDteExtractor':
      return 'Lector nativo de PDF (DTE chileno)'
    case 'MockOcrFallback':
      return 'Motor de respaldo (IA no disponible)'
    default:
      return proveedor
  }
}

// si no fue gemini, se uso un motor de respaldo
export function usoRespaldo(proveedor: string): boolean {
  return proveedor !== 'GoogleAiGemini'
}
