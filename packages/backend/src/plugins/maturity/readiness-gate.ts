/**
 * Production Readiness Gate
 * Validates minimum maturity requirements before deployment
 */

import { ServiceScorecard, ReadinessValidation, Check } from './types';

/**
 * Production readiness gate configuration
 */
export interface ReadinessGateConfig {
  // Minimum overall score required for production deployment
  minimumScore: number;
  
  // Required checks that must pass (by check ID)
  requiredChecks: string[];
  
  // Category-specific minimum scores
  categoryMinimums?: {
    documentation?: number;
    testing?: number;
    monitoring?: number;
    security?: number;
    costEfficiency?: number;
  };
  
  // Whether to require approval for deployments that don't meet requirements
  requireApproval: boolean;
  
  // Approval workflow URL template (e.g., GitHub PR, Jira ticket)
  approvalUrlTemplate?: string;
}

/**
 * Approval request details
 */
export interface ApprovalRequest {
  serviceId: string;
  currentScore: number;
  minimumScore: number;
  failingChecks: Check[];
  blockers: string[];
  approvalUrl?: string;
  requestedAt: Date;
}

/**
 * Production Readiness Gate Engine
 */
export class ReadinessGate {
  private config: ReadinessGateConfig;

  constructor(config: ReadinessGateConfig) {
    this.config = config;
  }

  /**
   * Validate if a service is ready for production deployment
   */
  validateProductionReadiness(scorecard: ServiceScorecard): ReadinessValidation {
    const failingChecks: Check[] = [];
    const blockers: string[] = [];

    // Check 1: Overall score meets minimum threshold
    if (scorecard.overallScore < this.config.minimumScore) {
      blockers.push(
        `Overall maturity score (${scorecard.overallScore.toFixed(1)}) is below minimum required (${this.config.minimumScore})`
      );
    }

    // Check 2: All required checks must pass
    const allChecks = this.getAllChecks(scorecard);
    for (const checkId of this.config.requiredChecks) {
      const check = allChecks.find(c => c.id === checkId);
      if (!check) {
        blockers.push(`Required check '${checkId}' not found in scorecard`);
        continue;
      }
      
      if (check.status === 'fail') {
        failingChecks.push(check);
        blockers.push(`Required check failed: ${check.name} - ${check.description}`);
      }
    }

    // Check 3: Category-specific minimums (if configured)
    if (this.config.categoryMinimums) {
      for (const [category, minScore] of Object.entries(this.config.categoryMinimums)) {
        const categoryScore = scorecard.categories[category as keyof typeof scorecard.categories];
        if (categoryScore && categoryScore.score < minScore) {
          blockers.push(
            `${category} score (${categoryScore.score.toFixed(1)}) is below minimum required (${minScore})`
          );
        }
      }
    }

    // Check 4: No failing required checks in any category
    for (const [categoryName, category] of Object.entries(scorecard.categories)) {
      const failedRequired = category.checks.filter(
        c => c.required && c.status === 'fail'
      );
      
      for (const check of failedRequired) {
        if (!failingChecks.find(c => c.id === check.id)) {
          failingChecks.push(check);
          blockers.push(
            `Required check failed in ${categoryName}: ${check.name} - ${check.description}`
          );
        }
      }
    }

    const isReady = blockers.length === 0;

    return {
      isReady,
      minimumScore: this.config.minimumScore,
      currentScore: scorecard.overallScore,
      failingChecks,
      blockers,
    };
  }

  /**
   * Create an approval request for a deployment that doesn't meet requirements
   */
  createApprovalRequest(
    serviceId: string,
    validation: ReadinessValidation
  ): ApprovalRequest {
    const approvalUrl = this.generateApprovalUrl(serviceId, validation);

    return {
      serviceId,
      currentScore: validation.currentScore,
      minimumScore: validation.minimumScore,
      failingChecks: validation.failingChecks,
      blockers: validation.blockers,
      approvalUrl,
      requestedAt: new Date(),
    };
  }

  /**
   * Generate approval URL from template
   */
  private generateApprovalUrl(
    serviceId: string,
    validation: ReadinessValidation
  ): string | undefined {
    if (!this.config.approvalUrlTemplate) {
      return undefined;
    }

    // Replace template variables
    let url = this.config.approvalUrlTemplate;
    url = url.replace('{serviceId}', encodeURIComponent(serviceId));
    url = url.replace('{currentScore}', validation.currentScore.toFixed(1));
    url = url.replace('{minimumScore}', validation.minimumScore.toString());
    url = url.replace(
      '{blockerCount}',
      validation.blockers.length.toString()
    );

    return url;
  }

  /**
   * Get all checks from scorecard
   */
  private getAllChecks(scorecard: ServiceScorecard): Check[] {
    const checks: Check[] = [];
    
    for (const category of Object.values(scorecard.categories)) {
      checks.push(...category.checks);
    }
    
    return checks;
  }

  /**
   * Generate detailed feedback for gate failure
   */
  generateDetailedFeedback(validation: ReadinessValidation): string {
    if (validation.isReady) {
      return 'Service meets all production readiness requirements.';
    }

    const lines: string[] = [];
    lines.push('❌ Production Readiness Gate: FAILED');
    lines.push('');
    lines.push('Your service does not meet the minimum requirements for production deployment.');
    lines.push('');
    
    // Overall score
    lines.push('📊 Overall Score:');
    lines.push(`   Current: ${validation.currentScore.toFixed(1)}/100`);
    lines.push(`   Required: ${validation.minimumScore}/100`);
    lines.push(`   Gap: ${(validation.minimumScore - validation.currentScore).toFixed(1)} points`);
    lines.push('');

    // Blockers
    if (validation.blockers.length > 0) {
      lines.push('🚫 Blockers:');
      for (let i = 0; i < validation.blockers.length; i++) {
        lines.push(`   ${i + 1}. ${validation.blockers[i]}`);
      }
      lines.push('');
    }

    // Failing checks details
    if (validation.failingChecks.length > 0) {
      lines.push('❗ Failing Required Checks:');
      for (const check of validation.failingChecks) {
        lines.push(`   • ${check.name}`);
        lines.push(`     ${check.description}`);
        if (check.value !== undefined) {
          lines.push(`     Current: ${JSON.stringify(check.value)}`);
        }
        if (check.threshold !== undefined) {
          lines.push(`     Required: ${JSON.stringify(check.threshold)}`);
        }
      }
      lines.push('');
    }

    // Next steps
    lines.push('📋 Next Steps:');
    lines.push('   1. Review the failing checks above');
    lines.push('   2. Address the blockers to improve your maturity score');
    lines.push('   3. Run the maturity check again after making improvements');
    lines.push('   4. If urgent, request approval to deploy with current score');
    lines.push('');

    // Approval info
    if (this.config.requireApproval) {
      lines.push('⚠️  Approval Required:');
      lines.push('   This deployment requires approval from a platform administrator.');
      lines.push('   Please create an approval request with justification for deploying');
      lines.push('   a service that does not meet production readiness requirements.');
    }

    return lines.join('\n');
  }

  /**
   * Generate summary feedback (shorter version)
   */
  generateSummaryFeedback(validation: ReadinessValidation): string {
    if (validation.isReady) {
      return `✅ Production ready (score: ${validation.currentScore.toFixed(1)}/100)`;
    }

    return [
      `❌ Not production ready (score: ${validation.currentScore.toFixed(1)}/${validation.minimumScore})`,
      `${validation.blockers.length} blocker(s), ${validation.failingChecks.length} failing check(s)`,
    ].join(' - ');
  }

  /**
   * Check if approval is required for this validation result
   */
  requiresApproval(validation: ReadinessValidation): boolean {
    return !validation.isReady && this.config.requireApproval;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ReadinessGateConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ReadinessGateConfig {
    return { ...this.config };
  }
}

/**
 * Default production readiness gate configuration
 */
export const DEFAULT_READINESS_CONFIG: ReadinessGateConfig = {
  minimumScore: 70,
  requiredChecks: [
    // Documentation
    'doc-readme',
    'doc-techdocs',
    
    // Testing
    'test-unit',
    'test-passing',
    
    // Monitoring
    'mon-metrics',
    'mon-alerts',
    'mon-logging',
    
    // Security
    'sec-scanning',
    'sec-secrets',
    
    // Cost
    'cost-budget',
  ],
  categoryMinimums: {
    security: 80, // Security must be at least 80
    testing: 70,  // Testing must be at least 70
  },
  requireApproval: true,
  approvalUrlTemplate: '/approval/request?service={serviceId}&score={currentScore}&required={minimumScore}',
};
