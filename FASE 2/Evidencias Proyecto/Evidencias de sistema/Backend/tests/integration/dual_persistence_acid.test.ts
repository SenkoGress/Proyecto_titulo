import { createTestPostgresClient, createTestSqliteClient } from '../helpers/db-test-helper';
import { PostgresClient } from '../../src/database/postgres/client';
import { SqliteClient } from '../../src/database/sqlite/client';
import {
  createFixtureIds,
  sampleTenant,
  sampleUsuario,
  sampleProducto,
  sampleMetodoPago
} from '../helpers/fixtures';

describe('Dual Persistence ACID Transactions & Latency Performance (<200ms)', () => {
  let pgClient: PostgresClient;
  let sqliteClient: SqliteClient;

  beforeAll(async () => {
    const pgSetup = await createTestPostgresClient();
    pgClient = pgSetup.client;

    const sqliteSetup = createTestSqliteClient();
    sqliteClient = sqliteSetup.client;
  });

  afterAll(async () => {
    await pgClient.close();
    sqliteClient.close();
  });

  describe('PostgreSQL SaaS Engine ACID Transactions', () => {
    test('1. Commit Atómico: Venta completa (venta + detalles + historial_stock) persiste en <200ms', async () => {
      const ids = createFixtureIds();
      const tenant = sampleTenant(ids.tenantId);
      const user = sampleUsuario(ids.usuarioCajeroId, ids.tenantId, 'cajero');
      const prod1 = sampleProducto(ids.productoId, ids.tenantId);
      const prod2 = sampleProducto(createFixtureIds().productoId, ids.tenantId);
      const metodo = sampleMetodoPago(ids.metodoPagoId);

      // Pre-requisitos base
      await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
      await pgClient.query(`INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5, $6)`, [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);
      await pgClient.query(`INSERT INTO metodos_pago (id, nombre, descripcion, activo, pasarela) VALUES ($1, $2, $3, $4, $5)`, [metodo.id, metodo.nombre, metodo.descripcion, metodo.activo, metodo.pasarela]);
      await pgClient.query(`INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [prod1.id, prod1.tenant_id, prod1.sku, prod1.nombre, 100, 500, 1000]);
      await pgClient.query(`INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [prod2.id, prod2.tenant_id, prod2.sku, prod2.nombre, 100, 800, 1500]);

      const startTime = Date.now();

      await pgClient.withTransaction(async (client) => {
        // 1. Insertar Transacción de Venta
        await client.query(
          `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, metodo_pago_id, sync_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [ids.ventaId, ids.tenantId, ids.usuarioCajeroId, 'POS-CLOUD-ACID-01', 3500.0, 3.0, 'COMPLETADA', ids.metodoPagoId, 'SYNCED']
        );

        // 2. Insertar Detalle 1 (2 unidades de prod1)
        await client.query(
          `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [createFixtureIds().detalleVentaId, ids.ventaId, prod1.id, 2.0, 1000.0, 2000.0]
        );

        // 3. Insertar Detalle 2 (1 unidad de prod2)
        await client.query(
          `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [createFixtureIds().detalleVentaId, ids.ventaId, prod2.id, 1.0, 1500.0, 1500.0]
        );

        // 4. Actualizar stocks
        await client.query(`UPDATE productos SET stock_actual = stock_actual - 2 WHERE id = $1`, [prod1.id]);
        await client.query(`UPDATE productos SET stock_actual = stock_actual - 1 WHERE id = $1`, [prod2.id]);

        // 5. Registrar Historial Stock (Net stock delta)
        await client.query(
          `INSERT INTO historial_stock (id, tenant_id, producto_id, cambio_anterior, nuevo_stock, cambio, tipo_movimiento, motivo, usuario_registro)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [createFixtureIds().historialStockId, ids.tenantId, prod1.id, 100, 98, -2, 'venta', 'Venta en POS', user.nombre]
        );
        await client.query(
          `INSERT INTO historial_stock (id, tenant_id, producto_id, cambio_anterior, nuevo_stock, cambio, tipo_movimiento, motivo, usuario_registro)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [createFixtureIds().historialStockId, ids.tenantId, prod2.id, 100, 99, -1, 'venta', 'Venta en POS', user.nombre]
        );
      });

      const elapsedTime = Date.now() - startTime;

      // Validación de latencia < 200ms
      expect(elapsedTime).toBeLessThan(200);

      // Verificación de integridad persistida
      const saleRow = await pgClient.query('SELECT total FROM transacciones_venta WHERE id = $1', [ids.ventaId]);
      expect(Number(saleRow.rows[0].total)).toBe(3500.0);

      const itemsRows = await pgClient.query('SELECT COUNT(*) as count FROM detalle_venta WHERE venta_id = $1', [ids.ventaId]);
      expect(Number(itemsRows.rows[0].count)).toBe(2);

      const stockCheck1 = await pgClient.query('SELECT stock_actual FROM productos WHERE id = $1', [prod1.id]);
      expect(Number(stockCheck1.rows[0].stock_actual)).toBe(98);
    });

    test('2. Rollback Atómico: Un error en un item revierte TODA la transacción sin persistencia parcial', async () => {
      const failedSaleId = createFixtureIds().ventaId;
      const validProdId = createFixtureIds().productoId;
      const fakeProdId = '00000000-0000-0000-0000-000000000001';
      const tenant = sampleTenant();
      const user = sampleUsuario(createFixtureIds().usuarioCajeroId, tenant.id, 'cajero');

      await pgClient.query(`INSERT INTO tenants (id, nombre, estado) VALUES ($1, $2, $3)`, [tenant.id, tenant.nombre, tenant.estado]);
      await pgClient.query(`INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4, $5, $6)`, [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);
      await pgClient.query(`INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [validProdId, tenant.id, 'SKU-ROLLBACK', 'Prod Rollback', 50, 500, 1000]);

      let errorThrown = false;
      try {
        await pgClient.withTransaction(async (client) => {
          // 1. Inserción de venta preliminar
          await client.query(
            `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, sync_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [failedSaleId, tenant.id, user.id, 'FAIL-FOLIO', 1000, 1, 'COMPLETADA', 'PENDING']
          );

          // 2. Inserción de detalle válido
          await client.query(
            `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [createFixtureIds().detalleVentaId, failedSaleId, validProdId, 1.0, 1000.0, 1000.0]
          );

          // 3. Inserción de detalle INVÁLIDO (FK producto no existente) -> provocará ROLLBACK
          await client.query(
            `INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [createFixtureIds().detalleVentaId, failedSaleId, fakeProdId, 1.0, 1000.0, 1000.0]
          );
        });
      } catch {
        errorThrown = true;
      }

      expect(errorThrown).toBe(true);

      // Comprobar que la venta NUNCA se guardó (Rollback total)
      const saleCheck = await pgClient.query('SELECT id FROM transacciones_venta WHERE id = $1', [failedSaleId]);
      expect(saleCheck.rows.length).toBe(0);

      const itemsCheck = await pgClient.query('SELECT id FROM detalle_venta WHERE venta_id = $1', [failedSaleId]);
      expect(itemsCheck.rows.length).toBe(0);
    });
  });

  describe('SQLite Local POS Engine ACID Transactions', () => {
    test('3. Commit Atómico: Venta rápida local en SQLite con latencia ultra-baja (<200ms)', () => {
      const ids = createFixtureIds();
      const tenant = sampleTenant(ids.tenantId);
      const user = sampleUsuario(ids.usuarioCajeroId, ids.tenantId, 'cajero');
      const prod = sampleProducto(ids.productoId, ids.tenantId);

      sqliteClient.execute('INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)', [tenant.id, tenant.nombre, tenant.estado]);
      sqliteClient.execute('INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?, ?)', [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);
      sqliteClient.execute('INSERT INTO productos (id, tenant_id, sku, nombre, stock_actual, precio_compra, precio_venta) VALUES (?, ?, ?, ?, ?, ?, ?)', [prod.id, prod.tenant_id, prod.sku, prod.nombre, 80, 400, 900]);

      const startTime = Date.now();

      sqliteClient.withTransaction(() => {
        sqliteClient.execute(
          `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, is_dirty, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'PENDING')`,
          [ids.ventaId, ids.tenantId, ids.usuarioCajeroId, 'FOLIO-SQLITE-ACID-01', 1800.0, 2.0, 'COMPLETADA']
        );

        sqliteClient.execute(
          'INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
          [ids.detalleVentaId, ids.ventaId, prod.id, 2.0, 900.0, 1800.0]
        );

        sqliteClient.execute(
          'UPDATE productos SET stock_actual = stock_actual - 2 WHERE id = ?',
          [prod.id]
        );

        sqliteClient.execute(
          `INSERT INTO historial_stock (id, tenant_id, producto_id, cambio_anterior, nuevo_stock, cambio, tipo_movimiento, motivo, usuario_registro)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ids.historialStockId, ids.tenantId, prod.id, 80, 78, -2, 'venta', 'Venta POS Local', user.nombre]
        );
      });

      const elapsedTime = Date.now() - startTime;

      // Latencia en SQLite local debe ser menor a 200ms (típicamente < 10ms)
      expect(elapsedTime).toBeLessThan(200);

      // Verificación de persistencia
      const sale = sqliteClient.queryOne<{ total: number }>('SELECT total FROM transacciones_venta WHERE id = ?', [ids.ventaId]);
      expect(sale?.total).toBe(1800.0);

      const updatedProd = sqliteClient.queryOne<{ stock_actual: number }>('SELECT stock_actual FROM productos WHERE id = ?', [prod.id]);
      expect(updatedProd?.stock_actual).toBe(78);
    });

    test('4. Rollback Atómico: Error en SQLite cancela toda la transacción local sin dejar residuos', () => {
      const ids = createFixtureIds();
      const tenant = sampleTenant(ids.tenantId);
      const user = sampleUsuario(ids.usuarioCajeroId, ids.tenantId, 'cajero');

      sqliteClient.execute('INSERT INTO tenants (id, nombre, estado) VALUES (?, ?, ?)', [tenant.id, tenant.nombre, tenant.estado]);
      sqliteClient.execute('INSERT INTO usuarios (id, tenant_id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?, ?)', [user.id, user.tenant_id, user.nombre, user.email, user.password_hash, user.rol]);

      let threwError = false;
      try {
        sqliteClient.withTransaction(() => {
          sqliteClient.execute(
            `INSERT INTO transacciones_venta (id, tenant_id, usuario_id, folio_local_sqlite, total, unidades, estado, is_dirty, sync_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'PENDING')`,
            [ids.ventaId, ids.tenantId, ids.usuarioCajeroId, 'FOLIO-ERROR-ROLLBACK', 5000.0, 1.0, 'COMPLETADA']
          );

          // Forzamos un fallo violando FK con producto inexistente
          sqliteClient.execute(
            'INSERT INTO detalle_venta (id, venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
            [ids.detalleVentaId, ids.ventaId, 'ID-PRODUCTO-NO-EXISTE', 1.0, 5000.0, 5000.0]
          );
        });
      } catch {
        threwError = true;
      }

      expect(threwError).toBe(true);

      // Verificar que la venta fue revertida
      const sale = sqliteClient.queryOne('SELECT id FROM transacciones_venta WHERE id = ?', [ids.ventaId]);
      expect(sale).toBeUndefined();
    });
  });
});
