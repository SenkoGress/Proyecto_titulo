import { defaultPgClient } from './postgres/client';
import { PostgresMigrator } from './postgres/migrator';
import { defaultSqliteClient } from './sqlite/client';
import { SqliteMigrator } from './sqlite/migrator';
import { logger } from '../utils/logger';
import { generateChileanBarcode } from '../utils/barcode.utils';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000002';

export async function initializeDatabase(): Promise<void> {
  logger.info('InitDB', 'Starting automated database initialization and migration check...');

  // 1. Migraciones SQLite Local
  try {
    const sqliteMigrator = new SqliteMigrator(defaultSqliteClient);
    const appliedSqlite = sqliteMigrator.migrate();
    if (appliedSqlite.length > 0) {
      logger.info('InitDB', `SQLite migrations applied: ${appliedSqlite.join(', ')}`);
    } else {
      logger.info('InitDB', 'SQLite database is up to date.');
    }

    // Sembrar datos iniciales en SQLite si no existen
    seedSqliteDemoData();

    // Rellenar códigos de barra EAN-13 estándar para productos que no tengan
    backfillSqliteBarcodes();
  } catch (err) {
    logger.error('InitDB', 'Failed during SQLite initialization', err);
  }

  // 2. Migraciones PostgreSQL Cloud (si está accesible)
  try {
    const pgOnline = await defaultPgClient.healthCheck();
    if (pgOnline) {
      const pgMigrator = new PostgresMigrator(defaultPgClient);
      const appliedPg = await pgMigrator.migrate();
      if (appliedPg.length > 0) {
        logger.info('InitDB', `PostgreSQL migrations applied: ${appliedPg.join(', ')}`);
      } else {
        logger.info('InitDB', 'PostgreSQL cloud database is up to date.');
      }

      // Sembrar datos iniciales en PostgreSQL para consistencia con el nodo local
      await seedPostgresDemoData();

      // Rellenar códigos de barra EAN-13 estándar para productos en PostgreSQL
      await backfillPostgresBarcodes();
    } else {
      logger.warn('InitDB', 'PostgreSQL cloud is unreachable. Operating in standalone Offline-First POS mode.');
    }
  } catch (err) {
    logger.warn('InitDB', 'PostgreSQL initialization failed or offline. Continuing in local mode.', { error: String(err) });
  }
}

function seedSqliteDemoData(): void {
  const existingTenant = defaultSqliteClient.queryOne<{ id: string }>(
    'SELECT id FROM tenants WHERE id = ?',
    [DEMO_TENANT_ID]
  );

  if (existingTenant) {
    return; // Ya fue sembrado
  }

  logger.info('InitDB', 'Seeding demo initial dataset in SQLite...');

  defaultSqliteClient.withTransaction(() => {
    // 1. Plan y Tenant
    defaultSqliteClient.execute(
      `INSERT INTO tenants (id, nombre, estado) 
       VALUES (?, 'Almacén Don Tito (Microempresa Demo)', 'ACTIVO')`,
      [DEMO_TENANT_ID]
    );

    // 2. Usuario Cajero / Admin (password: admin123 con hash real Bcrypt salt 10)
    defaultSqliteClient.execute(
      `INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) 
       VALUES (?, ?, 'Admin Demo', 'admin@gestock.cl', '$2b$10$UL9HVRwUfwIqug0w0pn8Oup4mCYktCkyKIorLGaMnSQfcNEi0XCE.', 'admin')`,
      [DEMO_USER_ID, DEMO_TENANT_ID]
    );

    // 3. Métodos de Pago
    const metodos = [
      { id: '11111111-0000-0000-0000-000000000001', nombre: 'Efectivo', pasarela: 'EFECTIVO' },
      { id: '11111111-0000-0000-0000-000000000002', nombre: 'Transbank Webpay / POS', pasarela: 'TRANSBANK' },
      { id: '11111111-0000-0000-0000-000000000003', nombre: 'Mercado Pago', pasarela: 'MERCADOPAGO' },
      { id: '11111111-0000-0000-0000-000000000004', nombre: 'SumUp Air', pasarela: 'SUMUP' },
      { id: '11111111-0000-0000-0000-000000000005', nombre: 'RutPay (BancoEstado / CuentaRUT)', pasarela: 'RUTPAY' }
    ];
    for (const m of metodos) {
      defaultSqliteClient.execute(
        `INSERT OR IGNORE INTO metodos_pago (id, nombre, descripcion, activo, pasarela) 
         VALUES (?, ?, ?, 1, ?)`,
        [m.id, m.nombre, m.nombre, m.pasarela]
      );
    }

    // 4. Proveedores
    const proveedores = [
      { id: '22222222-0000-0000-0000-000000000001', rut: '76.123.456-7', nombre: 'Embonor Coca-Cola Chile' },
      { id: '22222222-0000-0000-0000-000000000002', rut: '76.999.888-K', nombre: 'Distribuidora Mayorista Central SpA' },
      { id: '22222222-0000-0000-0000-000000000003', rut: '81.444.222-1', nombre: 'Cooperativa Colun Lácteos' }
    ];
    for (const prov of proveedores) {
      defaultSqliteClient.execute(
        `INSERT OR IGNORE INTO proveedores (id, tenant_id, rut_proveedor, nombre_proveedores, email, whatsapp_contacto) 
         VALUES (?, ?, ?, ?, 'contacto@proveedor.cl', '+56911223344')`,
        [prov.id, DEMO_TENANT_ID, prov.rut, prov.nombre]
      );
    }

    // 5. Productos iniciales del catálogo
    const productos = [
      {
        id: '33333333-0000-0000-0000-000000000001',
        sku: 'BEB-CC-350',
        barcode: '7801234567890',
        nombre: 'Coca Cola 350ml Lata',
        stock: 45.00,
        min: 12.00,
        costo: 500.00,
        precio: 1000.00,
        cat: 'Bebidas',
        prov: proveedores[0].id
      },
      {
        id: '33333333-0000-0000-0000-000000000002',
        sku: 'BEB-MONS-473',
        barcode: '7801234567891',
        nombre: 'Bebida Energética Monster 473ml',
        stock: 6.00, // Riesgo crítico < 15
        min: 15.00,
        costo: 1200.00,
        precio: 2500.00,
        cat: 'Bebidas',
        prov: proveedores[0].id
      },
      {
        id: '33333333-0000-0000-0000-000000000003',
        sku: 'ABA-HAR-1K',
        barcode: '7801234567892',
        nombre: 'Harina Selecta Sin Polvos 1kg',
        stock: 24.00,
        min: 10.00,
        costo: 750.00,
        precio: 1350.00,
        cat: 'Abarrotes',
        prov: proveedores[1].id
      },
      {
        id: '33333333-0000-0000-0000-000000000004',
        sku: 'ABA-ACE-900',
        barcode: '7801234567893',
        nombre: 'Aceite Vegetal Belmont 900ml',
        stock: 4.00, // Riesgo crítico < 12
        min: 12.00,
        costo: 1100.00,
        precio: 2190.00,
        cat: 'Abarrotes',
        prov: proveedores[1].id
      },
      {
        id: '33333333-0000-0000-0000-000000000005',
        sku: 'LAC-LECH-1L',
        barcode: '7801234567894',
        nombre: 'Leche Entera Colun 1L',
        stock: 35.00,
        min: 10.00,
        costo: 720.00,
        precio: 1290.00,
        cat: 'Lácteos',
        prov: proveedores[2].id
      },
      {
        id: '33333333-0000-0000-0000-000000000006',
        sku: 'SNK-LAY-200',
        barcode: '7801234567895',
        nombre: 'Papas Fritas Lays Clásicas 200g',
        stock: 18.00,
        min: 8.00,
        costo: 1050.00,
        precio: 1890.00,
        cat: 'Snacks',
        prov: proveedores[1].id
      }
    ];

    for (const p of productos) {
      defaultSqliteClient.execute(
        `INSERT OR IGNORE INTO productos 
         (id, tenant_id, proveedor_id, codigo_barra, sku, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, categoria, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [p.id, DEMO_TENANT_ID, p.prov, p.barcode, p.sku, p.nombre, p.stock, p.min, p.costo, p.precio, p.cat]
      );
    }

    // 6. Tendencias de Mercado iniciales
    defaultSqliteClient.execute(
      `INSERT OR IGNORE INTO market_trends 
       (id, tenant_id, fuente_api, sku_referencia, palabra_clave, indice_demanda, precio_promedio_mercado)
       VALUES 
       ('44444444-0000-0000-0000-000000000001', ?, 'MercadoLibre', 'BEB-MONS-473', 'Monster Energy 473ml', 89.50, 2600.00),
       ('44444444-0000-0000-0000-000000000002', ?, 'MercadoLibre', 'BEB-CC-350', 'Coca Cola 350ml', 82.00, 1050.00),
       ('44444444-0000-0000-0000-000000000003', ?, 'AliExpress', 'ABA-ACE-900', 'Aceite Vegetal Belmont', 76.00, 2250.00)`,
      [DEMO_TENANT_ID, DEMO_TENANT_ID, DEMO_TENANT_ID]
    );

    // 7. Sembrar historial de ventas de los últimos 7 días para cálculo predictivo
    for (const p of productos) {
      defaultSqliteClient.execute(
        `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, is_dirty, sync_status, fecha)
         VALUES (?, ?, ?, ?, ?, 10, 'COMPLETADA', 0, 'SYNCED', datetime('now', '-2 days'))`,
        [`v1-${p.id}`, DEMO_TENANT_ID, DEMO_USER_ID, `FOLIO-HIST-${p.sku}`, p.precio * 10]
      );
      defaultSqliteClient.execute(
        `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES (?, ?, ?, 10, ?, ?)`,
        [`dv1-${p.id}`, `v1-${p.id}`, p.id, p.precio, p.precio * 10]
      );
    }

    // 8. Configuración inicial del negocio (Margen y Ley de Redondeo)
    defaultSqliteClient.execute(
      `INSERT OR IGNORE INTO configuracion_sistema (id, tenant_id, clave, valor, descripcion, actualizado_at)
       VALUES (?, ?, 'margen_ganancia_default', '35', 'Margen de ganancia comercial asignado por el admin (%)', datetime('now'))`,
      ['55555555-0000-0000-0000-000000000001', DEMO_TENANT_ID]
    );
    defaultSqliteClient.execute(
      `INSERT OR IGNORE INTO configuracion_sistema (id, tenant_id, clave, valor, descripcion, actualizado_at)
       VALUES (?, ?, 'regla_redondeo_chile', 'true', 'Aplicación de la Ley de Redondeo N° 20.956 (Banco Central de Chile)', datetime('now'))`,
      ['55555555-0000-0000-0000-000000000002', DEMO_TENANT_ID]
    );

    // 9. Configuración Tributaria SII (Res. Ex. N° 176, Ley N° 20.727)
    const siiConfigs = [
      { k: 'sii_modelo_emision', v: 'MODELO_B', d: 'Modelo Emisión SII: MODELO_B (Voucher reemplaza boleta - Res. 176) / MODELO_A (Siempre emite boleta)' },
      { k: 'sii_rut_emisor', v: '76.123.456-7', d: 'RUT Emisor de la empresa' },
      { k: 'sii_razon_social', v: 'ALMACEN DON TITO SPA', d: 'Razón Social comercial' },
      { k: 'sii_giro_comercial', v: 'VENTA AL POR MENOR EN ALMACENES Y MINIMARKET', d: 'Giro comercial según SII' },
      { k: 'sii_acteco', v: '471100', d: 'Código actividad económica principal SII' },
      { k: 'sii_direccion', v: 'AV. LIBERTADOR BERNARDO OHIGGINS 1234', d: 'Dirección fiscal de casa matriz' },
      { k: 'sii_comuna', v: 'SANTIAGO', d: 'Comuna casa matriz' },
      { k: 'sii_ciudad', v: 'SANTIAGO', d: 'Ciudad casa matriz' },
      { k: 'sii_ambiente', v: 'CERTIFICACION_MAULLIN', d: 'Ambiente SII (CERTIFICACION_MAULLIN / PRODUCCION_PALENA)' }
    ];

    for (let i = 0; i < siiConfigs.length; i++) {
      const cfg = siiConfigs[i];
      defaultSqliteClient.execute(
        `INSERT OR IGNORE INTO configuracion_sistema (id, tenant_id, clave, valor, descripcion, actualizado_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [`cfg-sii-${i + 1}`, DEMO_TENANT_ID, cfg.k, cfg.v, cfg.d]
      );
    }
  });

  logger.info('InitDB', 'Demo initial dataset seeded successfully in SQLite.');
}

async function seedPostgresDemoData(): Promise<void> {
  const res = await defaultPgClient.query(
    'SELECT id FROM tenants WHERE id = $1',
    [DEMO_TENANT_ID]
  );

  if (res.rows.length > 0) {
    return; // Ya existe en Postgres
  }

  logger.info('InitDB', 'Seeding demo initial dataset in PostgreSQL Cloud...');

  await defaultPgClient.withTransaction(async (client) => {
    // 1. Tenant
    await client.query(
      `INSERT INTO tenants (id, nombre, estado) 
       VALUES ($1, 'Almacén Don Tito (Microempresa Demo)', 'ACTIVO') ON CONFLICT DO NOTHING`,
      [DEMO_TENANT_ID]
    );

    // 2. Usuario (password: admin123 con hash real Bcrypt salt 10)
    await client.query(
      `INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) 
       VALUES ($1, $2, 'Admin Demo', 'admin@gestock.cl', '$2b$10$UL9HVRwUfwIqug0w0pn8Oup4mCYktCkyKIorLGaMnSQfcNEi0XCE.', 'admin') ON CONFLICT DO NOTHING`,
      [DEMO_USER_ID, DEMO_TENANT_ID]
    );

    // 2.1 Métodos de Pago
    await client.query(
      `INSERT INTO metodos_pago (id, nombre, descripcion, activo, pasarela) VALUES
       ('11111111-0000-0000-0000-000000000001', 'Efectivo', 'Pago en efectivo', true, 'EFECTIVO'),
       ('11111111-0000-0000-0000-000000000002', 'Transbank Webpay / POS', 'Transbank POS', true, 'TRANSBANK'),
       ('11111111-0000-0000-0000-000000000003', 'Mercado Pago', 'Mercado Pago Point / QR', true, 'MERCADOPAGO'),
       ('11111111-0000-0000-0000-000000000004', 'SumUp Air', 'SumUp Lector Tarjetas', true, 'SUMUP'),
       ('11111111-0000-0000-0000-000000000005', 'RutPay (BancoEstado / CuentaRUT)', 'Pago móvil y transferencias CuentaRUT', true, 'RUTPAY')
       ON CONFLICT (id) DO NOTHING`
    );

    // 3. Proveedores
    await client.query(
      `INSERT INTO proveedores (id, tenant_id, rut_proveedor, nombre_proveedores, email, whatsapp_contacto) 
       VALUES 
       ('22222222-0000-0000-0000-000000000001', $1, '76.123.456-7', 'Embonor Coca-Cola Chile', 'contacto@proveedor.cl', '+56911223344'),
       ('22222222-0000-0000-0000-000000000002', $1, '76.999.888-K', 'Distribuidora Mayorista Central SpA', 'contacto@proveedor.cl', '+56911223344'),
       ('22222222-0000-0000-0000-000000000003', $1, '81.444.222-1', 'Cooperativa Colun Lácteos', 'contacto@proveedor.cl', '+56911223344')
       ON CONFLICT DO NOTHING`,
      [DEMO_TENANT_ID]
    );

    // 4. Productos
    await client.query(
      `INSERT INTO productos 
       (id, tenant_id, sku, codigo_barra, nombre, stock_actual, stock_minimo, precio_compra, precio_venta, categoria, activo)
       VALUES 
       ('33333333-0000-0000-0000-000000000001', $1, 'BEB-CC-350', '7801234567890', 'Coca Cola 350ml Lata', 45.00, 12.00, 500.00, 1000.00, 'Bebidas', true),
       ('33333333-0000-0000-0000-000000000002', $1, 'BEB-MONS-473', '7801234567891', 'Bebida Energética Monster 473ml', 6.00, 15.00, 1200.00, 2500.00, 'Bebidas', true),
       ('33333333-0000-0000-0000-000000000003', $1, 'ABA-HAR-1K', '7801234567892', 'Harina Selecta Sin Polvos 1kg', 24.00, 10.00, 750.00, 1350.00, 'Abarrotes', true),
       ('33333333-0000-0000-0000-000000000004', $1, 'ABA-ACE-900', '7801234567893', 'Aceite Vegetal Belmont 900ml', 4.00, 12.00, 1100.00, 2190.00, 'Abarrotes', true),
       ('33333333-0000-0000-0000-000000000005', $1, 'LAC-LECH-1L', '7801234567894', 'Leche Entera Colun 1L', 35.00, 10.00, 720.00, 1290.00, 'Lácteos', true),
       ('33333333-0000-0000-0000-000000000006', $1, 'SNK-LAY-200', '7801234567895', 'Papas Fritas Lays Clásicas 200g', 18.00, 8.00, 1050.00, 1890.00, 'Snacks', true)
       ON CONFLICT DO NOTHING`,
      [DEMO_TENANT_ID]
    );

    // 5. Tendencias
    await client.query(
      `INSERT INTO market_trends 
       (id, tenant_id, fuente_api, sku_referencia, palabra_clave, indice_demanda, precio_promedio_mercado)
       VALUES 
       ('44444444-0000-0000-0000-000000000001', $1, 'MercadoLibre', 'BEB-MONS-473', 'Monster Energy 473ml', 89.50, 2600.00),
       ('44444444-0000-0000-0000-000000000002', $1, 'MercadoLibre', 'BEB-CC-350', 'Coca Cola 350ml', 82.00, 1050.00),
       ('44444444-0000-0000-0000-000000000003', $1, 'AliExpress', 'ABA-ACE-900', 'Aceite Vegetal Belmont', 76.00, 2250.00)
       ON CONFLICT DO NOTHING`,
      [DEMO_TENANT_ID]
    );

    // 6. Configuración inicial del negocio (Margen y Ley de Redondeo)
    await client.query(
      `INSERT INTO configuracion_sistema (id, tenant_id, clave, valor, descripcion) VALUES
       ('55555555-0000-0000-0000-000000000001', $1, 'margen_ganancia_default', '35', 'Margen de ganancia comercial asignado por el admin (%)'),
       ('55555555-0000-0000-0000-000000000002', $1, 'regla_redondeo_chile', 'true', 'Aplicación de la Ley de Redondeo N° 20.956 (Banco Central de Chile)')
       ON CONFLICT DO NOTHING`,
      [DEMO_TENANT_ID]
    );
  });

  logger.info('InitDB', 'Demo initial dataset seeded successfully in PostgreSQL.');
}

function backfillSqliteBarcodes(): void {
  try {
    const sinCodigo = defaultSqliteClient.query<{ id: string; sku: string }>(
      "SELECT id, sku FROM productos WHERE codigo_barra IS NULL OR TRIM(codigo_barra) = ''"
    );

    if (sinCodigo.length > 0) {
      logger.info('InitDB', `Backfilling Chilean EAN-13 barcodes for ${sinCodigo.length} products in SQLite...`);
      defaultSqliteClient.withTransaction(() => {
        for (const p of sinCodigo) {
          const barcode = generateChileanBarcode(p.sku);
          defaultSqliteClient.execute(
            'UPDATE productos SET codigo_barra = ? WHERE id = ?',
            [barcode, p.id]
          );
        }
      });
      logger.info('InitDB', 'SQLite barcode backfill completed.');
    }
  } catch (err) {
    logger.warn('InitDB', 'Error backfilling barcodes in SQLite', { error: String(err) });
  }
}

async function backfillPostgresBarcodes(): Promise<void> {
  try {
    const res = await defaultPgClient.query<{ id: string; sku: string }>(
      "SELECT id, sku FROM productos WHERE codigo_barra IS NULL OR TRIM(codigo_barra) = ''"
    );

    if (res.rows.length > 0) {
      logger.info('InitDB', `Backfilling Chilean EAN-13 barcodes for ${res.rows.length} products in PostgreSQL...`);
      await defaultPgClient.withTransaction(async (client) => {
        for (const p of res.rows) {
          const barcode = generateChileanBarcode(p.sku);
          await client.query(
            'UPDATE productos SET codigo_barra = $1 WHERE id = $2',
            [barcode, p.id]
          );
        }
      });
      logger.info('InitDB', 'PostgreSQL barcode backfill completed.');
    }
  } catch (err) {
    logger.warn('InitDB', 'Error backfilling barcodes in PostgreSQL', { error: String(err) });
  }
}
