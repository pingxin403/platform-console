/**
 * Redis Cache Implementation
 * 
 * Production-ready Redis cache with TTL support
 * Replaces in-memory cache for better scalability and multi-instance support
 */

import { Logger } from 'winston';

export interface RedisCacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  defaultTTL?: number; // seconds
  enableCompression?: boolean;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Redis Cache Client
 * 
 * Provides a Redis-backed cache with TTL support, compression, and error handling
 * Falls back to in-memory cache if Redis is unavailable
 */
export class RedisCache {
  private config: RedisCacheConfig;
  private logger: Logger;
  private client: any; // Redis client (lazy loaded)
  private connected: boolean = false;
  private fallbackCache: Map<string, CacheEntry<any>>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RedisCacheConfig, logger: Logger) {
    this.config = {
      defaultTTL: 900, // 15 minutes default
      keyPrefix: 'backstage:',
      enableCompression: false,
      ...config,
    };
    this.logger = logger;
    this.fallbackCache = new Map();
    
    // Initialize Redis connection
    this.initializeRedis();
    
    // Start cleanup for fallback cache
    this.startCleanup();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      // Lazy load Redis to avoid dependency if not configured
      const Redis = await import('ioredis').then(m => m.default);
      
      this.client = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db || 0,
        keyPrefix: this.config.keyPrefix,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.client.on('connect', () => {
        this.connected = true;
        this.logger.info('Redis cache connected');
      });

      this.client.on('error', (error: Error) => {
        this.logger.error('Redis cache error', { error: error.message });
        this.connected = false;
      });

      this.client.on('close', () => {
        this.connected = false;
        this.logger.warn('Redis cache connection closed');
      });

      // Test connection
      await this.client.ping();
      this.connected = true;
    } catch (error) {
      this.logger.warn('Redis not available, using in-memory fallback cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.connected = false;
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.connected && this.client) {
        const value = await this.client.get(key);
        
        if (!value) {
          return null;
        }

        // Decompress if enabled
        const data = this.config.enableCompression
          ? await this.decompress(value)
          : value;

        return JSON.parse(data) as T;
      } else {
        // Fallback to in-memory cache
        return this.getFallback<T>(key);
      }
    } catch (error) {
      this.logger.error('Cache get error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.getFallback<T>(key);
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const ttlSeconds = ttl ?? this.config.defaultTTL!;
      const data = JSON.stringify(value);

      if (this.connected && this.client) {
        // Compress if enabled
        const finalData = this.config.enableCompression
          ? await this.compress(data)
          : data;

        await this.client.setex(key, ttlSeconds, finalData);
      } else {
        // Fallback to in-memory cache
        this.setFallback(key, value, ttlSeconds);
      }
    } catch (error) {
      this.logger.error('Cache set error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fallback to in-memory cache on error
      this.setFallback(key, value, ttl ?? this.config.defaultTTL!);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      if (this.connected && this.client) {
        await this.client.del(key);
      } else {
        this.fallbackCache.delete(key);
      }
    } catch (error) {
      this.logger.error('Cache delete error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.fallbackCache.delete(key);
    }
  }

  /**
   * Clear all cache entries (use with caution)
   */
  async clear(): Promise<void> {
    try {
      if (this.connected && this.client) {
        // Clear only keys with our prefix
        const keys = await this.client.keys(`${this.config.keyPrefix}*`);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } else {
        this.fallbackCache.clear();
      }
    } catch (error) {
      this.logger.error('Cache clear error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.fallbackCache.clear();
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (this.connected && this.client) {
        const result = await this.client.exists(key);
        return result === 1;
      } else {
        return this.fallbackCache.has(key);
      }
    } catch (error) {
      this.logger.error('Cache exists error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.fallbackCache.has(key);
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (this.connected && this.client) {
        const values = await this.client.mget(...keys);
        return values.map((value: string | null) => {
          if (!value) return null;
          try {
            const data = this.config.enableCompression
              ? this.decompressSync(value)
              : value;
            return JSON.parse(data) as T;
          } catch {
            return null;
          }
        });
      } else {
        return keys.map(key => this.getFallback<T>(key));
      }
    } catch (error) {
      this.logger.error('Cache mget error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return keys.map(key => this.getFallback<T>(key));
    }
  }

  /**
   * Set multiple values in cache
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    try {
      if (this.connected && this.client) {
        const pipeline = this.client.pipeline();
        
        for (const entry of entries) {
          const ttl = entry.ttl ?? this.config.defaultTTL!;
          const data = JSON.stringify(entry.value);
          const finalData = this.config.enableCompression
            ? await this.compress(data)
            : data;
          
          pipeline.setex(entry.key, ttl, finalData);
        }
        
        await pipeline.exec();
      } else {
        for (const entry of entries) {
          this.setFallback(entry.key, entry.value, entry.ttl ?? this.config.defaultTTL!);
        }
      }
    } catch (error) {
      this.logger.error('Cache mset error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fallback
      for (const entry of entries) {
        this.setFallback(entry.key, entry.value, entry.ttl ?? this.config.defaultTTL!);
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    keyCount: number;
    memoryUsage?: string;
    fallbackSize: number;
  }> {
    try {
      if (this.connected && this.client) {
        const info = await this.client.info('memory');
        const keyCount = await this.client.dbsize();
        
        return {
          connected: true,
          keyCount,
          memoryUsage: this.parseMemoryUsage(info),
          fallbackSize: this.fallbackCache.size,
        };
      } else {
        return {
          connected: false,
          keyCount: 0,
          fallbackSize: this.fallbackCache.size,
        };
      }
    } catch (error) {
      return {
        connected: false,
        keyCount: 0,
        fallbackSize: this.fallbackCache.size,
      };
    }
  }

  /**
   * Fallback: Get from in-memory cache
   */
  private getFallback<T>(key: string): T | null {
    const entry = this.fallbackCache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.fallbackCache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  /**
   * Fallback: Set in in-memory cache
   */
  private setFallback<T>(key: string, value: T, ttl: number): void {
    const expiresAt = Date.now() + ttl * 1000;
    this.fallbackCache.set(key, { value, expiresAt });
  }

  /**
   * Start cleanup interval for fallback cache
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }
    
    this.cleanupInterval = setInterval(() => this.cleanupFallback(), 5 * 60 * 1000);
    // Allow Node.js to exit even if this timer is active
    this.cleanupInterval.unref();
  }

  /**
   * Cleanup expired entries in fallback cache
   */
  private cleanupFallback(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.fallbackCache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.fallbackCache.delete(key);
    }
  }

  /**
   * Compress data (placeholder - implement with zlib if needed)
   */
  private async compress(data: string): Promise<string> {
    // TODO: Implement compression with zlib if enableCompression is true
    return data;
  }

  /**
   * Decompress data (placeholder - implement with zlib if needed)
   */
  private async decompress(data: string): Promise<string> {
    // TODO: Implement decompression with zlib if enableCompression is true
    return data;
  }

  /**
   * Decompress data synchronously (placeholder)
   */
  private decompressSync(data: string): string {
    // TODO: Implement decompression with zlib if enableCompression is true
    return data;
  }

  /**
   * Parse memory usage from Redis INFO output
   */
  private parseMemoryUsage(info: string): string {
    const match = info.match(/used_memory_human:(.+)/);
    return match ? match[1].trim() : 'unknown';
  }

  /**
   * Destroy cache and cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
    
    this.fallbackCache.clear();
    this.connected = false;
  }
}
