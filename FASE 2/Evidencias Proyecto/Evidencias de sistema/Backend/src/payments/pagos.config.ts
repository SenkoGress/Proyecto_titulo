/**
 * Datos de cobro de cada comercio. Se leen del entorno: en la aplicacion de escritorio, el proceso
 * principal los carga desde datos/pagos.json, en la carpeta del usuario, que no viaja en el
 * instalador ni se sincroniza con la nube.
 *
 *   simulado    cada pasarela aprueba sin salir del equipo (demostracion y pruebas)
 *   sandbox     llamadas reales al ambiente de pruebas del proveedor, sin dinero real
 *   produccion  la maquina del comercio cobra de verdad
 */
export type ModoPagos = 'simulado' | 'sandbox' | 'produccion';

export interface ConfigPagos {
  modo: ModoPagos;
  /** Espera maxima a que el cliente pase la tarjeta en la maquina. */
  esperaMaximaMs: number;
  transbank: { puerto: string | null };
  mercadoPago: { accessToken: string | null; terminalId: string | null; resultadoSandbox: string | null };
  sumUp: {
    apiKey: string | null;
    merchantCode: string | null;
    readerId: string | null;
    affiliateKey: string | null;
    appId: string | null;
  };
}

const MODOS: ModoPagos[] = ['simulado', 'sandbox', 'produccion'];
const texto = (v?: string) => (v && v.trim() ? v.trim() : null);

export function configPagos(env: NodeJS.ProcessEnv = process.env): ConfigPagos {
  const modo = (env.PAGOS_MODO || 'simulado').trim().toLowerCase() as ModoPagos;
  if (!MODOS.includes(modo)) {
    throw new Error(`PAGOS_MODO="${env.PAGOS_MODO}" no es valido: use simulado, sandbox o produccion`);
  }
  return {
    modo,
    esperaMaximaMs: Number(env.PAGOS_ESPERA_MAXIMA_MS) || 120000,
    transbank: { puerto: texto(env.TBK_POS_PUERTO) },
    mercadoPago: {
      accessToken: texto(env.MP_ACCESS_TOKEN),
      // En sandbox, sin maquina fisica, Mercado Pago ofrece un terminal virtual
      terminalId: texto(env.MP_TERMINAL_ID) || (modo === 'sandbox' ? 'NEWLAND_N950__SBX0000001' : null),
      resultadoSandbox: texto(env.MP_SANDBOX_RESULTADO),
    },
    sumUp: {
      apiKey: texto(env.SUMUP_API_KEY),
      merchantCode: texto(env.SUMUP_MERCHANT_CODE),
      readerId: texto(env.SUMUP_READER_ID),
      affiliateKey: texto(env.SUMUP_AFFILIATE_KEY),
      appId: texto(env.SUMUP_APP_ID),
    },
  };
}

/** Lanza un error que nombra lo que falta, para que el cajero vea por que no se cobro. */
export function exigir(valores: Record<string, string | null>, proveedor: string): void {
  const faltan = Object.entries(valores).filter(([, v]) => !v).map(([k]) => k);
  if (faltan.length) {
    throw new Error(`Falta configurar ${faltan.join(', ')} para cobrar con ${proveedor}`);
  }
}

export const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
