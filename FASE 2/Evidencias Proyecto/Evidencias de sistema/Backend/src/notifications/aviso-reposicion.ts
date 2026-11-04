import { SuggestedPurchaseOrder } from '../replenishment/types';

const PESOS = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

function monto(valor: number): string {
  return PESOS.format(Math.round(Number(valor) || 0));
}

function escapar(texto: string): string {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** "quedan 3, " o "agotado, ", y cadena vacia cuando no se conoce la existencia. */
function existencia(sku: string, stockPorSku: Map<string, number>): string {
  if (!stockPorSku.has(sku)) return '';
  const unidades = Number(stockPorSku.get(sku));
  return unidades === 0 ? 'agotado, ' : `quedan ${unidades}, `;
}

/**
 * Redacta el aviso de reposicion que recibe el dueno del local.
 *
 * El mensaje se escribe para quien atiende un minimarket, no para quien programo el sistema: dice
 * que proveedor pasa, que conviene pedirle y cuanto suma, en ese orden. No incluye identificadores
 * internos ni terminos del modelo de datos.
 */
export function redactarAvisoReposicion(
  orders: SuggestedPurchaseOrder[],
  /** Existencia actual por SKU. La orden no la trae: viene de las alertas de stock bajo. */
  stockPorSku: Map<string, number> = new Map()
): {
  asunto: string;
  texto: string;
  html: string;
} {
  // Los productos sin proveedor asignado no son un pedido: no hay a quien pedirles y no llevan
  // total. Van en su propia seccion para que el local sepa que hay que reponerlos y que antes
  // tiene que asignarles proveedor.
  const pedidos = orders.filter((o) => !o.sinProveedor);
  const huerfanos = orders.filter((o) => o.sinProveedor);

  const total = pedidos.reduce((suma, o) => suma + (Number(o.totalEstimado) || 0), 0);
  const productos = orders.reduce((suma, o) => suma + o.items.length, 0);
  const sinProveedor = huerfanos.reduce((suma, o) => suma + o.items.length, 0);

  const asunto =
    pedidos.length === 0
      ? 'Productos por reponer sin proveedor asignado'
      : pedidos.length === 1
        ? `Pedido sugerido para ${pedidos[0].proveedorNombre}`
        : `Pedidos sugeridos para ${pedidos.length} proveedores`;

  const lineas: string[] = [];
  lineas.push('Esto es lo que conviene pedir segun el stock de hoy.');
  lineas.push('');

  for (const orden of pedidos) {
    const visita = orden.proximaVisitaTexto ? ` (${orden.proximaVisitaTexto})` : '';
    lineas.push(`${orden.proveedorNombre}${visita}`);
    for (const item of orden.items) {
      lineas.push(`  - ${item.nombre}: ${existencia(item.sku, stockPorSku)}conviene pedir ${item.cantidadSugerida}`);
    }
    lineas.push(`  Total estimado: ${monto(orden.totalEstimado)}`);
    lineas.push('');
  }

  if (pedidos.length > 1) {
    lineas.push(`Total de los ${pedidos.length} pedidos: ${monto(total)}`);
    lineas.push('');
  }

  if (sinProveedor > 0) {
    lineas.push('Sin proveedor asignado');
    for (const orden of huerfanos) {
      for (const item of orden.items) {
        lineas.push(`  - ${item.nombre}: ${existencia(item.sku, stockPorSku)}faltan ${item.cantidadSugerida}`);
      }
    }
    lineas.push('  Estos no se pueden pedir todavia. Asigneles un proveedor en Inventario.');
    lineas.push('');
  }

  lineas.push(`${productos} producto${productos === 1 ? '' : 's'} bajo el punto de reorden.`);
  lineas.push('');
  lineas.push('Aviso automatico de GesTock. Puede cambiar el dia y la hora en Configuracion.');

  const filas = pedidos
    .map((orden) => {
      const items = orden.items
        .map(
          (item) =>
            `<li>${escapar(item.nombre)}: ${escapar(existencia(item.sku, stockPorSku))}conviene pedir <strong>${item.cantidadSugerida}</strong></li>`
        )
        .join('');
      const visita = orden.proximaVisitaTexto ? ` <span style="color:#556">(${escapar(orden.proximaVisitaTexto)})</span>` : '';
      return `
      <tr><td style="padding:14px 0;border-bottom:1px solid #e3e8ef">
        <div style="font-weight:600;color:#1f3a5f">${escapar(orden.proveedorNombre)}${visita}</div>
        <ul style="margin:8px 0 6px 18px;padding:0;color:#333">${items}</ul>
        <div style="color:#556">Total estimado: <strong>${monto(orden.totalEstimado)}</strong></div>
      </td></tr>`;
    })
    .join('');

  const filasSinProveedor = huerfanos
    .flatMap((orden) => orden.items)
    .map(
      (item) =>
        `<li>${escapar(item.nombre)}: ${escapar(existencia(item.sku, stockPorSku))}faltan <strong>${item.cantidadSugerida}</strong></li>`
    )
    .join('');

  const bloqueSinProveedor =
    sinProveedor === 0
      ? ''
      : `
    <div style="margin:18px 0 0;padding:14px;border:1px solid #f0d9a8;border-radius:6px;background:#fdf7ea">
      <div style="font-weight:600;color:#7a5b16">Sin proveedor asignado</div>
      <ul style="margin:8px 0 6px 18px;padding:0;color:#333">${filasSinProveedor}</ul>
      <div style="color:#7a5b16;font-size:13px">Estos no se pueden pedir todavia. Asigneles un proveedor en Inventario.</div>
    </div>`;

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f6f8fb;font-family:Segoe UI,system-ui,sans-serif">
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:8px;padding:24px">
    <h1 style="margin:0 0 4px;font-size:19px;color:#1f3a5f">Pedido sugerido</h1>
    <p style="margin:0 0 16px;color:#556;font-size:14px">Esto es lo que conviene pedir segun el stock de hoy.</p>
    <table style="width:100%;border-collapse:collapse">${filas}</table>
    ${pedidos.length > 1 ? `<p style="margin:16px 0 0;color:#1f3a5f"><strong>Total de los ${pedidos.length} pedidos: ${monto(total)}</strong></p>` : ''}
    ${bloqueSinProveedor}
    <p style="margin:16px 0 0;color:#556;font-size:13px">
      ${productos} producto${productos === 1 ? '' : 's'} bajo el punto de reorden.
    </p>
    <p style="margin:20px 0 0;color:#889;font-size:12px">
      Aviso automatico de GesTock. Puede cambiar el dia y la hora en Configuracion.
    </p>
  </div>
</body></html>`;

  return { asunto, texto: lineas.join('\n'), html };
}
