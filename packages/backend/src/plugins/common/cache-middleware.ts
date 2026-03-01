/**
 * API Response Caching Middleware
 * 
 * Implements HTTP response caching with configurable TTL
 * Supports cache invalidation and conditional caching
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from 'winston';
import { RedisCache } from './redis-cache';

export interface CacheMiddlewareConfig {
  ttl: number; // seconds
  keyGenerator?: (req: Request) => string;
  shouldCache?: (req: Request, res: Response) => boolean;
  varyBy?: string[]; // Headers to vary cache by (e.g., ['user-id', 'authorization'])
}

/**
 * Create cache middleware for API responses
 */
export function createCacheMiddleware(
  cache: RedisCache,
  logger: Logger,
  config: CacheMiddlewareConfig,
) {
  const {
    ttl,
    keyGenerator = defaultKeyGenerator,
    shouldCache = defaultShouldCache,
    varyBy = [],
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyGenerator(req);
      const varyKey = generateVaryKey(req, varyBy);
      const fullKey = `api:${cacheKey}:${varyKey}`;

      // Check cache
      const cached = await cache.get<CachedResponse>(fullKey);
      
      if (cached) {
        logger.debug('Cache hit', { key: fullKey, path: req.path });
        
        // Set cache headers
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', fullKey);
        
        // Set cached headers
        if (cached.headers) {
          for (const [key, value] of Object.entries(cached.headers)) {
            res.set(key, value);
          }
        }
        
        // Send cached response
        return res.status(cached.status).json(cached.body);
      }

      logger.debug('Cache miss', { key: fullKey, path: req.path });
      res.set('X-Cache', 'MISS');

      // Capture response
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);
      
      let responseCaptured = false;

      // Override res.json to capture response
      res.json = function(body: any) {
        if (!responseCaptured && shouldCache(req, res)) {
          responseCaptured = true;
          cacheResponse(cache, fullKey, res.statusCode, body, res.getHeaders(), ttl, logger);
        }
        return originalJson(body);
      };

      // Override res.send to capture response
      res.send = function(body: any) {
        if (!responseCaptured && shouldCache(req, res)) {
          responseCaptured = true;
          try {
            const jsonBody = typeof body === 'string' ? JSON.parse(body) : body;
            cacheResponse(cache, fullKey, res.statusCode, jsonBody, res.getHeaders(), ttl, logger);
          } catch {
            // Not JSON, skip caching
          }
        }
        return originalSend(body);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
      });
      next();
    }
  };
}

/**
 * Cached response structure
 */
interface CachedResponse {
  status: number;
  body: any;
  headers?: Record<string, string>;
  cachedAt: number;
}

/**
 * Cache response
 */
async function cacheResponse(
  cache: RedisCache,
  key: string,
  status: number,
  body: any,
  headers: any,
  ttl: number,
  logger: Logger,
): Promise<void> {
  try {
    const cachedResponse: CachedResponse = {
      status,
      body,
      headers: extractCacheableHeaders(headers),
      cachedAt: Date.now(),
    };

    await cache.set(key, cachedResponse, ttl);
    logger.debug('Response cached', { key, ttl });
  } catch (error) {
    logger.error('Failed to cache response', {
      error: error instanceof Error ? error.message : 'Unknown error',
      key,
    });
  }
}

/**
 * Default cache key generator
 */
function defaultKeyGenerator(req: Request): string {
  const query = req.query ? JSON.stringify(req.query) : '';
  return `${req.path}:${query}`;
}

/**
 * Generate vary key from headers
 */
function generateVaryKey(req: Request, varyBy: string[]): string {
  if (varyBy.length === 0) {
    return 'default';
  }

  const parts = varyBy.map(header => {
    const value = req.get(header) || 'none';
    return `${header}:${value}`;
  });

  return parts.join(':');
}

/**
 * Default should cache predicate
 */
function defaultShouldCache(req: Request, res: Response): boolean {
  // Only cache successful responses
  if (res.statusCode < 200 || res.statusCode >= 300) {
    return false;
  }

  // Don't cache if explicitly disabled
  if (req.get('Cache-Control') === 'no-cache') {
    return false;
  }

  return true;
}

/**
 * Extract cacheable headers
 */
function extractCacheableHeaders(headers: any): Record<string, string> {
  const cacheable: Record<string, string> = {};
  const cacheableHeaderNames = [
    'content-type',
    'content-encoding',
    'etag',
    'last-modified',
  ];

  for (const name of cacheableHeaderNames) {
    const value = headers[name];
    if (value) {
      cacheable[name] = Array.isArray(value) ? value[0] : value;
    }
  }

  return cacheable;
}

/**
 * Create cache invalidation middleware
 */
export function createCacheInvalidationMiddleware(
  cache: RedisCache,
  logger: Logger,
  patterns: string[],
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Invalidate cache on write operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      try {
        for (const pattern of patterns) {
          const key = pattern.replace(':path', req.path);
          await cache.delete(key);
          logger.debug('Cache invalidated', { key, method: req.method });
        }
      } catch (error) {
        logger.error('Cache invalidation error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    next();
  };
}

/**
 * Cache configuration presets
 */
export const CachePresets = {
  /**
   * Short-lived cache (5 minutes)
   * For frequently changing data
   */
  SHORT: {
    ttl: 300, // 5 minutes
  },

  /**
   * Medium-lived cache (15 minutes)
   * For moderately changing data
   */
  MEDIUM: {
    ttl: 900, // 15 minutes
  },

  /**
   * Long-lived cache (1 hour)
   * For rarely changing data
   */
  LONG: {
    ttl: 3600, // 1 hour
  },

  /**
   * Cost data cache (10 minutes)
   * For cost estimation and anomaly detection
   */
  COST_DATA: {
    ttl: 600, // 10 minutes
  },

  /**
   * Scorecard cache (15 minutes)
   * For maturity scorecards
   */
  SCORECARD: {
    ttl: 900, // 15 minutes
  },

  /**
   * DORA metrics cache (30 minutes)
   * For DORA metrics and analytics
   */
  DORA_METRICS: {
    ttl: 1800, // 30 minutes
  },
};
