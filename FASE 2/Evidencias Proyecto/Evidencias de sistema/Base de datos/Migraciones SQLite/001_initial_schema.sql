-- ============================================================================
-- Gestock Local POS Database Migration: 001_initial_schema.sql
-- Unified Mirror Schema for SQLite Local Offline-First Engine
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. Planes_Facturacion (SaaS Subscription Plans - Local Read Cache)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planes_facturacion (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    precio_mensual REAL NOT NULL DEFAULT 0.00,
    precio_anual REAL NOT NULL DEFAULT 0.00,
    descuento_anual INTEGER NOT NULL DEFAULT 0,
    caracteristicas TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- 2. Tenants (Multi-Tenant Local Organization Data)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    plan_id TEXT REFERENCES planes_facturacion(id) ON DELETE SET NULL,
    estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'SUSPENDIDO', 'CANCELADO')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------------------------
-- 3. Usuarios (Users with Role-Based Access Control)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'cajero')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_tenant ON usuarios(tenant_id);

-- ----------------------------------------------------------------------------
-- 4. Notificaciones_Tokens (Push Tokens & Auth Sessions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones_tokens (
    id TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    token TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    creada_en TEXT NOT NULL DEFAULT (datetime('now')),
    expiracion TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_tokens_usuario ON notificaciones_tokens(usuario_id);

-- ----------------------------------------------------------------------------
-- 5. Historial_Planes (Tenant Subscription Change History)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historial_planes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES planes_facturacion(id) ON DELETE RESTRICT,
    usuario_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_cambio TEXT NOT NULL DEFAULT (datetime('now')),
    metodo_pago TEXT NOT NULL,
    monto_pagado REAL NOT NULL DEFAULT 0.00
);

CREATE INDEX IF NOT EXISTS idx_historial_planes_tenant ON historial_planes(tenant_id);

-- ----------------------------------------------------------------------------
-- 6. Configuracion_Sistema (Local & Tenant Settings)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracion_sistema (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
    clave TEXT NOT NULL,
    valor TEXT NOT NULL,
    descripcion TEXT,
    actualizado_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, clave)
);

CREATE INDEX IF NOT EXISTS idx_config_tenant ON configuracion_sistema(tenant_id);

-- ----------------------------------------------------------------------------
-- 7. Proveedores (Suppliers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proveedores (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rut_proveedor TEXT NOT NULL,
    nombre_proveedores TEXT NOT NULL,
    dias_visita_proveedores TEXT,
    email TEXT,
    whatsapp_contacto TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, rut_proveedor)
);

CREATE INDEX IF NOT EXISTS idx_proveedores_tenant ON proveedores(tenant_id);

-- ----------------------------------------------------------------------------
-- 8. Catalogo_Borradores (Supplier Draft Catalog & Ingestion)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalogo_borradores (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    proveedor_id TEXT REFERENCES proveedores(id) ON DELETE SET NULL,
    estado_revision_catalogo TEXT NOT NULL DEFAULT 'PENDIENTE',
    fecha_ingreso TEXT NOT NULL DEFAULT (datetime('now')),
    notas TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_catalogo_borradores_tenant ON catalogo_borradores(tenant_id);

-- ----------------------------------------------------------------------------
-- 9. Productos (Product Catalog & Inventory Balances)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    proveedor_id TEXT REFERENCES proveedores(id) ON DELETE SET NULL,
    codigo_barra TEXT,
    sku TEXT NOT NULL,
    nombre TEXT NOT NULL,
    stock_actual REAL NOT NULL DEFAULT 0.00,
    stock_minimo REAL NOT NULL DEFAULT 0.00,
    id_pos_externo TEXT,
    precio_compra REAL NOT NULL DEFAULT 0.00,
    precio_venta REAL NOT NULL DEFAULT 0.00,
    categoria TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_productos_tenant ON productos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_productos_codigo_barra ON productos(tenant_id, codigo_barra);

-- ----------------------------------------------------------------------------
-- 10. Movimientos_Inventario_Tipos (Inventory Movement Types)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_inventario_tipos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    codigo TEXT NOT NULL UNIQUE,
    descripcion TEXT
);

-- ----------------------------------------------------------------------------
-- 11. Movimientos_Inventario (Stock Audit Log & Movements Ledger)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    tipo_movimiento_id TEXT NOT NULL REFERENCES movimientos_inventario_tipos(id) ON DELETE RESTRICT,
    cantidad REAL NOT NULL,
    saldo_anterior REAL NOT NULL,
    nuevo_saldo REAL NOT NULL,
    id_origen TEXT,
    tipo_origen TEXT,
    fecha_movimiento TEXT NOT NULL DEFAULT (datetime('now')),
    usuario_registro TEXT
);

CREATE INDEX IF NOT EXISTS idx_movimientos_tenant_producto ON movimientos_inventario(tenant_id, producto_id);

-- ----------------------------------------------------------------------------
-- 12. Historial_Stock (Predictive Net Stock Delta Engine)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historial_stock (
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

CREATE INDEX IF NOT EXISTS idx_historial_stock_tenant_producto ON historial_stock(tenant_id, producto_id);

-- ----------------------------------------------------------------------------
-- 13. Factura_Ingresos (Purchases & Invoices)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS factura_ingresos (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    proveedor_id TEXT REFERENCES proveedores(id) ON DELETE SET NULL,
    numero_factura TEXT NOT NULL,
    fecha_ingreso TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'RECIBIDA',
    cantidad REAL NOT NULL DEFAULT 0.00,
    metodo_ingreso TEXT,
    rut_proveedor TEXT,
    total REAL NOT NULL DEFAULT 0.00,
    json_ocr_raw TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_factura_ingresos_tenant ON factura_ingresos(tenant_id);

-- ----------------------------------------------------------------------------
-- 14. Metodos_Pago (Payment Methods Catalog)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metodos_pago (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    pasarela TEXT NOT NULL DEFAULT 'EFECTIVO' CHECK (pasarela IN ('EFECTIVO', 'TRANSBANK', 'MERCADOPAGO', 'SUMUP', 'OTRO'))
);

-- ----------------------------------------------------------------------------
-- 15. Transacciones_Venta (POS Sales with Offline-First Sync Fields)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transacciones_venta (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    folio_local_sqlite TEXT,
    fecha TEXT NOT NULL DEFAULT (datetime('now')),
    total REAL NOT NULL DEFAULT 0.00,
    unidades REAL NOT NULL DEFAULT 0.00,
    estado TEXT NOT NULL DEFAULT 'COMPLETADA',
    rut_cliente TEXT,
    observaciones TEXT,
    metodo_pago_id TEXT REFERENCES metodos_pago(id) ON DELETE RESTRICT,
    is_dirty INTEGER NOT NULL DEFAULT 1,
    sync_attempts INTEGER NOT NULL DEFAULT 0,
    last_synced_at TEXT,
    sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_transacciones_venta_tenant ON transacciones_venta(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transacciones_venta_sync ON transacciones_venta(tenant_id, sync_status);
CREATE INDEX IF NOT EXISTS idx_transacciones_venta_dirty ON transacciones_venta(is_dirty);

-- ----------------------------------------------------------------------------
-- 16. Detalle_Venta (Sale Line Items - Normalized 1:N with Transacciones_Venta)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_venta (
    id TEXT PRIMARY KEY,
    venta_id TEXT NOT NULL REFERENCES transacciones_venta(id) ON DELETE CASCADE,
    producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad REAL NOT NULL,
    precio_unitario REAL NOT NULL,
    subtotal REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_detalle_venta_venta ON detalle_venta(venta_id);
CREATE INDEX IF NOT EXISTS idx_detalle_venta_producto ON detalle_venta(producto_id);

-- ----------------------------------------------------------------------------
-- 17. Mermas (Stock Shrinkage and Spoilage Log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mermas (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    cantidad REAL NOT NULL,
    motivo TEXT NOT NULL,
    observaciones TEXT,
    usuario_id TEXT,
    fecha TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mermas_tenant_producto ON mermas(tenant_id, producto_id);

