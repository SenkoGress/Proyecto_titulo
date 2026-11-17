function escapar(texto: string): string {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Correo con el pedido que el local le escribe a un proveedor. El texto lo reviso el usuario. */
export function redactarPedidoProveedor(nombreProveedor: string, mensaje: string): {
  asunto: string;
  texto: string;
  html: string;
} {
  const parrafos = escapar(mensaje.trim()).replace(/\r?\n/g, '<br>');

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-collapse:collapse">
    <tr><td style="padding:20px 28px;background:#0f172a;border-bottom:4px solid #2563eb">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:22px;font-weight:700;color:#ffffff">Ges<span style="color:#3b82f6">Tock</span></td>
        <td align="right" style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8">Pedido de reposici&oacute;n</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:28px;font-size:15px;line-height:1.6;color:#0f172a">${parrafos}</td></tr>
    <tr><td style="padding:16px 28px;background:#f1f5f9;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b">
      Este pedido fue enviado desde la aplicaci&oacute;n <strong style="color:#0f172a">GesTock</strong> por el local que lo firma.
      Para confirmarlo, responda a este correo.
    </td></tr>
  </table>
</body></html>`;

  return { asunto: `Pedido de reposicion para ${nombreProveedor}`, texto: mensaje.trim(), html };
}
