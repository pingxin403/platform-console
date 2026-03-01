# Performance Optimization Migration Guide

This guide helps you migrate existing code to use the new performance optimizations.

## Overview

The performance optimization implementation (Task 22.2) introduces:

1. Redis cache layer
2. API response caching middleware
3. Database query optimization
4. Async job processing
5. Optimized anomaly detection

## Step-by-Step Migration

### Step 1: Install Dependencies

```bash
cd packages/backend
npm install ioredis@^5.3.2
```

### Step 2: Configure Redis

Add Redis configuration to your `.env` file:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
```

For local development without Redis, the system will automatically fall back to in-memory cache.

### Step 3: Update FinOps Cache

**File**: `packages/backend/src/plugins/finops/cache.ts`

Replace the in-memory cache with Redis cache:

```typescript
// Before
import { CostEstimationCache } from './cache';

const cache = new CostEstimationCache(900); // 15 minutes

// After
import { RedisCache } from '../common/redis-cache';
import { Config } from '@backstage/config';

const cache = new RedisCache(
  {
    host: config.getString('backend.cache.redis.host'),
    port: config.getNumber('backend.cache.redis.port'),
    password: config.getOptionalString('backend.cache.redis.password'),
    db: config.getOptionalNumber('backend.cache.redis.db') || 0,
    keyPrefix: 'finops:',
    defaultTTL: config.getOptionalNumber('backend.cache.ttl.costData') || 600,
  },
  logger,
);
```

### Step 4: Update Maturity Cache

**File**: `packages/backend/src/plugins/maturity/cache.ts`

Replace the in-memory cache with Redis cache:

```typescript
// Before
import { MaturityScoreCache } from './cache';

const cache = new MaturityScoreCache(3600); // 1 hour

// After
import { RedisCache } from '../common/redis-cache';
import { Config } from '@backstage/config';

const cache = new RedisCache(
  {
    host: config.getString('backend.cache.redis.host'),
    port: config.getNumber('backend.cache.redis.port'),
    password: config.getOptionalString('backend.cache.redis.password'),
    db: config.getOptionalNumber('backend.cache.redis.db') || 0,
    keyPrefix: 'maturity:',
    defaultTTL: config.getOptionalNumber('backend.cache.ttl.scorecard') || 900,
  },
  logger,
);
```

### Step 5: Add API Response Caching

**File**: `packages/backend/src/plugins/finops/plugin.ts`

Add cache middleware to API routes:

```typescript
import { createCacheMiddleware, CachePresets } from '../common/cache-middleware';
import { RedisCache } from '../common/redis-cache';

// Initialize cache
const cache = new RedisCache(/* config */, logger);

// Apply to routes
router.get(
  '/cost/:serviceId',
  createCacheMiddleware(cache, logger, {
    ...CachePresets.COST_DATA,
    varyBy: ['user-id'],
  }),
  async (req, res) => {
    // Handler code
  }
);

router.get(
  '/anomalies/:serviceId',
  createCacheMiddleware(cache, logger, {
    ...CachePresets.SHORT,
    varyBy: ['user-id'],
  }),
  async (req, res) => {
    // Handler code
  }
);
```

### Step 6: Create Database Indexes

**File**: `packages/backend/src/index.ts`

Add index creation on startup:

```typescript
import { QueryOptimizer } from './plugins/common/database-optimization';

async function main() {
  // ... existing code ...

  // Create database indexes
  const optimizer = new QueryOptimizer(database, logger);
  await optimizer.createRecommendedIndexes();

  // ... rest of startup code ...
}
```

### Step 7: Integrate Async Job Processor

**File**: `packages/backend/src/plugins/finops/plugin.ts`

Replace direct anomaly detection with async jobs:

```typescript
import { AsyncJobProcessor, JobTypes } from '../common/async-job-processor';

// Initialize job processor
const jobProcessor = new AsyncJobProcessor(
  {
    concurrency: 5,
    pollInterval: 1000,
    defaultTimeout: 60000,
    defaultMaxRetries: 3,
  },
  logger,
);

// Register anomaly detection handler
jobProcessor.registerHandler({
  type: JobTypes.COST_ANOMALY_DETECTION,
  handler: async (data: { serviceId: string }, job) => {
    const anomalies = await anomalyDetector.detectAnomalies(data.serviceId);
    
    // Send alerts
    for (const anomaly of anomalies) {
      await alertEngine.sendAlert(anomaly, data.serviceId);
    }
    
    return anomalies;
  },
  maxRetries: 3,
  timeout: 30000,
});

// Start processor
jobProcessor.start();

// Update scheduler to use job processor
class AnomalyScheduler {
  private async runDetection(): Promise<void> {
    for (const serviceId of this.config.services) {
      // Add job instead of direct processing
      await jobProcessor.addJob(
        JobTypes.COST_ANOMALY_DETECTION,
        { serviceId },
        { priority: 10 }
      );
    }
  }
}
```

### Step 8: Optimize Database Queries

**File**: `packages/backend/src/plugins/finops/cost-estimation-engine.ts`

Use optimized query builders:

```typescript
import { OptimizedQueryBuilder } from '../common/database-optimization';

// Before
const costData = await db('cost_data')
  .where('service_id', serviceId)
  .where('timestamp', '>', startDate)
  .where('timestamp', '<', endDate);

// After
const costData = await OptimizedQueryBuilder.buildCostHistoryQuery(
  db,
  serviceId,
  startDate,
  endDate,
);
```

### Step 9: Update Scorecard Calculation

**File**: `packages/backend/src/plugins/maturity/plugin.ts`

Use async job processor for bulk scorecard updates:

```typescript
import { AsyncJobProcessor, JobTypes } from '../common/async-job-processor';

// Register scorecard calculation handler
jobProcessor.registerHandler({
  type: JobTypes.SCORECARD_CALCULATION,
  handler: async (data: { serviceId: string; metadata: ServiceMetadata }, job) => {
    const scorecard = await scoringEngine.calculateScorecard(
      data.serviceId,
      data.metadata,
    );
    return scorecard;
  },
  maxRetries: 2,
  timeout: 30000,
});

// Bulk update endpoint
router.post('/scorecards/bulk-update', async (req, res) => {
  const { serviceIds } = req.body;
  
  const jobIds = await Promise.all(
    serviceIds.map(serviceId =>
      jobProcessor.addJob(
        JobTypes.SCORECARD_CALCULATION,
        { serviceId, metadata: {} },
        { priority: 5 }
      )
    )
  );
  
  res.json({ jobIds });
});
```

### Step 10: Add Cache Invalidation

**File**: `packages/backend/src/plugins/finops/plugin.ts`

Add cache invalidation on write operations:

```typescript
import { createCacheInvalidationMiddleware } from '../common/cache-middleware';

// Apply to write routes
router.use(
  createCacheInvalidationMiddleware(cache, logger, [
    'api:cost:*',
    'api:anomalies:*',
  ])
);

// Or manually invalidate
router.post('/cost/:serviceId', async (req, res) => {
  // Update cost data
  await updateCostData(req.params.serviceId, req.body);
  
  // Invalidate cache
  await cache.delete(`cost:${req.params.serviceId}`);
  
  res.json({ success: true });
});
```

## Testing

### Test Redis Connection

```typescript
import { RedisCache } from './plugins/common/redis-cache';

const cache = new RedisCache(config, logger);

// Test connection
await cache.set('test', 'value');
const value = await cache.get('test');
console.log('Redis test:', value === 'value' ? 'PASS' : 'FAIL');

// Get stats
const stats = await cache.getStats();
console.log('Cache stats:', stats);
```

### Test Cache Middleware

```bash
# First request (cache miss)
curl -i http://localhost:7007/api/cost/my-service
# Check for: X-Cache: MISS

# Second request (cache hit)
curl -i http://localhost:7007/api/cost/my-service
# Check for: X-Cache: HIT
```

### Test Database Indexes

```typescript
import { QueryOptimizer } from './plugins/common/database-optimization';

const optimizer = new QueryOptimizer(db, logger);

// Analyze query
const analysis = await optimizer.analyzeQuery(`
  SELECT * FROM cost_data 
  WHERE service_id = 'my-service' 
  AND timestamp > NOW() - INTERVAL '7 days'
`);

console.log('Execution time:', analysis.executionTime, 'ms');
console.log('Recommendations:', analysis.recommendations);
```

### Test Async Job Processor

```typescript
import { AsyncJobProcessor } from './plugins/common/async-job-processor';

const processor = new AsyncJobProcessor(config, logger);

// Add test job
const jobId = await processor.addJob('test', { data: 'test' });

// Check status
const job = processor.getJob(jobId);
console.log('Job status:', job?.status);

// Get stats
const stats = processor.getStats();
console.log('Processor stats:', stats);
```

## Rollback Plan

If you need to rollback the changes:

1. **Remove Redis dependency**
   ```bash
   npm uninstall ioredis
   ```

2. **Revert cache implementations**
   - Restore original `CostEstimationCache` in finops/cache.ts
   - Restore original `MaturityScoreCache` in maturity/cache.ts

3. **Remove cache middleware**
   - Remove `createCacheMiddleware` calls from routes

4. **Remove async job processor**
   - Restore direct processing in schedulers

5. **Remove database indexes** (optional)
   ```sql
   DROP INDEX IF EXISTS idx_cost_data_service_id;
   DROP INDEX IF EXISTS idx_cost_data_timestamp;
   -- ... etc
   ```

## Performance Monitoring

After migration, monitor these metrics:

1. **Cache Hit Rate**
   ```typescript
   const stats = await cache.getStats();
   const hitRate = stats.hits / (stats.hits + stats.misses);
   console.log('Cache hit rate:', hitRate);
   ```

2. **API Response Time**
   ```bash
   # Use Datadog APM or custom metrics
   curl -w "@curl-format.txt" -o /dev/null -s http://localhost:7007/api/cost/my-service
   ```

3. **Database Query Performance**
   ```typescript
   const slowQueries = await optimizer.getSlowQueries(1000);
   console.log('Slow queries:', slowQueries);
   ```

4. **Job Processing**
   ```typescript
   const stats = processor.getStats();
   console.log('Job stats:', stats);
   ```

## Common Issues

### Redis Connection Failed

**Symptom**: `WARN: Redis not available, using in-memory fallback cache`

**Solution**:
1. Check Redis is running: `redis-cli ping`
2. Verify connection config in `.env`
3. Check network connectivity
4. Review Redis logs

### Cache Not Working

**Symptom**: Always getting cache misses

**Solution**:
1. Check cache key generation
2. Verify TTL is not too short
3. Check if cache is being invalidated
4. Review cache middleware configuration

### Slow Queries

**Symptom**: Queries still slow after adding indexes

**Solution**:
1. Run `EXPLAIN ANALYZE` on the query
2. Check if indexes are being used
3. Run `VACUUM ANALYZE` on tables
4. Review query patterns

### Jobs Not Processing

**Symptom**: Jobs stuck in pending state

**Solution**:
1. Check job processor is started
2. Verify handler is registered
3. Check for errors in logs
4. Review concurrency settings

## Support

For issues or questions:

1. Check the [PERFORMANCE_OPTIMIZATION.md](./PERFORMANCE_OPTIMIZATION.md) documentation
2. Review error logs in Sentry
3. Check Datadog APM for performance metrics
4. Contact the platform team
