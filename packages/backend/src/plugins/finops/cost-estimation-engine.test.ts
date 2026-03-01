/**
 * Tests for Cost Estimation Engine
 */

import { CostEstimationEngine } from './cost-estimation-engine';
import { CostEstimationConfig, DeploymentSpec } from './types';

describe('CostEstimationEngine', () => {
  let engine: CostEstimationEngine;
  let config: CostEstimationConfig;

  beforeEach(() => {
    config = {
      opencost: {
        baseUrl: 'http://localhost:9003',
      },
      aws: {
        enabled: true,
        region: 'us-east-1',
      },
      cache: {
        ttl: 900,
      },
      pricing: {
        kubernetes: {
          cpuPerCorePerHour: 0.031,
          memoryPerGBPerHour: 0.004,
          storagePerGBPerMonth: 0.10,
        },
        aws: {
          rds: {
            perInstancePerHour: 0.50,
          },
          s3: {
            perGBPerMonth: 0.023,
          },
        },
      },
    };

    engine = new CostEstimationEngine(config);
  });

  afterEach(async () => {
    await engine.clearCache();
  });

  afterAll(() => {
    // Cleanup cache resources
    const cache = (engine as any).cache;
    if (cache && typeof cache.destroy === 'function') {
      cache.destroy();
    }
  });

  describe('estimateDeploymentCost', () => {
    it('should estimate cost for a basic deployment', async () => {
      const spec: DeploymentSpec = {
        cpu: '2',
        memory: '4Gi',
        replicas: 3,
      };

      const estimate = await engine.estimateDeploymentCost(spec);

      expect(estimate).toBeDefined();
      expect(estimate.estimatedMonthlyCost).toBeGreaterThan(0);
      expect(estimate.breakdown.kubernetes.cpu).toBeGreaterThan(0);
      expect(estimate.breakdown.kubernetes.memory).toBeGreaterThan(0);
      expect(estimate.confidence).toBe(0.85);
      expect(estimate.currency).toBe('USD');
    });

    it('should estimate cost with storage', async () => {
      const spec: DeploymentSpec = {
        cpu: '1',
        memory: '2Gi',
        storage: '10Gi',
        replicas: 2,
      };

      const estimate = await engine.estimateDeploymentCost(spec);

      expect(estimate.breakdown.kubernetes.storage).toBeGreaterThan(0);
    });

    it('should estimate AWS costs for production environment', async () => {
      const spec: DeploymentSpec = {
        cpu: '2',
        memory: '4Gi',
        replicas: 3,
        environment: 'production',
      };

      const estimate = await engine.estimateDeploymentCost(spec);

      expect(estimate.breakdown.aws.rds).toBeGreaterThan(0);
      expect(estimate.breakdown.aws.s3).toBeGreaterThan(0);
      expect(estimate.breakdown.aws.total).toBeGreaterThan(0);
    });

    it('should handle millicores CPU format', async () => {
      const spec: DeploymentSpec = {
        cpu: '2000m',
        memory: '4Gi',
        replicas: 1,
      };

      const estimate = await engine.estimateDeploymentCost(spec);

      expect(estimate.breakdown.kubernetes.cpu).toBeGreaterThan(0);
    });

    it('should handle Mi memory format', async () => {
      const spec: DeploymentSpec = {
        cpu: '2',
        memory: '4096Mi',
        replicas: 1,
      };

      const estimate = await engine.estimateDeploymentCost(spec);

      expect(estimate.breakdown.kubernetes.memory).toBeGreaterThan(0);
    });

    it('should cache estimation results', async () => {
      const spec: DeploymentSpec = {
        cpu: '2',
        memory: '4Gi',
        replicas: 3,
      };

      // First call
      const estimate1 = await engine.estimateDeploymentCost(spec);
      
      // Second call should return cached result
      const estimate2 = await engine.estimateDeploymentCost(spec);

      expect(estimate1).toEqual(estimate2);
      
      const stats = engine.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('getHistoricalCost', () => {
    it('should return historical cost data', async () => {
      const serviceName = 'test-service';
      const timeRange = '7d';

      const historicalData = await engine.getHistoricalCost(serviceName, timeRange);

      expect(historicalData).toBeDefined();
      expect(historicalData.serviceName).toBe(serviceName);
      expect(historicalData.costs.kubernetes).toBeDefined();
      expect(historicalData.costs.kubernetes.cpu).toBeGreaterThanOrEqual(0);
      expect(historicalData.costs.kubernetes.memory).toBeGreaterThanOrEqual(0);
      expect(historicalData.costs.kubernetes.storage).toBeGreaterThanOrEqual(0);
      expect(historicalData.totalCost).toBeGreaterThanOrEqual(0);
    });

    it('should cache historical cost data', async () => {
      const serviceName = 'test-service';
      const timeRange = '7d';

      // First call
      const data1 = await engine.getHistoricalCost(serviceName, timeRange);
      
      // Second call should return cached result
      const data2 = await engine.getHistoricalCost(serviceName, timeRange);

      expect(data1).toEqual(data2);
    });

    it('should handle different time ranges', async () => {
      const serviceName = 'test-service';

      const data7d = await engine.getHistoricalCost(serviceName, '7d');
      const data30d = await engine.getHistoricalCost(serviceName, '30d');

      expect(data7d.timeRange).not.toEqual(data30d.timeRange);
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      const spec: DeploymentSpec = {
        cpu: '2',
        memory: '4Gi',
        replicas: 3,
      };

      await engine.estimateDeploymentCost(spec);
      
      let stats = engine.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      await engine.clearCache();
      
      stats = engine.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should provide cache statistics', async () => {
      const spec: DeploymentSpec = {
        cpu: '2',
        memory: '4Gi',
        replicas: 3,
      };

      await engine.estimateDeploymentCost(spec);
      
      const stats = engine.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });
  });
});
