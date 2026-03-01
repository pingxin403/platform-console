/**
 * API Key Rotation Service
 * 
 * Manages API key lifecycle including creation, rotation, and revocation.
 * Implements automatic rotation policies and owner notifications.
 */

import crypto from 'crypto';
import { Logger } from 'winston';
import { ApiKeyRotationConfig } from './security-config';
import { AuditLogger } from './audit-logger';

export interface ApiKey {
  id: string;
  name: string;
  key: string; // Hashed key
  prefix: string; // First 8 chars for identification
  ownerId: string;
  ownerEmail: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt?: Date;
  rotatedFrom?: string; // Previous key ID
  status: 'active' | 'expired' | 'revoked';
  scopes: string[];
}

export interface ApiKeyCreationRequest {
  name: string;
  ownerId: string;
  ownerEmail: string;
  scopes: string[];
  expiresInDays?: number;
}

export interface ApiKeyRotationResult {
  oldKeyId: string;
  newKey: ApiKey;
  plainKey: string; // Only returned once
}

export class ApiKeyRotationService {
  private keys: Map<string, ApiKey> = new Map();

  constructor(
    private readonly config: ApiKeyRotationConfig,
    private readonly logger: Logger,
    private readonly auditLogger: AuditLogger,
  ) {
    if (config.enabled && config.autoRotate) {
      this.startAutoRotation();
    }
  }

  /**
   * Create a new API key
   */
  async createApiKey(request: ApiKeyCreationRequest): Promise<{ key: ApiKey; plainKey: string }> {
    const plainKey = this.generatePlainKey();
    const hashedKey = this.hashKey(plainKey);
    const prefix = plainKey.substring(0, 8);

    const expiresInDays = request.expiresInDays || this.config.rotationIntervalDays;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const key: ApiKey = {
      id: this.generateKeyId(),
      name: request.name,
      key: hashedKey,
      prefix,
      ownerId: request.ownerId,
      ownerEmail: request.ownerEmail,
      createdAt: new Date(),
      expiresAt,
      status: 'active',
      scopes: request.scopes,
    };

    this.keys.set(key.id, key);

    // Audit log
    await this.auditLogger.logApiKey(
      'create',
      {
        userId: request.ownerId,
        email: request.ownerEmail,
      },
      {
        id: key.id,
        name: key.name,
      },
      'success',
      {
        scopes: key.scopes,
        expiresAt: key.expiresAt,
      },
    );

    this.logger.info('API key created', {
      keyId: key.id,
      name: key.name,
      ownerId: key.ownerId,
      expiresAt: key.expiresAt,
    });

    return { key, plainKey };
  }

  /**
   * Rotate an existing API key
   */
  async rotateApiKey(keyId: string): Promise<ApiKeyRotationResult> {
    const oldKey = this.keys.get(keyId);
    if (!oldKey) {
      throw new Error(`API key not found: ${keyId}`);
    }

    if (oldKey.status !== 'active') {
      throw new Error(`Cannot rotate ${oldKey.status} key: ${keyId}`);
    }

    // Create new key with same properties
    const { key: newKey, plainKey } = await this.createApiKey({
      name: oldKey.name,
      ownerId: oldKey.ownerId,
      ownerEmail: oldKey.ownerEmail,
      scopes: oldKey.scopes,
    });

    // Link new key to old key
    newKey.rotatedFrom = oldKey.id;

    // Revoke old key
    oldKey.status = 'revoked';

    // Audit log
    await this.auditLogger.logApiKey(
      'rotate',
      {
        userId: oldKey.ownerId,
        email: oldKey.ownerEmail,
      },
      {
        id: oldKey.id,
        name: oldKey.name,
      },
      'success',
      {
        newKeyId: newKey.id,
      },
    );

    this.logger.info('API key rotated', {
      oldKeyId: oldKey.id,
      newKeyId: newKey.id,
      ownerId: oldKey.ownerId,
    });

    // Notify owner if configured
    if (this.config.notifyOwners) {
      await this.notifyOwner(oldKey.ownerEmail, 'rotated', {
        oldKeyId: oldKey.id,
        newKeyId: newKey.id,
        keyName: oldKey.name,
      });
    }

    return {
      oldKeyId: oldKey.id,
      newKey,
      plainKey,
    };
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string, revokedBy: { userId: string; email: string }): Promise<void> {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`API key not found: ${keyId}`);
    }

    if (key.status === 'revoked') {
      throw new Error(`API key already revoked: ${keyId}`);
    }

    key.status = 'revoked';

    // Audit log
    await this.auditLogger.logApiKey(
      'revoke',
      revokedBy,
      {
        id: key.id,
        name: key.name,
      },
      'success',
      {
        ownerId: key.ownerId,
      },
    );

    this.logger.info('API key revoked', {
      keyId: key.id,
      name: key.name,
      revokedBy: revokedBy.userId,
    });

    // Notify owner if configured
    if (this.config.notifyOwners) {
      await this.notifyOwner(key.ownerEmail, 'revoked', {
        keyId: key.id,
        keyName: key.name,
        revokedBy: revokedBy.email,
      });
    }
  }

  /**
   * Validate an API key
   */
  async validateApiKey(plainKey: string): Promise<ApiKey | null> {
    const hashedKey = this.hashKey(plainKey);
    const prefix = plainKey.substring(0, 8);

    // Find key by prefix first (optimization)
    const candidates = Array.from(this.keys.values()).filter(k => k.prefix === prefix);

    for (const key of candidates) {
      if (key.key === hashedKey) {
        // Check if key is active and not expired
        if (key.status !== 'active') {
          this.logger.warn('Attempted to use non-active API key', {
            keyId: key.id,
            status: key.status,
          });
          return null;
        }

        if (key.expiresAt < new Date()) {
          this.logger.warn('Attempted to use expired API key', {
            keyId: key.id,
            expiresAt: key.expiresAt,
          });
          key.status = 'expired';
          return null;
        }

        // Update last used timestamp
        key.lastUsedAt = new Date();

        return key;
      }
    }

    return null;
  }

  /**
   * Get API keys for an owner
   */
  getApiKeys(ownerId: string): ApiKey[] {
    return Array.from(this.keys.values())
      .filter(key => key.ownerId === ownerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get API keys expiring soon
   */
  getExpiringKeys(daysThreshold: number = this.config.warningDays): ApiKey[] {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + daysThreshold);

    return Array.from(this.keys.values())
      .filter(key => 
        key.status === 'active' &&
        key.expiresAt <= threshold &&
        key.expiresAt > new Date()
      )
      .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
  }

  /**
   * Start automatic key rotation
   */
  private startAutoRotation(): void {
    // Check for expiring keys every day
    const checkInterval = 24 * 60 * 60 * 1000; // 24 hours

    setInterval(async () => {
      try {
        await this.checkAndRotateKeys();
      } catch (error) {
        this.logger.error('Auto-rotation check failed', { error });
      }
    }, checkInterval);

    this.logger.info('API key auto-rotation started', {
      checkInterval: '24 hours',
      rotationIntervalDays: this.config.rotationIntervalDays,
      warningDays: this.config.warningDays,
    });
  }

  /**
   * Check and rotate expiring keys
   */
  private async checkAndRotateKeys(): Promise<void> {
    const expiringKeys = this.getExpiringKeys();

    this.logger.info('Checking for expiring API keys', {
      count: expiringKeys.length,
    });

    for (const key of expiringKeys) {
      const daysUntilExpiration = Math.ceil(
        (key.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );

      // Send warning notification
      if (this.config.notifyOwners && daysUntilExpiration <= this.config.warningDays) {
        await this.notifyOwner(key.ownerEmail, 'expiring', {
          keyId: key.id,
          keyName: key.name,
          daysUntilExpiration,
        });
      }

      // Auto-rotate if enabled and key is expired
      if (this.config.autoRotate && daysUntilExpiration <= 0) {
        try {
          await this.rotateApiKey(key.id);
          this.logger.info('Auto-rotated expired API key', {
            keyId: key.id,
            name: key.name,
          });
        } catch (error) {
          this.logger.error('Failed to auto-rotate API key', {
            keyId: key.id,
            error,
          });
        }
      }
    }
  }

  /**
   * Notify key owner
   */
  private async notifyOwner(
    email: string,
    event: 'created' | 'rotated' | 'revoked' | 'expiring',
    details: Record<string, any>,
  ): Promise<void> {
    // This is a placeholder for notification logic
    // In production, integrate with email service or Slack
    this.logger.info('API key notification', {
      email,
      event,
      details,
    });

    // TODO: Implement actual notification (email, Slack, etc.)
  }

  /**
   * Generate a random API key
   */
  private generatePlainKey(): string {
    // Format: idp_<random_32_chars>
    const randomBytes = crypto.randomBytes(24);
    return `idp_${randomBytes.toString('base64url')}`;
  }

  /**
   * Hash API key for storage
   */
  private hashKey(plainKey: string): string {
    return crypto
      .createHash('sha256')
      .update(plainKey)
      .digest('hex');
  }

  /**
   * Generate unique key ID
   */
  private generateKeyId(): string {
    return `key-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }
}

/**
 * API key authentication middleware
 */
export function createApiKeyMiddleware(service: ApiKeyRotationService) {
  return async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    // Check if it's an API key (starts with 'idp_')
    if (!token.startsWith('idp_')) {
      return next();
    }

    try {
      const apiKey = await service.validateApiKey(token);

      if (!apiKey) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired API key',
        });
      }

      // Attach API key info to request
      req.apiKey = apiKey;
      req.user = {
        id: apiKey.ownerId,
        email: apiKey.ownerEmail,
        scopes: apiKey.scopes,
      };

      next();
    } catch (error) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to validate API key',
      });
    }
  };
}
