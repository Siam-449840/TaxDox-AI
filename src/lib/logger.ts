/**
 * TaxDox AI — Structured Logging (Section 12.1)
 *
 * Pino-style structured JSON logging with correlation IDs.
 * Every log includes: timestamp, level, message, correlationId, module, and context.
 *
 * In production: export to Grafana Loki / Datadog / Axiom.
 * In development: pretty-print to console.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  correlationId?: string
  module?: string
  userId?: string
  firmId?: string
  [key: string]: unknown
}

// Generate a correlation ID for request tracing
export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

// Simple structured logger (Pino-compatible interface)
class StructuredLogger {
  private module: string
  private defaultContext: LogContext

  constructor(module: string, defaultContext: LogContext = {}) {
    this.module = module
    this.defaultContext = defaultContext
  }

  private log(level: LogLevel, message: string, context: LogContext = {}): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      module: this.module,
      ...this.defaultContext,
      ...context,
    }

    // In production, this would go to Pino → Datadog/Loki
    // In development, pretty-print
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(entry))
    } else {
      const color = {
        debug: '\x1b[36m',
        info: '\x1b[32m',
        warn: '\x1b[33m',
        error: '\x1b[31m',
        fatal: '\x1b[35m',
      }[level]
      const reset = '\x1b[0m'
      const ts = entry.timestamp.split('T')[1]?.replace('Z', '') || ''
      console.error(
        `${color}[${ts}] ${level.toUpperCase()}${reset} [${this.module}] ${message}`,
        Object.keys(context).length > 0 ? context : ''
      )
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context)
  }

  error(message: string, context?: LogContext) {
    this.log('error', message, context)
  }

  fatal(message: string, context?: LogContext) {
    this.log('fatal', message, context)
  }

  // Create a child logger with additional default context
  child(context: LogContext): StructuredLogger {
    return new StructuredLogger(this.module, { ...this.defaultContext, ...context })
  }
}

// ─── Module Loggers ───────────────────────────────────────────

export const logger = {
  auth: new StructuredLogger('auth'),
  api: new StructuredLogger('api'),
  ai: new StructuredLogger('ai'),
  billing: new StructuredLogger('billing'),
  document: new StructuredLogger('document'),
  engagement: new StructuredLogger('engagement'),
  notification: new StructuredLogger('notification'),
  security: new StructuredLogger('security'),
  system: new StructuredLogger('system'),
}

export { StructuredLogger }
