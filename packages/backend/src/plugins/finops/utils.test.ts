/**
 * Tests for utility functions
 */

import { parseCPU, parseMemory, parseStorage, hoursPerMonth, generateCacheKey } from './utils';

describe('parseCPU', () => {
  it('should parse CPU cores', () => {
    expect(parseCPU('2')).toBe(2);
    expect(parseCPU('2.5')).toBe(2.5);
    expect(parseCPU('0.5')).toBe(0.5);
  });

  it('should parse millicores', () => {
    expect(parseCPU('2000m')).toBe(2);
    expect(parseCPU('500m')).toBe(0.5);
    expect(parseCPU('1500m')).toBe(1.5);
  });

  it('should handle empty input', () => {
    expect(parseCPU('')).toBe(0);
  });

  it('should handle whitespace', () => {
    expect(parseCPU(' 2 ')).toBe(2);
    expect(parseCPU(' 2000m ')).toBe(2);
  });
});

describe('parseMemory', () => {
  it('should parse Gibibytes', () => {
    expect(parseMemory('4Gi')).toBe(4);
    expect(parseMemory('2.5Gi')).toBe(2.5);
  });

  it('should parse Gigabytes', () => {
    expect(parseMemory('4G')).toBe(4);
    expect(parseMemory('2.5G')).toBe(2.5);
  });

  it('should parse Mebibytes', () => {
    expect(parseMemory('4096Mi')).toBe(4);
    expect(parseMemory('2048Mi')).toBe(2);
    expect(parseMemory('512Mi')).toBe(0.5);
  });

  it('should parse Megabytes', () => {
    expect(parseMemory('4096M')).toBe(4);
    expect(parseMemory('2048M')).toBe(2);
  });

  it('should handle empty input', () => {
    expect(parseMemory('')).toBe(0);
  });

  it('should handle whitespace', () => {
    expect(parseMemory(' 4Gi ')).toBe(4);
    expect(parseMemory(' 4096Mi ')).toBe(4);
  });

  it('should assume GB if no unit', () => {
    expect(parseMemory('4')).toBe(4);
  });
});

describe('parseStorage', () => {
  it('should parse storage using same logic as memory', () => {
    expect(parseStorage('10Gi')).toBe(10);
    expect(parseStorage('10G')).toBe(10);
    expect(parseStorage('10240Mi')).toBe(10);
    expect(parseStorage('10240M')).toBe(10);
  });

  it('should handle empty input', () => {
    expect(parseStorage('')).toBe(0);
  });
});

describe('hoursPerMonth', () => {
  it('should return average hours per month', () => {
    expect(hoursPerMonth()).toBe(730);
  });
});

describe('generateCacheKey', () => {
  it('should generate cache key for estimate', () => {
    const key = generateCacheKey('estimate', 'deployment', { cpu: '2', memory: '4Gi' });
    expect(key).toContain('finops:estimate:deployment');
  });

  it('should generate cache key for historical', () => {
    const key = generateCacheKey('historical', 'test-service', { timeRange: '7d' });
    expect(key).toContain('finops:historical:test-service');
  });

  it('should generate different keys for different params', () => {
    const key1 = generateCacheKey('estimate', 'deployment', { cpu: '2' });
    const key2 = generateCacheKey('estimate', 'deployment', { cpu: '4' });
    expect(key1).not.toBe(key2);
  });

  it('should handle missing params', () => {
    const key = generateCacheKey('estimate', 'deployment');
    expect(key).toContain('finops:estimate:deployment');
  });
});
