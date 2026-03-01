/**
 * Service Maturity Scoring Engine
 * Implements scoring rules for 5 categories:
 * 1. Documentation
 * 2. Testing
 * 3. Monitoring
 * 4. Security
 * 5. Cost Efficiency
 */

import {
  ServiceScorecard,
  ServiceMetadata,
  ScoringConfig,
  CategoryScore,
  Check,
  CheckStatus,
  CategoryType,
} from './types';
import { MaturityScoreCache } from './cache';

export class ScoringEngine {
  private cache: MaturityScoreCache;
  private config: ScoringConfig;

  constructor(config: ScoringConfig, cacheTTL: number = 3600) {
    this.config = config;
    this.cache = new MaturityScoreCache(cacheTTL);
  }

  /**
   * Calculate complete scorecard for a service
   */
  async calculateScorecard(
    serviceId: string,
    metadata: ServiceMetadata,
  ): Promise<ServiceScorecard> {
    // Check cache first
    const cacheKey = `scorecard:${serviceId}`;
    const cached = await this.cache.get<ServiceScorecard>(cacheKey);
    if (cached) {
      return cached;
    }

    // Calculate scores for each category
    const documentation = this.calculateDocumentationScore(metadata);
    const testing = this.calculateTestingScore(metadata);
    const monitoring = this.calculateMonitoringScore(metadata);
    const security = this.calculateSecurityScore(metadata);
    const costEfficiency = this.calculateCostEfficiencyScore(metadata);

    // Calculate overall score (weighted average)
    const overallScore = this.calculateOverallScore({
      documentation,
      testing,
      monitoring,
      security,
      costEfficiency,
    });

    const now = new Date();
    const scorecard: ServiceScorecard = {
      serviceId,
      overallScore,
      categories: {
        documentation,
        testing,
        monitoring,
        security,
        costEfficiency,
      },
      lastUpdated: now,
      expiresAt: new Date(now.getTime() + this.config.cacheTTL * 1000),
      version: 1,
    };

    // Cache the result
    await this.cache.set(cacheKey, scorecard, this.config.cacheTTL);

    return scorecard;
  }

  /**
   * Calculate documentation category score
   */
  private calculateDocumentationScore(metadata: ServiceMetadata): CategoryScore {
    const config = this.config.checks.documentation;
    const checks: Check[] = [];

    // README check
    checks.push({
      id: 'doc-readme',
      name: 'README exists',
      description: 'Service has a README file',
      status: metadata.hasReadme ? 'pass' : 'fail',
      required: config.readme.required,
      value: metadata.hasReadme,
      weight: config.readme.weight,
    });

    // TechDocs check
    checks.push({
      id: 'doc-techdocs',
      name: 'TechDocs available',
      description: 'Service has TechDocs documentation',
      status: metadata.hasTechDocs ? 'pass' : 'fail',
      required: config.techDocs.required,
      value: metadata.hasTechDocs,
      weight: config.techDocs.weight,
    });

    // API docs check
    checks.push({
      id: 'doc-api',
      name: 'API documentation',
      description: 'Service has API documentation',
      status: metadata.hasApiDocs ? 'pass' : 'fail',
      required: config.apiDocs.required,
      value: metadata.hasApiDocs,
      weight: config.apiDocs.weight,
    });

    // Runbook check
    checks.push({
      id: 'doc-runbook',
      name: 'Runbook available',
      description: 'Service has operational runbook',
      status: metadata.hasRunbook ? 'pass' : 'fail',
      required: config.runbook.required,
      value: metadata.hasRunbook,
      weight: config.runbook.weight,
    });

    // Documentation freshness check
    if (metadata.documentationFreshness !== undefined) {
      const isFresh = metadata.documentationFreshness <= config.freshness.thresholdDays;
      checks.push({
        id: 'doc-freshness',
        name: 'Documentation freshness',
        description: `Documentation updated within ${config.freshness.thresholdDays} days`,
        status: isFresh ? 'pass' : 'warning',
        required: config.freshness.required,
        value: metadata.documentationFreshness,
        threshold: config.freshness.thresholdDays,
        weight: config.freshness.weight,
      });
    }

    return this.calculateCategoryScore(
      checks,
      this.config.categoryWeights.documentation,
    );
  }

  /**
   * Calculate testing category score
   */
  private calculateTestingScore(metadata: ServiceMetadata): CategoryScore {
    const config = this.config.checks.testing;
    const checks: Check[] = [];

    // Unit tests check
    checks.push({
      id: 'test-unit',
      name: 'Unit tests exist',
      description: 'Service has unit tests',
      status: metadata.hasUnitTests ? 'pass' : 'fail',
      required: config.unitTests.required,
      value: metadata.hasUnitTests,
      weight: config.unitTests.weight,
    });

    // Integration tests check
    checks.push({
      id: 'test-integration',
      name: 'Integration tests exist',
      description: 'Service has integration tests',
      status: metadata.hasIntegrationTests ? 'pass' : 'fail',
      required: config.integrationTests.required,
      value: metadata.hasIntegrationTests,
      weight: config.integrationTests.weight,
    });

    // Code coverage check
    if (metadata.codeCoverage !== undefined) {
      const meetsThreshold = metadata.codeCoverage >= config.coverage.minimumPercent;
      checks.push({
        id: 'test-coverage',
        name: 'Code coverage',
        description: `Code coverage >= ${config.coverage.minimumPercent}%`,
        status: meetsThreshold ? 'pass' : metadata.codeCoverage >= config.coverage.minimumPercent * 0.8 ? 'warning' : 'fail',
        required: config.coverage.required,
        value: metadata.codeCoverage,
        threshold: config.coverage.minimumPercent,
        weight: config.coverage.weight,
      });
    }

    // Tests passing check
    checks.push({
      id: 'test-passing',
      name: 'Tests passing',
      description: 'All tests are passing',
      status: metadata.testsPassing ? 'pass' : 'fail',
      required: config.passing.required,
      value: metadata.testsPassing,
      weight: config.passing.weight,
    });

    return this.calculateCategoryScore(
      checks,
      this.config.categoryWeights.testing,
    );
  }

  /**
   * Calculate monitoring category score
   */
  private calculateMonitoringScore(metadata: ServiceMetadata): CategoryScore {
    const config = this.config.checks.monitoring;
    const checks: Check[] = [];

    // Metrics check
    checks.push({
      id: 'mon-metrics',
      name: 'Metrics instrumentation',
      description: 'Service exposes metrics',
      status: metadata.hasMetrics ? 'pass' : 'fail',
      required: config.metrics.required,
      value: metadata.hasMetrics,
      weight: config.metrics.weight,
    });

    // Alerts check
    checks.push({
      id: 'mon-alerts',
      name: 'Alerts configured',
      description: 'Service has monitoring alerts',
      status: metadata.hasAlerts ? 'pass' : 'fail',
      required: config.alerts.required,
      value: metadata.hasAlerts,
      weight: config.alerts.weight,
    });

    // Logging check
    checks.push({
      id: 'mon-logging',
      name: 'Structured logging',
      description: 'Service implements structured logging',
      status: metadata.hasLogging ? 'pass' : 'fail',
      required: config.logging.required,
      value: metadata.hasLogging,
      weight: config.logging.weight,
    });

    // Dashboard check
    checks.push({
      id: 'mon-dashboard',
      name: 'Monitoring dashboard',
      description: 'Service has monitoring dashboard',
      status: metadata.hasDashboard ? 'pass' : 'fail',
      required: config.dashboard.required,
      value: metadata.hasDashboard,
      weight: config.dashboard.weight,
    });

    // SLOs check
    checks.push({
      id: 'mon-slos',
      name: 'SLOs defined',
      description: 'Service has defined SLOs',
      status: metadata.slosDefined ? 'pass' : 'fail',
      required: config.slos.required,
      value: metadata.slosDefined,
      weight: config.slos.weight,
    });

    return this.calculateCategoryScore(
      checks,
      this.config.categoryWeights.monitoring,
    );
  }

  /**
   * Calculate security category score
   */
  private calculateSecurityScore(metadata: ServiceMetadata): CategoryScore {
    const config = this.config.checks.security;
    const checks: Check[] = [];

    // Security scanning check
    checks.push({
      id: 'sec-scanning',
      name: 'Security scanning enabled',
      description: 'Service has security scanning configured',
      status: metadata.hasSecurityScanning ? 'pass' : 'fail',
      required: config.scanning.required,
      value: metadata.hasSecurityScanning,
      weight: config.scanning.weight,
    });

    // Vulnerabilities check
    if (metadata.vulnerabilityCount !== undefined) {
      const totalOk = metadata.vulnerabilityCount <= config.vulnerabilities.maxTotal;
      const highSevOk = (metadata.highSeverityVulnerabilities ?? 0) <= config.vulnerabilities.maxHighSeverity;
      const status: CheckStatus = totalOk && highSevOk ? 'pass' : highSevOk ? 'warning' : 'fail';
      
      checks.push({
        id: 'sec-vulnerabilities',
        name: 'Vulnerability count',
        description: `Total vulnerabilities <= ${config.vulnerabilities.maxTotal}, high severity <= ${config.vulnerabilities.maxHighSeverity}`,
        status,
        required: config.vulnerabilities.required,
        value: {
          total: metadata.vulnerabilityCount,
          highSeverity: metadata.highSeverityVulnerabilities ?? 0,
        },
        threshold: {
          maxTotal: config.vulnerabilities.maxTotal,
          maxHighSeverity: config.vulnerabilities.maxHighSeverity,
        },
        weight: config.vulnerabilities.weight,
      });
    }

    // Dependencies up-to-date check
    checks.push({
      id: 'sec-dependencies',
      name: 'Dependencies up-to-date',
      description: 'Service dependencies are up-to-date',
      status: metadata.dependenciesUpToDate ? 'pass' : 'warning',
      required: config.dependencies.required,
      value: metadata.dependenciesUpToDate,
      weight: config.dependencies.weight,
    });

    // Secrets scanning check
    checks.push({
      id: 'sec-secrets',
      name: 'Secrets scanning',
      description: 'Service has secrets scanning enabled',
      status: metadata.secretsScanned ? 'pass' : 'fail',
      required: config.secrets.required,
      value: metadata.secretsScanned,
      weight: config.secrets.weight,
    });

    return this.calculateCategoryScore(
      checks,
      this.config.categoryWeights.security,
    );
  }

  /**
   * Calculate cost efficiency category score
   */
  private calculateCostEfficiencyScore(metadata: ServiceMetadata): CategoryScore {
    const config = this.config.checks.costEfficiency;
    const checks: Check[] = [];

    // Budget compliance check
    checks.push({
      id: 'cost-budget',
      name: 'Within budget',
      description: 'Service is within allocated budget',
      status: metadata.withinBudget ? 'pass' : 'fail',
      required: config.budget.required,
      value: metadata.withinBudget,
      weight: config.budget.weight,
    });

    // Resource utilization check
    if (metadata.resourceUtilization !== undefined) {
      const meetsThreshold = metadata.resourceUtilization >= config.utilization.minimumPercent;
      checks.push({
        id: 'cost-utilization',
        name: 'Resource utilization',
        description: `Resource utilization >= ${config.utilization.minimumPercent}%`,
        status: meetsThreshold ? 'pass' : metadata.resourceUtilization >= config.utilization.minimumPercent * 0.8 ? 'warning' : 'fail',
        required: config.utilization.required,
        value: metadata.resourceUtilization,
        threshold: config.utilization.minimumPercent,
        weight: config.utilization.weight,
      });
    }

    // Cost trend check
    if (metadata.costTrend) {
      checks.push({
        id: 'cost-trend',
        name: 'Cost trend',
        description: 'Service cost trend is stable or improving',
        status: metadata.costTrend === 'improving' ? 'pass' : metadata.costTrend === 'stable' ? 'warning' : 'fail',
        required: config.trend.required,
        value: metadata.costTrend,
        weight: config.trend.weight,
      });
    }

    // Right-sizing check
    checks.push({
      id: 'cost-rightsizing',
      name: 'Resource right-sizing',
      description: 'Service resources are right-sized',
      status: metadata.hasRightSizing ? 'pass' : 'warning',
      required: config.rightSizing.required,
      value: metadata.hasRightSizing,
      weight: config.rightSizing.weight,
    });

    return this.calculateCategoryScore(
      checks,
      this.config.categoryWeights.costEfficiency,
    );
  }

  /**
   * Calculate category score from checks
   */
  private calculateCategoryScore(
    checks: Check[],
    categoryWeight: number,
  ): CategoryScore {
    let totalScore = 0;
    let totalWeight = 0;

    for (const check of checks) {
      totalWeight += check.weight;
      
      // Calculate check score based on status
      let checkScore = 0;
      if (check.status === 'pass') {
        checkScore = 100;
      } else if (check.status === 'warning') {
        checkScore = 50;
      } else {
        checkScore = 0;
      }
      
      totalScore += checkScore * check.weight;
    }

    // Normalize score to 0-100
    const score = totalWeight > 0 ? totalScore / totalWeight : 0;

    // Determine category status
    let status: 'passing' | 'warning' | 'failing';
    const failedRequiredChecks = checks.filter(c => c.required && c.status === 'fail');
    
    if (failedRequiredChecks.length > 0) {
      status = 'failing';
    } else if (score >= 80) {
      status = 'passing';
    } else if (score >= 60) {
      status = 'warning';
    } else {
      status = 'failing';
    }

    return {
      score: Math.round(score * 100) / 100, // Round to 2 decimal places
      weight: categoryWeight,
      checks,
      status,
      maxScore: 100,
    };
  }

  /**
   * Calculate overall score from category scores
   */
  private calculateOverallScore(categories: {
    documentation: CategoryScore;
    testing: CategoryScore;
    monitoring: CategoryScore;
    security: CategoryScore;
    costEfficiency: CategoryScore;
  }): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [_, category] of Object.entries(categories)) {
      totalScore += category.score * category.weight;
      totalWeight += category.weight;
    }

    // Normalize to 0-100
    const overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    return Math.round(overallScore * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Force recalculation (bypass cache)
   */
  async recalculateScorecard(
    serviceId: string,
    metadata: ServiceMetadata,
  ): Promise<ServiceScorecard> {
    // Clear cache for this service
    await this.cache.delete(`scorecard:${serviceId}`);
    
    // Calculate fresh scorecard
    return this.calculateScorecard(serviceId, metadata);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return this.cache.getStats();
  }

  /**
   * Clear all cached scorecards
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Destroy engine and cleanup resources
   */
  destroy(): void {
    this.cache.destroy();
  }
}
