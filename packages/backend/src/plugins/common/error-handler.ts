/**
 * Comprehensive Error Handling Utilities for IDP Platform
 * 
 * Provides centralized error handling with:
 * - Retry logic with exponential backoff
 * - Graceful degradation with caching
 * - Error monitoring and alerting
 * - User-friendly error messages
 */

import { Logger } from 'winston';

/**
 * Error severity levels for monitoring and alerting
 */
export enum ErrorSeverity {
  CRITICAL = 'critical', // Affects core functionality - immediate notification
  HIGH = 'high',         // Affects important functionality - 15 min notification
  MEDIUM = 'medium',     // Affects secondary functionality - 1 hour notification
  LOW = 'low',           // Does not affect functionality - daily summary
}

/**
 * Custom error class with additional context
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
    public readonly severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    public readonly context?: Record<string, any>,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Cache interface for degradation handling
 */
export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  logger?: Logger,
): Promise<T> {
  let lastError: Error;
  let delay = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (config.retryableErrors && error instanceof ServiceError) {
        if (!config.retryableErrors.includes(error.code)) {
          throw error;
        }
      }

      // Don't retry on last attempt
      if (attempt === config.maxRetries) {
        break;
      }

      logger?.warn(`Retry attempt ${attempt + 1}/${config.maxRetries} after ${delay}ms`, {
        error: lastError.message,
      });

      // Wait before retrying
      await sleep(delay);

      // Exponential backoff
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  throw lastError!;
}

/**
 * Execute function with graceful degradation using cache
 */
export async function withGracefulDegradation<T>(
  fn: () => Promise<T>,
  options: {
    cacheKey: string;
    cache: CacheProvider;
    logger: Logger;
    fallbackValue?: T;
    retryConfig?: RetryConfig;
  },
): Promise<{ data: T; fromCache: boolean; error?: Error }> {
  const { cacheKey, cache, logger, fallbackValue, retryConfig } = options;

  try {
    // Try to execute function with retry
    const data = await retryWithBackoff(fn, retryConfig, logger);
    
    // Cache successful result
    await cache.set(cacheKey, data, 900); // 15 minutes TTL
    
    return { data, fromCache: false };
  } catch (error) {
    logger.error('Function execution failed, attempting graceful degradation', {
      cacheKey,
      error: (error as Error).message,
    });

    // Try to use cached data
    const cachedData = await cache.get<T>(cacheKey);
    if (cachedData) {
      logger.warn('Using cached data for graceful degradation', { cacheKey });
      return { data: cachedData, fromCache: true, error: error as Error };
    }

    // Use fallback value if provided
    if (fallbackValue !== undefined) {
      logger.warn('Using fallback value for graceful degradation', { cacheKey });
      return { data: fallbackValue, fromCache: false, error: error as Error };
    }

    // No degradation possible, throw error
    throw error;
  }
}

/**
 * Wrap external API calls with timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutError: string = 'Operation timed out',
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutError)), timeoutMs),
    ),
  ]);
}

/**
 * Create user-friendly error message
 */
export function createUserFriendlyError(
  error: Error,
  context: string,
): ServiceError {
  // Map technical errors to user-friendly messages
  const errorMappings: Record<string, string> = {
    ECONNREFUSED: 'Unable to connect to the service. Please try again later.',
    ETIMEDOUT: 'The request took too long to complete. Please try again.',
    ENOTFOUND: 'The service could not be found. Please check your configuration.',
    '401': 'Authentication failed. Please check your credentials.',
    '403': 'You do not have permission to access this resource.',
    '404': 'The requested resource was not found.',
    '429': 'Too many requests. Please try again later.',
    '500': 'An internal server error occurred. Please try again later.',
    '503': 'The service is temporarily unavailable. Please try again later.',
  };

  // Check for known error patterns
  for (const [pattern, message] of Object.entries(errorMappings)) {
    if (error.message.includes(pattern) || error.name.includes(pattern)) {
      return new ServiceError(
        `${context}: ${message}`,
        pattern,
        true,
        ErrorSeverity.MEDIUM,
        { originalError: error.message },
      );
    }
  }

  // Default user-friendly error
  return new ServiceError(
    `${context}: An unexpected error occurred. Please try again later.`,
    'UNKNOWN_ERROR',
    true,
    ErrorSeverity.MEDIUM,
    { originalError: error.message },
  );
}

/**
 * Log error with context for monitoring
 */
export function logError(
  logger: Logger,
  error: Error,
  context: Record<string, any> = {},
): void {
  const errorInfo = {
    message: error.message,
    name: error.name,
    stack: error.stack,
    ...context,
  };

  if (error instanceof ServiceError) {
    errorInfo.code = error.code;
    errorInfo.severity = error.severity;
    errorInfo.retryable = error.retryable;
    errorInfo.context = error.context;

    // Log based on severity
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error('CRITICAL ERROR', errorInfo);
        break;
      case ErrorSeverity.HIGH:
        logger.error('HIGH SEVERITY ERROR', errorInfo);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('MEDIUM SEVERITY ERROR', errorInfo);
        break;
      case ErrorSeverity.LOW:
        logger.info('LOW SEVERITY ERROR', errorInfo);
        break;
    }
  } else {
    logger.error('Unhandled error', errorInfo);
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fail-open strategy for cost gate failures
 * Returns true (allow) if estimation fails
 */
export function failOpenStrategy<T>(
  result: T | null,
  defaultValue: T,
  logger: Logger,
  context: string,
): T {
  if (result === null || result === undefined) {
    logger.warn(`Fail-open strategy applied: ${context}`, {
      defaultValue,
    });
    return defaultValue;
  }
  return result;
}

/**
 * Partial data availability strategy for scorecard calculation
 * Returns available data with warnings for missing parts
 */
export interface PartialResult<T> {
  data: Partial<T>;
  availableFields: string[];
  missingFields: string[];
  warnings: string[];
}

export function handlePartialData<T extends Record<string, any>>(
  results: Array<{ field: string; value: any; error?: Error }>,
  logger: Logger,
): PartialResult<T> {
  const data: Partial<T> = {};
  const availableFields: string[] = [];
  const missingFields: string[] = [];
  const warnings: string[] = [];

  for (const result of results) {
    if (result.error) {
      missingFields.push(result.field);
      warnings.push(`Unable to calculate ${result.field}: ${result.error.message}`);
      logger.warn(`Partial data: ${result.field} unavailable`, {
        error: result.error.message,
      });
    } else {
      data[result.field as keyof T] = result.value;
      availableFields.push(result.field);
    }
  }

  return {
    data,
    availableFields,
    missingFields,
    warnings,
  };
}

/**
 * Historical data fallback strategy for DORA metrics
 * Returns last successful calculation if current fails
 */
export async function withHistoricalFallback<T>(
  fn: () => Promise<T>,
  options: {
    historicalKey: string;
    cache: CacheProvider;
    logger: Logger;
    maxAgeSeconds?: number;
  },
): Promise<{ data: T; isHistorical: boolean; timestamp?: Date }> {
  const { historicalKey, cache, logger, maxAgeSeconds = 86400 } = options;

  try {
    // Try to get current data
    const data = await fn();
    
    // Store as historical data with timestamp
    await cache.set(
      historicalKey,
      { data, timestamp: new Date() },
      maxAgeSeconds,
    );
    
    return { data, isHistorical: false };
  } catch (error) {
    logger.warn('Current data unavailable, using historical fallback', {
      historicalKey,
      error: (error as Error).message,
    });

    // Try to get historical data
    const historical = await cache.get<{ data: T; timestamp: Date }>(historicalKey);
    
    if (historical) {
      logger.info('Using historical data', {
        historicalKey,
        timestamp: historical.timestamp,
      });
      return {
        data: historical.data,
        isHistorical: true,
        timestamp: historical.timestamp,
      };
    }

    // No historical data available
    throw new ServiceError(
      'No current or historical data available',
      'NO_DATA_AVAILABLE',
      false,
      ErrorSeverity.HIGH,
      { originalError: (error as Error).message },
    );
  }
}
