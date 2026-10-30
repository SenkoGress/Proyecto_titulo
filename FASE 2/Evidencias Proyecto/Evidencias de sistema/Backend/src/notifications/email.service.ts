import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../utils/logger';

export interface MensajeCorreo {
  para: string;
  asunto: string;
  texto: string;
  html?: string;
}

export interface ResultadoEnvio {
  enviado: boolean;
  mensaje: string;
  destinatario: string;
  /** Identificador que devuelve el servidor de correo, util para rastrear una entrega. */
  id?: string;
}

/**
 * Transporte de correo sobre SMTP.
 *
 * La regla que gobierna este servicio es la misma que el resto del sistema aplica a los servicios
 * externos: si no esta configurado, lo dice. Nunca informa un envio que no ocurrio. El metodo que
 * existia antes registraba "Simulating automated dispatch" y devolvia exito, de modo que el
 * usuario quedaba esperando un correo que nadie habia despachado.
 *
 * Las credenciales se leen del entorno y no se registran en el log en ningun caso.
 */
export class EmailService {
  private transporte: Transporter | null = null;

  constructor(
    private readonly host = process.env.SMTP_HOST,
    private readonly puerto = Number(process.env.SMTP_PORT || 587),
    private readonly usuario = process.env.SMTP_USER,
    private readonly clave = process.env.SMTP_PASSWORD,
    private readonly remitente = process.env.SMTP_FROM || process.env.SMTP_USER
  ) {}

  public estaConfigurado(): boolean {
    return Boolean(this.host && this.usuario && this.clave && this.remitente);
  }

  /** Describe que falta, sin revelar ningun valor. */
  public queFalta(): string[] {
    const faltantes: string[] = [];
    if (!this.host) faltantes.push('SMTP_HOST');
    if (!this.usuario) faltantes.push('SMTP_USER');
    if (!this.clave) faltantes.push('SMTP_PASSWORD');
    if (!this.remitente) faltantes.push('SMTP_FROM');
    return faltantes;
  }

  private obtenerTransporte(): Transporter {
    if (!this.transporte) {
      this.transporte = nodemailer.createTransport({
        host: this.host,
        port: this.puerto,
        // El puerto 465 habla TLS desde el saludo inicial; el 587 lo negocia despues
        secure: this.puerto === 465,
        auth: { user: this.usuario, pass: this.clave }
      });
    }
    return this.transporte;
  }

  public async enviar(mensaje: MensajeCorreo): Promise<ResultadoEnvio> {
    if (!this.estaConfigurado()) {
      const faltantes = this.queFalta().join(', ');
      logger.warn('EmailService', 'No hay servidor de correo configurado: no se envio nada', { faltantes });
      return {
        enviado: false,
        destinatario: mensaje.para,
        mensaje:
          'El envio de correo no esta configurado en este servidor. ' +
          `Faltan las variables de entorno: ${faltantes}.`
      };
    }

    if (!mensaje.para) {
      return {
        enviado: false,
        destinatario: '',
        mensaje: 'No hay una direccion de correo configurada para el local.'
      };
    }

    try {
      const info = await this.obtenerTransporte().sendMail({
        from: this.remitente,
        to: mensaje.para,
        subject: mensaje.asunto,
        text: mensaje.texto,
        html: mensaje.html
      });

      logger.info('EmailService', 'Correo despachado', {
        destinatario: mensaje.para,
        asunto: mensaje.asunto,
        id: info.messageId
      });

      return {
        enviado: true,
        destinatario: mensaje.para,
        mensaje: `Correo enviado a ${mensaje.para}`,
        id: info.messageId
      };
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      logger.error('EmailService', 'El servidor de correo rechazo el envio', error);
      return {
        enviado: false,
        destinatario: mensaje.para,
        mensaje: `No se pudo enviar el correo: ${detalle}`
      };
    }
  }

  /** Comprueba las credenciales contra el servidor, sin despachar ningun mensaje. */
  public async verificar(): Promise<ResultadoEnvio> {
    if (!this.estaConfigurado()) {
      return {
        enviado: false,
        destinatario: '',
        mensaje: `Faltan las variables de entorno: ${this.queFalta().join(', ')}.`
      };
    }

    try {
      await this.obtenerTransporte().verify();
      return { enviado: true, destinatario: '', mensaje: 'El servidor de correo respondio correctamente.' };
    } catch (error) {
      return {
        enviado: false,
        destinatario: '',
        mensaje: `El servidor de correo no acepto las credenciales: ${
          error instanceof Error ? error.message : String(error)
        }`
      };
    }
  }
}

export const defaultEmailService = new EmailService();
