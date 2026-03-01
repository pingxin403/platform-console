/**
 * Simple in-memory cache implementation with TTL
 * In production, this should be replaced with Redis
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CostEstimationCache {
  private cache: Map<string, CacheEntry<any>>;
  private defaultTTL: number;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(defaultTTL: number = 900) {
    // Default TTL: 15 minutes (900 seconds)
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
    this.cleanupInterval = null;
    
    // Cleanup expired entries every 5 minutes
    this.startCleanup();
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }
    
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    // Allow Node.js to exit even if this timer is active
    this.cleanupInterval.unref();
  }

  /**
   * Stop cleanup interval
   */
  private stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  /**
   * Set value in cache with optional TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const ttlSeconds = ttl ?? this.defaultTTL;
    const expiresAt = Date.now() + ttlSeconds * 1000;
    
    this.cache.set(key, {
      value,
      expiresAt,
    });
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    this.stopCleanup();
    this.cache.clear();
  }
}
