import { defaultSqliteClient, SqliteClient } from '../database/sqlite/client';
import { defaultTenantConfigService, TenantConfigService } from '../config/tenant-config.service';
import { defaultReplenishmentService, ReplenishmentService } from '../replenishment/replenishment.service';
import { logger } from '../utils/logger';

const UN_MINUTO_MS = 60_000;

/**
 * Intentos de despacho por dia y espera entre uno y otro. Reintentar cada minuto hasta medianoche
 * no sirve: si el correo no sale por falta de internet, lo que falta no se arregla en un minuto, y
 * la insistencia solo llena el registro de errores. Cinco intentos cada media hora cubren dos
 * horas, que es margen suficiente para una caida pasajera; agotados, el dia se cierra y las
 * ordenes quedan para revision manual.
 */
export const TOPE_INTENTOS_AVISO = 5;
export const ESPERA_ENTRE_INTENTOS_MIN = 30;

export interface RevisionAviso {
  tenantId: string;
  despachado: boolean;
  motivo: string;
}

/** Fecha local en formato YYYY-MM-DD. No se usa toISOString porque ese convierte a UTC. */
function fechaLocal(momento: Date): string {
  const mes = String(momento.getMonth() + 1).padStart(2, '0');
  const dia = String(momento.getDate()).padStart(2, '0');
  return `${momento.getFullYear()}-${mes}-${dia}`;
}

/** Dia de la semana en norma ISO: 1 lunes, 7 domingo. getDay devuelve 0 para domingo. */
function diaIso(momento: Date): number {
  return momento.getDay() === 0 ? 7 : momento.getDay();
}

function minutosDelDia(momento: Date): number {
  return momento.getHours() * 60 + momento.getMinutes();
}

function minutosDeHora(hora: string): number {
  const [h, m] = hora.split(':');
  return Number(h) * 60 + Number(m);
}

/**
 * Minutos transcurridos desde una marca ISO, o null si no hay marca previa o es ilegible. Un
 * resultado negativo significa que la marca quedo en el futuro, por un cambio de hora del equipo:
 * quien llama no espera por ella, porque esperar dejaria al local sin aviso el resto del dia.
 */
function minutosDesde(marcaIso: string, ahora: Date): number | null {
  if (!marcaIso) return null;

  const marca = new Date(marcaIso);
  if (Number.isNaN(marca.getTime())) return null;

  return Math.floor((ahora.getTime() - marca.getTime()) / 60_000);
}

/**
 * Despacha el aviso de reposicion el dia y la hora que configuro el local.
 *
 * Dos decisiones gobiernan este componente, y las dos vienen de como se usa el sistema en un
 * minimarket:
 *
 * El aviso se despacha si la hora ya paso y ese dia todavia no se envio, no solo si la hora
 * coincide al minuto. El computador del local se apaga de noche y se enciende al abrir, de modo
 * que exigir coincidencia exacta significaria que el aviso de las 08:00 no sale nunca si el
 * local abre 08:30.
 *
 * La marca de envio se guarda en la base, no en memoria. Un reinicio a media manana no debe
 * provocar un segundo correo por el mismo dia.
 *
 * Y el reintento es acotado y espaciado. Reintentar cada minuto mientras el correo no salga
 * mantenia el dia abierto hasta medianoche: el despacho volvia a calcular y a grabar las ordenes
 * en cada pasada, de modo que un local sin internet acumulaba miles de ordenes en un dia por el
 * solo hecho de tener el aviso activado.
 */
export class ProgramadorAvisos {
  private reloj: NodeJS.Timeout | null = null;

  constructor(
    private readonly sqliteClient: SqliteClient = defaultSqliteClient,
    private readonly configService: TenantConfigService = defaultTenantConfigService,
    private readonly replenishmentService: ReplenishmentService = defaultReplenishmentService
  ) {}

  public iniciar(intervaloMs: number = UN_MINUTO_MS): void {
    if (this.reloj) return;
    this.reloj = setInterval(() => {
      this.revisar().catch((err) => {
        logger.error('ProgramadorAvisos', 'La revision programada termino con error', err);
      });
    }, intervaloMs);
    // Sin unref el proceso no termina nunca, y las pruebas quedarian colgadas
    this.reloj.unref?.();
    logger.info('ProgramadorAvisos', 'Revision del aviso de reposicion activa', {
      cadaSegundos: Math.round(intervaloMs / 1000)
    });
  }

  public detener(): void {
    if (!this.reloj) return;
    clearInterval(this.reloj);
    this.reloj = null;
  }

  public async revisar(ahora: Date = new Date()): Promise<RevisionAviso[]> {
    const revisiones: RevisionAviso[] = [];

    for (const tenantId of this.locales()) {
      try {
        revisiones.push(await this.revisarLocal(tenantId, ahora));
      } catch (err) {
        revisiones.push({
          tenantId,
          despachado: false,
          motivo: err instanceof Error ? err.message : String(err)
        });
      }
    }

    return revisiones;
  }

  private locales(): string[] {
    try {
      return this.sqliteClient.query<{ id: string }>('SELECT id FROM tenants').map((t) => t.id);
    } catch (err) {
      logger.warn('ProgramadorAvisos', 'No se pudo listar los locales', {
        error: err instanceof Error ? err.message : String(err)
      });
      return [];
    }
  }

  private async revisarLocal(tenantId: string, ahora: Date): Promise<RevisionAviso> {
    const activo = await this.configService.getAutoSendOrders(tenantId);
    if (!activo) {
      return { tenantId, despachado: false, motivo: 'el envio automatico esta desactivado' };
    }

    const destinatario = await this.configService.getOrderNotificationEmail(tenantId);
    if (!destinatario) {
      return { tenantId, despachado: false, motivo: 'el local no tiene un correo configurado' };
    }

    const dia = await this.configService.getDiaEnvio(tenantId);
    if (diaIso(ahora) !== dia) {
      return { tenantId, despachado: false, motivo: 'hoy no corresponde' };
    }

    const hora = await this.configService.getHoraEnvio(tenantId);
    if (minutosDelDia(ahora) < minutosDeHora(hora)) {
      return { tenantId, despachado: false, motivo: `la hora configurada (${hora}) todavia no llega` };
    }

    const hoy = fechaLocal(ahora);
    if ((await this.configService.getUltimoAvisoEnviado(tenantId)) === hoy) {
      return { tenantId, despachado: false, motivo: 'el aviso de hoy ya salio' };
    }

    const intentos = await this.configService.getIntentosAviso(tenantId);
    const deHoy = intentos.fecha === hoy ? intentos : { fecha: hoy, intentos: 0, ultimoIntento: '' };

    if (deHoy.intentos >= TOPE_INTENTOS_AVISO) {
      return { tenantId, despachado: false, motivo: 'se agotaron los intentos de hoy' };
    }

    const espera = minutosDesde(deHoy.ultimoIntento, ahora);
    if (espera !== null && espera >= 0 && espera < ESPERA_ENTRE_INTENTOS_MIN) {
      return {
        tenantId,
        despachado: false,
        motivo: `el intento anterior fue hace ${espera} minutos, se espera ${ESPERA_ENTRE_INTENTOS_MIN}`
      };
    }

    let resultado;
    try {
      resultado = await this.replenishmentService.despacharAvisoReposicion(tenantId);
    } catch (err) {
      // Un fallo del propio despacho tambien consume un intento. Si no, el tope cubriria solo el
      // correo que no sale y una excepcion repetida volveria a dejar el dia abierto hasta
      // medianoche, escribiendo un error por minuto.
      const registro = await this.configService.registrarIntentoAviso(tenantId, hoy, ahora);
      const detalle = err instanceof Error ? err.message : String(err);

      if (registro.intentos >= TOPE_INTENTOS_AVISO) {
        await this.configService.marcarAvisoEnviado(tenantId, hoy);
      }

      return {
        tenantId,
        despachado: false,
        motivo: `el despacho fallo: ${detalle} (intento ${registro.intentos} de ${TOPE_INTENTOS_AVISO})`
      };
    }

    if (resultado.orders.length === 0) {
      // Sin nada bajo el punto de reorden no se manda un correo vacio, pero el dia se marca
      // igual: la revision ya ocurrio y repetirla cada minuto hasta medianoche no aporta.
      await this.configService.marcarAvisoEnviado(tenantId, hoy);
      return { tenantId, despachado: false, motivo: 'no hay productos bajo el punto de reorden' };
    }

    const despacho = resultado.despacho;
    if (despacho?.sent) {
      await this.configService.marcarAvisoEnviado(tenantId, hoy);
      return { tenantId, despachado: true, motivo: despacho.message };
    }

    const registro = await this.configService.registrarIntentoAviso(tenantId, hoy, ahora);
    const motivo = despacho?.message || 'el aviso no se pudo despachar';

    if (registro.intentos >= TOPE_INTENTOS_AVISO) {
      // Agotados los intentos se cierra el dia: dejarlo abierto significaria reintentar hasta
      // medianoche, y declarar el aviso como pendiente de salir cuando ya no va a salir.
      await this.configService.marcarAvisoEnviado(tenantId, hoy);
      logger.warn('ProgramadorAvisos', 'El aviso de reposicion no se pudo despachar hoy', {
        tenantId,
        intentos: registro.intentos,
        motivo
      });
      return {
        tenantId,
        despachado: false,
        motivo: `${motivo} (intento ${registro.intentos} de ${TOPE_INTENTOS_AVISO}: el aviso de hoy queda sin enviar)`
      };
    }

    return {
      tenantId,
      despachado: false,
      motivo: `${motivo} (intento ${registro.intentos} de ${TOPE_INTENTOS_AVISO})`
    };
  }
}

export const defaultProgramadorAvisos = new ProgramadorAvisos();
