import { Router, Request, Response } from 'express';
import { defaultReplenishmentService } from '../replenishment/replenishment.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/replenishment/velocity
 * Retorna la velocidad diaria de ventas y estado de quiebre de stock
 */
router.get('/velocity', async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.query.tenant_id as string;
  const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;

  if (!tenantId) {
    res.status(400).json({ success: false, message: 'tenant_id query parameter is required' });
    return;
  }

  try {
    const velocities = await defaultReplenishmentService.calculateSalesVelocity(tenantId, days);
    res.status(200).json({ success: true, velocities });
  } catch (error) {
    logger.error('ReplenishmentRoutes', 'Failed to calculate sales velocity', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error calculating sales velocity',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Helper para formatear la respuesta enriquecida de reabastecimiento para frontend y APIs
 */
function formatReplenishmentResponse(result: any) {
  const totalCosto = (result.orders || []).reduce((sum: number, o: any) => sum + (o.totalEstimado || 0), 0);

  const formattedOrders = (result.orders || []).map((o: any) => ({
    orden_id: o.orderId,
    proveedor_id: o.proveedorId,
    proveedor_nombre: o.proveedorNombre,
    proveedor_rut: o.proveedorRut,
    proveedor_email: o.proveedorEmail,
    proveedor_telefono: o.proveedorTelefono,
    dias_visita: o.diasVisita,
    proxima_visita: {
      displayText: o.proximaVisitaTexto,
      daysUntil: o.diasHastaVisita
    },
    estado: o.estado,
    total_estimado: o.totalEstimado,
    items: (o.items || []).map((it: any) => {
      const alertMatch = (result.lowStockAlerts || []).find((l: any) => l.sku === it.sku);
      return {
        producto_id: it.productId,
        sku: it.sku,
        codigo_barra: it.codigoBarra,
        producto_nombre: it.nombre,
        cantidad_sugerida: it.cantidadSugerida,
        costo_unitario: it.precioUnitario,
        costo_estimado: it.subtotalEstimado,
        stock_actual: alertMatch ? alertMatch.stockActual : 0,
        stock_minimo: alertMatch ? alertMatch.stockMinimo : 0,
        is_agotado: alertMatch ? alertMatch.isAgotado : false,
        candidatos_proveedores: (it.opcionesProveedores || []).map((c: any) => ({
          proveedor_id: c.proveedorId,
          proveedor_nombre: c.proveedorNombre,
          rut_proveedor: c.rutProveedor,
          precio_unitario: c.precioUnitario,
          dias_visita: c.diasVisita,
          proxima_visita: {
            displayText: c.proximaVisitaTexto,
            daysUntil: c.diasHastaVisita
          },
          es_mejor_precio: c.esMasEconomico,
          es_visita_mas_proxima: c.esVisitaMasProxima,
          es_recomendado: c.esRecomendado,
          motivo_recomendacion: c.motivoRecomendacion
        }))
      };
    })
  }));

  const formattedLowStock = (result.lowStockAlerts || []).map((l: any) => ({
    producto_id: l.productId,
    sku: l.sku,
    codigo_barra: l.codigoBarra,
    nombre: l.nombre,
    stock_actual: l.stockActual,
    stock_minimo: l.stockMinimo,
    velocidad_diaria: l.velocityDaily,
    dias_inventario_restante: l.daysOfInventory,
    reorder_point: l.reorderPoint,
    is_agotado: l.isAgotado,
    proveedor_nombre: l.proveedorNombre,
    proxima_visita: {
      displayText: l.proximaVisitaProveedor
    }
  }));

  return {
    suggested_orders: formattedOrders,
    low_stock_products: formattedLowStock,
    low_stock_alerts: formattedLowStock,
    resumen: {
      total_ordenes: (result.orders || []).length,
      total_productos_criticos: result.totalCritical || 0,
      costo_total_estimado: totalCosto
    },
    email_status: result.emailDispatchStatus
  };
}

/**
 * GET /api/v1/replenishment/suggest
 * Genera el análisis de bajo stock y órdenes de compra sugeridas
 */
router.get('/suggest', async (req: Request, res: Response): Promise<void> => {
  const tenantId = (req.query.tenant_id as string) || '00000000-0000-0000-0000-000000000001';
  const analysisDays = req.query.analysis_days ? parseInt(req.query.analysis_days as string, 10) : undefined;
  const leadTimeDays = req.query.lead_time_days ? parseInt(req.query.lead_time_days as string, 10) : undefined;
  const safetyStockFactor = req.query.safety_factor ? parseFloat(req.query.safety_factor as string) : undefined;

  try {
    const result = await defaultReplenishmentService.generateSuggestedOrders(tenantId, {
      analysisDays,
      defaultLeadTimeDays: leadTimeDays,
      safetyStockFactor,
      persist: false
    });

    const responseData = formatReplenishmentResponse(result);

    res.status(200).json({
      success: true,
      data: responseData,
      count: result.orders.length,
      orders: result.orders
    });
  } catch (error) {
    logger.error('ReplenishmentRoutes', 'Failed to generate suggested orders', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar sugerencias de reabastecimiento',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/v1/replenishment/suggest
 * Genera órdenes de compra sugeridas agrupadas por proveedor
 */
router.post('/suggest', async (req: Request, res: Response): Promise<void> => {
  const { tenant_id, analysis_days, lead_time_days, safety_stock_factor } = req.body;
  const tenantId = tenant_id || '00000000-0000-0000-0000-000000000001';

  try {
    const result = await defaultReplenishmentService.generateSuggestedOrders(tenantId, {
      analysisDays: analysis_days,
      defaultLeadTimeDays: lead_time_days,
      safetyStockFactor: safety_stock_factor
    });

    const responseData = formatReplenishmentResponse(result);

    res.status(200).json({
      success: true,
      data: responseData,
      count: result.orders.length,
      orders: result.orders
    });
  } catch (error) {
    logger.error('ReplenishmentRoutes', 'Failed to generate suggested orders', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error generating purchase orders',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/v1/replenishment/send-email
 * Despacha manualmente o confirma el envío de órdenes de compra por correo
 */
router.post('/send-email', async (req: Request, res: Response): Promise<void> => {
  const { tenant_id, recipient_email } = req.body;
  const tenantId = tenant_id || '00000000-0000-0000-0000-000000000001';

  try {
    const emailToUse = recipient_email || (await defaultReplenishmentService['pgClient'] ? 'admin@gestock.cl' : 'admin@gestock.cl');
    const result = await defaultReplenishmentService.generateSuggestedOrders(tenantId);

    if (result.orders.length === 0) {
      res.status(200).json({
        success: true,
        message: 'No hay órdenes de compra pendientes para enviar en este momento (Stock en niveles óptimos).'
      });
      return;
    }

    const dispatch = await defaultReplenishmentService.sendPurchaseOrdersBatchEmail(
      tenantId,
      recipient_email || 'admin@gestock.cl',
      result.orders
    );

    res.status(200).json({
      success: true,
      message: dispatch.message,
      data: dispatch
    });
  } catch (error) {
    logger.error('ReplenishmentRoutes', 'Failed to send purchase orders email', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar órdenes por correo',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/v1/replenishment/purchase-orders
 * Lista las órdenes de compra para el tenant
 */
router.get('/purchase-orders', async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.query.tenant_id as string;
  const estado = req.query.estado as string | undefined;

  if (!tenantId) {
    res.status(400).json({ success: false, message: 'tenant_id query parameter is required' });
    return;
  }

  try {
    const orders = await defaultReplenishmentService.getPurchaseOrders(tenantId, estado);
    res.status(200).json({ success: true, orders });
  } catch (error) {
    logger.error('ReplenishmentRoutes', 'Failed to get purchase orders', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error retrieving purchase orders',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
