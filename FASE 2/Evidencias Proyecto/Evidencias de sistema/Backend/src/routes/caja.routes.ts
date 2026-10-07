import { Router, Request, Response } from 'express';
import { defaultCierreCajaService } from '../caja/cierre-caja.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/caja/abrir
 * Abre un turno de caja con fondo inicial
 */
router.post('/abrir', async (req: Request, res: Response): Promise<void> => {
  const { tenant_id, usuario_id, monto_apertura = 0 } = req.body;

  if (!tenant_id || !usuario_id) {
    res.status(400).json({ success: false, message: 'tenant_id and usuario_id are required' });
    return;
  }

  try {
    const sesion = await defaultCierreCajaService.abrirCaja(tenant_id, usuario_id, Number(monto_apertura));
    res.status(201).json({ success: true, data: sesion });
  } catch (error) {
    logger.error('CajaRoutes', 'Error opening cash session', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/v1/caja/resumen
 * Retorna el balance y desglose en vivo del turno actual
 */
router.get('/resumen', async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.query.tenant_id as string;

  if (!tenantId) {
    res.status(400).json({ success: false, message: 'tenant_id query param is required' });
    return;
  }

  try {
    const resumen = await defaultCierreCajaService.obtenerResumenTurnoActual(tenantId);
    res.status(200).json({
      success: true,
      activa: resumen !== null,
      data: resumen
    });
  } catch (error) {
    logger.error('CajaRoutes', 'Error getting cash summary', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cash session summary'
    });
  }
});

/**
 * POST /api/v1/caja/cerrar
 * Realiza el arqueo y cierre de caja generando el Balance Z
 */
router.post('/cerrar', async (req: Request, res: Response): Promise<void> => {
  const { tenant_id, usuario_id, monto_real_efectivo, observaciones } = req.body;

  if (!tenant_id || !usuario_id || monto_real_efectivo === undefined) {
    res.status(400).json({
      success: false,
      message: 'tenant_id, usuario_id, and monto_real_efectivo are required'
    });
    return;
  }

  try {
    const cierre = await defaultCierreCajaService.cerrarCaja(
      tenant_id,
      usuario_id,
      Number(monto_real_efectivo),
      observaciones
    );
    res.status(200).json({ success: true, data: cierre });
  } catch (error) {
    logger.error('CajaRoutes', 'Error closing cash session', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/v1/caja/historial
 * Historial de cierres de caja (Z)
 */
router.get('/historial', async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.query.tenant_id as string;

  if (!tenantId) {
    res.status(400).json({ success: false, message: 'tenant_id is required' });
    return;
  }

  try {
    const historial = await defaultCierreCajaService.obtenerHistorialCierres(tenantId);
    res.status(200).json({ success: true, data: historial });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch cash history' });
  }
});

/**
 * POST /api/v1/caja/movimiento
 * Registra un egreso (gasto menor) o ingreso (aporte sencillo) en la sesión activa
 */
router.post('/movimiento', async (req: Request, res: Response): Promise<void> => {
  const { tenant_id, sesion_caja_id, tipo, monto, motivo, usuario_id } = req.body;

  let targetSesionId = sesion_caja_id;
  if (!targetSesionId && tenant_id) {
    const activa = await defaultCierreCajaService.obtenerResumenTurnoActual(tenant_id);
    if (activa) {
      targetSesionId = activa.id;
    }
  }

  if (!tenant_id || !targetSesionId || !tipo || !monto || !motivo) {
    res.status(400).json({
      success: false,
      message: 'tenant_id, sesion activa de caja, tipo, monto, and motivo are required'
    });
    return;
  }

  try {
    const mov = await defaultCierreCajaService.registrarMovimiento(
      tenant_id,
      targetSesionId,
      tipo,
      Number(monto),
      motivo,
      usuario_id
    );
    res.status(201).json({ success: true, data: mov });
  } catch (error) {
    logger.error('CajaRoutes', 'Error registering cash movement', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/v1/caja/movimientos
 * Obtiene los movimientos de una sesión de caja
 */
router.get('/movimientos', async (req: Request, res: Response): Promise<void> => {
  const sesionId = req.query.sesion_id as string;

  if (!sesionId) {
    res.status(400).json({ success: false, message: 'sesion_id is required' });
    return;
  }

  try {
    const movs = defaultCierreCajaService.obtenerMovimientos(sesionId);
    res.status(200).json({ success: true, data: movs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch cash movements' });
  }
});

export default router;
