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

  // Colores de la interfaz (front-end/src/app/theme/theme.ts). Los clientes de correo solo
  // respetan estilos en linea y maquetacion con tablas.
  const TH = 'padding:8px 12px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0';
  const TD = 'padding:10px 12px;font-size:14px;color:#0f172a;border-bottom:1px solid #e2e8f0';

  const celdaStock = (sku: string): string => {
    if (!stockPorSku.has(sku)) return `<td align="center" style="${TD};color:#64748b">&mdash;</td>`;
    const unidades = Number(stockPorSku.get(sku));
    return unidades === 0
      ? `<td align="center" style="${TD};color:#dc2626;font-weight:600">Agotado</td>`
      : `<td align="center" style="${TD}">${unidades}</td>`;
  };

  const filas = pedidos
    .map((orden) => {
      const items = orden.items
        .map(
          (item) => `
        <tr>
          <td style="${TD}">${escapar(item.nombre)}</td>
          ${celdaStock(item.sku)}
          <td align="center" style="${TD};font-weight:700;color:#2563eb">${item.cantidadSugerida}</td>
          <td align="right" style="${TD}">${monto(item.subtotalEstimado)}</td>
        </tr>`
        )
        .join('');
      const visita = orden.proximaVisitaTexto
        ? `<span style="display:inline-block;margin-left:8px;padding:2px 10px;border-radius:10px;background:#2563eb;color:#ffffff;font-size:12px;font-weight:600">${escapar(orden.proximaVisitaTexto)}</span>`
        : '';
      return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #e2e8f0;border-collapse:collapse">
      <tr><td colspan="4" style="padding:12px;background:#eff6ff;border-bottom:1px solid #e2e8f0;font-size:15px;font-weight:700;color:#0f172a">${escapar(orden.proveedorNombre)}${visita}</td></tr>
      <tr>
        <th align="left" style="${TH}">Producto</th>
        <th align="center" style="${TH}">Stock actual</th>
        <th align="center" style="${TH}">Pedir</th>
        <th align="right" style="${TH}">Subtotal</th>
      </tr>${items}
      <tr>
        <td colspan="3" align="right" style="padding:10px 12px;font-size:13px;color:#64748b">Total estimado</td>
        <td align="right" style="padding:10px 12px;font-size:15px;font-weight:700;color:#0f172a">${monto(orden.totalEstimado)}</td>
      </tr>
    </table>`;
    })
    .join('');

  const filasSinProveedor = huerfanos
    .flatMap((orden) => orden.items)
    .map(
      (item) => `
      <tr>
        <td style="${TD}">${escapar(item.nombre)}</td>
        ${celdaStock(item.sku)}
        <td align="center" style="${TD};font-weight:700;color:#d97706">${item.cantidadSugerida}</td>
      </tr>`
    )
    .join('');

  const TH_AVISO = TH.replace('#f8fafc', '#fffbeb').replace('#64748b', '#92400e');
  const bloqueSinProveedor =
    sinProveedor === 0
      ? ''
      : `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #fcd34d;border-collapse:collapse">
      <tr><td colspan="3" style="padding:12px;background:#fef3c7;font-size:15px;font-weight:700;color:#92400e">Sin proveedor asignado</td></tr>
      <tr>
        <th align="left" style="${TH_AVISO}">Producto</th>
        <th align="center" style="${TH_AVISO}">Stock actual</th>
        <th align="center" style="${TH_AVISO}">Faltan</th>
      </tr>${filasSinProveedor}
      <tr><td colspan="3" style="padding:10px 12px;font-size:13px;color:#92400e;background:#fffbeb">Estos productos no se pueden pedir todav&iacute;a. As&iacute;gneles un proveedor en Inventario.</td></tr>
    </table>`;

  const dato = (rotulo: string, valor: string, color = '#0f172a'): string => `
        <td width="33%" style="padding:12px;background:#f1f5f9;border:4px solid #ffffff">
          <div style="font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#64748b">${rotulo}</div>
          <div style="margin-top:4px;font-size:20px;font-weight:700;color:${color}">${valor}</div>
        </td>`;

  const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'long' }).format(new Date());

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-collapse:collapse">
    <tr><td style="padding:20px 28px;background:#0f172a;border-bottom:4px solid #2563eb">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:22px;font-weight:700;color:#ffffff">Ges<span style="color:#3b82f6">Tock</span></td>
        <td align="right" style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8">Aviso de reposici&oacute;n</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 6px;font-size:22px;color:#0f172a">${pedidos.length === 0 ? 'Productos por reponer' : 'Pedido sugerido'}</h1>
      <p style="margin:0 0 20px;font-size:14px;color:#64748b">Esto es lo que conviene pedir seg&uacute;n el stock de hoy, ${fecha}.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse"><tr>${dato('Proveedores', String(pedidos.length))}${dato('Productos', String(productos))}${dato('Total estimado', monto(total), '#2563eb')}
      </tr></table>
      ${filas}
      ${
        pedidos.length > 1
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#0f172a;border-collapse:collapse"><tr>
        <td style="padding:14px 16px;font-size:14px;color:#e2e8f0">Total de los ${pedidos.length} pedidos</td>
        <td align="right" style="padding:14px 16px;font-size:18px;font-weight:700;color:#ffffff">${monto(total)}</td>
      </tr></table>`
          : ''
      }
      ${bloqueSinProveedor}
      <p style="margin:0;font-size:13px;color:#64748b">${productos} producto${productos === 1 ? '' : 's'} bajo el punto de reorden.</p>
    </td></tr>
    <tr><td style="padding:16px 28px;background:#f1f5f9;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b">
      Este correo fue enviado autom&aacute;ticamente desde la aplicaci&oacute;n <strong style="color:#0f172a">GesTock</strong>,
      el sistema de inventario y ventas de su local. Puede cambiar el d&iacute;a y la hora del aviso en Configuraci&oacute;n.
    </td></tr>
  </table>
</body></html>`;

  return { asunto, texto: lineas.join('\n'), html };
}
