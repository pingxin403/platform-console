/**
 * Encryption Service
 * 
 * Provides encryption and decryption for sensitive data at rest and in transit.
 * Uses AES-256-GCM for symmetric encryption with key rotation support.
 */

import crypto from 'crypto';
import { Logger } from 'winston';
import { EncryptionConfig } from './security-config';

export interface EncryptionKey {
  id: string;
  key: Buffer;
  createdAt: Date;
  expiresAt: Date;
  active: boolean;
}

export interface EncryptedData {
  keyId: string;
  iv: string;
  authTag: string;
  data: string;
}

export class EncryptionService {
  private keys: Map<string, EncryptionKey> = new Map();
  private activeKeyId: string | null = null;

  constructor(
    private readonly config: EncryptionConfig,
    private readonly logger: Logger,
  ) {
    this.initializeKeys();
  }

  /**
   * Initialize encryption keys from environment
   */
  private initializeKeys(): void {
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      throw new Error('ENCRYPTION_MASTER_KEY environment variable is required');
    }

    // Create initial key
    const keyId = this.generateKeyId();
    const key = this.deriveKey(masterKey, keyId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.keyRotationDays * 24 * 60 * 60 * 1000);

    this.keys.set(keyId, {
      id: keyId,
      key,
      createdAt: now,
      expiresAt,
      active: true,
    });

    this.activeKeyId = keyId;
    this.logger.info('Encryption service initialized', { keyId });
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string): EncryptedData {
    if (!this.config.enabled) {
      throw new Error('Encryption is disabled');
    }

    if (!this.activeKeyId) {
      throw new Error('No active encryption key');
    }

    const key = this.keys.get(this.activeKeyId);
    if (!key) {
      throw new Error('Active encryption key not found');
    }

    // Generate random IV (Initialization Vector)
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipheriv(this.config.algorithm, key.key, iv);

    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
      keyId: key.id,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted,
    };
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: EncryptedData): string {
    if (!this.config.enabled) {
      throw new Error('Encryption is disabled');
    }

    const key = this.keys.get(encryptedData.keyId);
    if (!key) {
      throw new Error(`Encryption key not found: ${encryptedData.keyId}`);
    }

    // Convert hex strings back to buffers
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');

    // Create decipher
    const decipher = crypto.createDecipheriv(this.config.algorithm, key.key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt data
    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Encrypt object fields that are marked as sensitive
   */
  encryptObject<T extends Record<string, any>>(obj: T): T {
    if (!this.config.enabled) {
      return obj;
    }

    const encrypted = { ...obj };

    for (const field of this.config.sensitiveFields) {
      const value = this.getNestedValue(encrypted, field);
      if (value && typeof value === 'string') {
        const encryptedData = this.encrypt(value);
        this.setNestedValue(encrypted, field, JSON.stringify(encryptedData));
      }
    }

    return encrypted;
  }

  /**
   * Decrypt object fields that are marked as sensitive
   */
  decryptObject<T extends Record<string, any>>(obj: T): T {
    if (!this.config.enabled) {
      return obj;
    }

    const decrypted = { ...obj };

    for (const field of this.config.sensitiveFields) {
      const value = this.getNestedValue(decrypted, field);
      if (value && typeof value === 'string') {
        try {
          const encryptedData = JSON.parse(value) as EncryptedData;
          const decryptedValue = this.decrypt(encryptedData);
          this.setNestedValue(decrypted, field, decryptedValue);
        } catch (error) {
          // Value might not be encrypted, leave as is
          this.logger.warn('Failed to decrypt field', { field, error });
        }
      }
    }

    return decrypted;
  }

  /**
   * Rotate encryption keys
   */
  rotateKey(): string {
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      throw new Error('ENCRYPTION_MASTER_KEY environment variable is required');
    }

    // Mark current key as inactive
    if (this.activeKeyId) {
      const currentKey = this.keys.get(this.activeKeyId);
      if (currentKey) {
        currentKey.active = false;
      }
    }

    // Create new key
    const keyId = this.generateKeyId();
    const key = this.deriveKey(masterKey, keyId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.keyRotationDays * 24 * 60 * 60 * 1000);

    this.keys.set(keyId, {
      id: keyId,
      key,
      createdAt: now,
      expiresAt,
      active: true,
    });

    this.activeKeyId = keyId;
    this.logger.info('Encryption key rotated', { keyId });

    return keyId;
  }

  /**
   * Re-encrypt data with new key
   */
  reencrypt(encryptedData: EncryptedData): EncryptedData {
    const plaintext = this.decrypt(encryptedData);
    return this.encrypt(plaintext);
  }

  /**
   * Check if key rotation is needed
   */
  needsRotation(): boolean {
    if (!this.activeKeyId) {
      return true;
    }

    const key = this.keys.get(this.activeKeyId);
    if (!key) {
      return true;
    }

    const now = new Date();
    const daysUntilExpiration = (key.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);

    return daysUntilExpiration <= 0;
  }

  /**
   * Get days until key expiration
   */
  getDaysUntilExpiration(): number {
    if (!this.activeKeyId) {
      return 0;
    }

    const key = this.keys.get(this.activeKeyId);
    if (!key) {
      return 0;
    }

    const now = new Date();
    return Math.max(0, (key.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  }

  /**
   * Generate unique key ID
   */
  private generateKeyId(): string {
    return `key-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Derive encryption key from master key using PBKDF2
   */
  private deriveKey(masterKey: string, salt: string): Buffer {
    return crypto.pbkdf2Sync(
      masterKey,
      salt,
      100000, // iterations
      32, // key length (256 bits)
      'sha256',
    );
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }
}

/**
 * Encrypt data in transit using TLS
 * This is a placeholder for TLS configuration documentation
 */
export const TLS_CONFIG = {
  // TLS should be configured at the infrastructure level (load balancer, ingress)
  // Backstage should be deployed behind a TLS-terminating proxy
  minVersion: 'TLSv1.2',
  ciphers: [
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-SHA256',
    'ECDHE-RSA-AES256-SHA384',
  ].join(':'),
  honorCipherOrder: true,
};
