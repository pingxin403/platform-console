/**
 * Security Configuration
 * 
 * Centralized security configuration for the Internal Developer Platform.
 * Includes rate limiting, encryption, audit logging, and API key rotation settings.
 */

import { Config } from '@backstage/config';

export interface SecurityConfig {
  rateLimiting: RateLimitConfig;
  encryption: EncryptionConfig;
  auditLogging: AuditLoggingConfig;
  apiKeyRotation: ApiKeyRotationConfig;
}

export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  standardHeaders: boolean; // Return rate limit info in headers
  legacyHeaders: boolean;
  // Per-endpoint overrides
  endpoints: {
    [path: string]: {
      windowMs?: number;
      maxRequests?: number;
    };
  };
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: string; // e.g., 'aes-256-gcm'
  keyRotationDays: number;
  sensitiveFields: string[]; // Fields to encrypt in database
}

export interface AuditLoggingConfig {
  enabled: boolean;
  logLevel: 'info' | 'warn' | 'error';
  sensitiveOperations: string[]; // Operations to audit
  retentionDays: number;
  destinations: ('database' | 'file' | 'sentry')[];
}

export interface ApiKeyRotationConfig {
  enabled: boolean;
  rotationIntervalDays: number;
  warningDays: number; // Days before expiration to warn
  autoRotate: boolean;
  notifyOwners: boolean;
}

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  rateLimiting: {
    enabled: true,
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    standardHeaders: true,
    legacyHeaders: false,
    endpoints: {
      '/api/catalog/entities': {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 60, // 60 requests per minute
      },
      '/api/scaffolder/v2/tasks': {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 10, // 10 service creations per hour
      },
      '/api/auth': {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5, // 5 auth attempts per 15 minutes
      },
      '/api/finops/cost-estimate': {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 30, // 30 cost estimates per minute
      },
      '/api/maturity/scorecard': {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 30, // 30 scorecard requests per minute
      },
    },
  },
  encryption: {
    enabled: true,
    algorithm: 'aes-256-gcm',
    keyRotationDays: 90,
    sensitiveFields: [
      'apiKey',
      'apiSecret',
      'token',
      'password',
      'privateKey',
      'certificate',
      'budget.approvalToken',
      'nps.userEmail',
    ],
  },
  auditLogging: {
    enabled: true,
    logLevel: 'info',
    sensitiveOperations: [
      'auth.login',
      'auth.logout',
      'auth.token.refresh',
      'catalog.entity.create',
      'catalog.entity.delete',
      'scaffolder.task.create',
      'finops.budget.update',
      'finops.cost-gate.override',
      'maturity.gate.override',
      'rbac.permission.grant',
      'rbac.permission.revoke',
      'rbac.role.assign',
      'rbac.role.remove',
      'api-key.create',
      'api-key.rotate',
      'api-key.revoke',
    ],
    retentionDays: 90,
    destinations: ['database', 'sentry'],
  },
  apiKeyRotation: {
    enabled: true,
    rotationIntervalDays: 90,
    warningDays: 14,
    autoRotate: false, // Manual rotation by default for safety
    notifyOwners: true,
  },
};

/**
 * Load security configuration from Backstage config
 */
export function loadSecurityConfig(config: Config): SecurityConfig {
  const securityConfig = config.getOptionalConfig('security');

  if (!securityConfig) {
    return DEFAULT_SECURITY_CONFIG;
  }

  return {
    rateLimiting: {
      enabled: securityConfig.getOptionalBoolean('rateLimiting.enabled') ?? DEFAULT_SECURITY_CONFIG.rateLimiting.enabled,
      windowMs: securityConfig.getOptionalNumber('rateLimiting.windowMs') ?? DEFAULT_SECURITY_CONFIG.rateLimiting.windowMs,
      maxRequests: securityConfig.getOptionalNumber('rateLimiting.maxRequests') ?? DEFAULT_SECURITY_CONFIG.rateLimiting.maxRequests,
      skipSuccessfulRequests: securityConfig.getOptionalBoolean('rateLimiting.skipSuccessfulRequests') ?? DEFAULT_SECURITY_CONFIG.rateLimiting.skipSuccessfulRequests,
      skipFailedRequests: securityConfig.getOptionalBoolean('rateLimiting.skipFailedRequests') ?? DEFAULT_SECURITY_CONFIG.rateLimiting.skipFailedRequests,
      standardHeaders: securityConfig.getOptionalBoolean('rateLimiting.standardHeaders') ?? DEFAULT_SECURITY_CONFIG.rateLimiting.standardHeaders,
      legacyHeaders: securityConfig.getOptionalBoolean('rateLimiting.legacyHeaders') ?? DEFAULT_SECURITY_CONFIG.rateLimiting.legacyHeaders,
      endpoints: securityConfig.getOptionalConfig('rateLimiting.endpoints')?.get() ?? DEFAULT_SECURITY_CONFIG.rateLimiting.endpoints,
    },
    encryption: {
      enabled: securityConfig.getOptionalBoolean('encryption.enabled') ?? DEFAULT_SECURITY_CONFIG.encryption.enabled,
      algorithm: securityConfig.getOptionalString('encryption.algorithm') ?? DEFAULT_SECURITY_CONFIG.encryption.algorithm,
      keyRotationDays: securityConfig.getOptionalNumber('encryption.keyRotationDays') ?? DEFAULT_SECURITY_CONFIG.encryption.keyRotationDays,
      sensitiveFields: securityConfig.getOptionalStringArray('encryption.sensitiveFields') ?? DEFAULT_SECURITY_CONFIG.encryption.sensitiveFields,
    },
    auditLogging: {
      enabled: securityConfig.getOptionalBoolean('auditLogging.enabled') ?? DEFAULT_SECURITY_CONFIG.auditLogging.enabled,
      logLevel: (securityConfig.getOptionalString('auditLogging.logLevel') as 'info' | 'warn' | 'error') ?? DEFAULT_SECURITY_CONFIG.auditLogging.logLevel,
      sensitiveOperations: securityConfig.getOptionalStringArray('auditLogging.sensitiveOperations') ?? DEFAULT_SECURITY_CONFIG.auditLogging.sensitiveOperations,
      retentionDays: securityConfig.getOptionalNumber('auditLogging.retentionDays') ?? DEFAULT_SECURITY_CONFIG.auditLogging.retentionDays,
      destinations: (securityConfig.getOptionalStringArray('auditLogging.destinations') as ('database' | 'file' | 'sentry')[]) ?? DEFAULT_SECURITY_CONFIG.auditLogging.destinations,
    },
    apiKeyRotation: {
      enabled: securityConfig.getOptionalBoolean('apiKeyRotation.enabled') ?? DEFAULT_SECURITY_CONFIG.apiKeyRotation.enabled,
      rotationIntervalDays: securityConfig.getOptionalNumber('apiKeyRotation.rotationIntervalDays') ?? DEFAULT_SECURITY_CONFIG.apiKeyRotation.rotationIntervalDays,
      warningDays: securityConfig.getOptionalNumber('apiKeyRotation.warningDays') ?? DEFAULT_SECURITY_CONFIG.apiKeyRotation.warningDays,
      autoRotate: securityConfig.getOptionalBoolean('apiKeyRotation.autoRotate') ?? DEFAULT_SECURITY_CONFIG.apiKeyRotation.autoRotate,
      notifyOwners: securityConfig.getOptionalBoolean('apiKeyRotation.notifyOwners') ?? DEFAULT_SECURITY_CONFIG.apiKeyRotation.notifyOwners,
    },
  };
}
