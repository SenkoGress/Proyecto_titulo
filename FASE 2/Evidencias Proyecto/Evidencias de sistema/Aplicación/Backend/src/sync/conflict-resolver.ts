import { Producto, TransaccionVenta } from '../database/types';
import { logger } from '../utils/logger';

export interface ReconciledCatalogItem {
  id: string;
  sku: string;
  nombre: string;
  precio_compra: number;
  precio_venta: number;
  stock_actual: number;
  activo: boolean;
  source: 'CLOUD' | 'LOCAL';
}

export class ConflictResolver {
  /**
   * Política: "La Nube manda en Catálogo (precios y productos)".
   * Si existe divergencia entre un producto local y la nube, los datos maestros y precios de la nube
   * prevalecen sobre los valores locales del POS.
   */
  public resolveCatalogConflict(localProduct: Producto, cloudProduct: Producto): ReconciledCatalogItem {
    logger.debug('ConflictResolver', `Reconciling catalog for product ${cloudProduct.id}`, {
      localPrice: localProduct.precio_venta,
      cloudPrice: cloudProduct.precio_venta
    });

    return {
      id: cloudProduct.id,
      sku: cloudProduct.sku,
      nombre: cloudProduct.nombre,
      precio_compra: Number(cloudProduct.precio_compra),
      precio_venta: Number(cloudProduct.precio_venta),
      stock_actual: Number(cloudProduct.stock_actual),
      activo: Boolean(cloudProduct.activo),
      source: 'CLOUD'
    };
  }

  /**
   * Política: "El POS manda en Transacciones (ventas)".
   * Las transacciones registradas localmente en SQLite son inmutables y la nube debe respetarlas
   * tal como fueron cobradas y emitidas al cliente final.
   */
  public resolveTransactionConflict(localSale: TransaccionVenta, cloudSale?: TransaccionVenta): TransaccionVenta {
    if (!cloudSale) {
      return localSale;
    }

    // Si ya existe en la nube, se mantiene la cabecera original emitida en el POS
    return {
      ...cloudSale,
      folio_local_sqlite: localSale.folio_local_sqlite || cloudSale.folio_local_sqlite,
      total: localSale.total,
      unidades: localSale.unidades,
      estado: localSale.estado
    };
  }

  /**
   * Política: "Cálculo de diferencia neta en historial de stock".
   * Nunca sobreescribe el stock absoluto de forma destructiva; computa el delta neto.
   */
  public calculateNetStockDelta(initialStock: number, soldQuantity: number): {
    oldStock: number;
    delta: number;
    newStock: number;
  } {
    const delta = -Math.abs(soldQuantity);
    const newStock = initialStock + delta;
    return {
      oldStock: initialStock,
      delta,
      newStock
    };
  }
}

export const defaultConflictResolver = new ConflictResolver();
