/**
 * Tests for Anomaly Detector
 */

import { AnomalyDetector } from './anomaly-detector';
import { CostEstimationEngine } from './cost-estimation-engine';
import { AnomalyDetectionConfig, CostEstimationConfig, HistoricalCostData } from './types';

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector;
  let mockEngine: jest.Mocked<CostEstimationEngine>;

  const defaultConfig: AnomalyDetectionConfig = {
    thresholds: {
      spike: 50, // 50% increase
      sustainedIncrease: 30, // 30% increase over time
      unusualPattern: 2, // 2 standard deviations
    },
    lookbackPeriod: 7,
    checkInterval: 60,
  };

  beforeEach(() => {
    // Create mock cost estimation engine
    const engineConfig: CostEstimationConfig = {
      opencost: { baseUrl: 'http://localhost:9003' },
      cache: { ttl: 900 },
      pricing: {
        kubernetes: {
          cpuPerCorePerHour: 0.031,
          memoryPerGBPerHour: 0.004,
          storagePerGBPerMonth: 0.10,
        },
        aws: {
          rds: { perInstancePerHour: 0.50 },
          s3: { perGBPerMonth: 0.023 },
        },
      },
    };

    mockEngine = new CostEstimationEngine(engineConfig) as jest.Mocked<CostEstimationEngine>;

    // Mock getHistoricalCost method
    mockEngine.getHistoricalCost = jest.fn();

    detector = new AnomalyDetector(defaultConfig, mockEngine);
  });

  describe('detectSpike', () => {
    it('should detect cost spike when increase exceeds threshold', async () => {
      // Mock current cost: $200
      const currentData: HistoricalCostData = {
        serviceName: 'test-service',
        timeRange: { start: '2024-01-01', end: '2024-01-08' },
        costs: {
          kubernetes: { cpu: 80, memory: 80, storage: 40, total: 200 },
        },
        totalCost: 200,
      };

      // Mock previous cost: $100 (100% increase - should trigger spike)
      const previousData: HistoricalCostData = {
        serviceName: 'test-service',
        timeRange: { start: '2023-12-25', end: '2024-01-01' },
        costs: {
          kubernetes: { cpu: 40, memory: 40, storage: 20, total: 100 },
        },
        totalCost: 100,
      };

      (mockEngine.getHistoricalCost as jest.Mock)
        .mockResolvedValueOnce(currentData)
        .mockResolvedValueOnce(previousData);

      const anomalies = await detector.detectAnomalies('test-service');

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].anomalyType).toBe('spike');
      expect(anomalies[0].severity).toBe('high');
      expect(anomalies[0].currentCost).toBe(200);
      expect(anomalies[0].expectedCost).toBe(100);
      expect(anomalies[0].deviation).toBe(100);
      expect(anomalies[0].recommendations).toContain(
        'Review recent deployments or configuration changes',
      );
    });

    it('should not detect spike when increase is below threshold', async () => {
      // Mock current cost: $120
      const currentData: HistoricalCostData = {
        serviceName: 'test-service',
        timeRange: { start: '2024-01-01', end: '2024-01-08' },
        costs: {
          kubernetes: { cpu: 48, memory: 48, storage: 24, total: 120 },
        },
        totalCost: 120,
      };

      // Mock previous cost: $100 (20% increase - below 50% threshold)
      const previousData: HistoricalCostData = {
        serviceName: 'test-service',
        timeRange: { start: '2023-12-25', end: '2024-01-01' },
        costs: {
          kubernetes: { cpu: 40, memory: 40, storage: 20, total: 100 },
        },
        totalCost: 100,
      };

      (mockEngine.getHistoricalCost as jest.Mock)
        .mockResolvedValueOnce(currentData)
        .mockResolvedValueOnce(previousData);

      const anomalies = await detector.detectAnomalies('test-service');

      // Should not detect spike, but might detect other anomalies
      const spikeAnomalies = anomalies.filter(a => a.anomalyType === 'spike');
      expect(spikeAnomalies).toHaveLength(0);
    });
  });

  describe('detectSustainedIncrease', () => {
    it('should detect sustained increase over multiple periods', async () => {
      // Mock increasing costs over time: $100 -> $120 -> $140 -> $160
      const costs = [100, 120, 140, 160];
      const mockData = costs.map((cost, idx) => ({
        serviceName: 'test-service',
        timeRange: {
          start: `2024-01-${idx * 7 + 1}`,
          end: `2024-01-${(idx + 1) * 7 + 1}`,
        },
        costs: {
          kubernetes: {
            cpu: cost * 0.4,
            memory: cost * 0.4,
            storage: cost * 0.2,
            total: cost,
          },
        },
        totalCost: cost,
      }));

      (mockEngine.getHistoricalCost as jest.Mock)
        .mockResolvedValueOnce(mockData[3]) // Current
        .mockResolvedValueOnce(mockData[2]) // Period 1
        .mockResolvedValueOnce(mockData[1]) // Period 2
        .mockResolvedValueOnce(mockData[0]); // Period 3

      const anomalies = await detector.detectAnomalies('test-service');

      const sustainedAnomalies = anomalies.filter(
        a => a.anomalyType === 'sustained_increase',
      );
      expect(sustainedAnomalies.length).toBeGreaterThan(0);
      expect(sustainedAnomalies[0].currentCost).toBe(160);
      expect(sustainedAnomalies[0].expectedCost).toBe(100);
      expect(sustainedAnomalies[0].deviation).toBe(60); // 60% increase
    });
  });

  describe('detectUnusualPattern', () => {
    it('should detect unusual pattern when cost is statistical outlier', async () => {
      // Mock stable costs: $100, $105, $98, $102, $99, $103, $101
      // Then sudden jump to $200 (outlier)
      const stableCosts = [100, 105, 98, 102, 99, 103, 101];
      const outlierCost = 200;

      const mockStableData = stableCosts.map((cost, idx) => ({
        serviceName: 'test-service',
        timeRange: {
          start: `2024-01-${idx * 7 + 1}`,
          end: `2024-01-${(idx + 1) * 7 + 1}`,
        },
        costs: {
          kubernetes: {
            cpu: cost * 0.4,
            memory: cost * 0.4,
            storage: cost * 0.2,
            total: cost,
          },
        },
        totalCost: cost,
      }));

      const mockOutlierData: HistoricalCostData = {
        serviceName: 'test-service',
        timeRange: { start: '2024-02-01', end: '2024-02-08' },
        costs: {
          kubernetes: {
            cpu: outlierCost * 0.4,
            memory: outlierCost * 0.4,
            storage: outlierCost * 0.2,
            total: outlierCost,
          },
        },
        totalCost: outlierCost,
      };

      // Mock the calls in the correct order
      // First call: current data (outlier)
      // Then calls for spike detection (previous period)
      // Then calls for sustained increase (multiple periods)
      // Then calls for unusual pattern (7 historical periods)
      (mockEngine.getHistoricalCost as jest.Mock)
        .mockResolvedValueOnce(mockOutlierData) // Current for main detectAnomalies
        .mockResolvedValueOnce(mockStableData[6]) // Previous for spike detection
        .mockResolvedValueOnce(mockStableData[5]) // Period 1 for sustained
        .mockResolvedValueOnce(mockStableData[4]) // Period 2 for sustained
        .mockResolvedValueOnce(mockStableData[3]) // Period 3 for sustained
        .mockResolvedValueOnce(mockStableData[6]) // Period 1 for unusual pattern
        .mockResolvedValueOnce(mockStableData[5]) // Period 2 for unusual pattern
        .mockResolvedValueOnce(mockStableData[4]) // Period 3 for unusual pattern
        .mockResolvedValueOnce(mockStableData[3]) // Period 4 for unusual pattern
        .mockResolvedValueOnce(mockStableData[2]) // Period 5 for unusual pattern
        .mockResolvedValueOnce(mockStableData[1]) // Period 6 for unusual pattern
        .mockResolvedValueOnce(mockStableData[0]); // Period 7 for unusual pattern

      const anomalies = await detector.detectAnomalies('test-service');

      const patternAnomalies = anomalies.filter(
        a => a.anomalyType === 'unusual_pattern',
      );
      expect(patternAnomalies.length).toBeGreaterThan(0);
      expect(patternAnomalies[0].currentCost).toBe(200);
    });
  });

  describe('getAnomalies', () => {
    it('should return all anomalies for a service', async () => {
      // Detect some anomalies first
      const currentData: HistoricalCostData = {
        serviceName: 'test-service',
        timeRange: { start: '2024-01-01', end: '2024-01-08' },
        costs: {
          kubernetes: { cpu: 80, memory: 80, storage: 40, total: 200 },
        },
        totalCost: 200,
      };

      const previousData: HistoricalCostData = {
        serviceName: 'test-service',
        timeRange: { start: '2023-12-25', end: '2024-01-01' },
        costs: {
          kubernetes: { cpu: 40, memory: 40, storage: 20, total: 100 },
        },
        totalCost: 100,
      };

      (mockEngine.getHistoricalCost as jest.Mock)
        .mockResolvedValueOnce(currentData)
        .mockResolvedValueOnce(previousData);

      await detector.detectAnomalies('test-service');

      const anomalies = await detector.getAnomalies('test-service');
      expect(anomalies.length).toBeGreaterThan(0);
    });
  });

  describe('resolveAnomaly', () => {
    it('should mark anomaly as resolved', async () => {
      // Detect an anomaly first
      const currentData: HistoricalCostData = {
        serviceName: 'test-service',
        timeRange: { start: '2024-01-01', end: '2024-01-08' },
        costs: {
          kubernetes: { cpu: 80, memory: 80, storage: 40, total: 200 },
        },
        totalCost: 200,
      };

      const previousData: HistoricalCostData = {
        serviceName: 'test-service',
        timeRange: { start: '2023-12-25', end: '2024-01-01' },
        costs: {
          kubernetes: { cpu: 40, memory: 40, storage: 20, total: 100 },
        },
        totalCost: 100,
      };

      (mockEngine.getHistoricalCost as jest.Mock)
        .mockResolvedValueOnce(currentData)
        .mockResolvedValueOnce(previousData);

      const anomalies = await detector.detectAnomalies('test-service');
      const anomalyId = anomalies[0].id;

      // Resolve the anomaly
      await detector.resolveAnomaly(anomalyId);

      // Check that it's marked as resolved
      const allAnomalies = await detector.getAnomalies('test-service');
      const resolvedAnomaly = allAnomalies.find(a => a.id === anomalyId);
      expect(resolvedAnomaly?.resolvedAt).toBeDefined();
    });
  });
});
