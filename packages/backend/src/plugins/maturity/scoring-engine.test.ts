/**
 * Unit tests for Service Maturity Scoring Engine
 */

import { ScoringEngine } from './scoring-engine';
import { ServiceMetadata, ScoringConfig } from './types';

describe('ScoringEngine', () => {
  let engine: ScoringEngine;
  let config: ScoringConfig;

  beforeEach(() => {
    // Default test configuration
    config = {
      categoryWeights: {
        documentation: 0.2,
        testing: 0.25,
        monitoring: 0.2,
        security: 0.25,
        costEfficiency: 0.1,
      },
      productionReadinessThreshold: 70,
      cacheTTL: 3600,
      checks: {
        documentation: {
          readme: { weight: 0.3, required: true },
          techDocs: { weight: 0.3, required: true },
          apiDocs: { weight: 0.2, required: false },
          runbook: { weight: 0.1, required: false },
          freshness: { weight: 0.1, required: false, thresholdDays: 90 },
        },
        testing: {
          unitTests: { weight: 0.3, required: true },
          integrationTests: { weight: 0.2, required: false },
          coverage: { weight: 0.3, required: true, minimumPercent: 80 },
          passing: { weight: 0.2, required: true },
        },
        monitoring: {
          metrics: { weight: 0.25, required: true },
          alerts: { weight: 0.25, required: true },
          logging: { weight: 0.2, required: true },
          dashboard: { weight: 0.15, required: false },
          slos: { weight: 0.15, required: false },
        },
        security: {
          scanning: { weight: 0.3, required: true },
          vulnerabilities: {
            weight: 0.3,
            required: true,
            maxTotal: 10,
            maxHighSeverity: 0,
          },
          dependencies: { weight: 0.2, required: false },
          secrets: { weight: 0.2, required: true },
        },
        costEfficiency: {
          budget: { weight: 0.4, required: true },
          utilization: { weight: 0.3, required: false, minimumPercent: 70 },
          trend: { weight: 0.2, required: false },
          rightSizing: { weight: 0.1, required: false },
        },
      },
    };

    engine = new ScoringEngine(config, 3600);
  });

  afterEach(() => {
    engine.destroy();
  });

  describe('calculateScorecard', () => {
    it('should calculate perfect score for service meeting all criteria', async () => {
      const metadata: ServiceMetadata = {
        serviceId: 'test-service',
        name: 'Test Service',
        owner: 'team-a',
        team: 'team-a',
        repositoryUrl: 'https://github.com/org/test-service',
        // Documentation - all pass
        hasReadme: true,
        hasTechDocs: true,
        hasApiDocs: true,
        hasRunbook: true,
        documentationFreshness: 30,
        // Testing - all pass
        hasUnitTests: true,
        hasIntegrationTests: true,
        codeCoverage: 85,
        testsPassing: true,
        // Monitoring - all pass
        hasMetrics: true,
        hasAlerts: true,
        hasLogging: true,
        hasDashboard: true,
        slosDefined: true,
        // Security - all pass
        hasSecurityScanning: true,
        vulnerabilityCount: 5,
        highSeverityVulnerabilities: 0,
        dependenciesUpToDate: true,
        secretsScanned: true,
        // Cost efficiency - all pass
        withinBudget: true,
        resourceUtilization: 75,
        costTrend: 'improving',
        hasRightSizing: true,
      };

      const scorecard = await engine.calculateScorecard('test-service', metadata);

      expect(scorecard.serviceId).toBe('test-service');
      expect(scorecard.overallScore).toBeGreaterThan(90);
      expect(scorecard.categories.documentation.status).toBe('passing');
      expect(scorecard.categories.testing.status).toBe('passing');
      expect(scorecard.categories.monitoring.status).toBe('passing');
      expect(scorecard.categories.security.status).toBe('passing');
      expect(scorecard.categories.costEfficiency.status).toBe('passing');
    });

    it('should calculate low score for service failing required checks', async () => {
      const metadata: ServiceMetadata = {
        serviceId: 'failing-service',
        name: 'Failing Service',
        owner: 'team-b',
        team: 'team-b',
        repositoryUrl: 'https://github.com/org/failing-service',
        // Documentation - fail required
        hasReadme: false,
        hasTechDocs: false,
        hasApiDocs: false,
        hasRunbook: false,
        // Testing - fail required
        hasUnitTests: false,
        hasIntegrationTests: false,
        codeCoverage: 30,
        testsPassing: false,
        // Monitoring - fail required
        hasMetrics: false,
        hasAlerts: false,
        hasLogging: false,
        hasDashboard: false,
        slosDefined: false,
        // Security - fail required
        hasSecurityScanning: false,
        vulnerabilityCount: 50,
        highSeverityVulnerabilities: 5,
        dependenciesUpToDate: false,
        secretsScanned: false,
        // Cost efficiency - fail required
        withinBudget: false,
        resourceUtilization: 30,
        costTrend: 'worsening',
        hasRightSizing: false,
      };

      const scorecard = await engine.calculateScorecard('failing-service', metadata);

      expect(scorecard.serviceId).toBe('failing-service');
      expect(scorecard.overallScore).toBeLessThan(30);
      expect(scorecard.categories.documentation.status).toBe('failing');
      expect(scorecard.categories.testing.status).toBe('failing');
      expect(scorecard.categories.monitoring.status).toBe('failing');
      expect(scorecard.categories.security.status).toBe('failing');
      expect(scorecard.categories.costEfficiency.status).toBe('failing');
    });

    it('should use cache for subsequent requests', async () => {
      const metadata: ServiceMetadata = {
        serviceId: 'cached-service',
        name: 'Cached Service',
        owner: 'team-c',
        team: 'team-c',
        repositoryUrl: 'https://github.com/org/cached-service',
        hasReadme: true,
        hasTechDocs: true,
        hasApiDocs: true,
        hasRunbook: true,
        hasUnitTests: true,
        hasIntegrationTests: true,
        codeCoverage: 80,
        testsPassing: true,
        hasMetrics: true,
        hasAlerts: true,
        hasLogging: true,
        hasDashboard: true,
        slosDefined: true,
        hasSecurityScanning: true,
        vulnerabilityCount: 0,
        highSeverityVulnerabilities: 0,
        dependenciesUpToDate: true,
        secretsScanned: true,
        withinBudget: true,
        resourceUtilization: 70,
        costTrend: 'stable',
        hasRightSizing: true,
      };

      // First call - should calculate
      const scorecard1 = await engine.calculateScorecard('cached-service', metadata);
      
      // Second call - should use cache
      const scorecard2 = await engine.calculateScorecard('cached-service', metadata);

      expect(scorecard1).toEqual(scorecard2);
      expect(scorecard1.lastUpdated).toEqual(scorecard2.lastUpdated);
    });

    it('should handle partial metadata gracefully', async () => {
      const metadata: ServiceMetadata = {
        serviceId: 'partial-service',
        name: 'Partial Service',
        owner: 'team-d',
        team: 'team-d',
        repositoryUrl: 'https://github.com/org/partial-service',
        hasReadme: true,
        hasTechDocs: true,
        hasApiDocs: false,
        hasRunbook: false,
        // No documentation freshness
        hasUnitTests: true,
        hasIntegrationTests: false,
        // No code coverage
        testsPassing: true,
        hasMetrics: true,
        hasAlerts: true,
        hasLogging: true,
        hasDashboard: false,
        slosDefined: false,
        hasSecurityScanning: true,
        // No vulnerability data
        dependenciesUpToDate: true,
        secretsScanned: true,
        withinBudget: true,
        // No utilization data
        // No cost trend
        hasRightSizing: false,
      };

      const scorecard = await engine.calculateScorecard('partial-service', metadata);

      expect(scorecard.serviceId).toBe('partial-service');
      expect(scorecard.overallScore).toBeGreaterThan(0);
      expect(scorecard.overallScore).toBeLessThan(100);
      
      // Should have checks for all categories
      expect(scorecard.categories.documentation.checks.length).toBeGreaterThan(0);
      expect(scorecard.categories.testing.checks.length).toBeGreaterThan(0);
      expect(scorecard.categories.monitoring.checks.length).toBeGreaterThan(0);
      expect(scorecard.categories.security.checks.length).toBeGreaterThan(0);
      expect(scorecard.categories.costEfficiency.checks.length).toBeGreaterThan(0);
    });
  });

  describe('recalculateScorecard', () => {
    it('should bypass cache and recalculate', async () => {
      const metadata: ServiceMetadata = {
        serviceId: 'recalc-service',
        name: 'Recalc Service',
        owner: 'team-e',
        team: 'team-e',
        repositoryUrl: 'https://github.com/org/recalc-service',
        hasReadme: true,
        hasTechDocs: true,
        hasApiDocs: true,
        hasRunbook: true,
        hasUnitTests: true,
        hasIntegrationTests: true,
        codeCoverage: 80,
        testsPassing: true,
        hasMetrics: true,
        hasAlerts: true,
        hasLogging: true,
        hasDashboard: true,
        slosDefined: true,
        hasSecurityScanning: true,
        vulnerabilityCount: 0,
        dependenciesUpToDate: true,
        secretsScanned: true,
        withinBudget: true,
        resourceUtilization: 70,
        costTrend: 'stable',
        hasRightSizing: true,
      };

      // First call - should calculate and cache
      const scorecard1 = await engine.calculateScorecard('recalc-service', metadata);
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Recalculate - should bypass cache
      const scorecard2 = await engine.recalculateScorecard('recalc-service', metadata);

      expect(scorecard1.overallScore).toBe(scorecard2.overallScore);
      expect(scorecard1.lastUpdated.getTime()).not.toBe(scorecard2.lastUpdated.getTime());
    });
  });

  describe('category scoring', () => {
    it('should weight categories correctly in overall score', async () => {
      const metadata: ServiceMetadata = {
        serviceId: 'weighted-service',
        name: 'Weighted Service',
        owner: 'team-f',
        team: 'team-f',
        repositoryUrl: 'https://github.com/org/weighted-service',
        // Perfect documentation (20% weight)
        hasReadme: true,
        hasTechDocs: true,
        hasApiDocs: true,
        hasRunbook: true,
        documentationFreshness: 10,
        // Perfect testing (25% weight)
        hasUnitTests: true,
        hasIntegrationTests: true,
        codeCoverage: 90,
        testsPassing: true,
        // Perfect monitoring (20% weight)
        hasMetrics: true,
        hasAlerts: true,
        hasLogging: true,
        hasDashboard: true,
        slosDefined: true,
        // Perfect security (25% weight)
        hasSecurityScanning: true,
        vulnerabilityCount: 0,
        highSeverityVulnerabilities: 0,
        dependenciesUpToDate: true,
        secretsScanned: true,
        // Failing cost efficiency (10% weight)
        withinBudget: false,
        resourceUtilization: 30,
        costTrend: 'worsening',
        hasRightSizing: false,
      };

      const scorecard = await engine.calculateScorecard('weighted-service', metadata);

      // Overall score should be high because cost efficiency has low weight
      expect(scorecard.overallScore).toBeGreaterThan(80);
      
      // Cost efficiency should be low
      expect(scorecard.categories.costEfficiency.score).toBeLessThan(30);
      
      // Other categories should be high
      expect(scorecard.categories.documentation.score).toBeGreaterThan(90);
      expect(scorecard.categories.testing.score).toBeGreaterThan(90);
      expect(scorecard.categories.monitoring.score).toBeGreaterThan(90);
      expect(scorecard.categories.security.score).toBeGreaterThan(90);
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', () => {
      const stats = engine.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });

    it('should clear cache', async () => {
      const metadata: ServiceMetadata = {
        serviceId: 'cache-clear-service',
        name: 'Cache Clear Service',
        owner: 'team-g',
        team: 'team-g',
        repositoryUrl: 'https://github.com/org/cache-clear-service',
        hasReadme: true,
        hasTechDocs: true,
        hasApiDocs: true,
        hasRunbook: true,
        hasUnitTests: true,
        hasIntegrationTests: true,
        codeCoverage: 80,
        testsPassing: true,
        hasMetrics: true,
        hasAlerts: true,
        hasLogging: true,
        hasDashboard: true,
        slosDefined: true,
        hasSecurityScanning: true,
        vulnerabilityCount: 0,
        dependenciesUpToDate: true,
        secretsScanned: true,
        withinBudget: true,
        resourceUtilization: 70,
        costTrend: 'stable',
        hasRightSizing: true,
      };

      // Calculate to populate cache
      await engine.calculateScorecard('cache-clear-service', metadata);
      
      let stats = engine.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      
      // Clear cache
      await engine.clearCache();
      
      stats = engine.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });
});
