import { Router, Request, Response } from 'express';
import { defaultInvoiceIngestionService } from '../invoices/invoice-ingestion.service';
import { defaultInvoiceQueue } from '../invoices/invoice-queue.service';
import { defaultInvoiceFileStore } from '../invoices/invoice-file.store';
import { esDocumentoIlegible } from '../ocr/extraccion';
import { esFacturaDuplicada } from '../invoices/invoice-ingestion.service';
import { defaultSqliteClient } from '../database/sqlite/client';
import { InvoiceInput, ExtractedInvoiceData } from '../ocr/types';
import { logger } from '../utils/logger';

const router = Router();

const esFalloDeDigitalizacion = (mensaje: string): boolean => mensaje.includes('No fue posible digitalizar');

/**
 * POST /api/v1/invoices/scan
 * Paso 1: Escaneo y previsualización de la factura sin modificar la base de datos
 */
router.post('/scan', async (req: Request, res: Response): Promise<void> => {
  const invoiceData = req.body.invoice_data || req.body.image_base64_or_pdf;
  const { file_name, mime_type, simulate_failure } = req.body;
  const tenant_id = req.body.tenant_id || (req as any).tenant_id || (req.headers['x-tenant-id'] as string) || (req.query.tenant_id as string);

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
    const errorMsg = error instanceof Error ? error.message : String(error);

    // El motor leyo el documento y no sirve: reintentarlo daria el mismo resultado, asi que se
    // conserva marcado como fallido y se le pide al usuario otra fotografia.
    if (esDocumentoIlegible(error)) {
      try {
        const registrada = defaultInvoiceQueue.registrarIlegible(tenant_id, invoiceData, file_name, mime_type, errorMsg);
        res.status(422).json({
          success: false,
          ilegible: true,
          data: { ...registrada, estado: 'FALLIDA_OCR' },
          message: errorMsg
        });
      } catch (errorRegistro) {
        logger.error('InvoiceRoutes', 'No se pudo registrar el documento ilegible', errorRegistro);
        res.status(422).json({ success: false, ilegible: true, message: errorMsg });
      }
      return;
    }

    // Si no se pudo alcanzar ningun motor, se guarda y queda en cola para reintentarlo al
    // recuperar la conexion. Antes se descartaba, de modo que no habia nada que reprocesar.
    if (esFalloDeDigitalizacion(errorMsg)) {
      try {
        const encolada = defaultInvoiceQueue.encolar(tenant_id, invoiceData, file_name, mime_type, errorMsg);
        logger.warn('InvoiceRoutes', 'Factura sin digitalizar encolada para reintento', { id: encolada.id });
        res.status(202).json({
          success: true,
          encolada: true,
          data: { ...encolada, estado: 'PENDIENTE_OCR', intentos_maximos: defaultInvoiceQueue.intentosMaximos },
          message: 'No fue posible digitalizar el documento ahora. Quedo guardado y se reintentara al ' +
            'recuperar la conexion; tambien puede ingresarlo manualmente.'
        });
        return;
      } catch (errorCola) {
        logger.error('InvoiceRoutes', 'No se pudo encolar la factura sin digitalizar', errorCola);
        res.status(422).json({
          success: false,
          message: errorMsg,
          error: errorCola instanceof Error ? errorCola.message : String(errorCola)
        });
        return;
      }
    }

    logger.error('InvoiceRoutes', 'Failed to scan invoice', error);
    res.status(500).json({
      success: false,
      message: 'Error al escanear la factura',
      error: errorMsg
    });
  }
});

/**
 * GET /api/v1/invoices/pending
 * Facturas guardadas que aun no se han podido digitalizar (RF-43)
 */
router.get('/pending', (req: Request, res: Response): void => {
  const tenantId = (req.query.tenant_id as string) || (req.headers['x-tenant-id'] as string);

  if (!tenantId) {
    res.status(400).json({ success: false, message: 'tenant_id query parameter is required' });
    return;
  }

  try {
    const cola = defaultInvoiceQueue.listar(tenantId);
    res.status(200).json({
      success: true,
      count: cola.length,
      intentos_maximos: defaultInvoiceQueue.intentosMaximos,
      data: cola
    });
  } catch (error) {
    logger.error('InvoiceRoutes', 'Failed to list pending invoices', error);
    res.status(500).json({
      success: false,
      message: 'Error al consultar la cola de facturas pendientes',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/v1/invoices/process-pending
 * Reintenta la digitalizacion de la cola. Tambien se ejecuta desde POST /pos/sync
 */
router.post('/process-pending', async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.body?.tenant_id || (req.headers['x-tenant-id'] as string) || (req.query.tenant_id as string);

  if (!tenantId) {
    res.status(400).json({ success: false, message: 'tenant_id is required' });
    return;
  }

  try {
    const resultado = await defaultInvoiceQueue.procesarPendientes(tenantId);
    const documentosHuerfanos = defaultInvoiceQueue.limpiarHuerfanos(tenantId);
    const respaldo = await defaultInvoiceIngestionService.respaldarFacturasEnNube(tenantId);
    res.status(200).json({
      success: true,
      data: { ...resultado, documentos_huerfanos_eliminados: documentosHuerfanos, respaldo_nube: respaldo }
    });
  } catch (error) {
    logger.error('InvoiceRoutes', 'Failed to process pending invoice queue', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la cola de facturas pendientes',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/v1/invoices/confirm
 * Paso 2: Confirmación explícita del usuario para autorizar la ingesta transaccional
 */
router.post('/confirm', async (req: Request, res: Response): Promise<void> => {
  const { invoice_data, documento } = req.body;
  const tenant_id = req.body.tenant_id || (req as any).tenant_id || (req.headers['x-tenant-id'] as string) || (req.query.tenant_id as string);

  if (!tenant_id || !invoice_data) {
    res.status(400).json({
      success: false,
      message: 'tenant_id and invoice_data are required'
    });
    return;
  }

  try {
    // "documento" es la referencia que devolvio el escaneo: vincula el respaldo tributario a la
    // factura. Si el cliente no lo reenvia, la ingesta funciona igual pero sin documento asociado.
    const result = await defaultInvoiceIngestionService.confirmIngest(
      tenant_id,
      invoice_data as ExtractedInvoiceData,
      documento
    );
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    // Una factura ya ingresada no es un error del sistema: es una compra ya contada. Se responde
    // 409 para que la interfaz lo distinga de un fallo y lo explique al usuario.
    if (esFacturaDuplicada(error)) {
      res.status(409).json({
        success: false,
        duplicada: true,
        message: error instanceof Error ? error.message : String(error)
      });
      return;
    }

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
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (esDocumentoIlegible(error)) {
      res.status(422).json({ success: false, ilegible: true, message: errorMsg });
      return;
    }
    // Una factura ya ingresada no es un error del sistema: es una compra ya contada. Se responde
    // 409 para que la interfaz lo distinga de un fallo y lo explique al usuario.
    if (esFacturaDuplicada(error)) {
      res.status(409).json({
        success: false,
        duplicada: true,
        message: error instanceof Error ? error.message : String(error)
      });
      return;
    }

    logger.error('InvoiceRoutes', 'Failed to ingest invoice', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during invoice ingestion',
      error: errorMsg
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
    // "data" normaliza el contrato con el resto de la API; "invoices" se conserva para no
    // romper a los clientes que ya la consumen.
    res.status(200).json({
      data: invoices,
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

/**
 * GET /api/v1/invoices/:id/document
 * Documento original de la factura, respaldo de la compra para el SII y la contabilidad
 */
router.get('/:id/document', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const tenantId = (req.query.tenant_id as string) || (req.headers['x-tenant-id'] as string);

  if (!tenantId) {
    res.status(400).json({ success: false, message: 'tenant_id query parameter is required' });
    return;
  }

  try {
    const factura = defaultSqliteClient.queryOne<{ archivo_ruta: string | null; archivo_nombre: string | null; archivo_mime: string | null }>(
      'SELECT archivo_ruta, archivo_nombre, archivo_mime FROM factura_ingresos WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!factura) {
      res.status(404).json({ success: false, message: 'Factura no encontrada en este comercio' });
      return;
    }

    // Disco local primero; si el archivo ya no esta, se recupera del respaldo en la nube. Sin esta
    // segunda via el respaldo no serviria de nada: un respaldo que no se puede restaurar no es respaldo.
    let contenido: Buffer | null = null;
    let origen = 'local';

    if (factura.archivo_ruta && defaultInvoiceFileStore.existe(factura.archivo_ruta)) {
      contenido = defaultInvoiceFileStore.leerBuffer(factura.archivo_ruta);
    } else {
      contenido = await defaultInvoiceIngestionService.recuperarDocumentoDeNube(tenantId, id);
      origen = 'nube';
    }

    if (!contenido) {
      res.status(404).json({
        success: false,
        message: 'Esta factura no tiene documento original almacenado ni en el equipo local ni en la ' +
          'nube. Las ingresadas antes de la incorporacion del respaldo documental, o escaneadas sin ' +
          'reenviar su referencia, no lo conservan.'
      });
      return;
    }

    res.setHeader('X-Documento-Origen', origen);
    res.setHeader('Content-Type', factura.archivo_mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${factura.archivo_nombre || 'factura'}"`);
    res.status(200).send(contenido);
  } catch (error) {
    logger.error('InvoiceRoutes', 'Failed to retrieve invoice document', error);
    res.status(500).json({
      success: false,
      message: 'Error al recuperar el documento de la factura',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
