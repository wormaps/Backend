export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, string | number | boolean | undefined>;

export interface LoggerPort {
  log(level: LogLevel, message: string, context?: LogContext): void;
}

export class ConsoleLogger implements LoggerPort {
  log(level: LogLevel, message: string, context: LogContext = {}): void {
    const payload = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
    console[level === 'debug' ? 'log' : level](`[${level}] ${message}${payload}`);
  }
}
