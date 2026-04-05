import { Injectable, Logger } from '@nestjs/common';
import { RequestContext } from '../http/request-context';

type LogLevel = 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string | null;
  sceneId?: string;
  provider?: string;
  step?: string;
  source?: string;
  status?: string;
  error?: unknown;
  [key: string]: unknown;
}

@Injectable()
export class AppLoggerService {
  private readonly logger = new Logger('App');

  info(message: string, context: LogContext = {}): void {
    this.write('info', message, context);
  }

  warn(message: string, context: LogContext = {}): void {
    this.write('warn', message, context);
  }

  error(message: string, context: LogContext = {}): void {
    this.write('error', message, context);
  }

  fromRequest(context: RequestContext | null | undefined): Pick<LogContext, 'requestId'> {
    return {
      requestId: context?.requestId ?? null,
    };
  }

  private write(level: LogLevel, message: string, context: LogContext): void {
    const record = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.normalizeContext(context),
    };
    const serialized = JSON.stringify(record);

    if (level === 'error') {
      this.logger.error(serialized);
      return;
    }
    if (level === 'warn') {
      this.logger.warn(serialized);
      return;
    }
    this.logger.log(serialized);
  }

  private normalizeContext(context: LogContext): LogContext {
    if (!context.error) {
      return context;
    }

    const error = context.error;
    if (error instanceof Error) {
      return {
        ...context,
        error: {
          name: error.name,
          message: error.message,
        },
      };
    }

    return context;
  }
}
