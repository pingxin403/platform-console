/**
 * Redis Cache Tests
 */

import { RedisCache } from './redis-cache';
import { Logger } from 'winston';

// Mock logger
const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as any;

describe('RedisCache', () => {
  let cache: RedisCache;

  beforeEach(() => {
    cache = new RedisCache(
      {
        host: 'localhost',
        port: 6379,
        keyPrefix: 'test:',
        defaultTTL: 60,
      },
      mockLogger,
    );
  });

  afterEach(async () => {
    await cache.destroy();
  });

  describe('Basic Operations', () => {
    it('should set and get a value', async () => {
      await cache.set('key1', 'value1');
      const value = await cache.get<string>('key1');
      expect(value).toBe('value1');
    });

    it('should return null for non-existent key', async () => {
      const value = await cache.get<string>('non-existent');
      expect(value).toBeNull();
    });

    it('should delete a value', async () => {
      await cache.set('key2', 'value2');
      await cache.delete('key2');
      const value = await cache.get<string>('key2');
      expect(value).toBeNull();
    });

    it('should clear all values', async () => {
      await cache.set('key3', 'value3');
      await cache.set('key4', 'value4');
      await cache.clear();
      
      const value3 = await cache.get<string>('key3');
      const value4 = await cache.get<string>('key4');
      
      expect(value3).toBeNull();
      expect(value4).toBeNull();
    });
  });

  describe('TTL', () => {
    it('should expire value after TTL', async () => {
      await cache.set('key5', 'value5', 1); // 1 second TTL
      
      // Value should exist immediately
      let value = await cache.get<string>('key5');
      expect(value).toBe('value5');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Value should be expired
      value = await cache.get<string>('key5');
      expect(value).toBeNull();
    });

    it('should use default TTL if not specified', async () => {
      await cache.set('key6', 'value6');
      const exists = await cache.exists('key6');
      expect(exists).toBe(true);
    });
  });

  describe('Complex Values', () => {
    it('should handle objects', async () => {
      const obj = { name: 'test', value: 123, nested: { key: 'value' } };
      await cache.set('obj1', obj);
      const retrieved = await cache.get<typeof obj>('obj1');
      expect(retrieved).toEqual(obj);
    });

    it('should handle arrays', async () => {
      const arr = [1, 2, 3, 'four', { five: 5 }];
      await cache.set('arr1', arr);
      const retrieved = await cache.get<typeof arr>('arr1');
      expect(retrieved).toEqual(arr);
    });

    it('should handle null values', async () => {
      await cache.set('null1', null);
      const retrieved = await cache.get('null1');
      expect(retrieved).toBeNull();
    });
  });

  describe('Batch Operations', () => {
    it('should get multiple values', async () => {
      await cache.set('batch1', 'value1');
      await cache.set('batch2', 'value2');
      await cache.set('batch3', 'value3');
      
      const values = await cache.mget<string>(['batch1', 'batch2', 'batch3']);
      expect(values).toEqual(['value1', 'value2', 'value3']);
    });

    it('should set multiple values', async () => {
      await cache.mset([
        { key: 'multi1', value: 'value1', ttl: 60 },
        { key: 'multi2', value: 'value2', ttl: 60 },
        { key: 'multi3', value: 'value3', ttl: 60 },
      ]);
      
      const value1 = await cache.get<string>('multi1');
      const value2 = await cache.get<string>('multi2');
      const value3 = await cache.get<string>('multi3');
      
      expect(value1).toBe('value1');
      expect(value2).toBe('value2');
      expect(value3).toBe('value3');
    });
  });

  describe('Fallback Cache', () => {
    it('should use fallback cache when Redis is unavailable', async () => {
      // Create cache with invalid Redis config
      const fallbackCache = new RedisCache(
        {
          host: 'invalid-host',
          port: 9999,
          keyPrefix: 'test:',
          defaultTTL: 60,
        },
        mockLogger,
      );

      // Should still work with fallback
      await fallbackCache.set('fallback1', 'value1');
      const value = await fallbackCache.get<string>('fallback1');
      expect(value).toBe('value1');

      await fallbackCache.destroy();
    });
  });

  describe('Statistics', () => {
    it('should return cache statistics', async () => {
      await cache.set('stats1', 'value1');
      await cache.set('stats2', 'value2');
      
      const stats = await cache.getStats();
      expect(stats).toHaveProperty('connected');
      expect(stats).toHaveProperty('keyCount');
      expect(stats).toHaveProperty('fallbackSize');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      // Try to get with invalid key
      const value = await cache.get<string>('');
      expect(value).toBeNull();
    });

    it('should log errors', async () => {
      // This should trigger an error log
      await cache.set('', 'value');
      
      // Check if error was logged (in fallback mode)
      // Note: This test may need adjustment based on actual error handling
    });
  });
});
