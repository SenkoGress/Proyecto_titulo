import { BackoffConfig } from './types';

export const defaultBackoffConfig: BackoffConfig = {
  initialDelayMs: 1000,   // 1 segundo base
  maxDelayMs: 60000,      // 1 minuto máximo
  multiplier: 2.0,        // Duplicación exponencial
  jitterFactor: 0.1       // 10% de variación aleatoria para evitar efecto rebaño (thundering herd)
};

export class ExponentialBackoff {
  private config: BackoffConfig;

  constructor(customConfig?: Partial<BackoffConfig>) {
    this.config = {
      ...defaultBackoffConfig,
      ...customConfig
    };
  }

  public calculateDelay(attempt: number): number {
    if (attempt <= 0) {
      return 0;
    }

    const exponentialDelay = this.config.initialDelayMs * Math.pow(this.config.multiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);

    // Calcular jitter determinista o aleatorio acotado
    const jitterRange = cappedDelay * this.config.jitterFactor;
    const jitter = (Math.random() * 2 - 1) * jitterRange;

    const finalDelay = Math.max(0, Math.round(cappedDelay + jitter));
    return finalDelay;
  }

  public getNextRetryTimestamp(attempt: number, fromDate = new Date()): Date {
    const delay = this.calculateDelay(attempt);
    return new Date(fromDate.getTime() + delay);
  }

  public isRetryAllowed(attempt: number, maxAttempts = 5): boolean {
    return attempt < maxAttempts;
  }
}

export const defaultBackoff = new ExponentialBackoff();
