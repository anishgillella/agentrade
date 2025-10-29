import pino from 'pino';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'pretty';
  serviceName: string;
}

/**
 * Create a production-grade logger with structured logging
 * Supports multiple outputs: stdout, files, remote logging
 */
export function createLogger(config: Partial<LoggerConfig> = {}): pino.Logger {
  const logLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;
  const logFormat = (process.env.LOG_FORMAT || 'json') as 'json' | 'pretty';
  const serviceName = config.serviceName || 'ai-trading';

  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Production: JSON format for log aggregation
  if (isProduction) {
    return pino({
      level: logLevel,
      base: {
        service: serviceName,
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },
    });
  }

  // Development: Pretty format for readability
  if (isDevelopment) {
    return pino(
      {
        level: logLevel,
        base: {
          service: serviceName,
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      logFormat === 'pretty'
        ? pino.transport({
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: false,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          })
        : undefined
    );
  }

  // Fallback
  return pino({ level: logLevel });
}

/**
 * Main logger instance - use this in your modules
 */
export const logger = createLogger({
  serviceName: 'ai-trading-system',
});

/**
 * Create child loggers for specific modules
 */
export function getLogger(moduleName: string): pino.Logger {
  return logger.child({ module: moduleName });
}

export default logger;
