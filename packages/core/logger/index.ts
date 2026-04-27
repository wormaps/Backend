export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, string | number | boolean | undefined | null>;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}

export class BunLogger implements Logger {
  private level: LogLevel;
  private service: string;
  private baseContext: LogContext;

  constructor(options: { level?: LogLevel; service: string }, baseContext?: LogContext) {
    this.level = options.level ?? 'info';
    this.service = options.service;
    this.baseContext = baseContext ?? {};
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.level];
  }

  private log(level: LogLevel, message: string, extraContext?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const payload = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      ...this.baseContext,
      ...extraContext,
    };

    const line = JSON.stringify(payload);
    switch (level) {
      case 'error':
        console.error(line);
        break;
      case 'warn':
        console.warn(line);
        break;
      default:
        console.log(line);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  child(context: LogContext): Logger {
    return new BunLogger(
      { level: this.level, service: this.service },
      { ...this.baseContext, ...context },
    );
  }
}
