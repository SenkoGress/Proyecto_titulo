import http from 'http';
import app from '../../src/index';
import { initializeDatabase } from '../../src/database/init-db';
import { defaultSqliteClient } from '../../src/database/sqlite/client';
import { defaultEmailService, MensajeCorreo } from '../../src/notifications/email.service';

describe('Pedido al proveedor por correo', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const CON_CORREO = '88888888-0000-0000-0000-0000000000a1';
  const SIN_CORREO = '88888888-0000-0000-0000-0000000000a2';
  let servidor: http.Server;
  let base: string;
  let enviados: MensajeCorreo[] = [];
  let correoConfigurado = true;

  const pedir = async (id: string, mensaje: unknown) => {
    const respuesta = await fetch(`${base}/api/v1/suppliers/${id}/pedido-correo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, mensaje })
    });
    return { status: respuesta.status, data: (await respuesta.json()) as any };
  };

  beforeAll(async () => {
    await initializeDatabase();
    const proveedor = (id: string, rut: string, email: string | null) =>
      defaultSqliteClient.execute(
        `INSERT OR REPLACE INTO proveedores (id, tenant_id, rut_proveedor, nombre_proveedores, dias_visita_proveedores, email)
         VALUES (?, ?, ?, ?, 'Lunes', ?)`,
        [id, tenantId, rut, `Proveedor ${rut}`, email]
      );
    proveedor(CON_CORREO, '77.100.001-1', 'ventas@proveedor-prueba.test');
    proveedor(SIN_CORREO, '77.100.002-K', null);

    await new Promise<void>((listo) => {
      servidor = app.listen(0, () => {
        base = `http://127.0.0.1:${(servidor.address() as any).port}`;
        listo();
      });
    });
  });

  afterAll((done) => {
    jest.restoreAllMocks();
    servidor.close(done);
  });

  beforeEach(() => {
    enviados = [];
    correoConfigurado = true;
    jest.spyOn(defaultEmailService, 'estaConfigurado').mockImplementation(() => correoConfigurado);
    jest.spyOn(defaultEmailService, 'enviar').mockImplementation(async (mensaje) => {
      enviados.push(mensaje);
      return { enviado: true, destinatario: mensaje.para, mensaje: '' };
    });
  });

  test('envia el mensaje revisado al correo del proveedor, sin dejar pasar HTML', async () => {
    const respuesta = await pedir(CON_CORREO, 'Hola, necesito:\n- Leche <b>entera</b> x 24');

    expect(respuesta.status).toBe(200);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].para).toBe('ventas@proveedor-prueba.test');
    expect(enviados[0].texto).toContain('Leche <b>entera</b> x 24');
    expect(enviados[0].html).toContain('Leche &lt;b&gt;entera&lt;/b&gt; x 24');
    expect(enviados[0].html).toContain('GesTock');
  });

  test('sin correo guardado, sin mensaje o sin proveedor no envia nada', async () => {
    expect((await pedir(SIN_CORREO, 'Hola')).status).toBe(400);
    expect((await pedir(CON_CORREO, '   ')).status).toBe(400);
    expect((await pedir('88888888-0000-0000-0000-00000000ffff', 'Hola')).status).toBe(404);
    expect(enviados).toHaveLength(0);
  });

  test('sin correo configurado en el equipo lo dice', async () => {
    correoConfigurado = false;
    expect((await pedir(CON_CORREO, 'Hola')).status).toBe(503);
    expect(enviados).toHaveLength(0);
  });
});
