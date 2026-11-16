-- Migración 010: Ampliar CHECK constraint de historial_stock en SQLite para incluir 'alta_inicial', 'ajuste_manual' y 'merma'
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS historial_stock_upgrade_tmp (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    cambio_anterior REAL NOT NULL,
    nuevo_stock REAL NOT NULL,
    cambio REAL NOT NULL,
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('venta', 'ingreso_factura', 'ajuste', 'alta_inicial', 'ajuste_manual', 'merma')),
    id_venta_manual TEXT,
    motivo TEXT,
    fecha_movimiento TEXT NOT NULL DEFAULT (datetime('now')),
    usuario_registro TEXT
);

INSERT INTO historial_stock_upgrade_tmp (id, tenant_id, producto_id, cambio_anterior, nuevo_stock, cambio, tipo_movimiento, id_venta_manual, motivo, fecha_movimiento, usuario_registro)
SELECT id, tenant_id, producto_id, cambio_anterior, nuevo_stock, cambio, tipo_movimiento, id_venta_manual, motivo, fecha_movimiento, usuario_registro
FROM historial_stock;

DROP TABLE historial_stock;

ALTER TABLE historial_stock_upgrade_tmp RENAME TO historial_stock;

CREATE INDEX IF NOT EXISTS idx_historial_stock_tenant_producto ON historial_stock(tenant_id, producto_id);

PRAGMA foreign_keys=ON;
