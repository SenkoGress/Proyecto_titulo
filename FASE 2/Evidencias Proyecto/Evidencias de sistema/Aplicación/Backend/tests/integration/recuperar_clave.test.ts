import http from 'http';
import bcrypt from 'bcryptjs';
import app from '../../src/index';
import { initializeDatabase } from '../../src/database/init-db';
import { defaultSqliteClient } from '../../src/database/sqlite/client';
import { defaultEmailService, MensajeCorreo } from '../../src/notifications/email.service';
import { RecuperacionClave, TOPE_INTENTOS_CODIGO, VIGENCIA_CODIGO_MIN } from '../../src/auth/recuperacion-clave';

describe('Recuperar la clave del administrador por correo', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const CLAVE_VIEJA = 'clave-vieja-1';
  let servidor: http.Server;
  let base: string;
  let enviados: MensajeCorreo[] = [];
  let correoConfigurado = true;
  let correoSale = true;
  let servidorResponde = true;

  const usuario = (id: string, email: string, rol: string) =>
    defaultSqliteClient.execute(
      `INSERT OR REPLACE INTO usuarios (id, tenant_id, nombre, email, password_hash, rol, activo)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [id, tenantId, `Prueba ${rol}`, email, bcrypt.hashSync(CLAVE_VIEJA, 4), rol]
    );

  const post = async (ruta: string, cuerpo: unknown) => {
    const respuesta = await fetch(`${base}/api/v1/auth/${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    });
    return { status: respuesta.status, data: (await respuesta.json()) as any };
  };

  const codigoDelUltimoCorreo = () => /(\d{6})/.exec(enviados[enviados.length - 1].texto)![1];

  beforeAll(async () => {
    await initializeDatabase();
    usuario('77777777-0000-0000-0000-0000000000a1', 'duena.recupera@prueba.cl', 'admin');
    usuario('77777777-0000-0000-0000-0000000000a2', 'socio.recupera@prueba.cl', 'admin');
    usuario('77777777-0000-0000-0000-0000000000a3', 'tercero.recupera@prueba.cl', 'admin');
    usuario('77777777-0000-0000-0000-0000000000c1', 'cajero.recupera@prueba.cl', 'cajero');

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
    correoSale = true;
    servidorResponde = true;
    // la configuracion de jest restaura los dobles entre pruebas: se arman en cada una
    jest.spyOn(defaultEmailService, 'estaConfigurado').mockImplementation(() => correoConfigurado);
    jest.spyOn(defaultEmailService, 'verificar').mockImplementation(async () => (
      { enviado: servidorResponde, destinatario: '', mensaje: '' }
    ));
    jest.spyOn(defaultEmailService, 'enviar').mockImplementation(async (mensaje) => {
      if (correoSale) enviados.push(mensaje);
      return { enviado: correoSale, destinatario: mensaje.para, mensaje: '' };
    });
  });

  test('a un cajero o a un correo desconocido les responde igual que a un administrador y no envia nada', async () => {
    const cajero = await post('password/olvide', { email: 'cajero.recupera@prueba.cl' });
    const nadie = await post('password/olvide', { email: 'no.existe@prueba.cl' });

    expect(cajero.status).toBe(200);
    expect(nadie.status).toBe(200);
    expect(cajero.data.message).toBe(nadie.data.message);
    expect(enviados).toHaveLength(0);
  });

  test('el administrador recibe el codigo, cambia la clave y el codigo no sirve dos veces', async () => {
    const email = 'duena.recupera@prueba.cl';
    const pedido = await post('password/olvide', { email });
    expect(pedido.status).toBe(200);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].para).toBe(email);
    expect(enviados[0].html).toContain('GesTock');
    const codigo = codigoDelUltimoCorreo();

    const repetido = await post('password/olvide', { email });
    expect(repetido.status).toBe(200);
    expect(enviados).toHaveLength(1);

    const errado = await post('password/restablecer', { email, codigo: codigo === '000000' ? '000001' : '000000', password_nueva: 'clave-nueva-1' });
    expect(errado.status).toBe(400);

    const corta = await post('password/restablecer', { email, codigo, password_nueva: 'corta' });
    expect(corta.status).toBe(400);

    const bien = await post('password/restablecer', { email, codigo, password_nueva: 'clave-nueva-1' });
    expect(bien.status).toBe(200);

    expect((await post('login', { email, password: 'clave-nueva-1' })).status).toBe(200);
    expect((await post('login', { email, password: CLAVE_VIEJA })).status).toBe(401);
    expect((await post('password/restablecer', { email, codigo, password_nueva: 'otra-clave-22' })).status).toBe(400);
  });

  test('un cajero no restablece su clave aunque invente un codigo', async () => {
    const intento = await post('password/restablecer', {
      email: 'cajero.recupera@prueba.cl', codigo: '123456', password_nueva: 'clave-nueva-1'
    });
    expect(intento.status).toBe(400);
    expect((await post('login', { email: 'cajero.recupera@prueba.cl', password: CLAVE_VIEJA })).status).toBe(200);
  });

  test('tras cinco codigos errados se bloquea, y el correcto ya no abre', async () => {
    const email = 'socio.recupera@prueba.cl';
    await post('password/olvide', { email });
    const codigo = codigoDelUltimoCorreo();
    const errado = codigo === '000000' ? '000001' : '000000';

    let ultimo = 0;
    for (let i = 0; i < TOPE_INTENTOS_CODIGO; i++) {
      ultimo = (await post('password/restablecer', { email, codigo: errado, password_nueva: 'clave-nueva-1' })).status;
    }
    expect(ultimo).toBe(429);
    expect((await post('password/restablecer', { email, codigo, password_nueva: 'clave-nueva-1' })).status).toBe(429);
    expect((await post('login', { email, password: CLAVE_VIEJA })).status).toBe(200);
  });

  test('sin correo configurado o sin servidor de correo responde igual para cualquier correo', async () => {
    const admin = 'tercero.recupera@prueba.cl';
    const nadie = 'no.existe@prueba.cl';

    correoConfigurado = false;
    expect((await post('password/olvide', { email: admin })).status).toBe(503);
    expect((await post('password/olvide', { email: nadie })).status).toBe(503);

    correoConfigurado = true;
    servidorResponde = false;
    const conCuenta = await post('password/olvide', { email: admin });
    const sinCuenta = await post('password/olvide', { email: nadie });
    expect(conCuenta.status).toBe(502);
    expect(sinCuenta.status).toBe(502);
    expect(conCuenta.data).toEqual(sinCuenta.data);
    expect(enviados).toHaveLength(0);
  });

  test('si el envio falla responde como siempre y no deja un codigo vivo', async () => {
    const email = 'tercero.recupera@prueba.cl';

    correoSale = false;
    const fallido = await post('password/olvide', { email });
    const nadie = await post('password/olvide', { email: 'no.existe@prueba.cl' });
    expect(fallido.status).toBe(200);
    expect(fallido.data).toEqual(nadie.data);
    await new Promise((listo) => setImmediate(listo));

    // el codigo fallido se anulo: se puede pedir otro de inmediato, sin esperar el minuto
    correoSale = true;
    expect((await post('password/olvide', { email })).status).toBe(200);
    expect(enviados).toHaveLength(1);
  });

  test('el codigo vence a los quince minutos', () => {
    let ahora = 1_000_000;
    const recuperacion = new RecuperacionClave(() => ahora);
    const codigo = recuperacion.emitir('u1')!;

    expect(codigo).toMatch(/^\d{6}$/);
    expect(recuperacion.emitir('u1')).toBeNull();

    ahora += VIGENCIA_CODIGO_MIN * 60 * 1000 + 1;
    expect(recuperacion.canjear('u1', codigo)).toBe('invalido');
  });
});
