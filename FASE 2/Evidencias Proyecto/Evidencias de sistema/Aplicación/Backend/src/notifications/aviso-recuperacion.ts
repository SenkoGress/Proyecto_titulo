import { VIGENCIA_CODIGO_MIN } from '../auth/recuperacion-clave';

function escapar(texto: string): string {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Correo con el codigo para restablecer la clave. Mismos colores que el aviso de reposicion. */
export function redactarCodigoRecuperacion(nombre: string, codigo: string): {
  asunto: string;
  texto: string;
  html: string;
} {
  const texto = [
    `Hola, ${nombre}.`,
    '',
    `Tu codigo para crear una clave nueva en GesTock es: ${codigo}`,
    `Vence en ${VIGENCIA_CODIGO_MIN} minutos y sirve una sola vez.`,
    '',
    'Si no lo pediste, ignora este correo: tu clave sigue siendo la misma.',
    '',
    'Correo automatico de GesTock.'
  ].join('\n');

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-collapse:collapse">
    <tr><td style="padding:20px 28px;background:#0f172a;border-bottom:4px solid #2563eb">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:22px;font-weight:700;color:#ffffff">Ges<span style="color:#3b82f6">Tock</span></td>
        <td align="right" style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8">Recuperar la clave</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 6px;font-size:22px;color:#0f172a">Tu c&oacute;digo de recuperaci&oacute;n</h1>
      <p style="margin:0 0 20px;font-size:14px;color:#64748b">Hola, ${escapar(nombre)}. Escribe este c&oacute;digo en la pantalla de ingreso de GesTock para crear una clave nueva.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse"><tr>
        <td align="center" style="padding:18px;background:#eff6ff;border:1px solid #bfdbfe;font-family:Consolas,Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:.3em;color:#2563eb">${escapar(codigo)}</td>
      </tr></table>
      <p style="margin:0 0 8px;font-size:14px;color:#0f172a">Vence en <strong>${VIGENCIA_CODIGO_MIN} minutos</strong> y sirve una sola vez.</p>
      <p style="margin:0;font-size:13px;color:#64748b">Si no lo pediste, ignora este correo: tu clave sigue siendo la misma.</p>
    </td></tr>
    <tr><td style="padding:16px 28px;background:#f1f5f9;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b">
      Este correo fue enviado autom&aacute;ticamente desde la aplicaci&oacute;n <strong style="color:#0f172a">GesTock</strong>,
      el sistema de inventario y ventas de su local.
    </td></tr>
  </table>
</body></html>`;

  return { asunto: 'Tu codigo para recuperar la clave de GesTock', texto, html };
}
