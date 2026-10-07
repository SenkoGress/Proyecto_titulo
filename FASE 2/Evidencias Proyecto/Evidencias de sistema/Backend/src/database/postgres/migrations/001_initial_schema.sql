-- ============================================================================
-- Gestock SaaS Cloud Database Migration: 001_initial_schema.sql
-- Unified 15-Table Relational Schema for PostgreSQL Multi-Tenant SaaS
-- ============================================================================

-- Extensions for UUID Generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Planes_Facturacion (SaaS Subscription Plans)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planes_facturacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(50) NOT NULL UNIQUE,
    precio_mensual NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    precio_anual NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    descuento_anual INTEGER NOT NULL DEFAULT 0,
    caracteristicas JSONB,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. Tenants (Multi-Tenant Organization Accounts)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    plan_id UUID REFERENCES planes_facturacion(id) ON DELETE SET NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'SUSPENDIDO', 'CANCELADO')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. Usuarios (Users with Role-Based Access Control)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL CHECK (rol IN ('admin', 'cajero')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_usuarios_tenant_email UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_tenant ON usuarios(tenant_id);

-- ----------------------------------------------------------------------------
-- 4. Notificaciones_Tokens (Push Tokens & Auth Sessions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    token TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    expiracion TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_tokens_usuario ON notificaciones_tokens(usuario_id);

-- ----------------------------------------------------------------------------
-- 5. Historial_Planes (Tenant Subscription Change History)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historial_planes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES planes_facturacion(id) ON DELETE RESTRICT,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_cambio TIMESTAMPTZ NOT NULL DEFAULT now(),
    metodo_pago VARCHAR(50) NOT NULL,
    monto_pagado NUMERIC(14, 2) NOT NULL DEFAULT 0.00
);

CREATE INDEX IF NOT EXISTS idx_historial_planes_tenant ON historial_planes(tenant_id);

-- ----------------------------------------------------------------------------
-- 6. Configuracion_Sistema (Global & Tenant Specific Settings)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracion_sistema (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    clave VARCHAR(100) NOT NULL,
    valor TEXT NOT NULL,
    descripcion TEXT,
    actualizado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_config_tenant_clave UNIQUE (tenant_id, clave)
);

CREATE INDEX IF NOT EXISTS idx_config_tenant ON configuracion_sistema(tenant_id);

-- ----------------------------------------------------------------------------
-- 7. Proveedores (Suppliers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rut_proveedor VARCHAR(20) NOT NULL,
    nombre_proveedores VARCHAR(100) NOT NULL,
    dias_visita_proveedores VARCHAR(50),
    email VARCHAR(150),
    whatsapp_contacto VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_proveedor_tenant_rut UNIQUE (tenant_id, rut_proveedor)
);

CREATE INDEX IF NOT EXISTS idx_proveedores_tenant ON proveedores(tenant_id);

-- ----------------------------------------------------------------------------
-- 8. Catalogo_Borradores (Supplier Draft Catalog & Market Ingestion)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalogo_borradores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
    estado_revision_catalogo VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    fecha_ingreso TIMESTAMPTZ NOT NULL DEFAULT now(),
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalogo_borradores_tenant ON catalogo_borradores(tenant_id);

-- ----------------------------------------------------------------------------
-- 9. Productos (Product Catalog & Inventory Balances)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
    codigo_barra VARCHAR(50),
    sku VARCHAR(100) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    stock_actual NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    stock_minimo NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    id_pos_externo VARCHAR(100),
    precio_compra NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    precio_venta NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    categoria VARCHAR(100),
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_productos_tenant_sku UNIQUE (tenant_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_productos_tenant ON productos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_productos_codigo_barra ON productos(tenant_id, codigo_barra);

-- ----------------------------------------------------------------------------
-- 10. Movimientos_Inventario_Tipos (Inventory Movement Types Dictionary)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_inventario_tipos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(50) NOT NULL,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    descripcion TEXT
);

-- ----------------------------------------------------------------------------
-- 11. Movimientos_Inventario (Stock Audit Log & Movements Ledger)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    tipo_movimiento_id UUID NOT NULL REFERENCES movimientos_inventario_tipos(id) ON DELETE RESTRICT,
    cantidad NUMERIC(14, 2) NOT NULL,
    saldo_anterior NUMERIC(14, 2) NOT NULL,
    nuevo_saldo NUMERIC(14, 2) NOT NULL,
    id_origen UUID,
    tipo_origen VARCHAR(50),
    fecha_movimiento TIMESTAMPTZ NOT NULL DEFAULT now(),
    usuario_registro VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_movimientos_tenant_producto ON movimientos_inventario(tenant_id, producto_id);

-- ----------------------------------------------------------------------------
-- 12. Historial_Stock (Predictive Net Stock Delta Engine)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historial_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    cambio_anterior NUMERIC(14, 2) NOT NULL,
    nuevo_stock NUMERIC(14, 2) NOT NULL,
    cambio NUMERIC(14, 2) NOT NULL,
    tipo_movimiento VARCHAR(50) NOT NULL CHECK (tipo_movimiento IN ('venta', 'ingreso_factura', 'ajuste', 'alta_inicial', 'ajuste_manual', 'merma')),
    id_venta_manual UUID,
    motivo VARCHAR(200),
    fecha_movimiento TIMESTAMPTZ NOT NULL DEFAULT now(),
    usuario_registro VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_historial_stock_tenant_producto ON historial_stock(tenant_id, producto_id);

-- ----------------------------------------------------------------------------
-- 13. Factura_Ingresos (Purchases & OCR Ingested Invoices)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS factura_ingresos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
    numero_factura VARCHAR(50) NOT NULL,
    fecha_ingreso DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'RECIBIDA',
    cantidad NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    metodo_ingreso VARCHAR(50),
    rut_proveedor VARCHAR(20),
    total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    json_ocr_raw JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_factura_ingresos_tenant ON factura_ingresos(tenant_id);

-- ----------------------------------------------------------------------------
-- 14. Metodos_Pago (Payment Methods & Gateway Catalog)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metodos_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    pasarela VARCHAR(50) NOT NULL DEFAULT 'EFECTIVO' CHECK (pasarela IN ('EFECTIVO', 'TRANSBANK', 'MERCADOPAGO', 'SUMUP', 'OTRO'))
);

-- ----------------------------------------------------------------------------
-- 15. Transacciones_Venta (Sales Orders with Offline-First Sync Fields)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transacciones_venta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    folio_local_sqlite VARCHAR(100),
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    unidades NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    estado VARCHAR(50) NOT NULL DEFAULT 'COMPLETADA',
    rut_cliente VARCHAR(20),
    observaciones TEXT,
    metodo_pago_id UUID REFERENCES metodos_pago(id) ON DELETE RESTRICT,
    is_dirty INTEGER NOT NULL DEFAULT 0,
    sync_attempts INTEGER NOT NULL DEFAULT 0,
    last_synced_at TIMESTAMPTZ,
    sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_transacciones_venta_tenant ON transacciones_venta(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transacciones_venta_sync ON transacciones_venta(tenant_id, sync_status);

-- ----------------------------------------------------------------------------
-- 16. Detalle_Venta (Sale Line Items - Normalized 1:N with Transacciones_Venta)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_venta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID NOT NULL REFERENCES transacciones_venta(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad NUMERIC(14, 2) NOT NULL,
    precio_unitario NUMERIC(14, 2) NOT NULL,
    subtotal NUMERIC(14, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_detalle_venta_venta ON detalle_venta(venta_id);
CREATE INDEX IF NOT EXISTS idx_detalle_venta_producto ON detalle_venta(producto_id);

-- ----------------------------------------------------------------------------
-- 17. Mermas (Stock Shrinkage and Spoilage Log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mermas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    cantidad NUMERIC(14, 2) NOT NULL,
    motivo VARCHAR(100) NOT NULL,
    observaciones TEXT,
    usuario_id VARCHAR(100),
    fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mermas_tenant_producto ON mermas(tenant_id, producto_id);

