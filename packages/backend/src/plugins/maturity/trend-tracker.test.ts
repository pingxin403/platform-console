/**
 * Tests for Maturity Trend Tracking Engine
 */

import { TrendTracker } from './trend-tracker';
import { MaturityDataPoint, MaturityTrend } from './types';

describe('TrendTracker', () => {
  let tracker: TrendTracker;

  beforeEach(() => {
    tracker = new TrendTracker();
  });

  describe('calculateTrend', () => {
    it('should calculate improving trend', () => {
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date('2024-01-01'), score: 60 },
        { date: new Date('2024-01-15'), score: 70 },
        { date: new Date('2024-02-01'), score: 80 },
      ];

      const trend = tracker.calculateTrend(dataPoints);

      expect(trend.trend).toBe('improving');
      expect(trend.improvement).toBeCloseTo(33.33, 1); // (80 - 60) / 60 * 100
      expect(trend.dataPoints).toHaveLength(3);
    });

    it('should calculate declining trend', () => {
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date('2024-01-01'), score: 80 },
        { date: new Date('2024-01-15'), score: 70 },
        { date: new Date('2024-02-01'), score: 60 },
      ];

      const trend = tracker.calculateTrend(dataPoints);

      expect(trend.trend).toBe('declining');
      expect(trend.improvement).toBeCloseTo(-25, 1); // (60 - 80) / 80 * 100
    });

    it('should calculate stable trend', () => {
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date('2024-01-01'), score: 70 },
        { date: new Date('2024-01-15'), score: 72 },
        { date: new Date('2024-02-01'), score: 71 },
      ];

      const trend = tracker.calculateTrend(dataPoints);

      expect(trend.trend).toBe('stable');
      expect(Math.abs(trend.improvement)).toBeLessThan(5);
    });

    it('should handle empty data points', () => {
      const trend = tracker.calculateTrend([]);

      expect(trend.trend).toBe('stable');
      expect(trend.improvement).toBe(0);
      expect(trend.dataPoints).toHaveLength(0);
    });

    it('should sort data points by date', () => {
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date('2024-02-01'), score: 80 },
        { date: new Date('2024-01-01'), score: 60 },
        { date: new Date('2024-01-15'), score: 70 },
      ];

      const trend = tracker.calculateTrend(dataPoints);

      expect(trend.dataPoints[0].score).toBe(60); // Oldest
      expect(trend.dataPoints[2].score).toBe(80); // Newest
    });
  });

  describe('analyzeTrend', () => {
    it('should calculate velocity and projections', () => {
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date('2024-01-01'), score: 60 },
        { date: new Date('2024-01-31'), score: 70 }, // 30 days later, +10 points
      ];

      const analysis = tracker.analyzeTrend(dataPoints);

      expect(analysis.velocity).toBeCloseTo(0.333, 2); // 10 points / 30 days
      expect(analysis.projectedScore30Days).toBeCloseTo(80, 0); // 70 + (0.333 * 30)
      expect(analysis.projectedScore90Days).toBeCloseTo(100, 0); // 70 + (0.333 * 90), capped at 100
    });

    it('should handle single data point', () => {
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date('2024-01-01'), score: 60 },
      ];

      const analysis = tracker.analyzeTrend(dataPoints);

      expect(analysis.trend).toBe('stable');
      expect(analysis.velocity).toBe(0);
      expect(analysis.improvement).toBe(0);
    });

    it('should cap projections at 100', () => {
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date('2024-01-01'), score: 90 },
        { date: new Date('2024-01-11'), score: 95 }, // 10 days, +5 points = 0.5 per day
      ];

      const analysis = tracker.analyzeTrend(dataPoints);

      expect(analysis.projectedScore30Days).toBe(100); // Would be 110, capped at 100
    });

    it('should not allow negative projections', () => {
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date('2024-01-01'), score: 20 },
        { date: new Date('2024-01-11'), score: 10 }, // 10 days, -10 points = -1 per day
      ];

      const analysis = tracker.analyzeTrend(dataPoints);

      expect(analysis.projectedScore30Days).toBeGreaterThanOrEqual(0);
    });
  });

  describe('addDataPoint', () => {
    it('should add new data point to existing points', () => {
      const existingPoints: MaturityDataPoint[] = [
        { date: new Date('2024-01-01'), score: 60 },
      ];

      const newPoints = tracker.addDataPoint(existingPoints, 70, new Date('2024-01-15'));

      expect(newPoints).toHaveLength(2);
      expect(newPoints[1].score).toBe(70);
    });

    it('should use current date if not provided', () => {
      const existingPoints: MaturityDataPoint[] = [];
      const before = Date.now();
      
      const newPoints = tracker.addDataPoint(existingPoints, 70);
      
      const after = Date.now();

      expect(newPoints).toHaveLength(1);
      expect(newPoints[0].date.getTime()).toBeGreaterThanOrEqual(before);
      expect(newPoints[0].date.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('getDataPointsInRange', () => {
    it('should filter data points by date range', () => {
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date('2024-01-01'), score: 60 },
        { date: new Date('2024-01-15'), score: 70 },
        { date: new Date('2024-02-01'), score: 80 },
        { date: new Date('2024-02-15'), score: 90 },
      ];

      const filtered = tracker.getDataPointsInRange(
        dataPoints,
        new Date('2024-01-10'),
        new Date('2024-02-05'),
      );

      expect(filtered).toHaveLength(2);
      expect(filtered[0].score).toBe(70);
      expect(filtered[1].score).toBe(80);
    });

    it('should return empty array if no points in range', () => {
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date('2024-01-01'), score: 60 },
      ];

      const filtered = tracker.getDataPointsInRange(
        dataPoints,
        new Date('2024-02-01'),
        new Date('2024-02-28'),
      );

      expect(filtered).toHaveLength(0);
    });
  });

  describe('detectSignificantChanges', () => {
    it('should detect significant score changes', () => {
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date('2024-01-01'), score: 60 },
        { date: new Date('2024-01-15'), score: 70 }, // +16.67% - significant
        { date: new Date('2024-02-01'), score: 72 }, // +2.86% - not significant
        { date: new Date('2024-02-15'), score: 50 }, // -30.56% - significant
      ];

      const changes = tracker.detectSignificantChanges(dataPoints, 10);

      expect(changes).toHaveLength(2);
      expect(changes[0].newScore).toBe(70);
      expect(changes[0].changePercent).toBeCloseTo(16.67, 1);
      expect(changes[1].newScore).toBe(50);
      expect(changes[1].changePercent).toBeCloseTo(-30.56, 1);
    });

    it('should handle empty data points', () => {
      const changes = tracker.detectSignificantChanges([]);

      expect(changes).toHaveLength(0);
    });

    it('should handle single data point', () => {
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date('2024-01-01'), score: 60 },
      ];

      const changes = tracker.detectSignificantChanges(dataPoints);

      expect(changes).toHaveLength(0);
    });
  });

  describe('calculateMovingAverage', () => {
    it('should calculate 7-day moving average', () => {
      const dataPoints: MaturityDataPoint[] = Array.from({ length: 10 }, (_, i) => ({
        date: new Date(2024, 0, i + 1),
        score: 60 + i * 2, // Increasing scores
      }));

      const movingAvg = tracker.calculateMovingAverage(dataPoints, 7);

      expect(movingAvg.length).toBe(4); // 10 - 7 + 1
      expect(movingAvg[0].score).toBeCloseTo(66, 0); // Average of first 7 points
    });

    it('should return original data if window size larger than data', () => {
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date('2024-01-01'), score: 60 },
        { date: new Date('2024-01-02'), score: 70 },
      ];

      const movingAvg = tracker.calculateMovingAverage(dataPoints, 7);

      expect(movingAvg).toEqual(dataPoints);
    });
  });

  describe('comparePeriods', () => {
    it('should compare two time periods', () => {
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date('2024-01-01'), score: 60 },
        { date: new Date('2024-01-15'), score: 65 },
        { date: new Date('2024-02-01'), score: 70 },
        { date: new Date('2024-02-15'), score: 80 },
      ];

      const comparison = tracker.comparePeriods(
        dataPoints,
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        new Date('2024-02-01'),
        new Date('2024-02-28'),
      );

      expect(comparison.period1Average).toBeCloseTo(62.5, 1); // (60 + 65) / 2
      expect(comparison.period2Average).toBeCloseTo(75, 1); // (70 + 80) / 2
      expect(comparison.change).toBeCloseTo(12.5, 1);
      expect(comparison.trend).toBe('improving');
    });
  });

  describe('getLatestScore', () => {
    it('should return the most recent score', () => {
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date('2024-01-01'), score: 60 },
        { date: new Date('2024-02-01'), score: 80 },
        { date: new Date('2024-01-15'), score: 70 },
      ];

      const latestScore = tracker.getLatestScore(dataPoints);

      expect(latestScore).toBe(80); // Most recent date
    });

    it('should return null for empty data points', () => {
      const latestScore = tracker.getLatestScore([]);

      expect(latestScore).toBeNull();
    });
  });

  describe('pruneOldDataPoints', () => {
    it('should remove data points older than max age', () => {
      const now = new Date();
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000), score: 60 }, // 400 days ago
        { date: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000), score: 70 }, // 200 days ago
        { date: new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000), score: 80 }, // 100 days ago
      ];

      const pruned = tracker.pruneOldDataPoints(dataPoints, 365);

      expect(pruned).toHaveLength(2); // Only keep points within 365 days
      expect(pruned[0].score).toBe(70);
      expect(pruned[1].score).toBe(80);
    });

    it('should keep all points if within max age', () => {
      const now = new Date();
      const dataPoints: MaturityDataPoint[] = [
        { date: new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000), score: 60 },
        { date: new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000), score: 70 },
      ];

      const pruned = tracker.pruneOldDataPoints(dataPoints, 365);

      expect(pruned).toHaveLength(2);
    });
  });
});
