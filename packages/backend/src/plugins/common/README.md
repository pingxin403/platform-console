# Common Error Handling Utilities

This directory contains comprehensive error handling utilities used across all IDP platform plugins.

## Overview

The error handling system provides:

1. **Retry Logic with Exponential Backoff**: Automatically retry failed operations with configurable backoff
2. **Graceful Degradation**: Fall back to cached data or default values when operations fail
3. **Fail-Open Strategy**: Allow operations to proceed when non-critical validations fail (e.g., cost estimation)
4. **Partial Data Handling**: Calculate results with available data when some data sources fail
5. **Historical Fallback**: Use recent historical data when current data is unavailable
6. **Error Monitoring**: Integrate with Sentry for error tracking and alerting
7. **User-Friendly Messages**: Convert technical errors to user-friendly messages

## Components

### 1. Error Handler (`error-handler.ts`)

Core error handling utilities:

- `ServiceError`: Custom error class with severity, retry ability, and context
- `retryWithBackoff()`: Retry function with exponential backoff
- `withGracefulDegradation()`: Execute with cache fallback
- `withTimeout()`: Wrap operations with timeout
- `failOpenStrategy()`: Implement fail-open for non-critical operations
- `handlePartialData()`: Handle partial data availability
- `withHistoricalFallback()`: Use historical data when current fails

### 2. Sentry Integration (`sentry-integration.ts`)

Error monitoring and alerting:

- `initializeSentry()`: Initialize Sentry with configuration
- `captureError()`: Capture errors with context
- `captureMessage()`: Capture messages with severity
- `startTransaction()`: Start performance monitoring transaction
- `addBreadcrumb()`: Add debugging breadcrumbs

### 3. Error Configuration (`error-config.ts`)

Centralized configuration:

- `RETRY_CONFIGS`: Retry configurations for different API types
- `TIMEOUT_CONFIGS`: Timeout values for different operations
- `CACHE_TTL_CONFIGS`: Cache TTL values for different data types
- `ERROR_SEVERITY_MAP`: Error severity mapping
- `USER_FRIENDLY_MESSAGES`: User-friendly error messages

## Usage Examples

### Example 1: External API Call with Retry

```typescript
import { retryWithBackoff, getRetryConfig, getTimeout, withTimeout } from '../common';

async function fetchFromGitHub(repo: string) {
  return retryWithBackoff(
    () => withTimeout(
      () => fetch(`https://api.github.com/repos/${repo}`),
      getTimeout('github'),
    ),
    getRetryConfig('github'),
    logger,
  );
}
```

### Example 2: Cost Estimation with Fail-Open

```typescript
import { failOpenStrategy, ServiceError, ErrorSeverity } from '../common';

async function estimateCost(spec: DeploymentSpec): Promise<CostEstimate> {
  try {
    const estimate = await calculateCost(spec);
    return estimate;
  } catch (error) {
    logger.error('Cost estimation failed, applying fail-open', { error });
    
    // Fail-open: allow deployment with zero cost
    return {
      estimatedMonthlyCost: 0,
      confidence: 0,
      warning: 'Cost estimation unavailable. Proceeding with deployment.',
    };
  }
}
```

### Example 3: Scorecard with Partial Data

```typescript
import { handlePartialData } from '../common';

async function calculateScorecard(serviceId: string): Promise<ServiceScorecard> {
  const results = await Promise.allSettled([
    calculateDocumentationScore(serviceId),
    calculateTestingScore(serviceId),
    calculateMonitoringScore(serviceId),
    calculateSecurityScore(serviceId),
    calculateCostEfficiencyScore(serviceId),
  ]);

  const partialResult = handlePartialData(
    results.map((r, i) => ({
      field: CATEGORY_NAMES[i],
      value: r.status === 'fulfilled' ? r.value : null,
      error: r.status === 'rejected' ? r.reason : undefined,
    })),
    logger,
  );

  // Use available data and warn about missing categories
  return {
    categories: partialResult.data,
    warnings: partialResult.warnings,
    availableCategories: partialResult.availableFields,
  };
}
```

### Example 4: DORA Metrics with Historical Fallback

```typescript
import { withHistoricalFallback } from '../common';

async function getDORAMetrics(serviceId: string): Promise<DORAMetrics> {
  const result = await withHistoricalFallback(
    () => calculateCurrentMetrics(serviceId),
    {
      historicalKey: `dora:${serviceId}`,
      cache: cacheProvider,
      logger,
      maxAgeSeconds: 86400, // 24 hours
    },
  );

  if (result.isHistorical) {
    logger.warn('Using historical DORA metrics', {
      serviceId,
      timestamp: result.timestamp,
    });
  }

  return result.data;
}
```

### Example 5: Graceful Degradation with Cache

```typescript
import { withGracefulDegradation } from '../common';

async function getDeploymentStatus(serviceId: string): Promise<DeploymentStatus> {
  const result = await withGracefulDegradation(
    () => fetchFromArgoCD(serviceId),
    {
      cacheKey: `deployment:${serviceId}`,
      cache: cacheProvider,
      logger,
      retryConfig: getRetryConfig('argocd'),
    },
  );

  return {
    ...result.data,
    fromCache: result.fromCache,
    warning: result.error ? 'Using cached deployment status' : undefined,
  };
}
```

## Error Severity Levels

Errors are classified into four severity levels:

1. **CRITICAL**: Affects core functionality (authentication, service creation)
   - Immediate notification
   - Examples: AUTH_FAILED, DATABASE_CONNECTION_FAILED

2. **HIGH**: Affects important functionality (cost gate, scorecard)
   - 15-minute notification window
   - Examples: BUDGET_EXCEEDED, EXTERNAL_API_UNAVAILABLE

3. **MEDIUM**: Affects secondary functionality (some integration failed)
   - 1-hour notification window
   - Examples: COST_ESTIMATION_FAILED, PARTIAL_SCORECARD_DATA

4. **LOW**: Does not affect functionality (cache miss)
   - Daily summary
   - Examples: CACHE_UNAVAILABLE, DORA_DATA_INCOMPLETE

## Error Handling Strategies

### 1. Fail-Open Strategy

Used for non-critical validations (e.g., cost estimation):

- If validation fails, allow operation to proceed
- Log warning and notify platform team
- Return default/safe value

**Use cases**: Cost estimation, budget validation

### 2. Fail-Closed Strategy

Used for critical validations (e.g., authentication):

- If validation fails, block operation
- Return error to user
- Require manual intervention

**Use cases**: Authentication, authorization, production readiness gate

### 3. Partial Data Strategy

Used when some data sources fail:

- Calculate with available data
- Mark unavailable fields
- Provide warnings about missing data

**Use cases**: Scorecard calculation, metrics aggregation

### 4. Historical Fallback Strategy

Used when current data is unavailable:

- Use recent historical data
- Mark as historical with timestamp
- Attempt to refresh in background

**Use cases**: DORA metrics, cost trends

### 5. Graceful Degradation Strategy

Used for external API failures:

- Retry with exponential backoff
- Fall back to cached data
- Use default values if no cache

**Use cases**: External API calls, deployment status

## Monitoring and Alerting

All errors are automatically captured in Sentry with:

- Error severity level
- Context information
- User information (if available)
- Breadcrumbs for debugging

Alerts are triggered based on:

- Error severity
- Error frequency
- Time window

See `error-config.ts` for alert thresholds.

## Configuration

All error handling behavior is configurable through `error-config.ts`:

- Retry attempts and delays
- Timeout values
- Cache TTL values
- Error severity mapping
- User-friendly messages

## Best Practices

1. **Always use retry for external APIs**: Network issues are common
2. **Set appropriate timeouts**: Prevent hanging operations
3. **Cache aggressively**: Reduce load on external systems
4. **Log with context**: Include relevant information for debugging
5. **Use appropriate severity**: Don't over-alert on low-severity errors
6. **Provide user-friendly messages**: Hide technical details from users
7. **Monitor error rates**: Track trends and patterns
8. **Test error scenarios**: Ensure graceful degradation works

## Testing

Error handling can be tested by:

1. **Unit tests**: Mock failures and verify error handling
2. **Integration tests**: Test with real external systems
3. **Chaos engineering**: Inject failures in production-like environment
4. **Load testing**: Verify behavior under high load

See individual plugin test files for examples.

## Future Improvements

Potential enhancements:

1. **Circuit breaker pattern**: Prevent cascading failures
2. **Adaptive retry**: Adjust retry strategy based on error patterns
3. **Predictive alerting**: Alert before failures occur
4. **Auto-remediation**: Automatically fix common issues
5. **Error analytics**: Analyze error patterns and trends
