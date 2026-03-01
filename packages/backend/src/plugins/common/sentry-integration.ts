/**
 * Sentry Integration for Error Monitoring and Alerting
 * 
 * Provides centralized error tracking with:
 * - Automatic error capture
 * - Severity-based alerting
 * - Context enrichment
 * - Performance monitoring
 */

import * as Sentry from '@sentry/node';
import { Logger } from 'winston';
import { ServiceError, ErrorSeverity } from './error-handler';

/**
 * Sentry configuration options
 */
export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
  enabled?: boolean;
}

/**
 * Initialize Sentry integration
 */
export function initializeSentry(config: SentryConfig, logger: Logger): void {
  if (!config.enabled) {
    logger.info('Sentry integration disabled');
    return;
  }

  try {
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      tracesSampleRate: config.tracesSampleRate || 0.1,
      
      // Integrate with Express
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app: undefined }),
      ],

      // Filter out low-severity errors from automatic capture
      beforeSend(event, hint) {
        const error = hint.originalException;
        
        if (error instanceof ServiceError) {
          // Add custom tags
          event.tags = {
            ...event.tags,
            errorCode: error.code,
            severity: error.severity,
            retryable: error.retryable.toString(),
          };

          // Add custom context
          if (error.context) {
            event.contexts = {
              ...event.contexts,
              custom: error.context,
            };
          }

          // Filter out low-severity errors
          if (error.severity === ErrorSeverity.LOW) {
            return null; // Don't send to Sentry
          }
        }

        return event;
      },
    });

    logger.info('Sentry integration initialized', {
      environment: config.environment,
      release: config.release,
    });
  } catch (error) {
    logger.error('Failed to initialize Sentry', {
      error: (error as Error).message,
    });
  }
}

/**
 * Capture error with context
 */
export function captureError(
  error: Error,
  context?: Record<string, any>,
  logger?: Logger,
): void {
  try {
    // Set context if provided
    if (context) {
      Sentry.setContext('error_context', context);
    }

    // Set severity level
    if (error instanceof ServiceError) {
      const sentryLevel = mapSeverityToSentryLevel(error.severity);
      Sentry.captureException(error, { level: sentryLevel });
    } else {
      Sentry.captureException(error);
    }

    logger?.debug('Error captured in Sentry', {
      errorMessage: error.message,
      context,
    });
  } catch (sentryError) {
    logger?.error('Failed to capture error in Sentry', {
      originalError: error.message,
      sentryError: (sentryError as Error).message,
    });
  }
}

/**
 * Capture message with severity
 */
export function captureMessage(
  message: string,
  severity: ErrorSeverity,
  context?: Record<string, any>,
  logger?: Logger,
): void {
  try {
    if (context) {
      Sentry.setContext('message_context', context);
    }

    const sentryLevel = mapSeverityToSentryLevel(severity);
    Sentry.captureMessage(message, sentryLevel);

    logger?.debug('Message captured in Sentry', { message, severity, context });
  } catch (error) {
    logger?.error('Failed to capture message in Sentry', {
      message,
      error: (error as Error).message,
    });
  }
}

/**
 * Start a transaction for performance monitoring
 */
export function startTransaction(
  name: string,
  operation: string,
): Sentry.Transaction {
  return Sentry.startTransaction({
    name,
    op: operation,
  });
}

/**
 * Set user context for error tracking
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  username?: string;
}): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

/**
 * Clear user context
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>,
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Map ServiceError severity to Sentry severity level
 */
function mapSeverityToSentryLevel(
  severity: ErrorSeverity,
): Sentry.SeverityLevel {
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      return 'fatal';
    case ErrorSeverity.HIGH:
      return 'error';
    case ErrorSeverity.MEDIUM:
      return 'warning';
    case ErrorSeverity.LOW:
      return 'info';
    default:
      return 'error';
  }
}

/**
 * Express middleware for Sentry request handling
 */
export const sentryRequestHandler = Sentry.Handlers?.requestHandler?.() || ((req: any, res: any, next: any) => next());

/**
 * Express middleware for Sentry error handling
 */
export const sentryErrorHandler = Sentry.Handlers?.errorHandler?.({
  shouldHandleError(error) {
    // Only handle errors that are not ServiceError with LOW severity
    if (error instanceof ServiceError && error.severity === ErrorSeverity.LOW) {
      return false;
    }
    return true;
  },
}) || ((error: any, req: any, res: any, next: any) => next(error));

/**
 * Flush Sentry events (useful for graceful shutdown)
 */
export async function flushSentry(timeoutMs: number = 2000): Promise<boolean> {
  try {
    return await Sentry.flush(timeoutMs);
  } catch (error) {
    console.error('Failed to flush Sentry events', error);
    return false;
  }
}
