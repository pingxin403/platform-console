/**
 * Tests for Team Maturity Benchmarking Engine
 */

import { BenchmarkEngine, ServiceScore } from './benchmark-engine';
import { ServiceScorecard } from './types';

describe('BenchmarkEngine', () => {
  let engine: BenchmarkEngine;

  beforeEach(() => {
    engine = new BenchmarkEngine();
  });

  describe('calculateTeamBenchmark', () => {
    it('should calculate team benchmark with multiple services', () => {
      const scorecards: ServiceScorecard[] = [
        {
          serviceId: 'service-1',
          overallScore: 80,
          categories: {} as any,
          lastUpdated: new Date(),
          expiresAt: new Date(),
          version: 1,
        },
        {
          serviceId: 'service-2',
          overallScore: 90,
          categories: {} as any,
          lastUpdated: new Date(),
          expiresAt: new Date(),
          version: 1,
        },
        {
          serviceId: 'service-3',
          overallScore: 70,
          categories: {} as any,
          lastUpdated: new Date(),
          expiresAt: new Date(),
          version: 1,
        },
      ];

      const benchmark = engine.calculateTeamBenchmark('team-1', scorecards);

      expect(benchmark.teamId).toBe('team-1');
      expect(benchmark.averageScore).toBe(80); // (80 + 90 + 70) / 3
      expect(benchmark.serviceCount).toBe(3);
      expect(benchmark.topServices).toHaveLength(3);
      expect(benchmark.topServices[0].serviceId).toBe('service-2'); // Highest score
      expect(benchmark.bottomServices[0].serviceId).toBe('service-3'); // Lowest score
    });

    it('should handle empty scorecard list', () => {
      const benchmark = engine.calculateTeamBenchmark('team-1', []);

      expect(benchmark.teamId).toBe('team-1');
      expect(benchmark.averageScore).toBe(0);
      expect(benchmark.serviceCount).toBe(0);
      expect(benchmark.topServices).toHaveLength(0);
      expect(benchmark.bottomServices).toHaveLength(0);
    });

    it('should calculate score distribution correctly', () => {
      const scorecards: ServiceScorecard[] = [
        { serviceId: 's1', overallScore: 15, categories: {} as any, lastUpdated: new Date(), expiresAt: new Date(), version: 1 },
        { serviceId: 's2', overallScore: 35, categories: {} as any, lastUpdated: new Date(), expiresAt: new Date(), version: 1 },
        { serviceId: 's3', overallScore: 55, categories: {} as any, lastUpdated: new Date(), expiresAt: new Date(), version: 1 },
        { serviceId: 's4', overallScore: 75, categories: {} as any, lastUpdated: new Date(), expiresAt: new Date(), version: 1 },
        { serviceId: 's5', overallScore: 95, categories: {} as any, lastUpdated: new Date(), expiresAt: new Date(), version: 1 },
      ];

      const benchmark = engine.calculateTeamBenchmark('team-1', scorecards);

      expect(benchmark.distribution['0-20']).toBe(1);
      expect(benchmark.distribution['20-40']).toBe(1);
      expect(benchmark.distribution['40-60']).toBe(1);
      expect(benchmark.distribution['60-80']).toBe(1);
      expect(benchmark.distribution['80-100']).toBe(1);
    });

    it('should limit top and bottom services to 5', () => {
      const scorecards: ServiceScorecard[] = Array.from({ length: 10 }, (_, i) => ({
        serviceId: `service-${i}`,
        overallScore: (i + 1) * 10,
        categories: {} as any,
        lastUpdated: new Date(),
        expiresAt: new Date(),
        version: 1,
      }));

      const benchmark = engine.calculateTeamBenchmark('team-1', scorecards);

      expect(benchmark.topServices).toHaveLength(5);
      expect(benchmark.bottomServices).toHaveLength(5);
      expect(benchmark.topServices[0].score).toBe(100); // Highest
      expect(benchmark.bottomServices[0].score).toBe(10); // Lowest
    });
  });

  describe('calculateAllTeamBenchmarks', () => {
    it('should calculate benchmarks for multiple teams', () => {
      const serviceScores: ServiceScore[] = [
        { serviceId: 's1', serviceName: 'Service 1', score: 80, team: 'team-1' },
        { serviceId: 's2', serviceName: 'Service 2', score: 90, team: 'team-1' },
        { serviceId: 's3', serviceName: 'Service 3', score: 70, team: 'team-2' },
        { serviceId: 's4', serviceName: 'Service 4', score: 60, team: 'team-2' },
      ];

      const benchmarks = engine.calculateAllTeamBenchmarks(serviceScores);

      expect(benchmarks.size).toBe(2);
      expect(benchmarks.get('team-1')?.averageScore).toBe(85); // (80 + 90) / 2
      expect(benchmarks.get('team-2')?.averageScore).toBe(65); // (70 + 60) / 2
    });

    it('should handle empty service scores', () => {
      const benchmarks = engine.calculateAllTeamBenchmarks([]);

      expect(benchmarks.size).toBe(0);
    });
  });

  describe('generateTeamRankings', () => {
    it('should generate rankings sorted by average score', () => {
      const benchmarks = new Map([
        ['team-1', { teamId: 'team-1', averageScore: 85, serviceCount: 2, distribution: {}, topServices: [], bottomServices: [] }],
        ['team-2', { teamId: 'team-2', averageScore: 65, serviceCount: 2, distribution: {}, topServices: [], bottomServices: [] }],
        ['team-3', { teamId: 'team-3', averageScore: 95, serviceCount: 1, distribution: {}, topServices: [], bottomServices: [] }],
      ]);

      const rankings = engine.generateTeamRankings(benchmarks);

      expect(rankings).toHaveLength(3);
      expect(rankings[0].teamId).toBe('team-3'); // Highest score
      expect(rankings[0].rank).toBe(1);
      expect(rankings[1].teamId).toBe('team-1');
      expect(rankings[1].rank).toBe(2);
      expect(rankings[2].teamId).toBe('team-2'); // Lowest score
      expect(rankings[2].rank).toBe(3);
    });

    it('should calculate rank changes when previous rankings provided', () => {
      const benchmarks = new Map([
        ['team-1', { teamId: 'team-1', averageScore: 85, serviceCount: 2, distribution: {}, topServices: [], bottomServices: [] }],
        ['team-2', { teamId: 'team-2', averageScore: 95, serviceCount: 2, distribution: {}, topServices: [], bottomServices: [] }],
      ]);

      const previousRankings = new Map([
        ['team-1', 1], // Was rank 1
        ['team-2', 2], // Was rank 2
      ]);

      const rankings = engine.generateTeamRankings(benchmarks, previousRankings);

      expect(rankings[0].teamId).toBe('team-2');
      expect(rankings[0].change).toBe(1); // Improved from rank 2 to rank 1
      expect(rankings[1].teamId).toBe('team-1');
      expect(rankings[1].change).toBe(-1); // Declined from rank 1 to rank 2
    });
  });

  describe('generateServiceRankings', () => {
    it('should generate service rankings sorted by score', () => {
      const serviceScores: ServiceScore[] = [
        { serviceId: 's1', serviceName: 'Service 1', score: 80, team: 'team-1' },
        { serviceId: 's2', serviceName: 'Service 2', score: 90, team: 'team-1' },
        { serviceId: 's3', serviceName: 'Service 3', score: 70, team: 'team-2' },
      ];

      const rankings = engine.generateServiceRankings(serviceScores);

      expect(rankings).toHaveLength(3);
      expect(rankings[0].serviceId).toBe('s2'); // Highest score
      expect(rankings[0].rank).toBe(1);
      expect(rankings[1].serviceId).toBe('s1');
      expect(rankings[1].rank).toBe(2);
      expect(rankings[2].serviceId).toBe('s3'); // Lowest score
      expect(rankings[2].rank).toBe(3);
    });
  });

  describe('compareTeamToOrganization', () => {
    it('should compare team against organization average', () => {
      const benchmarks = new Map([
        ['team-1', { teamId: 'team-1', averageScore: 85, serviceCount: 2, distribution: {}, topServices: [], bottomServices: [] }],
        ['team-2', { teamId: 'team-2', averageScore: 65, serviceCount: 2, distribution: {}, topServices: [], bottomServices: [] }],
        ['team-3', { teamId: 'team-3', averageScore: 75, serviceCount: 1, distribution: {}, topServices: [], bottomServices: [] }],
      ]);

      const comparison = engine.compareTeamToOrganization('team-1', benchmarks);

      expect(comparison.teamId).toBe('team-1');
      expect(comparison.averageScore).toBe(85);
      expect(comparison.organizationAverage).toBe(75); // (85 + 65 + 75) / 3
      expect(comparison.gap).toBe(10); // 85 - 75
      expect(comparison.aboveAverage).toBe(true);
      expect(comparison.percentile).toBeGreaterThan(50); // Above average
    });

    it('should throw error for non-existent team', () => {
      const benchmarks = new Map([
        ['team-1', { teamId: 'team-1', averageScore: 85, serviceCount: 2, distribution: {}, topServices: [], bottomServices: [] }],
      ]);

      expect(() => {
        engine.compareTeamToOrganization('team-999', benchmarks);
      }).toThrow('Team team-999 not found in benchmarks');
    });
  });

  describe('getTopTeams', () => {
    it('should return top performing teams', () => {
      const benchmarks = new Map([
        ['team-1', { teamId: 'team-1', averageScore: 85, serviceCount: 2, distribution: {}, topServices: [], bottomServices: [] }],
        ['team-2', { teamId: 'team-2', averageScore: 65, serviceCount: 2, distribution: {}, topServices: [], bottomServices: [] }],
        ['team-3', { teamId: 'team-3', averageScore: 95, serviceCount: 1, distribution: {}, topServices: [], bottomServices: [] }],
      ]);

      const topTeams = engine.getTopTeams(benchmarks, 2);

      expect(topTeams).toHaveLength(2);
      expect(topTeams[0].teamId).toBe('team-3'); // Highest
      expect(topTeams[1].teamId).toBe('team-1'); // Second highest
    });
  });

  describe('getTeamsNeedingImprovement', () => {
    it('should return teams below threshold', () => {
      const benchmarks = new Map([
        ['team-1', { teamId: 'team-1', averageScore: 85, serviceCount: 2, distribution: {}, topServices: [], bottomServices: [] }],
        ['team-2', { teamId: 'team-2', averageScore: 55, serviceCount: 2, distribution: {}, topServices: [], bottomServices: [] }],
        ['team-3', { teamId: 'team-3', averageScore: 45, serviceCount: 1, distribution: {}, topServices: [], bottomServices: [] }],
      ]);

      const teams = engine.getTeamsNeedingImprovement(benchmarks, 60, 5);

      expect(teams).toHaveLength(2);
      expect(teams[0].teamId).toBe('team-3'); // Lowest score
      expect(teams[1].teamId).toBe('team-2');
    });
  });

  describe('calculateOrganizationStats', () => {
    it('should calculate organization-wide statistics', () => {
      const benchmarks = new Map([
        ['team-1', { teamId: 'team-1', averageScore: 80, serviceCount: 2, distribution: {}, topServices: [], bottomServices: [] }],
        ['team-2', { teamId: 'team-2', averageScore: 60, serviceCount: 3, distribution: {}, topServices: [], bottomServices: [] }],
        ['team-3', { teamId: 'team-3', averageScore: 90, serviceCount: 1, distribution: {}, topServices: [], bottomServices: [] }],
      ]);

      const stats = engine.calculateOrganizationStats(benchmarks);

      expect(stats.totalTeams).toBe(3);
      expect(stats.totalServices).toBe(6); // 2 + 3 + 1
      expect(stats.averageScore).toBeCloseTo(76.67, 1); // (80 + 60 + 90) / 3
      expect(stats.medianScore).toBe(80);
      expect(stats.highestScore).toBe(90);
      expect(stats.lowestScore).toBe(60);
      expect(stats.standardDeviation).toBeGreaterThan(0);
    });

    it('should handle empty benchmarks', () => {
      const stats = engine.calculateOrganizationStats(new Map());

      expect(stats.totalTeams).toBe(0);
      expect(stats.totalServices).toBe(0);
      expect(stats.averageScore).toBe(0);
      expect(stats.medianScore).toBe(0);
      expect(stats.highestScore).toBe(0);
      expect(stats.lowestScore).toBe(0);
      expect(stats.standardDeviation).toBe(0);
    });
  });
});
