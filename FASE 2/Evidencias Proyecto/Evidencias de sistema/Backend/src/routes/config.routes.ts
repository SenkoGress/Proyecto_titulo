import { Router, Request, Response } from 'express';
import { defaultTenantConfigService } from '../config/tenant-config.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/config/margin
 * Obtiene el margen de ganancia comercial configurado para el tenant
 */
router.get('/margin', async (req: Request, res: Response): Promise<void> => {
  const tenantId = (req.query.tenant_id as string) || '00000000-0000-0000-0000-000000000001';

  try {
    const margin = await defaultTenantConfigService.getProfitMargin(tenantId);
    res.status(200).json({ success: true, margin });
  } catch (error) {
    logger.error('ConfigRoutes', 'Error retrieving profit margin', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve profit margin' });
  }
});

/**
 * POST /api/v1/config/margin
 * Actualiza el margen de ganancia comercial configurado por el Administrador
 */
router.post('/margin', async (req: Request, res: Response): Promise<void> => {
  const { tenant_id, margin } = req.body;

  if (!tenant_id || margin === undefined) {
    res.status(400).json({ success: false, message: 'tenant_id and margin are required' });
    return;
  }

  try {
    const updatedMargin = await defaultTenantConfigService.setProfitMargin(tenant_id, Number(margin));
    res.status(200).json({
      success: true,
      message: `Margen de ganancia actualizado a ${updatedMargin}%`,
      margin: updatedMargin
    });
  } catch (error) {
    logger.error('ConfigRoutes', 'Error setting profit margin', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/v1/config/email
 * Obtiene el correo configurado para órdenes de compra y el estado de auto-envío
 */
router.get('/email', async (req: Request, res: Response): Promise<void> => {
  const tenantId = (req.query.tenant_id as string) || '00000000-0000-0000-0000-000000000001';

  try {
    const email = await defaultTenantConfigService.getOrderNotificationEmail(tenantId);
    const autoSend = await defaultTenantConfigService.getAutoSendOrders(tenantId);
    res.status(200).json({
      success: true,
      email: email || '',
      auto_send: autoSend,
      dia_envio: await defaultTenantConfigService.getDiaEnvio(tenantId),
      hora_envio: await defaultTenantConfigService.getHoraEnvio(tenantId)
    });
  } catch (error) {
    logger.error('ConfigRoutes', 'Error retrieving email config', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve email config' });
  }
});

/**
 * POST /api/v1/config/email
 * Actualiza el correo de órdenes de compra y la bandera de auto-envío
 */
router.post('/email', async (req: Request, res: Response): Promise<void> => {
  const { tenant_id, email, auto_send, dia_envio, hora_envio } = req.body;
  const tenantId = tenant_id || '00000000-0000-0000-0000-000000000001';

  if (!email) {
    res.status(400).json({ success: false, message: 'email is required' });
    return;
  }

  try {
    const savedEmail = await defaultTenantConfigService.setOrderNotificationEmail(tenantId, email);
    // El dia y la hora son opcionales: si no vienen, conservan el valor guardado. Asi la
    // pantalla de Configuracion puede conectarse por partes sin romper lo que ya funciona.
    const horario = await defaultTenantConfigService.setHorarioEnvio(tenantId, dia_envio, hora_envio);

    if (auto_send !== undefined) {
      await defaultTenantConfigService.setAutoSendOrders(tenantId, auto_send === true || auto_send === 'true');
    }

    res.status(200).json({
      success: true,
      message: `Correo para órdenes de compra guardado: ${savedEmail}`,
      email: savedEmail,
      auto_send: auto_send !== undefined ? auto_send : true,
      dia_envio: horario.dia_envio,
      hora_envio: horario.hora_envio
    });
  } catch (error) {
    logger.error('ConfigRoutes', 'Error saving email config', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;

