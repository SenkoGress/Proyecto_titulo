export interface SupplierCandidateOption {
  proveedorId: string;
  nombreProveedor: string;
  rutProveedor: string;
  diasVisita: string;
  diasHastaVisita: number;
  proximaVisitaTexto: string;
  precioUnitario: number;
  esMasEconomico: boolean;
  esVisitaMasProxima: boolean;
  recomendacionBadge: string; // "Visita Mas Proxima" | "Mejor Precio" | "Opcion Alternativa"
}

export interface ProductSalesVelocity {
  productId: string;
  sku: string;
  codigoBarra?: string;
  nombre: string;
  stockActual: number;
  stockMinimo: number;
  precioCompra: number;
  totalSold: number;
  velocityDaily: number; // Unidades vendidas por día
  daysOfInventory: number; // Días que durará el stock actual
  reorderPoint: number; // Punto de reorden (ROP)
  isUnderStock: boolean;
  isAgotado: boolean;
  suggestedOrderQuantity: number;
  proveedorId?: string | null;
  proveedorNombre?: string;
  diasVisitaProveedor?: string;
  proximaVisitaProveedor?: string;
  proveedoresAlternativos?: SupplierCandidateOption[];
  proveedorRecomendado?: SupplierCandidateOption;
}

export interface SuggestedPurchaseOrder {
  orderId: string;
  tenantId: string;
  proveedorId: string;
  proveedorNombre: string;
  proveedorRut: string;
  proveedorEmail?: string;
  proveedorTelefono?: string;
  diasVisita: string;
  proximaVisitaTexto: string;
  diasHastaVisita: number;
  estado: 'sugerida' | 'enviada' | 'recibida' | 'cancelada';
  fechaCreacion: string;
  totalEstimado: number;
  items: {
    productId: string;
    sku: string;
    codigoBarra?: string;
    nombre: string;
    cantidadSugerida: number;
    precioUnitario: number;
    subtotalEstimado: number;
    opcionesProveedores?: SupplierCandidateOption[];
  }[];
}

export interface ReplenishmentConfig {
  analysisDays: number;        // Días de histórico de ventas a analizar (e.g. 7 o 30)
  defaultLeadTimeDays: number; // Días de entrega de proveedor (e.g. 7)
  safetyStockFactor: number;   // Multiplicador de cobertura (e.g. 2.0 para cubrir 2 ciclos de visita)
  persist?: boolean;           // Si es true, persiste las órdenes en BD; si es false (default), solo calcula y retorna
}
