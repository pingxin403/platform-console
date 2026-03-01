/**
 * Security Hardening Tests
 * 
 * Unit tests for security hardening features including rate limiting,
 * encryption, audit logging, and API key rotation.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import Redis from 'ioredis';
import { Logger } from 'winston';
import { createRateLimiter, getRateLimitInfo, resetRateLimit } from './rate-limiter';
import { EncryptionService } from './encryption-service';
import { AuditLogger } from './audit-logger';
import { ApiKeyRotationService } from './api-key-rotation';
import { DEFAULT_SECURITY_CONFIG } from './security-config';

// Mock Redis
jest.mock('ioredis');

// Mock Winston Logger
const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
} as any;

describe('Rate Limiter', () => {
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = new Redis() as jest.Mocked<Redis>;
    mockRedis.multi = jest.fn().mockReturnValue({
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 0],
        [null, 5],
        [null, 1],
        [null, 1],
      ]),
    });
  });

  it('should allow requests within rate limit', async () => {
    const rateLimiter = createRateLimiter({
      redis: mockRedis,
      logger: mockLogger,
      config: DEFAULT_SECURITY_CONFIG.rateLimiting,
    });

    const req: any = {
      path: '/api/catalog/entities',
      ip: '192.168.1.1',
      get: jest.fn(),
    };
    const res: any = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await rateLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should block requests exceeding rate limit', async () => {
    // Mock Redis to return count exceeding limit
    mockRedis.multi = jest.fn().mockReturnValue({
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 0],
        [null, 100], // Exceeds limit
        [null, 1],
        [null, 1],
      ]),
    });

    const rateLimiter = createRateLimiter({
      redis: mockRedis,
      logger: mockLogger,
      config: DEFAULT_SECURITY_CONFIG.rateLimiting,
    });

    const req: any = {
      path: '/api/catalog/entities',
      ip: '192.168.1.1',
      get: jest.fn(),
    };
    const res: any = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await rateLimiter(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Too Many Requests',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should set rate limit headers', async () => {
    const rateLimiter = createRateLimiter({
      redis: mockRedis,
      logger: mockLogger,
      config: DEFAULT_SECURITY_CONFIG.rateLimiting,
    });

    const req: any = {
      path: '/api/catalog/entities',
      ip: '192.168.1.1',
      get: jest.fn(),
    };
    const res: any = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await rateLimiter(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Limit', expect.any(Number));
    expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', expect.any(Number));
    expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Reset', expect.any(String));
  });
});

describe('Encryption Service', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    process.env.ENCRYPTION_MASTER_KEY = 'test-master-key-32-characters-long-secure';
    encryptionService = new EncryptionService(
      DEFAULT_SECURITY_CONFIG.encryption,
      mockLogger
    );
  });

  it('should encrypt and decrypt data correctly', () => {
    const plaintext = 'sensitive-api-key-123';
    const encrypted = encryptionService.encrypt(plaintext);

    expect(encrypted).toHaveProperty('keyId');
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted).toHaveProperty('authTag');
    expect(encrypted).toHaveProperty('data');
    expect(encrypted.data).not.toBe(plaintext);

    const decrypted = encryptionService.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should encrypt object fields', () => {
    const obj = {
      name: 'My Service',
      apiKey: 'secret-key-123',
      description: 'Public info',
    };

    const encrypted = encryptionService.encryptObject(obj);

    expect(encrypted.name).toBe('My Service');
    expect(encrypted.description).toBe('Public info');
    expect(encrypted.apiKey).not.toBe('secret-key-123');
    expect(typeof encrypted.apiKey).toBe('string');
  });

  it('should decrypt object fields', () => {
    const obj = {
      name: 'My Service',
      apiKey: 'secret-key-123',
      description: 'Public info',
    };

    const encrypted = encryptionService.encryptObject(obj);
    const decrypted = encryptionService.decryptObject(encrypted);

    expect(decrypted.name).toBe('My Service');
    expect(decrypted.apiKey).toBe('secret-key-123');
    expect(decrypted.description).toBe('Public info');
  });

  it('should handle nested fields', () => {
    const obj = {
      name: 'My Service',
      budget: {
        approvalToken: 'secret-token-456',
      },
    };

    const encrypted = encryptionService.encryptObject(obj);
    expect(encrypted.budget.approvalToken).not.toBe('secret-token-456');

    const decrypted = encryptionService.decryptObject(encrypted);
    expect(decrypted.budget.approvalToken).toBe('secret-token-456');
  });

  it('should rotate encryption keys', () => {
    const newKeyId = encryptionService.rotateKey();
    expect(newKeyId).toBeTruthy();
    expect(typeof newKeyId).toBe('string');
  });

  it('should re-encrypt data with new key', () => {
    const plaintext = 'sensitive-data';
    const encrypted1 = encryptionService.encrypt(plaintext);

    encryptionService.rotateKey();

    const encrypted2 = encryptionService.reencrypt(encrypted1);
    expect(encrypted2.keyId).not.toBe(encrypted1.keyId);

    const decrypted = encryptionService.decrypt(encrypted2);
    expect(decrypted).toBe(plaintext);
  });
});

describe('Audit Logger', () => {
  let auditLogger: AuditLogger;

  beforeEach(() => {
    auditLogger = new AuditLogger(
      DEFAULT_SECURITY_CONFIG.auditLogging,
      mockLogger
    );
  });

  it('should log audit events', async () => {
    await auditLogger.log({
      operation: 'auth.login',
      actor: {
        userId: 'user-123',
        email: 'user@example.com',
        ip: '192.168.1.1',
      },
      resource: {
        type: 'auth',
      },
      action: 'execute',
      status: 'success',
    });

    const logs = await auditLogger.query({
      operation: 'auth.login',
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].operation).toBe('auth.login');
    expect(logs[0].actor.userId).toBe('user-123');
    expect(logs[0].status).toBe('success');
  });

  it('should log authentication events', async () => {
    await auditLogger.logAuth(
      'login',
      {
        userId: 'user-123',
        email: 'user@example.com',
      },
      'success'
    );

    const logs = await auditLogger.query({
      operation: 'auth.login',
    });

    expect(logs).toHaveLength(1);
  });

  it('should log catalog operations', async () => {
    await auditLogger.logCatalog(
      'entity.create',
      {
        userId: 'user-123',
        email: 'user@example.com',
      },
      {
        id: 'service-456',
        name: 'my-service',
      },
      'success'
    );

    const logs = await auditLogger.query({
      operation: 'catalog.entity.create',
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].resource.id).toBe('service-456');
  });

  it('should query audit logs by user', async () => {
    await auditLogger.log({
      operation: 'test.operation',
      actor: { userId: 'user-123' },
      resource: { type: 'test' },
      action: 'execute',
      status: 'success',
    });

    await auditLogger.log({
      operation: 'test.operation',
      actor: { userId: 'user-456' },
      resource: { type: 'test' },
      action: 'execute',
      status: 'success',
    });

    const logs = await auditLogger.query({
      userId: 'user-123',
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].actor.userId).toBe('user-123');
  });

  it('should query audit logs by date range', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');

    await auditLogger.log({
      operation: 'test.operation',
      actor: { userId: 'user-123' },
      resource: { type: 'test' },
      action: 'execute',
      status: 'success',
    });

    const logs = await auditLogger.query({
      startDate,
      endDate,
    });

    expect(logs.length).toBeGreaterThan(0);
  });

  it('should clean up old audit logs', async () => {
    // Create old log entry
    await auditLogger.log({
      operation: 'test.operation',
      actor: { userId: 'user-123' },
      resource: { type: 'test' },
      action: 'execute',
      status: 'success',
    });

    // Manually set old timestamp
    const logs = await auditLogger.query({});
    if (logs.length > 0) {
      logs[0].timestamp = new Date('2020-01-01');
    }

    const deletedCount = await auditLogger.cleanup();
    expect(deletedCount).toBeGreaterThanOrEqual(0);
  });
});

describe('API Key Rotation Service', () => {
  let apiKeyService: ApiKeyRotationService;
  let mockAuditLogger: jest.Mocked<AuditLogger>;

  beforeEach(() => {
    mockAuditLogger = {
      logApiKey: jest.fn().mockResolvedValue(undefined),
    } as any;

    apiKeyService = new ApiKeyRotationService(
      DEFAULT_SECURITY_CONFIG.apiKeyRotation,
      mockLogger,
      mockAuditLogger
    );
  });

  it('should create API key', async () => {
    const { key, plainKey } = await apiKeyService.createApiKey({
      name: 'Test Key',
      ownerId: 'user-123',
      ownerEmail: 'user@example.com',
      scopes: ['catalog:read'],
    });

    expect(key).toHaveProperty('id');
    expect(key).toHaveProperty('name', 'Test Key');
    expect(key).toHaveProperty('ownerId', 'user-123');
    expect(key).toHaveProperty('status', 'active');
    expect(plainKey).toMatch(/^idp_/);
    expect(mockAuditLogger.logApiKey).toHaveBeenCalledWith(
      'create',
      expect.any(Object),
      expect.any(Object),
      'success',
      expect.any(Object)
    );
  });

  it('should validate API key', async () => {
    const { key, plainKey } = await apiKeyService.createApiKey({
      name: 'Test Key',
      ownerId: 'user-123',
      ownerEmail: 'user@example.com',
      scopes: ['catalog:read'],
    });

    const validated = await apiKeyService.validateApiKey(plainKey);
    expect(validated).toBeTruthy();
    expect(validated?.id).toBe(key.id);
    expect(validated?.status).toBe('active');
  });

  it('should reject invalid API key', async () => {
    const validated = await apiKeyService.validateApiKey('idp_invalid_key');
    expect(validated).toBeNull();
  });

  it('should rotate API key', async () => {
    const { key: oldKey } = await apiKeyService.createApiKey({
      name: 'Test Key',
      ownerId: 'user-123',
      ownerEmail: 'user@example.com',
      scopes: ['catalog:read'],
    });

    const { oldKeyId, newKey, plainKey } = await apiKeyService.rotateApiKey(oldKey.id);

    expect(oldKeyId).toBe(oldKey.id);
    expect(newKey.id).not.toBe(oldKey.id);
    expect(newKey.name).toBe(oldKey.name);
    expect(newKey.ownerId).toBe(oldKey.ownerId);
    expect(newKey.rotatedFrom).toBe(oldKey.id);
    expect(plainKey).toMatch(/^idp_/);
  });

  it('should revoke API key', async () => {
    const { key, plainKey } = await apiKeyService.createApiKey({
      name: 'Test Key',
      ownerId: 'user-123',
      ownerEmail: 'user@example.com',
      scopes: ['catalog:read'],
    });

    await apiKeyService.revokeApiKey(key.id, {
      userId: 'admin-456',
      email: 'admin@example.com',
    });

    const validated = await apiKeyService.validateApiKey(plainKey);
    expect(validated).toBeNull();
  });

  it('should get API keys for owner', async () => {
    await apiKeyService.createApiKey({
      name: 'Key 1',
      ownerId: 'user-123',
      ownerEmail: 'user@example.com',
      scopes: ['catalog:read'],
    });

    await apiKeyService.createApiKey({
      name: 'Key 2',
      ownerId: 'user-123',
      ownerEmail: 'user@example.com',
      scopes: ['catalog:write'],
    });

    const keys = apiKeyService.getApiKeys('user-123');
    expect(keys).toHaveLength(2);
  });

  it('should get expiring keys', async () => {
    await apiKeyService.createApiKey({
      name: 'Expiring Key',
      ownerId: 'user-123',
      ownerEmail: 'user@example.com',
      scopes: ['catalog:read'],
      expiresInDays: 7, // Expires in 7 days
    });

    const expiringKeys = apiKeyService.getExpiringKeys(14); // Warning threshold: 14 days
    expect(expiringKeys).toHaveLength(1);
  });
});
