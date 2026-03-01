/**
 * Production Readiness Gate Tests
 */

import {
  ReadinessGate,
  ReadinessGateConfig,
  DEFAULT_READINESS_CONFIG,
} from './readiness-gate';
import { ServiceScorecard, Check, CategoryScore } from './types';

describe('ReadinessGate', () => {
  let gate: ReadinessGate;
  let config: ReadinessGateConfig;

  beforeEach(() => {
    config = { ...DEFAULT_READINESS_CONFIG };
    gate = new ReadinessGate(config);
  });

  describe('validateProductionReadiness', () => {
    it('should pass validation when all requirements are met', () => {
      const scorecard = createMockScorecard({
        overallScore: 85,
        allChecksPassing: true,
      });

      const validation = gate.validateProductionReadiness(scorecard);

      expect(validation.isReady).toBe(true);
      expect(validation.blockers).toHaveLength(0);
      expect(validation.failingChecks).toHaveLength(0);
    });

    it('should fail validation when overall score is below minimum', () => {
      const scorecard = createMockScorecard({
        overallScore: 65, // Below minimum of 70
        allChecksPassing: true,
      });

      const validation = gate.validateProductionReadiness(scorecard);

      expect(validation.isReady).toBe(false);
      expect(validation.blockers.length).toBeGreaterThan(0);
      expect(validation.blockers[0]).toContain('Overall maturity score');
      expect(validation.blockers[0]).toContain('65');
      expect(validation.blockers[0]).toContain('70');
    });

    it('should fail validation when required checks fail', () => {
      const scorecard = createMockScorecard({
        overallScore: 85,
        allChecksPassing: false,
        failingChecks: ['doc-readme', 'test-unit'],
      });

      const validation = gate.validateProductionReadiness(scorecard);

      expect(validation.isReady).toBe(false);
      expect(validation.failingChecks.length).toBeGreaterThan(0);
      expect(validation.blockers.some(b => b.includes('README exists'))).toBe(true);
      expect(validation.blockers.some(b => b.includes('Unit tests exist'))).toBe(true);
    });

    it('should fail validation when category minimums are not met', () => {
      const scorecard = createMockScorecard({
        overallScore: 85,
        allChecksPassing: true,
        categoryScores: {
          security: 75, // Below minimum of 80
          testing: 65,  // Below minimum of 70
        },
      });

      const validation = gate.validateProductionReadiness(scorecard);

      expect(validation.isReady).toBe(false);
      expect(validation.blockers.some(b => b.includes('security'))).toBe(true);
      expect(validation.blockers.some(b => b.includes('testing'))).toBe(true);
    });

    it('should identify all failing required checks across categories', () => {
      const scorecard = createMockScorecard({
        overallScore: 85,
        allChecksPassing: false,
        failingChecks: ['doc-readme', 'test-unit', 'mon-metrics', 'sec-scanning'],
      });

      const validation = gate.validateProductionReadiness(scorecard);

      expect(validation.isReady).toBe(false);
      expect(validation.failingChecks.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle missing required checks gracefully', () => {
      const scorecard = createMockScorecard({
        overallScore: 85,
        allChecksPassing: true,
        missingChecks: ['doc-readme'],
      });

      const validation = gate.validateProductionReadiness(scorecard);

      expect(validation.isReady).toBe(false);
      expect(validation.blockers.some(b => b.includes('not found'))).toBe(true);
    });
  });

  describe('createApprovalRequest', () => {
    it('should create approval request with all required fields', () => {
      const scorecard = createMockScorecard({
        overallScore: 65,
        allChecksPassing: false,
        failingChecks: ['doc-readme'],
      });

      const validation = gate.validateProductionReadiness(scorecard);
      const approval = gate.createApprovalRequest('test-service', validation);

      expect(approval.serviceId).toBe('test-service');
      expect(approval.currentScore).toBe(65);
      expect(approval.minimumScore).toBe(70);
      expect(approval.failingChecks.length).toBeGreaterThan(0);
      expect(approval.blockers.length).toBeGreaterThan(0);
      expect(approval.requestedAt).toBeInstanceOf(Date);
    });

    it('should generate approval URL from template', () => {
      const scorecard = createMockScorecard({
        overallScore: 65,
        allChecksPassing: false,
      });

      const validation = gate.validateProductionReadiness(scorecard);
      const approval = gate.createApprovalRequest('test-service', validation);

      expect(approval.approvalUrl).toBeDefined();
      expect(approval.approvalUrl).toContain('test-service');
      expect(approval.approvalUrl).toContain('65');
      expect(approval.approvalUrl).toContain('70');
    });

    it('should handle missing approval URL template', () => {
      const gateWithoutTemplate = new ReadinessGate({
        ...config,
        approvalUrlTemplate: undefined,
      });

      const scorecard = createMockScorecard({
        overallScore: 65,
        allChecksPassing: false,
      });

      const validation = gateWithoutTemplate.validateProductionReadiness(scorecard);
      const approval = gateWithoutTemplate.createApprovalRequest('test-service', validation);

      expect(approval.approvalUrl).toBeUndefined();
    });
  });

  describe('generateDetailedFeedback', () => {
    it('should generate success message when ready', () => {
      const scorecard = createMockScorecard({
        overallScore: 85,
        allChecksPassing: true,
      });

      const validation = gate.validateProductionReadiness(scorecard);
      const feedback = gate.generateDetailedFeedback(validation);

      expect(feedback).toContain('meets all production readiness requirements');
    });

    it('should generate detailed failure message with all sections', () => {
      const scorecard = createMockScorecard({
        overallScore: 65,
        allChecksPassing: false,
        failingChecks: ['doc-readme', 'test-unit'],
      });

      const validation = gate.validateProductionReadiness(scorecard);
      const feedback = gate.generateDetailedFeedback(validation);

      expect(feedback).toContain('FAILED');
      expect(feedback).toContain('Overall Score');
      expect(feedback).toContain('65');
      expect(feedback).toContain('70');
      expect(feedback).toContain('Blockers');
      expect(feedback).toContain('Failing Required Checks');
      expect(feedback).toContain('Next Steps');
      expect(feedback).toContain('Approval Required');
    });

    it('should include check details in feedback', () => {
      const scorecard = createMockScorecard({
        overallScore: 65,
        allChecksPassing: false,
        failingChecks: ['test-coverage'],
      });

      const validation = gate.validateProductionReadiness(scorecard);
      const feedback = gate.generateDetailedFeedback(validation);

      expect(feedback).toContain('Code coverage');
      expect(feedback).toContain('Current:');
      expect(feedback).toContain('Required:');
    });
  });

  describe('generateSummaryFeedback', () => {
    it('should generate short success message', () => {
      const scorecard = createMockScorecard({
        overallScore: 85,
        allChecksPassing: true,
      });

      const validation = gate.validateProductionReadiness(scorecard);
      const summary = gate.generateSummaryFeedback(validation);

      expect(summary).toContain('✅');
      expect(summary).toContain('Production ready');
      expect(summary).toContain('85');
    });

    it('should generate short failure message with counts', () => {
      const scorecard = createMockScorecard({
        overallScore: 65,
        allChecksPassing: false,
        failingChecks: ['doc-readme', 'test-unit'],
      });

      const validation = gate.validateProductionReadiness(scorecard);
      const summary = gate.generateSummaryFeedback(validation);

      expect(summary).toContain('❌');
      expect(summary).toContain('Not production ready');
      expect(summary).toContain('65');
      expect(summary).toContain('70');
      expect(summary).toContain('blocker');
      expect(summary).toContain('failing check');
    });
  });

  describe('requiresApproval', () => {
    it('should return true when not ready and approval is required', () => {
      const scorecard = createMockScorecard({
        overallScore: 65,
        allChecksPassing: false,
      });

      const validation = gate.validateProductionReadiness(scorecard);
      const requires = gate.requiresApproval(validation);

      expect(requires).toBe(true);
    });

    it('should return false when ready', () => {
      const scorecard = createMockScorecard({
        overallScore: 85,
        allChecksPassing: true,
      });

      const validation = gate.validateProductionReadiness(scorecard);
      const requires = gate.requiresApproval(validation);

      expect(requires).toBe(false);
    });

    it('should return false when approval is not required in config', () => {
      const gateWithoutApproval = new ReadinessGate({
        ...config,
        requireApproval: false,
      });

      const scorecard = createMockScorecard({
        overallScore: 65,
        allChecksPassing: false,
      });

      const validation = gateWithoutApproval.validateProductionReadiness(scorecard);
      const requires = gateWithoutApproval.requiresApproval(validation);

      expect(requires).toBe(false);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      gate.updateConfig({ minimumScore: 80 });
      const newConfig = gate.getConfig();

      expect(newConfig.minimumScore).toBe(80);
    });

    it('should preserve other config values when updating', () => {
      const originalApproval = config.requireApproval;
      gate.updateConfig({ minimumScore: 80 });
      const newConfig = gate.getConfig();

      expect(newConfig.requireApproval).toBe(originalApproval);
    });

    it('should return copy of config', () => {
      const config1 = gate.getConfig();
      const config2 = gate.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});

/**
 * Helper function to create mock scorecard
 */
function createMockScorecard(options: {
  overallScore: number;
  allChecksPassing: boolean;
  failingChecks?: string[];
  missingChecks?: string[];
  categoryScores?: Record<string, number>;
}): ServiceScorecard {
  const {
    overallScore,
    allChecksPassing,
    failingChecks = [],
    missingChecks = [],
    categoryScores = {},
  } = options;

  const createCheck = (id: string, name: string, required: boolean): Check => {
    const shouldFail = failingChecks.includes(id);
    const shouldMiss = missingChecks.includes(id);

    if (shouldMiss) {
      return null as any; // Will be filtered out
    }

    return {
      id,
      name,
      description: `Check for ${name}`,
      status: shouldFail ? 'fail' : 'pass',
      required,
      value: shouldFail ? false : true,
      weight: 0.2,
    };
  };

  const createCategory = (
    name: string,
    checks: Check[],
    score?: number
  ): CategoryScore => {
    const validChecks = checks.filter(c => c !== null);
    return {
      score: score ?? (allChecksPassing ? 85 : 65),
      weight: 0.2,
      checks: validChecks,
      status: allChecksPassing ? 'passing' : 'failing',
      maxScore: 100,
    };
  };

  const docChecks = [
    createCheck('doc-readme', 'README exists', true),
    createCheck('doc-techdocs', 'TechDocs available', true),
    createCheck('doc-api', 'API documentation', false),
  ];

  const testChecks = [
    createCheck('test-unit', 'Unit tests exist', true),
    createCheck('test-integration', 'Integration tests exist', false),
    {
      id: 'test-coverage',
      name: 'Code coverage',
      description: 'Code coverage >= 80%',
      status: failingChecks.includes('test-coverage') ? 'fail' : 'pass',
      required: true,
      value: failingChecks.includes('test-coverage') ? 60 : 85,
      threshold: 80,
      weight: 0.3,
    },
    createCheck('test-passing', 'Tests passing', true),
  ];

  const monChecks = [
    createCheck('mon-metrics', 'Metrics instrumentation', true),
    createCheck('mon-alerts', 'Alerts configured', true),
    createCheck('mon-logging', 'Structured logging', true),
    createCheck('mon-dashboard', 'Monitoring dashboard', false),
  ];

  const secChecks = [
    createCheck('sec-scanning', 'Security scanning enabled', true),
    createCheck('sec-secrets', 'Secrets scanning', true),
    createCheck('sec-dependencies', 'Dependencies up-to-date', false),
  ];

  const costChecks = [
    createCheck('cost-budget', 'Within budget', true),
    createCheck('cost-utilization', 'Resource utilization', false),
  ];

  return {
    serviceId: 'test-service',
    overallScore,
    categories: {
      documentation: createCategory('documentation', docChecks, categoryScores.documentation),
      testing: createCategory('testing', testChecks, categoryScores.testing),
      monitoring: createCategory('monitoring', monChecks, categoryScores.monitoring),
      security: createCategory('security', secChecks, categoryScores.security),
      costEfficiency: createCategory('costEfficiency', costChecks, categoryScores.costEfficiency),
    },
    lastUpdated: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
    version: 1,
  };
}
