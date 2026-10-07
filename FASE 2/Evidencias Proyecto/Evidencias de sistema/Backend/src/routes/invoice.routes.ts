import { Router, Request, Response } from 'express';
import { defaultInvoiceIngestionService } from '../invoices/invoice-ingestion.service';
import { InvoiceInput, ExtractedInvoiceData } from '../ocr/types';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/invoices/scan
 * Paso 1: Escaneo y previsualización de la factura sin modificar la base de datos
 */
router.post('/scan', async (req: Request, res: Response): Promise<void> => {
  const invoiceData = req.body.invoice_data || req.body.image_base64_or_pdf;
  const { tenant_id, file_name, mime_type, simulate_failure } = req.body;

  if (!tenant_id || !invoiceData) {
    res.status(400).json({
      success: false,
      message: 'tenant_id and invoice_data (or image_base64_or_pdf) are required'
    });
    return;
  }

  const input: InvoiceInput = {
    invoiceData,
    fileName: file_name,
    mimeType: mime_type,
    simulateFailure: simulate_failure === true
  };

  try {
    const preview = await defaultInvoiceIngestionService.scanInvoice(tenant_id, input);
    res.status(200).json({
      success: true,
      preview
    });
  } catch (error) {
    logger.error('InvoiceRoutes', 'Failed to scan invoice', error);
    res.status(500).json({
      success: false,
      message: 'Error al escanear la factura',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/v1/invoices/confirm
 * Paso 2: Confirmación explícita del usuario para autorizar la ingesta transaccional
 */
router.post('/confirm', async (req: Request, res: Response): Promise<void> => {
  const { tenant_id, invoice_data } = req.body;

  if (!tenant_id || !invoice_data) {
    res.status(400).json({
      success: false,
      message: 'tenant_id and invoice_data are required'
    });
    return;
  }

  try {
    const result = await defaultInvoiceIngestionService.confirmIngest(tenant_id, invoice_data as ExtractedInvoiceData);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('InvoiceRoutes', 'Failed to confirm invoice ingestion', error);
    res.status(500).json({
      success: false,
      message: 'Error al autorizar e ingresar la factura',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/v1/invoices/ingest
 * Ingesta directa para retrocompatibilidad
 */
router.post('/ingest', async (req: Request, res: Response): Promise<void> => {
  const invoiceData = req.body.invoice_data || req.body.image_base64_or_pdf;
  const { tenant_id, file_name, mime_type, simulate_failure } = req.body;

  if (!tenant_id || !invoiceData) {
    res.status(400).json({
      success: false,
      message: 'tenant_id and invoice_data (or image_base64_or_pdf) are required'
    });
    return;
  }

  const input: InvoiceInput = {
    invoiceData,
    fileName: file_name,
    mimeType: mime_type,
    simulateFailure: simulate_failure === true
  };

  try {
    const result = await defaultInvoiceIngestionService.ingestInvoice(tenant_id, input);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('InvoiceRoutes', 'Failed to ingest invoice', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during invoice ingestion',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/v1/invoices
 * Lista las facturas ingresadas para un tenant con desglose tributario
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.query.tenant_id as string;

  if (!tenantId) {
    res.status(400).json({
      success: false,
      message: 'tenant_id query parameter is required'
    });
    return;
  }

  try {
    const invoices = await defaultInvoiceIngestionService.getInvoices(tenantId);
    res.status(200).json({
      success: true,
      invoices
    });
  } catch (error) {
    logger.error('InvoiceRoutes', 'Failed to get invoices', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error retrieving invoices',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
