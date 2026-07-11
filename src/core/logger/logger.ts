export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

export interface LoggerConfig {
  minLevel: LogLevel;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: unknown;
}

export class Logger {
  private readonly config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      minLevel: config?.minLevel ?? LogLevel.Debug,
    };
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.write(LogLevel.Debug, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.write(LogLevel.Info, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.write(LogLevel.Warn, message, context);
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    this.write(LogLevel.Error, message, { ...context, error: this.serializeError(error) });
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (level < this.config.minLevel) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context && Object.keys(context).length > 0 && { context }),
    };

    const output = JSON.stringify(entry);

    switch (level) {
      case LogLevel.Error:
        console.error(output);
        break;
      case LogLevel.Warn:
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  private serializeError(error: unknown): Record<string, unknown> | string | undefined {
    if (!error) return undefined;
    if (error instanceof Error) {
      return { name: error.name, message: error.message, stack: error.stack };
    }
    if (typeof error === "object") return error as Record<string, unknown>;
    return String(error);
  }

  child(context: Record<string, unknown>): Logger {
    const child = new Logger(this.config);
    const originalWrite = child.write.bind(child);
    child.write = (level, message, ctx) =>
      originalWrite(level, message, { ...context, ...ctx });
    return child;
  }
}
