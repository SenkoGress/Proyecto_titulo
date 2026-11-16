-- ============================================================================
-- Gestock SaaS Cloud Database Migration: 016_lotes_de_vencimiento.sql
-- Un producto puede tener stock con dos vencimientos distintos
-- ============================================================================

-- productos.fecha_vencimiento es un solo campo, de modo que una reposicion solo
-- puede conservar una de las dos fechas. Hasta ahora se conserva la mas proxima,
-- que es seguro pero impreciso: el sistema no sabe CUANTAS unidades vencen en esa
-- fecha. Esta tabla separa la existencia por lote, que es lo que exige el control
-- por vencimiento del D.S. 977/96.

-- La tabla se crea en los dos motores para que el esquema siga siendo espejo. La
-- gestion de lotes la ejerce el nodo local, porque es donde ocurren las ventas y
-- las mermas; su replicacion a la nube se incorpora junto con la sincronizacion.

CREATE TABLE IF NOT EXISTS lotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    codigo_lote VARCHAR(100),
    cantidad NUMERIC(14, 2) NOT NULL CHECK (cantidad >= 0),
    fecha_vencimiento DATE NOT NULL,
    factura_origen_folio VARCHAR(100),
    origen VARCHAR(30) NOT NULL DEFAULT 'INGESTA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- El orden de consumo es por fecha de vencimiento ascendente: lo que vence antes sale antes
CREATE INDEX IF NOT EXISTS idx_lotes_fefo ON lotes(tenant_id, producto_id, fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_lotes_vencimiento ON lotes(tenant_id, fecha_vencimiento) WHERE cantidad > 0;
