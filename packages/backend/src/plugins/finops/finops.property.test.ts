/**
 * Property-Based Tests for FinOps Module
 * 
 * This file contains property-based tests using fast-check to validate
 * the correctness properties defined in the design document.
 * 
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
 */

import fc from 'fast-check';
import { CostEstimationEngine } from './cost-estimation-engine';
import { BudgetManager } from './budget-manager';
import { AnomalyDetector } from './anomaly-detector';
import { CostEfficiencyCalculator } from './cost-efficiency';
import {
  CostEstimationConfig,
  DeploymentSpec,
  CostEstimate,
  AnomalyDetectionConfig,
} from './types';
import { Logger } from 'winston';

// Mock logger for tests
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as unknown as Logger;

// Default configuration for tests
const defaultConfig: CostEstimationConfig = {
  opencost: {
    baseUrl: 'http://localhost:9003',
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
      enabled: true,
      rds: {
        perInstancePerHour: 0.50,
      },
      s3: {
        perGBPerMonth: 0.023,
      },
    },
  },
};

const anomalyConfig: AnomalyDetectionConfig = {
  thresholds: {
    spike: 50,
    sustainedIncrease: 30,
    unusualPattern: 2,
  },
  lookbackPeriod: 7,
  checkInterval: 60,
};

// Custom arbitraries for domain-specific types
const deploymentSpecArbitrary = fc.record({
  cpu: fc.oneof(
    fc.constant('0.5'),
    fc.constant('1'),
    fc.constant('2'),
    fc.constant('4'),
    fc.constant('8'),
  ),
  memory: fc.oneof(
    fc.constant('512Mi'),
    fc.constant('1Gi'),
    fc.constant('2Gi'),
    fc.constant('4Gi'),
    fc.constant('8Gi'),
  ),
  storage: fc.option(
    fc.oneof(
      fc.constant('10Gi'),
      fc.constant('20Gi'),
      fc.constant('50Gi'),
      fc.constant('100Gi'),
    ),
    { nil: undefined },
  ),
  replicas: fc.integer({ min: 1, max: 10 }),
  environment: fc.oneof(
    fc.constant('development'),
    fc.constant('staging'),
    fc.constant('production'),
  ),
});

const serviceIdArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]{2,30}$/);

const budgetArbitrary = fc.record({
  monthlyBudget: fc.float({ min: 100, max: 10000, noNaN: true }),
  alertThreshold: fc.integer({ min: 50, max: 95 }),
});

/**
 * Feature: internal-developer-platform, Property 11: Cost Data Completeness
 * 
 * For any service, when viewing cost data, the system SHALL display monthly 
 * Kubernetes costs (CPU, memory, storage breakdown), AWS resource costs, 
 * cost trends with percentage changes, and cost efficiency metrics 
 * (cost per request, cost per user).
 * 
 * **Validates: Requirements 5.1, 5.2, 5.5**
 */
describe('Property 11: Cost Data Completeness', () => {
  let costEngine: CostEstimationEngine;
  let efficiencyCalculator: CostEfficiencyCalculator;

  beforeEach(() => {
    costEngine = new CostEstimationEngine(defaultConfig, mockLogger);
    efficiencyCalculator = new CostEfficiencyCalculator(costEngine, {
      opencost: defaultConfig.opencost,
      cache: defaultConfig.cache,
    });
  });

  afterEach(async () => {
    await costEngine.clearCache();
    await efficiencyCalculator.clearCache();
  });

  it('should display complete Kubernetes cost breakdown for any deployment spec', async () => {
    await fc.assert(
      fc.asyncProperty(
        deploymentSpecArbitrary,
        async (spec: DeploymentSpec) => {
          const estimate = await costEngine.estimateDeploymentCost(spec);

          // Verify Kubernetes cost breakdown is complete
          expect(estimate.breakdown.kubernetes).toBeDefined();
          expect(estimate.breakdown.kubernetes.cpu).toBeGreaterThanOrEqual(0);
          expect(estimate.breakdown.kubernetes.memory).toBeGreaterThanOrEqual(0);
          expect(estimate.breakdown.kubernetes.storage).toBeGreaterThanOrEqual(0);
          expect(estimate.breakdown.kubernetes.total).toBeGreaterThanOrEqual(0);

          // Verify total equals sum of components
          const sum = 
            estimate.breakdown.kubernetes.cpu +
            estimate.breakdown.kubernetes.memory +
            estimate.breakdown.kubernetes.storage;
          expect(estimate.breakdown.kubernetes.total).toBeCloseTo(sum, 2);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('should display complete AWS cost breakdown for any deployment spec', async () => {
    await fc.assert(
      fc.asyncProperty(
        deploymentSpecArbitrary,
        async (spec: DeploymentSpec) => {
          const estimate = await costEngine.estimateDeploymentCost(spec);

          // Verify AWS cost breakdown is complete
          expect(estimate.breakdown.aws).toBeDefined();
          expect(estimate.breakdown.aws.rds).toBeGreaterThanOrEqual(0);
          expect(estimate.breakdown.aws.s3).toBeGreaterThanOrEqual(0);
          expect(estimate.breakdown.aws.other).toBeGreaterThanOrEqual(0);
          expect(estimate.breakdown.aws.total).toBeGreaterThanOrEqual(0);

          // Verify total equals sum of components
          const sum = 
            estimate.breakdown.aws.rds +
            estimate.breakdown.aws.s3 +
            estimate.breakdown.aws.other;
          expect(estimate.breakdown.aws.total).toBeCloseTo(sum, 2);
        },
      ),
      { numRuns: 20 },
    );
  });

  it(
    'should display cost efficiency metrics for any service',
    async () => {
      await fc.assert(
      fc.asyncProperty(
        serviceIdArbitrary,
        async (serviceId: string) => {
          const metrics = await efficiencyCalculator.calculateEfficiencyMetrics(
            serviceId,
            '30d',
          );

          // Verify all required fields are present
          expect(metrics.serviceId).toBe(serviceId);
          expect(metrics.period).toBeDefined();
          expect(metrics.period.start).toBeDefined();
          expect(metrics.period.end).toBeDefined();

          // Cost per request and cost per user can be null, but if present must be valid
          if (metrics.costPerRequest !== null) {
            expect(metrics.costPerRequest).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(metrics.costPerRequest)).toBe(true);
          }

          if (metrics.costPerUser !== null) {
            expect(metrics.costPerUser).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(metrics.costPerUser)).toBe(true);
          }

          // Resource utilization must always be present and valid
          expect(metrics.resourceUtilization).toBeDefined();
          expect(metrics.resourceUtilization.cpu).toBeGreaterThanOrEqual(0);
          expect(metrics.resourceUtilization.cpu).toBeLessThanOrEqual(100);
          expect(metrics.resourceUtilization.memory).toBeGreaterThanOrEqual(0);
          expect(metrics.resourceUtilization.memory).toBeLessThanOrEqual(100);
          expect(metrics.resourceUtilization.storage).toBeGreaterThanOrEqual(0);
          expect(metrics.resourceUtilization.storage).toBeLessThanOrEqual(100);
          expect(metrics.resourceUtilization.overall).toBeGreaterThanOrEqual(0);
          expect(metrics.resourceUtilization.overall).toBeLessThanOrEqual(100);

          // Cost trend must be present
          expect(metrics.costTrend).toBeDefined();
          expect(metrics.costTrend.current).toBeGreaterThanOrEqual(0);
          expect(metrics.costTrend.previous).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(metrics.costTrend.changePercent)).toBe(true);
          expect(['increasing', 'decreasing', 'stable']).toContain(
            metrics.costTrend.direction,
          );

          // Recommendations must be an array
          expect(Array.isArray(metrics.recommendations)).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  }, 15000);

  it('should calculate total cost as sum of all components', async () => {
    await fc.assert(
      fc.asyncProperty(
        deploymentSpecArbitrary,
        async (spec: DeploymentSpec) => {
          const estimate = await costEngine.estimateDeploymentCost(spec);

          const expectedTotal = 
            estimate.breakdown.kubernetes.total +
            estimate.breakdown.aws.total;

          expect(estimate.estimatedMonthlyCost).toBeCloseTo(expectedTotal, 2);
        },
      ),
      { numRuns: 20 },
    );
  });
});

/**
 * Feature: internal-developer-platform, Property 12: Pre-Deployment Cost Gate
 * 
 * For any deployment request, if the estimated cost exceeds the service's 
 * remaining budget, the system SHALL block the deployment and require approval.
 * 
 * **Validates: Requirements 5.3**
 */
describe('Property 12: Pre-Deployment Cost Gate', () => {
  let costEngine: CostEstimationEngine;
  let budgetManager: BudgetManager;

  beforeEach(() => {
    costEngine = new CostEstimationEngine(defaultConfig, mockLogger);
    budgetManager = new BudgetManager({
      approvalWorkflow: {
        enabled: true,
        githubOrg: 'test-org',
        githubRepo: 'test-repo',
      },
    });
  });

  afterEach(async () => {
    await costEngine.clearCache();
  });

  it('should block deployment when estimated cost exceeds remaining budget', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceIdArbitrary,
        budgetArbitrary,
        fc.float({ min: 0, max: 1, noNaN: true }),
        deploymentSpecArbitrary,
        async (serviceId, budgetConfig, currentCostRatio, spec) => {
          // Create budget
          await budgetManager.createBudget(
            {
              serviceId,
              monthlyBudget: budgetConfig.monthlyBudget,
              alertThreshold: budgetConfig.alertThreshold,
            },
            'test-user',
          );

          // Calculate current cost as a ratio of budget
          const currentCost = budgetConfig.monthlyBudget * currentCostRatio;

          // Get cost estimate
          const estimate = await costEngine.estimateDeploymentCost(spec);

          // Validate budget
          const validation = await budgetManager.validateBudget(
            serviceId,
            estimate,
            currentCost,
          );

          const remainingBudget = budgetConfig.monthlyBudget - currentCost;

          // Property: If estimated cost exceeds remaining budget, deployment must be blocked
          if (estimate.estimatedMonthlyCost > remainingBudget) {
            expect(validation.isValid).toBe(false);
            expect(validation.requiresApproval).toBe(true);
            expect(validation.approvalUrl).toBeDefined();
          }

          // Property: If within budget, deployment should be allowed
          if (estimate.estimatedMonthlyCost <= remainingBudget &&
              currentCost + estimate.estimatedMonthlyCost <= budgetConfig.monthlyBudget) {
            expect(validation.isValid).toBe(true);
          }

          // Property: Validation must always provide budget information
          expect(validation.currentBudget).toBe(budgetConfig.monthlyBudget);
          expect(validation.estimatedCost).toBe(estimate.estimatedMonthlyCost);
          expect(validation.remainingBudget).toBeCloseTo(remainingBudget, 2);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('should require approval when projected total exceeds budget', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceIdArbitrary,
        fc.float({ min: 100, max: 1000, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        deploymentSpecArbitrary,
        async (serviceId, budget, currentRatio, spec) => {
          // Create budget
          await budgetManager.createBudget(
            {
              serviceId,
              monthlyBudget: budget,
            },
            'test-user',
          );

          const currentCost = budget * currentRatio;
          const estimate = await costEngine.estimateDeploymentCost(spec);
          const projectedTotal = currentCost + estimate.estimatedMonthlyCost;

          const validation = await budgetManager.validateBudget(
            serviceId,
            estimate,
            currentCost,
          );

          // Property: If projected total exceeds budget, must require approval
          if (projectedTotal > budget) {
            expect(validation.requiresApproval).toBe(true);
            expect(validation.isValid).toBe(false);
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('should provide approval URL when deployment is blocked', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceIdArbitrary,
        fc.float({ min: 100, max: 500, noNaN: true }),
        deploymentSpecArbitrary,
        async (serviceId, budget, spec) => {
          // Create budget
          await budgetManager.createBudget(
            {
              serviceId,
              monthlyBudget: budget,
            },
            'test-user',
          );

          // Use high current cost to force budget exceeded
          const currentCost = budget * 0.9;
          const estimate = await costEngine.estimateDeploymentCost(spec);

          const validation = await budgetManager.validateBudget(
            serviceId,
            estimate,
            currentCost,
          );

          // Property: When approval is required, approval URL must be provided
          if (validation.requiresApproval) {
            expect(validation.approvalUrl).toBeDefined();
            expect(validation.approvalUrl).toContain('github.com');
            expect(validation.approvalUrl).toContain(serviceId);
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it('should allow deployment when no budget is configured', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceIdArbitrary,
        deploymentSpecArbitrary,
        async (serviceId, spec) => {
          const estimate = await costEngine.estimateDeploymentCost(spec);

          const validation = await budgetManager.validateBudget(
            serviceId,
            estimate,
            0,
          );

          // Property: Without budget, deployment should always be allowed
          expect(validation.isValid).toBe(true);
          expect(validation.requiresApproval).toBe(false);
          expect(validation.message).toContain('No budget configured');
        },
      ),
      { numRuns: 15 },
    );
  });
});

/**
 * Feature: internal-developer-platform, Property 13: Cost Anomaly Detection and Alerting
 * 
 * For any detected cost anomaly, the system SHALL send an alert to the service 
 * owner and provide actionable recommendations.
 * 
 * **Validates: Requirements 5.4**
 */
describe('Property 13: Cost Anomaly Detection and Alerting', () => {
  let costEngine: CostEstimationEngine;
  let anomalyDetector: AnomalyDetector;

  beforeEach(() => {
    costEngine = new CostEstimationEngine(defaultConfig, mockLogger);
    anomalyDetector = new AnomalyDetector(anomalyConfig, costEngine);
  });

  afterEach(async () => {
    await costEngine.clearCache();
  });

  it(
    'should provide actionable recommendations for any detected anomaly',
    async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceIdArbitrary,
        async (serviceId: string) => {
          const anomalies = await anomalyDetector.detectAnomalies(serviceId);

          // Property: Every detected anomaly must have recommendations
          for (const anomaly of anomalies) {
            expect(anomaly.recommendations).toBeDefined();
            expect(Array.isArray(anomaly.recommendations)).toBe(true);
            expect(anomaly.recommendations.length).toBeGreaterThan(0);

            // Each recommendation should be a non-empty string
            for (const recommendation of anomaly.recommendations) {
              expect(typeof recommendation).toBe('string');
              expect(recommendation.length).toBeGreaterThan(0);
            }
          }
        },
      ),
      { numRuns: 10 },
    );
  }, 30000);

  it(
    'should assign severity level to any detected anomaly',
    async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceIdArbitrary,
        async (serviceId: string) => {
          const anomalies = await anomalyDetector.detectAnomalies(serviceId);

          // Property: Every anomaly must have a valid severity level
          for (const anomaly of anomalies) {
            expect(anomaly.severity).toBeDefined();
            expect(['low', 'medium', 'high']).toContain(anomaly.severity);
          }
        },
      ),
      { numRuns: 10 },
    );
  }, 30000);

  it(
    'should track notification status for any detected anomaly',
    async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceIdArbitrary,
        async (serviceId: string) => {
          const anomalies = await anomalyDetector.detectAnomalies(serviceId);

          // Property: Every anomaly must have notification tracking
          for (const anomaly of anomalies) {
            expect(typeof anomaly.notificationSent).toBe('boolean');
            
            // Initially, notification should not be sent
            expect(anomaly.notificationSent).toBe(false);

            // After marking as sent, should be true
            await anomalyDetector.markNotificationSent(anomaly.id);
            const updated = await anomalyDetector.getAnomalies(serviceId);
            const updatedAnomaly = updated.find(a => a.id === anomaly.id);
            expect(updatedAnomaly?.notificationSent).toBe(true);
          }
        },
      ),
      { numRuns: 10 },
    );
  }, 30000);

  it(
    'should calculate deviation for any detected anomaly',
    async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceIdArbitrary,
        async (serviceId: string) => {
          const anomalies = await anomalyDetector.detectAnomalies(serviceId);

          // Property: Every anomaly must have valid deviation metrics
          for (const anomaly of anomalies) {
            expect(anomaly.currentCost).toBeGreaterThanOrEqual(0);
            expect(anomaly.expectedCost).toBeGreaterThanOrEqual(0);
            expect(anomaly.deviation).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(anomaly.deviation)).toBe(true);

            // Deviation should reflect the difference between current and expected
            const calculatedDeviation = 
              ((anomaly.currentCost - anomaly.expectedCost) / anomaly.expectedCost) * 100;
            
            // Allow for rounding differences
            if (anomaly.expectedCost > 0) {
              expect(Math.abs(anomaly.deviation - Math.abs(calculatedDeviation))).toBeLessThan(1);
            }
          }
        },
      ),
      { numRuns: 10 },
    );
  }, 30000);

  it(
    'should categorize anomalies by type',
    async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceIdArbitrary,
        async (serviceId: string) => {
          const anomalies = await anomalyDetector.detectAnomalies(serviceId);

          // Property: Every anomaly must have a valid type
          for (const anomaly of anomalies) {
            expect(anomaly.anomalyType).toBeDefined();
            expect(['spike', 'sustained_increase', 'unusual_pattern']).toContain(
              anomaly.anomalyType,
            );
          }
        },
      ),
      { numRuns: 10 },
    );
  }, 30000);

  it(
    'should allow anomalies to be resolved',
    async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceIdArbitrary,
        async (serviceId: string) => {
          const anomalies = await anomalyDetector.detectAnomalies(serviceId);

          // Property: Any detected anomaly can be resolved
          for (const anomaly of anomalies) {
            // Initially not resolved
            expect(anomaly.resolvedAt).toBeUndefined();

            // Resolve the anomaly
            await anomalyDetector.resolveAnomaly(anomaly.id);

            // Check it's marked as resolved
            const allAnomalies = await anomalyDetector.getAnomalies(serviceId);
            const resolvedAnomaly = allAnomalies.find(a => a.id === anomaly.id);
            expect(resolvedAnomaly?.resolvedAt).toBeDefined();
            expect(resolvedAnomaly?.resolvedAt).toBeInstanceOf(Date);
          }
        },
      ),
      { numRuns: 10 },
    );
  }, 30000);

  it(
    'should provide unique IDs for all anomalies',
    async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(serviceIdArbitrary, { minLength: 2, maxLength: 5 }),
        async (serviceIds: string[]) => {
          const allAnomalyIds = new Set<string>();

          for (const serviceId of serviceIds) {
            const anomalies = await anomalyDetector.detectAnomalies(serviceId);
            
            for (const anomaly of anomalies) {
              // Property: Every anomaly must have a unique ID
              expect(allAnomalyIds.has(anomaly.id)).toBe(false);
              allAnomalyIds.add(anomaly.id);
            }
          }
        },
      ),
      { numRuns: 10 },
    );
  }, 30000);
});

/**
 * Additional Property: Cost Estimation Consistency
 * 
 * For any deployment spec, multiple cost estimations should return 
 * consistent results (idempotency).
 */
describe('Additional Property: Cost Estimation Consistency', () => {
  let costEngine: CostEstimationEngine;

  beforeEach(() => {
    costEngine = new CostEstimationEngine(defaultConfig, mockLogger);
  });

  afterEach(async () => {
    await costEngine.clearCache();
  });

  it('should return consistent estimates for the same deployment spec', async () => {
    await fc.assert(
      fc.asyncProperty(
        deploymentSpecArbitrary,
        async (spec: DeploymentSpec) => {
          // Clear cache to ensure fresh calculations
          await costEngine.clearCache();

          const estimate1 = await costEngine.estimateDeploymentCost(spec);
          
          // Clear cache again
          await costEngine.clearCache();
          
          const estimate2 = await costEngine.estimateDeploymentCost(spec);

          // Property: Same input should produce same output
          expect(estimate1.estimatedMonthlyCost).toBeCloseTo(
            estimate2.estimatedMonthlyCost,
            2,
          );
          expect(estimate1.breakdown.kubernetes.total).toBeCloseTo(
            estimate2.breakdown.kubernetes.total,
            2,
          );
          expect(estimate1.breakdown.aws.total).toBeCloseTo(
            estimate2.breakdown.aws.total,
            2,
          );
        },
      ),
      { numRuns: 20 },
    );
  });
});

/**
 * Additional Property: Budget Validation Monotonicity
 * 
 * For any service with a fixed budget, as current cost increases, 
 * the remaining budget should decrease monotonically.
 */
describe('Additional Property: Budget Validation Monotonicity', () => {
  let budgetManager: BudgetManager;

  beforeEach(() => {
    budgetManager = new BudgetManager();
  });

  it('should show decreasing remaining budget as current cost increases', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceIdArbitrary,
        fc.float({ min: 1000, max: 5000, noNaN: true }),
        fc.array(fc.float({ min: 0, max: 1, noNaN: true }), { minLength: 3, maxLength: 5 }),
        async (serviceId, budget, costRatios) => {
          // Create budget
          await budgetManager.createBudget(
            {
              serviceId,
              monthlyBudget: budget,
            },
            'test-user',
          );

          // Sort cost ratios to ensure increasing order
          const sortedRatios = [...costRatios].sort((a, b) => a - b);

          const mockEstimate: CostEstimate = {
            estimatedMonthlyCost: 0,
            breakdown: {
              kubernetes: { cpu: 0, memory: 0, storage: 0, total: 0 },
              aws: { rds: 0, s3: 0, other: 0, total: 0 },
            },
            confidence: 0.85,
            currency: 'USD',
          };

          let previousRemaining = budget;

          for (const ratio of sortedRatios) {
            const currentCost = budget * ratio;
            const validation = await budgetManager.validateBudget(
              serviceId,
              mockEstimate,
              currentCost,
            );

            // Property: Remaining budget should decrease as current cost increases
            expect(validation.remainingBudget).toBeLessThanOrEqual(previousRemaining);
            expect(validation.remainingBudget).toBeCloseTo(budget - currentCost, 2);

            previousRemaining = validation.remainingBudget;
          }
        },
      ),
      { numRuns: 15 },
    );
  });
});
