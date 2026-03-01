/**
 * Unit tests for error handling utilities
 */

import {
  ServiceError,
  ErrorSeverity,
  retryWithBackoff,
  withGracefulDegradation,
  withTimeout,
  failOpenStrategy,
  handlePartialData,
  withHistoricalFallback,
  DEFAULT_RETRY_CONFIG,
} from './error-handler';

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as any;

// Mock cache provider
const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
};

describe('ServiceError', () => {
  it('should create error with all properties', () => {
    const error = new ServiceError(
      'Test error',
      'TEST_ERROR',
      true,
      ErrorSeverity.HIGH,
      { foo: 'bar' },
    );

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.retryable).toBe(true);
    expect(error.severity).toBe(ErrorSeverity.HIGH);
    expect(error.context).toEqual({ foo: 'bar' });
  });

  it('should have default values', () => {
    const error = new ServiceError('Test error', 'TEST_ERROR');

    expect(error.retryable).toBe(false);
    expect(error.severity).toBe(ErrorSeverity.MEDIUM);
    expect(error.context).toBeUndefined();
  });
});

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should succeed on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(fn, DEFAULT_RETRY_CONFIG, mockLogger);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await retryWithBackoff(
      fn,
      { ...DEFAULT_RETRY_CONFIG, maxRetries: 3 },
      mockLogger,
    );

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(mockLogger.warn).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));

    await expect(
      retryWithBackoff(fn, { ...DEFAULT_RETRY_CONFIG, maxRetries: 2 }, mockLogger),
    ).rejects.toThrow('persistent failure');

    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should not retry non-retryable errors', async () => {
    const error = new ServiceError('Not retryable', 'NOT_RETRYABLE', false);
    const fn = jest.fn().mockRejectedValue(error);

    await expect(
      retryWithBackoff(
        fn,
        { ...DEFAULT_RETRY_CONFIG, retryableErrors: ['RETRYABLE'] },
        mockLogger,
      ),
    ).rejects.toThrow('Not retryable');

    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });
});

describe('withGracefulDegradation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return fresh data on success', async () => {
    const fn = jest.fn().mockResolvedValue({ data: 'fresh' });

    const result = await withGracefulDegradation(fn, {
      cacheKey: 'test-key',
      cache: mockCache,
      logger: mockLogger,
    });

    expect(result.data).toEqual({ data: 'fresh' });
    expect(result.fromCache).toBe(false);
    expect(result.error).toBeUndefined();
    expect(mockCache.set).toHaveBeenCalledWith('test-key', { data: 'fresh' }, 900);
  });

  it('should use cached data on failure', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('API failed'));
    mockCache.get.mockResolvedValue({ data: 'cached' });

    const promise = withGracefulDegradation(fn, {
      cacheKey: 'test-key',
      cache: mockCache,
      logger: mockLogger,
      retryConfig: { maxRetries: 3, initialDelayMs: 100, maxDelayMs: 1000, backoffMultiplier: 2 },
    });

    // Fast-forward through all retries
    await jest.runAllTimersAsync();

    const result = await promise;

    expect(result.data).toEqual({ data: 'cached' });
    expect(result.fromCache).toBe(true);
    expect(result.error).toBeDefined();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should use fallback value when no cache', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('API failed'));
    mockCache.get.mockResolvedValue(null);

    const promise = withGracefulDegradation(fn, {
      cacheKey: 'test-key',
      cache: mockCache,
      logger: mockLogger,
      fallbackValue: { data: 'fallback' },
      retryConfig: { maxRetries: 3, initialDelayMs: 100, maxDelayMs: 1000, backoffMultiplier: 2 },
    });

    // Fast-forward through all retries
    await jest.runAllTimersAsync();

    const result = await promise;

    expect(result.data).toEqual({ data: 'fallback' });
    expect(result.fromCache).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should throw when no degradation possible', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('API failed'));
    mockCache.get.mockResolvedValue(null);

    // Suppress console error for this test
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    const promise = withGracefulDegradation(fn, {
      cacheKey: 'test-key',
      cache: mockCache,
      logger: mockLogger,
      retryConfig: { maxRetries: 3, initialDelayMs: 100, maxDelayMs: 1000, backoffMultiplier: 2 },
    });

    // Fast-forward through all retries
    await jest.runAllTimersAsync();

    await expect(promise).rejects.toThrow('API failed');
    
    consoleErrorSpy.mockRestore();
  });
});

describe('withTimeout', () => {
  it('should resolve before timeout', async () => {
    const fn = jest.fn().mockResolvedValue('success');

    const result = await withTimeout(fn, 1000);

    expect(result).toBe('success');
  });

  it('should timeout slow operations', async () => {
    const fn = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('too slow'), 2000)),
    );

    await expect(withTimeout(fn, 100, 'Timeout!')).rejects.toThrow('Timeout!');
  });
});

describe('failOpenStrategy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return value when available', () => {
    const result = failOpenStrategy('value', 'default', mockLogger, 'test');

    expect(result).toBe('value');
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should return default when value is null', () => {
    const result = failOpenStrategy(null, 'default', mockLogger, 'test');

    expect(result).toBe('default');
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should return default when value is undefined', () => {
    const result = failOpenStrategy(undefined, 'default', mockLogger, 'test');

    expect(result).toBe('default');
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});

describe('handlePartialData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle all successful results', () => {
    const results = [
      { field: 'field1', value: 'value1' },
      { field: 'field2', value: 'value2' },
      { field: 'field3', value: 'value3' },
    ];

    const result = handlePartialData(results, mockLogger);

    expect(result.data).toEqual({
      field1: 'value1',
      field2: 'value2',
      field3: 'value3',
    });
    expect(result.availableFields).toEqual(['field1', 'field2', 'field3']);
    expect(result.missingFields).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('should handle partial failures', () => {
    const results = [
      { field: 'field1', value: 'value1' },
      { field: 'field2', value: null, error: new Error('Failed') },
      { field: 'field3', value: 'value3' },
    ];

    const result = handlePartialData(results, mockLogger);

    expect(result.data).toEqual({
      field1: 'value1',
      field3: 'value3',
    });
    expect(result.availableFields).toEqual(['field1', 'field3']);
    expect(result.missingFields).toEqual(['field2']);
    expect(result.warnings).toHaveLength(1);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should handle all failures', () => {
    const results = [
      { field: 'field1', value: null, error: new Error('Failed 1') },
      { field: 'field2', value: null, error: new Error('Failed 2') },
    ];

    const result = handlePartialData(results, mockLogger);

    expect(result.data).toEqual({});
    expect(result.availableFields).toEqual([]);
    expect(result.missingFields).toEqual(['field1', 'field2']);
    expect(result.warnings).toHaveLength(2);
  });
});

describe('withHistoricalFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
  });

  it('should return current data on success', async () => {
    const fn = jest.fn().mockResolvedValue({ metric: 'current' });

    const result = await withHistoricalFallback(fn, {
      historicalKey: 'hist-key',
      cache: mockCache,
      logger: mockLogger,
    });

    expect(result.data).toEqual({ metric: 'current' });
    expect(result.isHistorical).toBe(false);
    expect(result.timestamp).toBeUndefined();
    expect(mockCache.set).toHaveBeenCalled();
  });

  it('should use historical data on failure', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Failed'));
    const historicalData = {
      data: { metric: 'historical' },
      timestamp: new Date('2024-01-01'),
    };
    mockCache.get.mockResolvedValue(historicalData);

    const result = await withHistoricalFallback(fn, {
      historicalKey: 'hist-key',
      cache: mockCache,
      logger: mockLogger,
    });

    expect(result.data).toEqual({ metric: 'historical' });
    expect(result.isHistorical).toBe(true);
    expect(result.timestamp).toEqual(new Date('2024-01-01'));
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should throw when no historical data available', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Failed'));
    mockCache.get.mockResolvedValue(null);

    await expect(
      withHistoricalFallback(fn, {
        historicalKey: 'hist-key',
        cache: mockCache,
        logger: mockLogger,
      }),
    ).rejects.toThrow('No current or historical data available');
  });
});
