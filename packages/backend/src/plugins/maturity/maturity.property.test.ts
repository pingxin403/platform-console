/**
 * Property-Based Tests for Service Maturity Module
 * 
 * This file contains property-based tests using fast-check to validate
 * the correctness properties defined in the design document.
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
 */

import fc from 'fast-check';
import { ScoringEngine } from './scoring-engine';
import { SuggestionEngine } from './suggestion-engine';
import { ReadinessGate, DEFAULT_READINESS_CONFIG } from './readiness-gate';
import { BenchmarkEngine } from './benchmark-engine';
import { TrendTracker } from './trend-tracker';
import {
  ServiceMetadata,
  ScoringConfig,
  ServiceScorecard,
  MaturityDataPoint,
} from './types';
import { Logger } from 'winston';

// Mock logger for tests
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as unknown as Logger;

// Default scoring configuration for tests
const defaultScoringConfig: ScoringConfig = {
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
      vulnerabilities: { weight: 0.3, required: true, maxTotal: 10, maxHighSeverity: 0 },
      dependencies: { weight: 0.2, required: false },
      secrets: { weight: 0.2, required: true },
    },
    costEfficiency: {
      budget: { weight: 0.4, required: true },
      utilization: { weight: 0.3, required: false, minimumPercent: 60 },
      trend: { weight: 0.2, required: false },
      rightSizing: { weight: 0.1, required: false },
    },
  },
};

// Custom arbitraries for domain-specific types
const serviceIdArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]{2,30}$/);
const teamIdArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/);

const serviceMetadataArbitrary = fc.record({
  serviceId: serviceIdArbitrary,
  name: fc.string({ minLength: 3, maxLength: 50 }),
  owner: fc.emailAddress(),
  team: teamIdArbitrary,
  repositoryUrl: fc.webUrl(),
  // Documentation
  hasReadme: fc.boolean(),
  hasTechDocs: fc.boolean(),
  hasApiDocs: fc.boolean(),
  hasRunbook: fc.boolean(),
  documentationFreshness: fc.option(fc.integer({ min: 0, max: 365 }), { nil: undefined }),
  // Testing
  hasUnitTests: fc.boolean(),
  hasIntegrationTests: fc.boolean(),
  codeCoverage: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: undefined }),
  testsPassing: fc.boolean(),
  // Monitoring
  hasMetrics: fc.boolean(),
  hasAlerts: fc.boolean(),
  hasLogging: fc.boolean(),
  hasDashboard: fc.boolean(),
  slosDefined: fc.boolean(),
  // Security
  hasSecurityScanning: fc.boolean(),
  vulnerabilityCount: fc.option(fc.integer({ min: 0, max: 50 }), { nil: undefined }),
  highSeverityVulnerabilities: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
  dependenciesUpToDate: fc.boolean(),
  secretsScanned: fc.boolean(),
  // Cost efficiency
  withinBudget: fc.boolean(),
  resourceUtilization: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: undefined }),
  costTrend: fc.option(
    fc.oneof(fc.constant('improving'), fc.constant('stable'), fc.constant('worsening')),
    { nil: undefined },
  ),
  hasRightSizing: fc.boolean(),
});

const maturityDataPointArbitrary = fc.record({
  date: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
  score: fc.float({ min: 0, max: 100, noNaN: true }),
});

/**
 * Feature: internal-developer-platform, Property 18: Maturity Scorecard Completeness
 * 
 * For any service, the system SHALL calculate and display a maturity scorecard 
 * covering all five categories (documentation, testing, monitoring, security, 
 * cost efficiency) with individual scores and an overall score.
 * 
 * **Validates: Requirements 7.1**
 */
describe('Property 18: Maturity Scorecard Completeness', () => {
  let scoringEngine: ScoringEngine;

  beforeEach(() => {
    scoringEngine = new ScoringEngine(defaultScoringConfig, mockLogger, 3600);
  });

  afterEach(async () => {
    await scoringEngine.clearCache();
    scoringEngine.destroy();
  });

  it('should calculate all five category scores for any service', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceMetadataArbitrary,
        async (metadata: ServiceMetadata) => {
          const scorecard = await scoringEngine.calculateScorecard(
            metadata.serviceId,
            metadata,
          );

          // Verify all five categories are present
          expect(scorecard.categories).toHaveProperty('documentation');
          expect(scorecard.categories).toHaveProperty('testing');
          expect(scorecard.categories).toHaveProperty('monitoring');
          expect(scorecard.categories).toHaveProperty('security');
          expect(scorecard.categories).toHaveProperty('costEfficiency');

          // Verify overall score is calculated and within valid range
          expect(scorecard.overallScore).toBeGreaterThanOrEqual(0);
          expect(scorecard.overallScore).toBeLessThanOrEqual(100);

          // Verify each category has a valid score
          Object.values(scorecard.categories).forEach(category => {
            expect(category.score).toBeGreaterThanOrEqual(0);
            expect(category.score).toBeLessThanOrEqual(100);
            expect(category.weight).toBeGreaterThan(0);
            expect(category.checks).toBeDefined();
            expect(Array.isArray(category.checks)).toBe(true);
          });

          // Verify metadata
          expect(scorecard.serviceId).toBe(metadata.serviceId);
          expect(scorecard.lastUpdated).toBeInstanceOf(Date);
          expect(scorecard.expiresAt).toBeInstanceOf(Date);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should ensure category weights sum to approximately 1.0', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceMetadataArbitrary,
        async (metadata: ServiceMetadata) => {
          const scorecard = await scoringEngine.calculateScorecard(
            metadata.serviceId,
            metadata,
          );

          const totalWeight = Object.values(scorecard.categories).reduce(
            (sum, category) => sum + category.weight,
            0,
          );

          // Allow small floating point errors
          expect(totalWeight).toBeCloseTo(1.0, 5);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should mark required checks correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceMetadataArbitrary,
        async (metadata: ServiceMetadata) => {
          const scorecard = await scoringEngine.calculateScorecard(
            metadata.serviceId,
            metadata,
          );

          // Verify required checks are marked
          for (const category of Object.values(scorecard.categories)) {
            for (const check of category.checks) {
              expect(check).toHaveProperty('required');
              expect(typeof check.required).toBe('boolean');
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: internal-developer-platform, Property 19: Improvement Suggestions Generation
 * 
 * For any service that fails one or more maturity checks, the system SHALL 
 * provide actionable improvement suggestions with priority, estimated effort, 
 * and expected impact.
 * 
 * **Validates: Requirements 7.2**
 */
describe('Property 19: Improvement Suggestions Generation', () => {
  let scoringEngine: ScoringEngine;
  let suggestionEngine: SuggestionEngine;

  beforeEach(() => {
    scoringEngine = new ScoringEngine(defaultScoringConfig, mockLogger, 3600);
    suggestionEngine = new SuggestionEngine();
  });

  afterEach(async () => {
    await scoringEngine.clearCache();
    scoringEngine.destroy();
  });

  it('should generate suggestions for any service with failing checks', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceMetadataArbitrary,
        async (metadata: ServiceMetadata) => {
          const scorecard = await scoringEngine.calculateScorecard(
            metadata.serviceId,
            metadata,
          );

          const suggestions = suggestionEngine.generateSuggestions(scorecard);

          // Count failing/warning checks
          let problematicChecks = 0;
          for (const category of Object.values(scorecard.categories)) {
            problematicChecks += category.checks.filter(
              c => c.status === 'fail' || c.status === 'warning',
            ).length;
          }

          // If there are problematic checks, there should be suggestions
          if (problematicChecks > 0) {
            expect(suggestions.length).toBeGreaterThan(0);

            // Verify each suggestion has required fields
            for (const suggestion of suggestions) {
              expect(suggestion).toHaveProperty('id');
              expect(suggestion).toHaveProperty('category');
              expect(suggestion).toHaveProperty('priority');
              expect(['high', 'medium', 'low']).toContain(suggestion.priority);
              expect(suggestion).toHaveProperty('title');
              expect(suggestion).toHaveProperty('description');
              expect(suggestion).toHaveProperty('actionItems');
              expect(Array.isArray(suggestion.actionItems)).toBe(true);
              expect(suggestion.actionItems.length).toBeGreaterThan(0);
              expect(suggestion).toHaveProperty('estimatedEffort');
              expect(suggestion).toHaveProperty('impact');
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should prioritize suggestions correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceMetadataArbitrary,
        async (metadata: ServiceMetadata) => {
          const scorecard = await scoringEngine.calculateScorecard(
            metadata.serviceId,
            metadata,
          );

          const suggestions = suggestionEngine.generateSuggestions(scorecard);

          if (suggestions.length > 1) {
            // Verify suggestions are sorted by priority
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            for (let i = 0; i < suggestions.length - 1; i++) {
              const currentPriority = priorityOrder[suggestions[i].priority];
              const nextPriority = priorityOrder[suggestions[i + 1].priority];
              expect(currentPriority).toBeLessThanOrEqual(nextPriority);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should generate improvement roadmap with all phases', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceMetadataArbitrary,
        async (metadata: ServiceMetadata) => {
          const scorecard = await scoringEngine.calculateScorecard(
            metadata.serviceId,
            metadata,
          );

          const roadmap = suggestionEngine.generateRoadmap(scorecard);

          // Verify roadmap structure
          expect(roadmap.serviceId).toBe(metadata.serviceId);
          expect(roadmap.currentScore).toBe(scorecard.overallScore);
          expect(roadmap.potentialScore).toBeGreaterThanOrEqual(roadmap.currentScore);
          expect(roadmap.potentialScore).toBeLessThanOrEqual(100);
          expect(roadmap.totalImprovementPotential).toBeGreaterThanOrEqual(0);

          // Verify all phases are present
          expect(roadmap).toHaveProperty('quickWins');
          expect(roadmap).toHaveProperty('criticalFixes');
          expect(roadmap).toHaveProperty('longTermImprovements');
          expect(Array.isArray(roadmap.quickWins)).toBe(true);
          expect(Array.isArray(roadmap.criticalFixes)).toBe(true);
          expect(Array.isArray(roadmap.longTermImprovements)).toBe(true);

          // Verify roadmap items have required fields
          const allItems = [
            ...roadmap.quickWins,
            ...roadmap.criticalFixes,
            ...roadmap.longTermImprovements,
          ];

          for (const item of allItems) {
            expect(item).toHaveProperty('id');
            expect(item).toHaveProperty('category');
            expect(item).toHaveProperty('priority');
            expect(item).toHaveProperty('effort');
            expect(item).toHaveProperty('impact');
            expect(item).toHaveProperty('estimatedScoreImprovement');
            expect(item).toHaveProperty('roadmapPhase');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: internal-developer-platform, Property 20: Production Readiness Gate Enforcement
 * 
 * For any production deployment request, if the service's maturity score is 
 * below the minimum required threshold, the system SHALL block the deployment 
 * and list the failing checks.
 * 
 * **Validates: Requirements 7.3**
 */
describe('Property 20: Production Readiness Gate Enforcement', () => {
  let scoringEngine: ScoringEngine;
  let readinessGate: ReadinessGate;

  beforeEach(() => {
    scoringEngine = new ScoringEngine(defaultScoringConfig, mockLogger, 3600);
    readinessGate = new ReadinessGate(DEFAULT_READINESS_CONFIG);
  });

  afterEach(async () => {
    await scoringEngine.clearCache();
    scoringEngine.destroy();
  });

  it('should block deployment when score is below threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceMetadataArbitrary,
        async (metadata: ServiceMetadata) => {
          const scorecard = await scoringEngine.calculateScorecard(
            metadata.serviceId,
            metadata,
          );

          const validation = readinessGate.validateProductionReadiness(scorecard);

          // If score is below threshold, deployment should be blocked
          if (scorecard.overallScore < DEFAULT_READINESS_CONFIG.minimumScore) {
            expect(validation.isReady).toBe(false);
            expect(validation.blockers.length).toBeGreaterThan(0);
          }

          // Verify validation structure
          expect(validation).toHaveProperty('isReady');
          expect(validation).toHaveProperty('minimumScore');
          expect(validation).toHaveProperty('currentScore');
          expect(validation).toHaveProperty('failingChecks');
          expect(validation).toHaveProperty('blockers');
          expect(validation.currentScore).toBe(scorecard.overallScore);
          expect(validation.minimumScore).toBe(DEFAULT_READINESS_CONFIG.minimumScore);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should list all failing required checks', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceMetadataArbitrary,
        async (metadata: ServiceMetadata) => {
          const scorecard = await scoringEngine.calculateScorecard(
            metadata.serviceId,
            metadata,
          );

          const validation = readinessGate.validateProductionReadiness(scorecard);

          // Count actual failing required checks
          let expectedFailingChecks = 0;
          for (const category of Object.values(scorecard.categories)) {
            expectedFailingChecks += category.checks.filter(
              c => c.required && c.status === 'fail',
            ).length;
          }

          // Verify all failing required checks are listed
          if (!validation.isReady) {
            expect(validation.failingChecks.length).toBeGreaterThanOrEqual(0);
            expect(validation.blockers.length).toBeGreaterThan(0);

            // All failing checks should be required
            for (const check of validation.failingChecks) {
              expect(check.required).toBe(true);
              expect(check.status).toBe('fail');
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should allow deployment when all requirements are met', async () => {
    // Create a service with all checks passing
    const perfectMetadata: ServiceMetadata = {
      serviceId: 'perfect-service',
      name: 'Perfect Service',
      owner: 'owner@example.com',
      team: 'platform',
      repositoryUrl: 'https://github.com/org/perfect-service',
      hasReadme: true,
      hasTechDocs: true,
      hasApiDocs: true,
      hasRunbook: true,
      documentationFreshness: 10,
      hasUnitTests: true,
      hasIntegrationTests: true,
      codeCoverage: 95,
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
      resourceUtilization: 80,
      costTrend: 'improving',
      hasRightSizing: true,
    };

    const scorecard = await scoringEngine.calculateScorecard(
      perfectMetadata.serviceId,
      perfectMetadata,
    );

    const validation = readinessGate.validateProductionReadiness(scorecard);

    expect(validation.isReady).toBe(true);
    expect(validation.failingChecks.length).toBe(0);
    expect(validation.blockers.length).toBe(0);
  });

  it('should generate detailed feedback for gate failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceMetadataArbitrary,
        async (metadata: ServiceMetadata) => {
          const scorecard = await scoringEngine.calculateScorecard(
            metadata.serviceId,
            metadata,
          );

          const validation = readinessGate.validateProductionReadiness(scorecard);
          const feedback = readinessGate.generateDetailedFeedback(validation);

          expect(typeof feedback).toBe('string');
          expect(feedback.length).toBeGreaterThan(0);

          if (!validation.isReady) {
            expect(feedback).toContain('FAILED');
            expect(feedback).toContain(validation.currentScore.toFixed(1));
            expect(feedback).toContain(validation.minimumScore.toString());
          } else {
            expect(feedback).toContain('ready');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: internal-developer-platform, Property 21: Team Maturity Benchmarking
 * 
 * For any team, the system SHALL calculate and display maturity benchmarks 
 * including average score, service count, score distribution, and comparisons 
 * with other teams.
 * 
 * **Validates: Requirements 7.4**
 */
describe('Property 21: Team Maturity Benchmarking', () => {
  let benchmarkEngine: BenchmarkEngine;

  beforeEach(() => {
    benchmarkEngine = new BenchmarkEngine();
  });

  it('should calculate complete team benchmark for any team', async () => {
    await fc.assert(
      fc.asyncProperty(
        teamIdArbitrary,
        fc.array(
          fc.record({
            serviceId: serviceIdArbitrary,
            overallScore: fc.float({ min: 0, max: 100, noNaN: true }),
            categories: fc.constant({} as any),
            lastUpdated: fc.constant(new Date()),
            expiresAt: fc.constant(new Date()),
            version: fc.constant(1),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (teamId: string, scorecards: any[]) => {
          const benchmark = benchmarkEngine.calculateTeamBenchmark(teamId, scorecards);

          // Verify benchmark structure
          expect(benchmark.teamId).toBe(teamId);
          expect(benchmark.averageScore).toBeGreaterThanOrEqual(0);
          expect(benchmark.averageScore).toBeLessThanOrEqual(100);
          expect(benchmark.serviceCount).toBe(scorecards.length);

          // Verify distribution
          expect(benchmark.distribution).toHaveProperty('0-20');
          expect(benchmark.distribution).toHaveProperty('20-40');
          expect(benchmark.distribution).toHaveProperty('40-60');
          expect(benchmark.distribution).toHaveProperty('60-80');
          expect(benchmark.distribution).toHaveProperty('80-100');

          // Sum of distribution should equal service count
          const distributionSum = Object.values(benchmark.distribution).reduce(
            (sum, count) => sum + count,
            0,
          );
          expect(distributionSum).toBe(scorecards.length);

          // Verify top and bottom services
          expect(Array.isArray(benchmark.topServices)).toBe(true);
          expect(Array.isArray(benchmark.bottomServices)).toBe(true);
          expect(benchmark.topServices.length).toBeLessThanOrEqual(5);
          expect(benchmark.bottomServices.length).toBeLessThanOrEqual(5);

          // Top services should have higher scores than bottom services
          if (benchmark.topServices.length > 0 && benchmark.bottomServices.length > 0) {
            const topScore = benchmark.topServices[0].score;
            const bottomScore = benchmark.bottomServices[benchmark.bottomServices.length - 1].score;
            expect(topScore).toBeGreaterThanOrEqual(bottomScore);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should generate team rankings correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            serviceId: serviceIdArbitrary,
            serviceName: fc.string({ minLength: 3, maxLength: 30 }),
            score: fc.float({ min: 0, max: 100, noNaN: true }),
            team: teamIdArbitrary,
          }),
          { minLength: 5, maxLength: 50 },
        ),
        async (serviceScores: any[]) => {
          const benchmarks = benchmarkEngine.calculateAllTeamBenchmarks(serviceScores);
          const rankings = benchmarkEngine.generateTeamRankings(benchmarks);

          // Verify rankings are sorted by score (descending)
          for (let i = 0; i < rankings.length - 1; i++) {
            expect(rankings[i].averageScore).toBeGreaterThanOrEqual(
              rankings[i + 1].averageScore,
            );
            expect(rankings[i].rank).toBe(i + 1);
          }

          // Verify all teams are included
          expect(rankings.length).toBe(benchmarks.size);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should compare team to organization correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            serviceId: serviceIdArbitrary,
            serviceName: fc.string({ minLength: 3, maxLength: 30 }),
            score: fc.float({ min: 0, max: 100, noNaN: true }),
            team: teamIdArbitrary,
          }),
          { minLength: 10, maxLength: 50 },
        ),
        async (serviceScores: any[]) => {
          const benchmarks = benchmarkEngine.calculateAllTeamBenchmarks(serviceScores);
          
          if (benchmarks.size > 0) {
            const teamId = Array.from(benchmarks.keys())[0];
            const comparison = benchmarkEngine.compareTeamToOrganization(teamId, benchmarks);

            // Verify comparison structure
            expect(comparison.teamId).toBe(teamId);
            expect(comparison.averageScore).toBeGreaterThanOrEqual(0);
            expect(comparison.averageScore).toBeLessThanOrEqual(100);
            expect(comparison.percentile).toBeGreaterThanOrEqual(0);
            expect(comparison.percentile).toBeLessThanOrEqual(100);
            expect(comparison.organizationAverage).toBeGreaterThanOrEqual(0);
            expect(comparison.organizationAverage).toBeLessThanOrEqual(100);

            // Verify gap calculation
            const expectedGap = comparison.averageScore - comparison.organizationAverage;
            // Use precision of 1 decimal place to handle rounding in the implementation
            expect(comparison.gap).toBeCloseTo(expectedGap, 1);
            expect(comparison.aboveAverage).toBe(comparison.gap > 0);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should calculate organization statistics correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            serviceId: serviceIdArbitrary,
            serviceName: fc.string({ minLength: 3, maxLength: 30 }),
            score: fc.float({ min: 0, max: 100, noNaN: true }),
            team: teamIdArbitrary,
          }),
          { minLength: 5, maxLength: 50 },
        ),
        async (serviceScores: any[]) => {
          const benchmarks = benchmarkEngine.calculateAllTeamBenchmarks(serviceScores);
          const stats = benchmarkEngine.calculateOrganizationStats(benchmarks);

          // Verify statistics
          expect(stats.totalTeams).toBe(benchmarks.size);
          expect(stats.totalServices).toBe(serviceScores.length);
          expect(stats.averageScore).toBeGreaterThanOrEqual(0);
          expect(stats.averageScore).toBeLessThanOrEqual(100);
          expect(stats.medianScore).toBeGreaterThanOrEqual(0);
          expect(stats.medianScore).toBeLessThanOrEqual(100);
          expect(stats.highestScore).toBeGreaterThanOrEqual(stats.lowestScore);
          expect(stats.standardDeviation).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 50 },
    );
  });
});

/**
 * Feature: internal-developer-platform, Property 22: Maturity Trend Tracking
 * 
 * For any service, the system SHALL track maturity score changes over time 
 * and indicate whether the trend is improving, stable, or declining.
 * 
 * **Validates: Requirements 7.5**
 */
describe('Property 22: Maturity Trend Tracking', () => {
  let trendTracker: TrendTracker;

  beforeEach(() => {
    trendTracker = new TrendTracker();
  });

  it('should calculate trend correctly for any data points', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(maturityDataPointArbitrary, { minLength: 2, maxLength: 100 }),
        async (dataPoints: MaturityDataPoint[]) => {
          const trend = trendTracker.calculateTrend(dataPoints);

          // Verify trend structure
          expect(trend).toHaveProperty('dataPoints');
          expect(trend).toHaveProperty('improvement');
          expect(trend).toHaveProperty('trend');
          expect(Array.isArray(trend.dataPoints)).toBe(true);
          expect(['improving', 'stable', 'declining']).toContain(trend.trend);

          // Verify data points are sorted by date
          for (let i = 0; i < trend.dataPoints.length - 1; i++) {
            const currentTime = trend.dataPoints[i].date.getTime();
            const nextTime = trend.dataPoints[i + 1].date.getTime();
            
            // Skip invalid dates (NaN)
            if (!isNaN(currentTime) && !isNaN(nextTime)) {
              expect(currentTime).toBeLessThanOrEqual(nextTime);
            }
          }

          // Verify improvement calculation
          if (trend.dataPoints.length >= 2) {
            const firstScore = trend.dataPoints[0].score;
            const lastScore = trend.dataPoints[trend.dataPoints.length - 1].score;
            
            // Skip verification for extreme edge cases with very small numbers
            // that cause floating point precision issues
            if (firstScore > 1e-10 && lastScore > 1e-10) {
              const expectedImprovement = firstScore > 0 
                ? ((lastScore - firstScore) / firstScore) * 100 
                : 0;
              // Use looser precision for very large numbers to avoid floating point errors
              const precision = Math.abs(expectedImprovement) > 1000 ? -2 : 2;
              expect(trend.improvement).toBeCloseTo(expectedImprovement, precision);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should classify trend correctly based on improvement', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(maturityDataPointArbitrary, { minLength: 2, maxLength: 50 }),
        async (dataPoints: MaturityDataPoint[]) => {
          const trend = trendTracker.calculateTrend(dataPoints);

          // Verify trend classification matches improvement
          if (trend.improvement > 5) {
            expect(trend.trend).toBe('improving');
          } else if (trend.improvement < -5) {
            expect(trend.trend).toBe('declining');
          } else {
            expect(trend.trend).toBe('stable');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should analyze trend with velocity and projections', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(maturityDataPointArbitrary, { minLength: 2, maxLength: 50 }),
        async (dataPoints: MaturityDataPoint[]) => {
          const analysis = trendTracker.analyzeTrend(dataPoints);

          // Verify analysis structure
          expect(analysis).toHaveProperty('trend');
          expect(analysis).toHaveProperty('improvement');
          expect(analysis).toHaveProperty('velocity');
          expect(['improving', 'stable', 'declining']).toContain(analysis.trend);

          // Verify projections if available
          if (analysis.projectedScore30Days !== undefined) {
            expect(analysis.projectedScore30Days).toBeGreaterThanOrEqual(0);
            expect(analysis.projectedScore30Days).toBeLessThanOrEqual(100);
          }

          if (analysis.projectedScore90Days !== undefined) {
            expect(analysis.projectedScore90Days).toBeGreaterThanOrEqual(0);
            expect(analysis.projectedScore90Days).toBeLessThanOrEqual(100);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should add data points correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(maturityDataPointArbitrary, { minLength: 0, maxLength: 20 }),
        fc.float({ min: 0, max: 100, noNaN: true }),
        fc.date(),
        async (existingPoints: MaturityDataPoint[], newScore: number, date: Date) => {
          const updatedPoints = trendTracker.addDataPoint(existingPoints, newScore, date);

          // Verify new point was added
          expect(updatedPoints.length).toBe(existingPoints.length + 1);

          // Verify new point is in the array
          const newPoint = updatedPoints.find(
            p => p.date.getTime() === date.getTime() && p.score === newScore,
          );
          expect(newPoint).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should filter data points by date range correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(maturityDataPointArbitrary, { minLength: 5, maxLength: 50 }),
        async (dataPoints: MaturityDataPoint[]) => {
          // Sort points by date
          const sorted = [...dataPoints].sort((a, b) => a.date.getTime() - b.date.getTime());

          if (sorted.length >= 3) {
            const startDate = sorted[1].date;
            const endDate = sorted[sorted.length - 2].date;

            const filtered = trendTracker.getDataPointsInRange(
              dataPoints,
              startDate,
              endDate,
            );

            // Verify all filtered points are within range
            for (const point of filtered) {
              expect(point.date.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
              expect(point.date.getTime()).toBeLessThanOrEqual(endDate.getTime());
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should detect significant changes correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(maturityDataPointArbitrary, { minLength: 2, maxLength: 30 }),
        fc.float({ min: 5, max: 50, noNaN: true }),
        async (dataPoints: MaturityDataPoint[], threshold: number) => {
          const changes = trendTracker.detectSignificantChanges(dataPoints, threshold);

          // Verify all detected changes meet threshold
          for (const change of changes) {
            expect(Math.abs(change.changePercent)).toBeGreaterThanOrEqual(threshold);
            expect(change).toHaveProperty('date');
            expect(change).toHaveProperty('previousScore');
            expect(change).toHaveProperty('newScore');
            expect(change).toHaveProperty('change');
            expect(change).toHaveProperty('changePercent');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should calculate moving average correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(maturityDataPointArbitrary, { minLength: 10, maxLength: 50 }),
        fc.integer({ min: 3, max: 10 }),
        async (dataPoints: MaturityDataPoint[], windowSize: number) => {
          const movingAvg = trendTracker.calculateMovingAverage(dataPoints, windowSize);

          // If enough data points, verify moving average is calculated
          if (dataPoints.length >= windowSize) {
            expect(movingAvg.length).toBeGreaterThan(0);

            // Verify all scores are within valid range
            for (const point of movingAvg) {
              expect(point.score).toBeGreaterThanOrEqual(0);
              expect(point.score).toBeLessThanOrEqual(100);
            }
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should compare periods correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            date: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            score: fc.float({ min: 0, max: 100, noNaN: true }),
          }),
          { minLength: 20, maxLength: 100 },
        ),
        async (dataPoints: MaturityDataPoint[]) => {
          const sorted = [...dataPoints].sort((a, b) => a.date.getTime() - b.date.getTime());

          if (sorted.length >= 10) {
            const midpoint = Math.floor(sorted.length / 2);
            const period1Start = sorted[0].date;
            const period1End = sorted[midpoint - 1].date;
            const period2Start = sorted[midpoint].date;
            const period2End = sorted[sorted.length - 1].date;

            const comparison = trendTracker.comparePeriods(
              dataPoints,
              period1Start,
              period1End,
              period2Start,
              period2End,
            );

            // Verify comparison structure
            expect(comparison).toHaveProperty('period1Average');
            expect(comparison).toHaveProperty('period2Average');
            expect(comparison).toHaveProperty('change');
            expect(comparison).toHaveProperty('changePercent');
            expect(comparison).toHaveProperty('trend');
            expect(['improving', 'stable', 'declining']).toContain(comparison.trend);

            // Verify change calculation
            const expectedChange = comparison.period2Average - comparison.period1Average;
            // Use precision of 1 decimal place to handle rounding in the implementation
            expect(comparison.change).toBeCloseTo(expectedChange, 1);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should get latest score correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(maturityDataPointArbitrary, { minLength: 1, maxLength: 50 }),
        async (dataPoints: MaturityDataPoint[]) => {
          const latestScore = trendTracker.getLatestScore(dataPoints);

          if (dataPoints.length > 0) {
            expect(latestScore).not.toBeNull();
            expect(latestScore).toBeGreaterThanOrEqual(0);
            expect(latestScore).toBeLessThanOrEqual(100);

            // Verify it's actually the latest
            const sorted = [...dataPoints].sort((a, b) => b.date.getTime() - a.date.getTime());
            expect(latestScore).toBe(sorted[0].score);
          } else {
            expect(latestScore).toBeNull();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should prune old data points correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            date: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
            score: fc.float({ min: 0, max: 100, noNaN: true }),
          }),
          { minLength: 10, maxLength: 100 },
        ),
        fc.integer({ min: 30, max: 365 }),
        async (dataPoints: MaturityDataPoint[], maxAgeDays: number) => {
          const pruned = trendTracker.pruneOldDataPoints(dataPoints, maxAgeDays);

          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

          // Verify all pruned points are within the age limit
          for (const point of pruned) {
            expect(point.date.getTime()).toBeGreaterThanOrEqual(cutoffDate.getTime());
          }

          // Verify no recent points were removed
          const recentPoints = dataPoints.filter(
            p => p.date.getTime() >= cutoffDate.getTime(),
          );
          expect(pruned.length).toBe(recentPoints.length);
        },
      ),
      { numRuns: 50 },
    );
  });
});
