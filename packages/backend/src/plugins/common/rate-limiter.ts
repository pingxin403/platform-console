/**
 * Rate Limiter Middleware
 * 
 * Implements API rate limiting to prevent abuse and ensure fair resource usage.
 * Uses Redis for distributed rate limiting across multiple backend instances.
 */

import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { Logger } from 'winston';
import { RateLimitConfig } from './security-config';

export interface RateLimiterOptions {
  redis: Redis;
  logger: Logger;
  config: RateLimitConfig;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

/**
 * Rate limiter middleware factory
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { redis, logger, config } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) {
      return next();
    }

    try {
      const identifier = getIdentifier(req);
      const endpoint = getEndpointKey(req.path);
      const endpointConfig = config.endpoints[endpoint] || {
        windowMs: config.windowMs,
        maxRequests: config.maxRequests,
      };

      const key = `rate-limit:${endpoint}:${identifier}`;
      const now = Date.now();
      const windowStart = now - endpointConfig.windowMs!;

      // Use Redis sorted set to track requests in time window
      const multi = redis.multi();
      
      // Remove old entries outside the time window
      multi.zremrangebyscore(key, 0, windowStart);
      
      // Count requests in current window
      multi.zcard(key);
      
      // Add current request
      multi.zadd(key, now, `${now}-${Math.random()}`);
      
      // Set expiration
      multi.expire(key, Math.ceil(endpointConfig.windowMs! / 1000));

      const results = await multi.exec();
      
      if (!results) {
        throw new Error('Redis transaction failed');
      }

      const requestCount = results[1][1] as number;
      const limit = endpointConfig.maxRequests!;
      const remaining = Math.max(0, limit - requestCount - 1);
      const resetTime = now + endpointConfig.windowMs!;

      // Set rate limit headers
      if (config.standardHeaders) {
        res.setHeader('RateLimit-Limit', limit);
        res.setHeader('RateLimit-Remaining', remaining);
        res.setHeader('RateLimit-Reset', new Date(resetTime).toISOString());
      }

      if (config.legacyHeaders) {
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));
      }

      // Check if rate limit exceeded
      if (requestCount >= limit) {
        logger.warn('Rate limit exceeded', {
          identifier,
          endpoint,
          requestCount,
          limit,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });

        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(endpointConfig.windowMs! / 1000),
          limit,
          remaining: 0,
          reset: new Date(resetTime).toISOString(),
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limiter error', { error, path: req.path });
      // Fail open - allow request if rate limiter fails
      next();
    }
  };
}

/**
 * Get unique identifier for rate limiting
 * Uses user ID if authenticated, otherwise IP address
 */
function getIdentifier(req: Request): string {
  // Try to get user ID from auth token
  const userId = (req as any).user?.sub || (req as any).user?.id;
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Get endpoint key for rate limiting
 * Matches request path to configured endpoints
 */
function getEndpointKey(path: string): string {
  // Exact match
  if (path in DEFAULT_ENDPOINT_PATTERNS) {
    return path;
  }

  // Pattern match
  for (const [pattern, key] of Object.entries(DEFAULT_ENDPOINT_PATTERNS)) {
    if (matchPattern(path, pattern)) {
      return key;
    }
  }

  // Default to path
  return path;
}

/**
 * Default endpoint patterns for rate limiting
 */
const DEFAULT_ENDPOINT_PATTERNS: Record<string, string> = {
  '/api/catalog/entities': '/api/catalog/entities',
  '/api/catalog/entities/*': '/api/catalog/entities',
  '/api/scaffolder/v2/tasks': '/api/scaffolder/v2/tasks',
  '/api/scaffolder/v2/tasks/*': '/api/scaffolder/v2/tasks',
  '/api/auth': '/api/auth',
  '/api/auth/*': '/api/auth',
  '/api/finops/cost-estimate': '/api/finops/cost-estimate',
  '/api/maturity/scorecard': '/api/maturity/scorecard',
};

/**
 * Simple pattern matching for endpoint paths
 */
function matchPattern(path: string, pattern: string): boolean {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return path.startsWith(prefix);
  }
  return path === pattern;
}

/**
 * Get rate limit info for a specific identifier and endpoint
 */
export async function getRateLimitInfo(
  redis: Redis,
  identifier: string,
  endpoint: string,
  config: RateLimitConfig,
): Promise<RateLimitInfo> {
  const endpointConfig = config.endpoints[endpoint] || {
    windowMs: config.windowMs,
    maxRequests: config.maxRequests,
  };

  const key = `rate-limit:${endpoint}:${identifier}`;
  const now = Date.now();
  const windowStart = now - endpointConfig.windowMs!;

  // Count requests in current window
  await redis.zremrangebyscore(key, 0, windowStart);
  const requestCount = await redis.zcard(key);

  const limit = endpointConfig.maxRequests!;
  const remaining = Math.max(0, limit - requestCount);
  const resetTime = now + endpointConfig.windowMs!;

  return {
    limit,
    remaining,
    reset: resetTime,
  };
}

/**
 * Reset rate limit for a specific identifier and endpoint
 * Useful for testing or manual intervention
 */
export async function resetRateLimit(
  redis: Redis,
  identifier: string,
  endpoint: string,
): Promise<void> {
  const key = `rate-limit:${endpoint}:${identifier}`;
  await redis.del(key);
}
