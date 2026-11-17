import { createHash, randomInt, timingSafeEqual } from 'crypto';

export const VIGENCIA_CODIGO_MIN = 15;
export const TOPE_INTENTOS_CODIGO = 5;
const ESPERA_ENTRE_CODIGOS_MS = 60 * 1000;

interface CodigoPendiente {
  hash: Buffer;
  vence: number;
  intentos: number;
  emitido: number;
}

export type ResultadoCanje = 'ok' | 'invalido' | 'bloqueado';

function resumir(codigo: string): Buffer {
  return createHash('sha256').update(codigo).digest();
}

/**
 * Codigos de un solo uso para restablecer la clave del administrador.
 *
 * ponytail: viven en memoria, no en la base. Un codigo dura quince minutos y la caja es un solo
 * proceso, asi que reiniciar la aplicacion solo obliga a pedir otro. Si el servidor llegara a
 * correr en varias instancias, esto pasa a una tabla.
 */
export class RecuperacionClave {
  private readonly pendientes = new Map<string, CodigoPendiente>();

  constructor(private readonly ahora: () => number = Date.now) {}

  /** Devuelve el codigo en claro para enviarlo, o null si se pidio otro hace menos de un minuto. */
  public emitir(usuarioId: string): string | null {
    const previo = this.pendientes.get(usuarioId);
    if (previo && this.ahora() - previo.emitido < ESPERA_ENTRE_CODIGOS_MS) return null;

    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
    this.pendientes.set(usuarioId, {
      hash: resumir(codigo),
      vence: this.ahora() + VIGENCIA_CODIGO_MIN * 60 * 1000,
      intentos: 0,
      emitido: this.ahora()
    });
    return codigo;
  }

  /** Deja al usuario sin codigo: se usa cuando el correo no pudo salir. */
  public anular(usuarioId: string): void {
    this.pendientes.delete(usuarioId);
  }

  public canjear(usuarioId: string, codigo: string): ResultadoCanje {
    const pendiente = this.pendientes.get(usuarioId);
    if (!pendiente || this.ahora() > pendiente.vence) {
      this.pendientes.delete(usuarioId);
      return 'invalido';
    }
    if (pendiente.intentos >= TOPE_INTENTOS_CODIGO) return 'bloqueado';

    if (!timingSafeEqual(pendiente.hash, resumir(String(codigo).trim()))) {
      pendiente.intentos += 1;
      return pendiente.intentos >= TOPE_INTENTOS_CODIGO ? 'bloqueado' : 'invalido';
    }

    this.pendientes.delete(usuarioId);
    return 'ok';
  }
}

export const defaultRecuperacionClave = new RecuperacionClave();
