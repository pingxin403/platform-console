/**
 * Error Handling Configuration
 * 
 * Centralized configuration for error handling across all plugins
 */

import { RetryConfig, ErrorSeverity } from './error-handler';

/**
 * Retry configurations for different API types
 */
export const RETRY_CONFIGS: Record<string, RetryConfig> = {
  // External APIs (GitHub, Datadog, Sentry, etc.)
  externalAPI: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', '429', '500', '502', '503', '504'],
  },

  // OpenCost API
  opencost: {
    maxRetries: 2,
    initialDelayMs: 2000,
    maxDelayMs: 8000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', '500', '502', '503', '504'],
  },

  // Argo CD API
  argocd: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', '500', '502', '503', '504'],
  },

  // GitHub API
  github: {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 15000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', '429', '500', '502', '503', '504'],
  },

  // Datadog API
  datadog: {
    maxRetries: 2,
    initialDelayMs: 1500,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', '429', '500', '502', '503', '504'],
  },

  // Database operations
  database: {
    maxRetries: 2,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'],
  },

  // Quick operations (no retry)
  noRetry: {
    maxRetries: 0,
    initialDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
  },
};

/**
 * Timeout configurations for different operations (in milliseconds)
 */
export const TIMEOUT_CONFIGS = {
  // External API calls
  externalAPI: 30000, // 30 seconds
  
  // OpenCost API
  opencost: 30000, // 30 seconds
  
  // Argo CD API
  argocd: 15000, // 15 seconds
  
  // GitHub API
  github: 30000, // 30 seconds
  
  // Datadog API
  datadog: 20000, // 20 seconds
  
  // Database queries
  database: 10000, // 10 seconds
  
  // Cache operations
  cache: 5000, // 5 seconds
  
  // Quick operations
  quick: 5000, // 5 seconds
};

/**
 * Cache TTL configurations (in seconds)
 */
export const CACHE_TTL_CONFIGS = {
  // Cost estimation
  costEstimate: 900, // 15 minutes
  
  // Historical cost data
  historicalCost: 900, // 15 minutes
  
  // Service scorecard
  scorecard: 3600, // 1 hour
  
  // DORA metrics
  doraMetrics: 3600, // 1 hour
  
  // Deployment status
  deploymentStatus: 300, // 5 minutes
  
  // Service metadata
  serviceMetadata: 600, // 10 minutes
  
  // User permissions
  permissions: 300, // 5 minutes
  
  // Search results
  searchResults: 600, // 10 minutes
};

/**
 * Error severity mapping for different error types
 */
export const ERROR_SEVERITY_MAP: Record<string, ErrorSeverity> = {
  // Authentication/Authorization errors
  'AUTH_FAILED': ErrorSeverity.CRITICAL,
  'PERMISSION_DENIED': ErrorSeverity.HIGH,
  'TOKEN_EXPIRED': ErrorSeverity.MEDIUM,
  
  // External API errors
  'EXTERNAL_API_UNAVAILABLE': ErrorSeverity.HIGH,
  'EXTERNAL_API_TIMEOUT': ErrorSeverity.MEDIUM,
  'EXTERNAL_API_RATE_LIMIT': ErrorSeverity.MEDIUM,
  
  // Cost-related errors
  'COST_ESTIMATION_FAILED': ErrorSeverity.MEDIUM,
  'BUDGET_EXCEEDED': ErrorSeverity.HIGH,
  'COST_ANOMALY_DETECTED': ErrorSeverity.HIGH,
  
  // Scorecard errors
  'SCORECARD_CALCULATION_FAILED': ErrorSeverity.MEDIUM,
  'PARTIAL_SCORECARD_DATA': ErrorSeverity.MEDIUM,
  
  // DORA metrics errors
  'DORA_CALCULATION_FAILED': ErrorSeverity.MEDIUM,
  'DORA_DATA_INCOMPLETE': ErrorSeverity.LOW,
  
  // Database errors
  'DATABASE_CONNECTION_FAILED': ErrorSeverity.CRITICAL,
  'DATABASE_QUERY_FAILED': ErrorSeverity.HIGH,
  'DATABASE_TIMEOUT': ErrorSeverity.HIGH,
  
  // Cache errors
  'CACHE_UNAVAILABLE': ErrorSeverity.LOW,
  'CACHE_WRITE_FAILED': ErrorSeverity.LOW,
  
  // Generic errors
  'UNKNOWN_ERROR': ErrorSeverity.MEDIUM,
  'VALIDATION_ERROR': ErrorSeverity.LOW,
  'NOT_FOUND': ErrorSeverity.LOW,
};

/**
 * Alerting thresholds for error monitoring
 */
export const ALERT_THRESHOLDS = {
  // Critical errors - immediate notification
  critical: {
    count: 1,
    windowMinutes: 1,
  },
  
  // High severity errors - 15 minute notification
  high: {
    count: 5,
    windowMinutes: 15,
  },
  
  // Medium severity errors - 1 hour notification
  medium: {
    count: 20,
    windowMinutes: 60,
  },
  
  // Low severity errors - daily summary
  low: {
    count: 100,
    windowMinutes: 1440, // 24 hours
  },
};

/**
 * Graceful degradation strategies
 */
export const DEGRADATION_STRATEGIES = {
  // Cost estimation - fail open (allow deployment)
  costEstimation: {
    strategy: 'fail-open',
    fallbackValue: {
      estimatedMonthlyCost: 0,
      confidence: 0,
      warning: 'Cost estimation unavailable. Proceeding with deployment.',
    },
  },
  
  // Scorecard calculation - partial data
  scorecard: {
    strategy: 'partial-data',
    minimumCategories: 2, // At least 2 categories must be available
  },
  
  // DORA metrics - historical fallback
  doraMetrics: {
    strategy: 'historical-fallback',
    maxAgeHours: 24, // Use data up to 24 hours old
  },
  
  // Deployment status - cached data
  deploymentStatus: {
    strategy: 'cached-data',
    maxAgeMinutes: 30, // Use cached data up to 30 minutes old
  },
};

/**
 * User-friendly error messages
 */
export const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  // External API errors
  'EXTERNAL_API_UNAVAILABLE': 'The external service is temporarily unavailable. Please try again later.',
  'EXTERNAL_API_TIMEOUT': 'The request took too long to complete. Please try again.',
  'EXTERNAL_API_RATE_LIMIT': 'Too many requests. Please wait a moment and try again.',
  
  // Cost errors
  'COST_ESTIMATION_FAILED': 'Unable to estimate costs at this time. Your deployment will proceed without cost validation.',
  'BUDGET_EXCEEDED': 'The estimated cost exceeds your budget. Please review and request approval if needed.',
  
  // Scorecard errors
  'SCORECARD_CALCULATION_FAILED': 'Unable to calculate the complete maturity scorecard. Some data may be unavailable.',
  'PARTIAL_SCORECARD_DATA': 'The maturity scorecard was calculated with partial data. Some categories may be missing.',
  
  // DORA metrics errors
  'DORA_CALCULATION_FAILED': 'Unable to calculate DORA metrics at this time. Historical data may be shown.',
  'DORA_DATA_INCOMPLETE': 'DORA metrics are based on incomplete data. Results may not be fully accurate.',
  
  // Authentication errors
  'AUTH_FAILED': 'Authentication failed. Please sign in again.',
  'PERMISSION_DENIED': 'You do not have permission to access this resource.',
  'TOKEN_EXPIRED': 'Your session has expired. Please sign in again.',
  
  // Generic errors
  'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again later.',
  'NOT_FOUND': 'The requested resource was not found.',
  'VALIDATION_ERROR': 'The provided data is invalid. Please check and try again.',
};

/**
 * Get retry config for a specific API type
 */
export function getRetryConfig(apiType: string): RetryConfig {
  return RETRY_CONFIGS[apiType] || RETRY_CONFIGS.externalAPI;
}

/**
 * Get timeout for a specific operation type
 */
export function getTimeout(operationType: string): number {
  return TIMEOUT_CONFIGS[operationType as keyof typeof TIMEOUT_CONFIGS] || TIMEOUT_CONFIGS.externalAPI;
}

/**
 * Get cache TTL for a specific data type
 */
export function getCacheTTL(dataType: string): number {
  return CACHE_TTL_CONFIGS[dataType as keyof typeof CACHE_TTL_CONFIGS] || 600; // Default 10 minutes
}

/**
 * Get error severity for a specific error code
 */
export function getErrorSeverity(errorCode: string): ErrorSeverity {
  return ERROR_SEVERITY_MAP[errorCode] || ErrorSeverity.MEDIUM;
}

/**
 * Get user-friendly message for an error code
 */
export function getUserFriendlyMessage(errorCode: string): string {
  return USER_FRIENDLY_MESSAGES[errorCode] || USER_FRIENDLY_MESSAGES.UNKNOWN_ERROR;
}
