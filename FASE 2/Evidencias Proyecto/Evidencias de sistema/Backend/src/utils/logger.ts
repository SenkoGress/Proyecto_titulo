export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  meta?: Record<string, unknown>;
  error?: Error | unknown;
}

class Logger {
  private isTest = process.env.NODE_ENV === 'test';

  private format(entry: LogEntry): string {
    const metaStr = entry.meta ? ` | meta: ${JSON.stringify(entry.meta)}` : '';
    const errStr = entry.error ? ` | error: ${entry.error instanceof Error ? entry.error.stack || entry.error.message : String(entry.error)}` : '';
    return `[${entry.timestamp}] [${entry.level}] [${entry.context}]: ${entry.message}${metaStr}${errStr}`;
  }

  public info(context: string, message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      context,
      message,
      meta
    };
    if (!this.isTest || process.env.DEBUG_TESTS === 'true') {
      console.log(this.format(entry));
    }
  }

  public warn(context: string, message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      context,
      message,
      meta
    };
    console.warn(this.format(entry));
  }

  public error(context: string, message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      context,
      message,
      meta,
      error
    };
    console.error(this.format(entry));
  }

  public debug(context: string, message: string, meta?: Record<string, unknown>): void {
    if (process.env.DEBUG === 'true') {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.DEBUG,
        context,
        message,
        meta
      };
      console.debug(this.format(entry));
    }
  }
}

export const logger = new Logger();
