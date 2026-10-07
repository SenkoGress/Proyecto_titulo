import { Router, Request, Response } from 'express';
import { defaultPaymentDispatcher } from '../payments/payment-dispatcher.service';
import { PaymentConfirmRequest, PaymentInitRequest } from '../payments/types';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/payments/initiate
 * Inicia la transacción con la pasarela seleccionada (Transbank, MercadoPago, SumUp)
 */
router.post('/initiate', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as PaymentInitRequest;

  if (!body || !body.saleId || !body.tenantId || !body.gateway) {
    res.status(400).json({
      success: false,
      message: 'saleId, tenantId, and gateway are required'
    });
    return;
  }

  try {
    const result = await defaultPaymentDispatcher.initiatePayment(body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error('PaymentRoutes', 'Failed to initiate payment', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during payment initiation',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/v1/payments/confirm
 * Confirma el pago y lo persiste de forma ACID en payment_transactions
 */
router.post('/confirm', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as PaymentConfirmRequest;

  if (!body || !body.token || !body.saleId || !body.tenantId || !body.gateway) {
    res.status(400).json({
      success: false,
      message: 'token, saleId, tenantId, and gateway are required'
    });
    return;
  }

  try {
    const result = await defaultPaymentDispatcher.confirmPayment(body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error('PaymentRoutes', 'Failed to confirm payment', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during payment confirmation',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/v1/payments/sale/:saleId
 * Lista las transacciones de pago para una venta específica
 */
router.get('/sale/:saleId', async (req: Request, res: Response): Promise<void> => {
  const saleId = Array.isArray(req.params.saleId) ? req.params.saleId[0] : req.params.saleId;

  try {
    const transactions = await defaultPaymentDispatcher.getTransactionsBySale(saleId);
    res.status(200).json({ success: true, transactions });
  } catch (error) {
    logger.error('PaymentRoutes', 'Failed to retrieve payment transactions', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error retrieving payment transactions',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
