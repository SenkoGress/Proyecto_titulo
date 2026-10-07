import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { defaultSqliteClient } from '../database/sqlite/client';
import { defaultPgClient } from '../database/postgres/client';
import { calculateNextVisit } from '../utils/supplier.utils';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/suppliers
 * Retorna todos los proveedores del tenant con cálculo de próxima visita y productos suministrados
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const tenantId = (req.query.tenant_id as string) || '00000000-0000-0000-0000-000000000001';

  try {
    const suppliers = defaultSqliteClient.query<any>(
      `SELECT 
         p.id,
         p.tenant_id,
         p.rut_proveedor,
         p.nombre_proveedores,
         COALESCE(p.giro, 'Comercio Mayorista') as giro,
         COALESCE(p.direccion, 'Casa Matriz') as direccion,
         COALESCE(p.telefono, p.whatsapp_contacto, '+56 9 1122 3344') as telefono,
         p.email,
         COALESCE(p.dias_visita_proveedores, 'Lunes') as dias_visita_proveedores,
         (SELECT COUNT(*) FROM productos prod WHERE prod.tenant_id = p.tenant_id AND prod.proveedor_id = p.id) as productos_count,
         p.created_at,
         p.updated_at
       FROM proveedores p
       WHERE p.tenant_id = ?
       ORDER BY p.nombre_proveedores ASC`,
      [tenantId]
    );

    const enriched = suppliers.map(s => {
      const visit = calculateNextVisit(s.dias_visita_proveedores);
      return {
        ...s,
        total_productos_suministrados: s.productos_count || 0,
        proxima_visita: visit
      };
    });

    res.status(200).json({
      success: true,
      data: enriched,
      count: enriched.length
    });
  } catch (error) {
    logger.error('SupplierRoutes', 'Failed to fetch suppliers', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la lista de proveedores',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/v1/suppliers
 * Registra un nuevo proveedor en SQLite y PostgreSQL
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const {
    tenant_id,
    rut_proveedor,
    nombre_proveedores,
    giro,
    direccion,
    telefono,
    email,
    dias_visita_proveedores
  } = req.body;

  const tenantId = tenant_id || '00000000-0000-0000-0000-000000000001';

  if (!rut_proveedor || !nombre_proveedores) {
    res.status(400).json({
      success: false,
      message: 'rut_proveedor y nombre_proveedores son obligatorios'
    });
    return;
  }

  const supplierId = uuidv4();
  const diasVisita = dias_visita_proveedores || 'Lunes';
  const supplierGiro = giro || 'Comercio Mayorista';
  const supplierDir = direccion || 'Casa Matriz';
  const supplierTel = telefono || '+56 9 1122 3344';
  const supplierEmail = email || 'contacto@proveedor.cl';

  try {
    // 1. Guardar en SQLite
    defaultSqliteClient.execute(
      `INSERT INTO proveedores 
       (id, tenant_id, rut_proveedor, nombre_proveedores, email, whatsapp_contacto, giro, direccion, telefono, dias_visita_proveedores, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (tenant_id, rut_proveedor) DO UPDATE SET
         nombre_proveedores = excluded.nombre_proveedores,
         giro = excluded.giro,
         direccion = excluded.direccion,
         telefono = excluded.telefono,
         dias_visita_proveedores = excluded.dias_visita_proveedores,
         updated_at = datetime('now')`,
      [supplierId, tenantId, rut_proveedor, nombre_proveedores, supplierEmail, supplierTel, supplierGiro, supplierDir, supplierTel, diasVisita]
    );

    // 2. Guardar en PostgreSQL
    try {
      await defaultPgClient.query(
        `INSERT INTO proveedores 
         (id, tenant_id, rut_proveedor, nombre_proveedores, email, whatsapp_contacto, giro, direccion, telefono, dias_visita_proveedores, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
         ON CONFLICT (tenant_id, rut_proveedor) DO UPDATE SET
           nombre_proveedores = EXCLUDED.nombre_proveedores,
           giro = EXCLUDED.giro,
           direccion = EXCLUDED.direccion,
           telefono = EXCLUDED.telefono,
           dias_visita_proveedores = EXCLUDED.dias_visita_proveedores,
           updated_at = now()`,
        [supplierId, tenantId, rut_proveedor, nombre_proveedores, supplierEmail, supplierTel, supplierGiro, supplierDir, supplierTel, diasVisita]
      );
    } catch (pgErr) {
      logger.warn('SupplierRoutes', 'Failed to mirror supplier to PostgreSQL (offline mode)', { pgErr });
    }

    res.status(201).json({
      success: true,
      message: 'Proveedor registrado exitosamente',
      data: {
        id: supplierId,
        rut_proveedor,
        nombre_proveedores,
        dias_visita_proveedores: diasVisita
      }
    });
  } catch (error) {
    logger.error('SupplierRoutes', 'Failed to create supplier', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar el proveedor',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/v1/suppliers/:id
 * Actualiza los datos de un proveedor (día de visita, teléfono, email, etc.)
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const {
    tenant_id,
    nombre_proveedores,
    giro,
    direccion,
    telefono,
    email,
    dias_visita_proveedores
  } = req.body;

  const tenantId = tenant_id || '00000000-0000-0000-0000-000000000001';

  try {
    // 1. Actualizar en SQLite
    defaultSqliteClient.execute(
      `UPDATE proveedores
       SET 
         nombre_proveedores = COALESCE(?, nombre_proveedores),
         giro = COALESCE(?, giro),
         direccion = COALESCE(?, direccion),
         telefono = COALESCE(?, telefono),
         email = COALESCE(?, email),
         dias_visita_proveedores = COALESCE(?, dias_visita_proveedores),
         updated_at = datetime('now')
       WHERE id = ? AND tenant_id = ?`,
      [
        nombre_proveedores ?? null,
        giro ?? null,
        direccion ?? null,
        telefono ?? null,
        email ?? null,
        dias_visita_proveedores ?? null,
        id,
        tenantId
      ]
    );

    // 2. Actualizar en PostgreSQL
    try {
      await defaultPgClient.query(
        `UPDATE proveedores
         SET 
           nombre_proveedores = COALESCE($1, nombre_proveedores),
           giro = COALESCE($2, giro),
           direccion = COALESCE($3, direccion),
           telefono = COALESCE($4, telefono),
           email = COALESCE($5, email),
           dias_visita_proveedores = COALESCE($6, dias_visita_proveedores),
           updated_at = now()
         WHERE id = $7 AND tenant_id = $8`,
        [
          nombre_proveedores ?? null,
          giro ?? null,
          direccion ?? null,
          telefono ?? null,
          email ?? null,
          dias_visita_proveedores ?? null,
          id,
          tenantId
        ]
      );
    } catch (pgErr) {
      logger.warn('SupplierRoutes', 'Failed to update supplier in PostgreSQL (offline mode)', { pgErr });
    }

    res.status(200).json({
      success: true,
      message: 'Proveedor actualizado exitosamente'
    });
  } catch (error) {
    logger.error('SupplierRoutes', 'Failed to update supplier', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar proveedor',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
