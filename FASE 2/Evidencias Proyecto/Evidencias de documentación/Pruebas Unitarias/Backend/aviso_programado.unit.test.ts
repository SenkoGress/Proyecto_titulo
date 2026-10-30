import { EmailService } from '../../backend/src/notifications/email.service';
import { redactarAvisoReposicion } from '../../backend/src/notifications/aviso-reposicion';
import { ProgramadorAvisos } from '../../backend/src/notifications/programador-avisos';
import { TenantConfigService } from '../../backend/src/config/tenant-config.service';
import { ReplenishmentService } from '../../backend/src/replenishment/replenishment.service';
import { SuggestedPurchaseOrder } from '../../backend/src/replenishment/types';
import { defaultSqliteClient } from '../../backend/src/database/sqlite/client';
import { defaultPgClient } from '../../backend/src/database/postgres/client';
import { initializeDatabase } from '../../backend/src/database/init-db';

const TENANT = '00000000-0000-0000-0000-000000000001';

function orden(nombre: string, cantidad: number, total: number): SuggestedPurchaseOrder {
  return {
    orderId: 'ord-1',
    tenantId: TENANT,
    proveedorId: 'prov-1',
    proveedorNombre: 'Distribuidora Central',
    proveedorRut: '76.123.456-7',
    diasVisita: 'Lunes, Jueves',
    proximaVisitaTexto: 'pasa el jueves',
    diasHastaVisita: 2,
    estado: 'sugerida',
    fechaCreacion: '2026-10-30',
    totalEstimado: total,
    items: [
      {
        productId: 'p-1',
        sku: 'SKU-AV-01',
        nombre,
        cantidadSugerida: cantidad,
        precioUnitario: total / cantidad,
        subtotalEstimado: total
      }
    ]
  };
}

/**
 * El envio del aviso de reposicion estaba simulado: el metodo registraba "Simulating automated
 * dispatch", devolvia exito y marcaba las ordenes como enviadas en las dos bases. El local veia
 * el pedido como despachado y el proveedor nunca recibia nada.
 *
 * Estas pruebas fijan las tres reglas de la version real: no se informa un envio que no ocurrio,
 * el dia solo se marca cuando el correo salio, y el aviso no se repite si el proceso se reinicia.
 */
describe('Pruebas Unitarias: Aviso de Reposicion Programado', () => {
  describe('Redaccion del mensaje', () => {
    test('nombra al proveedor, el producto y la cantidad que conviene pedir', () => {
      const aviso = redactarAvisoReposicion([orden('Leche Entera 1L', 24, 16800)]);

      expect(aviso.asunto).toBe('Pedido sugerido para Distribuidora Central');
      expect(aviso.texto).toContain('Distribuidora Central (pasa el jueves)');
      expect(aviso.texto).toContain('Leche Entera 1L');
      expect(aviso.texto).toContain('conviene pedir 24');
    });

    test('incluye la existencia actual cuando se conoce, y la omite cuando no', () => {
      const conStock = redactarAvisoReposicion(
        [orden('Leche Entera 1L', 24, 16800)],
        new Map([['SKU-AV-01', 3]])
      );
      const agotado = redactarAvisoReposicion(
        [orden('Leche Entera 1L', 24, 16800)],
        new Map([['SKU-AV-01', 0]])
      );
      const sinDato = redactarAvisoReposicion([orden('Leche Entera 1L', 24, 16800)]);

      expect(conStock.texto).toContain('quedan 3,');
      expect(agotado.texto).toContain('agotado,');
      expect(sinDato.texto).not.toContain('quedan');
    });

    test('el nombre del producto se escapa en la version HTML', () => {
      const aviso = redactarAvisoReposicion([orden('Pan <especial> & Co', 10, 5000)]);

      expect(aviso.html).toContain('Pan &lt;especial&gt; &amp; Co');
      expect(aviso.html).not.toContain('<especial>');
    });
  });

  describe('Transporte de correo', () => {
    test('sin credenciales no informa un envio: declara que falta configurar', async () => {
      const servicio = new EmailService(undefined, 587, undefined, undefined, undefined);

      const resultado = await servicio.enviar({
        para: 'local@ejemplo.cl',
        asunto: 'Pedido sugerido',
        texto: 'cuerpo'
      });

      expect(resultado.enviado).toBe(false);
      expect(resultado.mensaje).toContain('SMTP_HOST');
      expect(servicio.estaConfigurado()).toBe(false);
    });

    test('configurado pero sin destinatario tampoco informa exito', async () => {
      const servicio = new EmailService('smtp.ejemplo.cl', 587, 'usuario', 'clave', 'avisos@ejemplo.cl');

      const resultado = await servicio.enviar({ para: '', asunto: 'Pedido', texto: 'cuerpo' });

      expect(resultado.enviado).toBe(false);
      expect(resultado.mensaje).toContain('direccion de correo');
    });
  });

  describe('Marcado de las ordenes', () => {
    beforeAll(async () => {
      defaultPgClient.tripCircuit();
      await initializeDatabase();
    });

    const PROVEEDOR = '00000000-0000-0000-0000-0000000avi01';

    beforeAll(() => {
      defaultSqliteClient.execute(
        `INSERT OR IGNORE INTO proveedores (id, tenant_id, rut_proveedor, nombre_proveedores, email)
         VALUES (?, ?, '76.123.456-7', 'Distribuidora Central', 'ventas@ejemplo.cl')`,
        [PROVEEDOR, TENANT]
      );
    });

    afterAll(() => {
      defaultSqliteClient.execute("DELETE FROM purchase_orders WHERE id IN ('ord-ok', 'ord-falla')");
      defaultSqliteClient.execute('DELETE FROM proveedores WHERE id = ?', [PROVEEDOR]);
    });

    function servicioConCorreo(enviado: boolean): ReplenishmentService {
      const correo = {
        async enviar() {
          return {
            enviado,
            destinatario: 'local@ejemplo.cl',
            mensaje: enviado ? 'Correo enviado' : 'No se pudo enviar el correo: el servidor rechazo el envio'
          };
        }
      } as unknown as EmailService;
      return new ReplenishmentService(defaultPgClient, defaultSqliteClient, undefined, correo);
    }

    function crearOrden(id: string): SuggestedPurchaseOrder {
      defaultSqliteClient.execute('DELETE FROM purchase_orders WHERE id = ?', [id]);
      defaultSqliteClient.execute(
        `INSERT INTO purchase_orders (id, tenant_id, supplier_id, estado, fecha_creacion, total_estimado)
         VALUES (?, ?, ?, 'sugerida', datetime('now'), 16800)`,
        [id, TENANT, PROVEEDOR]
      );
      const pedido = orden('Leche Entera 1L', 24, 16800);
      pedido.orderId = id;
      return pedido;
    }

    function estadoDe(id: string): string {
      const row = defaultSqliteClient.queryOne<{ estado: string }>(
        'SELECT estado FROM purchase_orders WHERE id = ?',
        [id]
      );
      return row?.estado || '';
    }

    test('si el correo sale, la orden queda enviada', async () => {
      const pedido = crearOrden('ord-ok');

      const resultado = await servicioConCorreo(true).sendPurchaseOrdersBatchEmail(
        TENANT,
        'local@ejemplo.cl',
        [pedido]
      );

      expect(resultado.sent).toBe(true);
      expect(estadoDe('ord-ok')).toBe('enviada');
    });

    test('si el correo no sale, la orden sigue sugerida y el resultado lo dice', async () => {
      const pedido = crearOrden('ord-falla');

      const resultado = await servicioConCorreo(false).sendPurchaseOrdersBatchEmail(
        TENANT,
        'local@ejemplo.cl',
        [pedido]
      );

      // Antes se marcaba 'enviada' igual, y el pedido desaparecia de las sugerencias sin que
      // el proveedor hubiera recibido nada
      expect(resultado.sent).toBe(false);
      expect(resultado.message).toContain('rechazo');
      expect(estadoDe('ord-falla')).toBe('sugerida');
    });
  });

  describe('Horario configurable', () => {
    test('rechaza un dia fuera de la norma ISO y una hora mal formada', async () => {
      const config = new TenantConfigService();

      await expect(config.setHorarioEnvio(TENANT, 8)).rejects.toThrow('entre 1 y 7');
      await expect(config.setHorarioEnvio(TENANT, 0)).rejects.toThrow('entre 1 y 7');
      await expect(config.setHorarioEnvio(TENANT, undefined, '25:00')).rejects.toThrow('HH:MM');
      await expect(config.setHorarioEnvio(TENANT, undefined, '8am')).rejects.toThrow('HH:MM');
    });
  });

  describe('Reloj del aviso', () => {
    const LUNES_9 = new Date(2026, 10, 2, 9, 0, 0);
    const LUNES_7 = new Date(2026, 10, 2, 7, 0, 0);
    const MARTES_9 = new Date(2026, 10, 3, 9, 0, 0);

    interface Guion {
      dia?: number;
      hora?: string;
      ultimo?: string;
      autoSend?: boolean;
      correo?: string;
      ordenes?: number;
      despachado?: boolean;
    }

    function programador(guion: Guion): {
      prog: ProgramadorAvisos;
      marcas: string[];
      generadas: number[];
    } {
      const marcas: string[] = [];
      const generadas: number[] = [];

      const config = {
        async getAutoSendOrders() {
          return guion.autoSend !== false;
        },
        async getOrderNotificationEmail() {
          return guion.correo !== undefined ? guion.correo : 'local@ejemplo.cl';
        },
        async getDiaEnvio() {
          return guion.dia ?? 1;
        },
        async getHoraEnvio() {
          return guion.hora ?? '08:00';
        },
        async getUltimoAvisoEnviado() {
          return guion.ultimo ?? '';
        },
        async marcarAvisoEnviado(_tenantId: string, fecha: string) {
          marcas.push(fecha);
        }
      } as unknown as TenantConfigService;

      const reposicion = {
        async generateSuggestedOrders() {
          const cantidad = guion.ordenes ?? 1;
          generadas.push(cantidad);
          return {
            orders: cantidad > 0 ? [orden('Leche Entera 1L', 24, 16800)] : [],
            lowStockAlerts: [],
            totalCritical: 0,
            emailDispatchStatus:
              cantidad > 0
                ? {
                    sent: guion.despachado !== false,
                    message: guion.despachado === false ? 'el servidor de correo no respondio' : 'Aviso enviado',
                    recipient: 'local@ejemplo.cl'
                  }
                : undefined
          };
        }
      } as unknown as ReplenishmentService;

      const sqlite = {
        query() {
          return [{ id: TENANT }];
        }
      } as unknown as typeof defaultSqliteClient;

      return { prog: new ProgramadorAvisos(sqlite, config, reposicion), marcas, generadas };
    }

    test('despacha el dia y a la hora configurados', async () => {
      const { prog, marcas } = programador({ dia: 1, hora: '08:00' });

      const [revision] = await prog.revisar(LUNES_9);

      expect(revision.despachado).toBe(true);
      expect(marcas).toEqual(['2026-11-02']);
    });

    test('no despacha si el dia no corresponde', async () => {
      const { prog, generadas } = programador({ dia: 1 });

      const [revision] = await prog.revisar(MARTES_9);

      expect(revision.despachado).toBe(false);
      expect(revision.motivo).toContain('hoy no corresponde');
      expect(generadas).toHaveLength(0);
    });

    test('no despacha antes de la hora configurada', async () => {
      const { prog } = programador({ dia: 1, hora: '08:00' });

      const [revision] = await prog.revisar(LUNES_7);

      expect(revision.despachado).toBe(false);
      expect(revision.motivo).toContain('08:00');
    });

    test('despacha aunque la hora ya haya pasado: el equipo del local estaba apagado', async () => {
      // 09:00 no coincide con 08:00. Exigir coincidencia al minuto dejaria al local sin aviso
      // cada vez que enciende el equipo despues de la hora configurada.
      const { prog } = programador({ dia: 1, hora: '08:00' });

      const [revision] = await prog.revisar(LUNES_9);

      expect(revision.despachado).toBe(true);
    });

    test('no repite el aviso si ya salio hoy', async () => {
      const { prog, generadas } = programador({ dia: 1, ultimo: '2026-11-02' });

      const [revision] = await prog.revisar(LUNES_9);

      expect(revision.despachado).toBe(false);
      expect(revision.motivo).toContain('ya salio');
      expect(generadas).toHaveLength(0);
    });

    test('si el correo falla no marca el dia, para reintentar cuando el servidor vuelva', async () => {
      const { prog, marcas } = programador({ dia: 1, despachado: false });

      const [revision] = await prog.revisar(LUNES_9);

      expect(revision.despachado).toBe(false);
      expect(marcas).toHaveLength(0);
    });

    test('sin productos bajo el punto de reorden no manda un correo vacio, pero cierra el dia', async () => {
      const { prog, marcas } = programador({ dia: 1, ordenes: 0 });

      const [revision] = await prog.revisar(LUNES_9);

      expect(revision.despachado).toBe(false);
      expect(revision.motivo).toContain('punto de reorden');
      expect(marcas).toEqual(['2026-11-02']);
    });

    test('respeta la bandera de envio automatico y la falta de correo', async () => {
      const apagado = programador({ autoSend: false });
      const sinCorreo = programador({ correo: '' });

      expect((await apagado.prog.revisar(LUNES_9))[0].motivo).toContain('desactivado');
      expect((await sinCorreo.prog.revisar(LUNES_9))[0].motivo).toContain('correo configurado');
      expect(apagado.generadas).toHaveLength(0);
      expect(sinCorreo.generadas).toHaveLength(0);
    });
  });
});
