/**
 * Unit tests for bottleneck analyzer
 */

import { Logger } from 'winston';
import { BottleneckAnalyzer } from './bottleneck-analyzer';
import {
  BottleneckAnalysisConfig,
  WorkflowTiming,
  WorkflowStage,
} from './bottleneck-types';

describe('BottleneckAnalyzer', () => {
  let analyzer: BottleneckAnalyzer;
  let mockLogger: Logger;
  let config: BottleneckAnalysisConfig;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    config = {
      enabled: true,
      thresholds: {
        minDuration: {
          code_review: 240, // 4 hours
          ci_build: 30, // 30 minutes
          deployment: 60, // 1 hour
          incident_response: 60, // 1 hour
          service_creation: 360, // 6 hours
          documentation: 120, // 2 hours
          approval: 480, // 8 hours
        },
        minOccurrences: 5,
        minAffectedUsers: 2,
      },
      analysis: {
        lookbackDays: 30,
        minDataPoints: 10,
        outlierPercentile: 95,
      },
    };

    analyzer = new BottleneckAnalyzer(mockLogger, config);
  });

  describe('trackWorkflowTiming', () => {
    it('should track workflow timing when enabled', async () => {
      const timing: WorkflowTiming = {
        stage: 'code_review',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T15:00:00Z'),
        duration: 300, // 5 hours
        userId: 'user1',
        entityId: 'pr-123',
        entityType: 'pull_request',
      };

      await analyzer.trackWorkflowTiming(timing);

      const timings = analyzer.getWorkflowTimings();
      expect(timings).toHaveLength(1);
      expect(timings[0]).toEqual(timing);
    });

    it('should not track when disabled', async () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledAnalyzer = new BottleneckAnalyzer(mockLogger, disabledConfig);

      const timing: WorkflowTiming = {
        stage: 'code_review',
        startTime: new Date(),
        endTime: new Date(),
        duration: 300,
        entityId: 'pr-123',
        entityType: 'pull_request',
      };

      await disabledAnalyzer.trackWorkflowTiming(timing);

      const timings = disabledAnalyzer.getWorkflowTimings();
      expect(timings).toHaveLength(0);
    });
  });

  describe('analyzeBottlenecks', () => {
    it('should return error when disabled', async () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledAnalyzer = new BottleneckAnalyzer(mockLogger, disabledConfig);

      const result = await disabledAnalyzer.analyzeBottlenecks(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Bottleneck analysis is disabled');
    });

    it('should return error when insufficient data points', async () => {
      // Add only 5 timings (less than minDataPoints of 10)
      for (let i = 0; i < 5; i++) {
        await analyzer.trackWorkflowTiming({
          stage: 'code_review',
          startTime: new Date(`2024-01-0${i + 1}T10:00:00Z`),
          endTime: new Date(`2024-01-0${i + 1}T15:00:00Z`),
          duration: 300,
          entityId: `pr-${i}`,
          entityType: 'pull_request',
        });
      }

      const result = await analyzer.analyzeBottlenecks(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Insufficient data points');
    });

    it('should identify bottleneck for slow code reviews', async () => {
      // Add 15 slow code review timings (> 4 hour threshold)
      for (let i = 0; i < 15; i++) {
        await analyzer.trackWorkflowTiming({
          stage: 'code_review',
          startTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
          endTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T16:00:00Z`),
          duration: 360, // 6 hours (exceeds 4 hour threshold)
          userId: `user${i % 5}`, // 5 different users
          entityId: `pr-${i}`,
          entityType: 'pull_request',
        });
      }

      const result = await analyzer.analyzeBottlenecks(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.success).toBe(true);
      expect(result.bottlenecks.length).toBeGreaterThan(0);

      const codeReviewBottleneck = result.bottlenecks.find(b => b.stage === 'code_review');
      expect(codeReviewBottleneck).toBeDefined();
      expect(codeReviewBottleneck!.impact.averageDelay).toBeGreaterThan(240); // > 4 hours
      expect(codeReviewBottleneck!.impact.affectedUsers).toBeGreaterThan(0);
      expect(codeReviewBottleneck!.recommendations.length).toBeGreaterThan(0);
    });

    it('should identify bottleneck for slow CI builds', async () => {
      // Add 15 slow CI build timings (> 30 minute threshold)
      for (let i = 0; i < 15; i++) {
        await analyzer.trackWorkflowTiming({
          stage: 'ci_build',
          startTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
          endTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T11:00:00Z`),
          duration: 60, // 1 hour (exceeds 30 minute threshold)
          userId: `user${i % 3}`,
          entityId: `build-${i}`,
          entityType: 'ci_build',
        });
      }

      const result = await analyzer.analyzeBottlenecks(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.success).toBe(true);
      const ciBuildBottleneck = result.bottlenecks.find(b => b.stage === 'ci_build');
      expect(ciBuildBottleneck).toBeDefined();
      expect(ciBuildBottleneck!.severity).toMatch(/critical|high|medium/);
    });

    it('should calculate correct impact metrics', async () => {
      // Add 20 timings with known characteristics
      const users = ['user1', 'user2', 'user3', 'user4', 'user5'];
      for (let i = 0; i < 20; i++) {
        await analyzer.trackWorkflowTiming({
          stage: 'deployment',
          startTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
          endTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T12:00:00Z`),
          duration: 120, // 2 hours (exceeds 1 hour threshold)
          userId: users[i % users.length],
          entityId: `deploy-${i}`,
          entityType: 'deployment',
        });
      }

      const result = await analyzer.analyzeBottlenecks(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.success).toBe(true);
      const deploymentBottleneck = result.bottlenecks.find(b => b.stage === 'deployment');
      expect(deploymentBottleneck).toBeDefined();

      // Check impact metrics
      expect(deploymentBottleneck!.impact.affectedUsers).toBe(5);
      expect(deploymentBottleneck!.impact.affectedEntities).toBe(20);
      expect(deploymentBottleneck!.impact.averageDelay).toBeCloseTo(120, 0);
      expect(deploymentBottleneck!.impact.totalTimeWasted).toBeCloseTo(40, 0); // 20 * 2 hours
      expect(deploymentBottleneck!.impact.frequency).toBeGreaterThan(0);
    });

    it('should generate appropriate recommendations', async () => {
      // Add slow code review timings
      for (let i = 0; i < 15; i++) {
        await analyzer.trackWorkflowTiming({
          stage: 'code_review',
          startTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
          endTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T18:00:00Z`),
          duration: 480, // 8 hours
          userId: `user${i % 3}`,
          entityId: `pr-${i}`,
          entityType: 'pull_request',
        });
      }

      const result = await analyzer.analyzeBottlenecks(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.success).toBe(true);
      const bottleneck = result.bottlenecks[0];
      expect(bottleneck.recommendations.length).toBeGreaterThan(0);
      expect(bottleneck.recommendations[0]).toHaveProperty('action');
      expect(bottleneck.recommendations[0]).toHaveProperty('priority');
      expect(bottleneck.recommendations[0]).toHaveProperty('estimatedImpact');
      expect(bottleneck.recommendations[0]).toHaveProperty('estimatedEffort');
    });

    it('should calculate severity correctly', async () => {
      // Add critical bottleneck (very slow, many users)
      for (let i = 0; i < 20; i++) {
        await analyzer.trackWorkflowTiming({
          stage: 'incident_response',
          startTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
          endTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T16:00:00Z`),
          duration: 360, // 6 hours (3x the 2 hour threshold)
          userId: `user${i % 15}`, // 15 different users
          entityId: `incident-${i}`,
          entityType: 'incident',
        });
      }

      const result = await analyzer.analyzeBottlenecks(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.success).toBe(true);
      const incidentBottleneck = result.bottlenecks.find(b => b.stage === 'incident_response');
      expect(incidentBottleneck).toBeDefined();
      expect(incidentBottleneck!.severity).toBe('critical');
    });

    it('should generate summary correctly', async () => {
      // Add multiple bottlenecks
      const stages: WorkflowStage[] = ['code_review', 'ci_build', 'deployment'];
      stages.forEach((stage, stageIndex) => {
        for (let i = 0; i < 15; i++) {
          analyzer.trackWorkflowTiming({
            stage,
            startTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
            endTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T16:00:00Z`),
            duration: 360,
            userId: `user${i % 5}`,
            entityId: `entity-${stage}-${i}`,
            entityType: stage,
          });
        }
      });

      const result = await analyzer.analyzeBottlenecks(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.success).toBe(true);
      expect(result.summary.totalBottlenecks).toBeGreaterThan(0);
      expect(result.summary.totalTimeWasted).toBeGreaterThan(0);
      expect(result.summary.affectedUsers).toBeGreaterThan(0);
      expect(result.summary.mostProblematicStage).toBeDefined();
    });

    it('should identify friction areas', async () => {
      // Add timings that create friction
      for (let i = 0; i < 15; i++) {
        await analyzer.trackWorkflowTiming({
          stage: 'approval',
          startTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
          endTime: new Date(`2024-01-${String(i + 2).padStart(2, '0')}T10:00:00Z`),
          duration: 1440, // 24 hours (exceeds 8 hour threshold)
          userId: `user${i % 3}`,
          entityId: `approval-${i}`,
          entityType: 'approval',
        });
      }

      const result = await analyzer.analyzeBottlenecks(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.success).toBe(true);
      expect(result.frictionAreas.length).toBeGreaterThan(0);

      const approvalFriction = result.frictionAreas.find(f => f.stage === 'approval');
      expect(approvalFriction).toBeDefined();
      expect(approvalFriction!.averageDuration).toBeGreaterThan(480); // > 8 hours
      expect(approvalFriction!.occurrences).toBe(15);
    });

    it('should detect worsening trend', async () => {
      // Add timings with increasing duration over time
      for (let i = 0; i < 20; i++) {
        const duration = 300 + i * 20; // Increasing from 300 to 680 minutes
        await analyzer.trackWorkflowTiming({
          stage: 'code_review',
          startTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
          endTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T${10 + Math.floor(duration / 60)}:${duration % 60}:00Z`),
          duration,
          userId: `user${i % 3}`,
          entityId: `pr-${i}`,
          entityType: 'pull_request',
        });
      }

      const result = await analyzer.analyzeBottlenecks(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.success).toBe(true);
      const frictionArea = result.frictionAreas.find(f => f.stage === 'code_review');
      expect(frictionArea).toBeDefined();
      expect(frictionArea!.trend).toBe('worsening');
    });

    it('should not identify bottleneck when below threshold', async () => {
      // Add fast timings (below threshold)
      for (let i = 0; i < 15; i++) {
        await analyzer.trackWorkflowTiming({
          stage: 'ci_build',
          startTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
          endTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:15:00Z`),
          duration: 15, // 15 minutes (below 30 minute threshold)
          userId: `user${i % 3}`,
          entityId: `build-${i}`,
          entityType: 'ci_build',
        });
      }

      const result = await analyzer.analyzeBottlenecks(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.success).toBe(true);
      const ciBuildBottleneck = result.bottlenecks.find(b => b.stage === 'ci_build');
      expect(ciBuildBottleneck).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty timings', async () => {
      const result = await analyzer.analyzeBottlenecks(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Insufficient data points');
    });

    it('should handle timings without userId', async () => {
      for (let i = 0; i < 15; i++) {
        await analyzer.trackWorkflowTiming({
          stage: 'deployment',
          startTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
          endTime: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T12:00:00Z`),
          duration: 120,
          entityId: `deploy-${i}`,
          entityType: 'deployment',
        });
      }

      const result = await analyzer.analyzeBottlenecks(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.success).toBe(true);
      // Should still work, just with 0 affected users
      const bottleneck = result.bottlenecks.find(b => b.stage === 'deployment');
      if (bottleneck) {
        expect(bottleneck.impact.affectedUsers).toBe(0);
      }
    });

    it('should handle analysis errors gracefully', async () => {
      // Force an error by providing invalid date range
      const result = await analyzer.analyzeBottlenecks(
        new Date('2024-01-31'),
        new Date('2024-01-01'), // end before start
      );

      // Should handle gracefully
      expect(result.success).toBeDefined();
      expect(result.analyzedAt).toBeDefined();
    });
  });
});
