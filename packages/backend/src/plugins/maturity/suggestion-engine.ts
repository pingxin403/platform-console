/**
 * Service Maturity Suggestion Engine
 * Generates actionable improvement suggestions based on failed/warning checks
 * Implements priority ranking and impact assessment
 */

import {
  ServiceScorecard,
  Suggestion,
  Check,
  CategoryType,
  CategoryScore,
} from './types';

/**
 * Suggestion template for generating specific recommendations
 */
interface SuggestionTemplate {
  checkId: string;
  category: CategoryType;
  title: string;
  description: string;
  actionItems: string[];
  estimatedEffort: string;
  baseImpact: number; // Base impact score (0-100)
  documentationLinks?: string[];
}

/**
 * Improvement roadmap item
 */
export interface RoadmapItem {
  id: string;
  category: CategoryType;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  estimatedScoreImprovement: number;
  checksAffected: number;
  actionItems: string[];
  roadmapPhase: 'quick-wins' | 'critical-fixes' | 'long-term';
}

/**
 * Improvement roadmap
 */
export interface ImprovementRoadmap {
  serviceId: string;
  currentScore: number;
  potentialScore: number;
  totalImprovementPotential: number;
  quickWins: RoadmapItem[];
  criticalFixes: RoadmapItem[];
  longTermImprovements: RoadmapItem[];
  generatedAt: Date;
}

/**
 * Suggestion generation engine
 */
export class SuggestionEngine {
  private templates: Map<string, SuggestionTemplate>;

  constructor() {
    this.templates = new Map();
    this.initializeTemplates();
  }

  /**
   * Initialize suggestion templates for all check types
   */
  private initializeTemplates(): void {
    // Documentation templates
    this.templates.set('doc-readme', {
      checkId: 'doc-readme',
      category: 'documentation',
      title: 'Add README documentation',
      description: 'Create a comprehensive README file to help developers understand and use your service',
      actionItems: [
        'Create a README.md file in the repository root',
        'Include service overview, purpose, and key features',
        'Add setup and installation instructions',
        'Document API endpoints and usage examples',
        'Include troubleshooting and FAQ sections',
      ],
      estimatedEffort: '2-4 hours',
      baseImpact: 30,
      documentationLinks: [
        'https://www.makeareadme.com/',
        'https://github.com/matiassingers/awesome-readme',
      ],
    });

    this.templates.set('doc-techdocs', {
      checkId: 'doc-techdocs',
      category: 'documentation',
      title: 'Set up TechDocs documentation',
      description: 'Enable TechDocs to provide comprehensive technical documentation for your service',
      actionItems: [
        'Create a docs/ directory in your repository',
        'Add mkdocs.yml configuration file',
        'Write documentation in Markdown format',
        'Include architecture diagrams and design decisions',
        'Configure TechDocs in catalog-info.yaml',
      ],
      estimatedEffort: '4-8 hours',
      baseImpact: 30,
      documentationLinks: [
        'https://backstage.io/docs/features/techdocs/',
      ],
    });

    this.templates.set('doc-api', {
      checkId: 'doc-api',
      category: 'documentation',
      title: 'Document API endpoints',
      description: 'Create comprehensive API documentation using OpenAPI/Swagger',
      actionItems: [
        'Generate OpenAPI specification for your API',
        'Document all endpoints, parameters, and responses',
        'Include example requests and responses',
        'Add authentication and authorization details',
        'Publish API docs to the developer portal',
      ],
      estimatedEffort: '4-6 hours',
      baseImpact: 20,
      documentationLinks: [
        'https://swagger.io/specification/',
        'https://backstage.io/docs/features/software-catalog/descriptor-format#spectype-optional',
      ],
    });

    this.templates.set('doc-runbook', {
      checkId: 'doc-runbook',
      category: 'documentation',
      title: 'Create operational runbook',
      description: 'Document operational procedures for common scenarios and incidents',
      actionItems: [
        'Create a runbook.md file in docs/ directory',
        'Document deployment procedures',
        'Add troubleshooting guides for common issues',
        'Include rollback procedures',
        'Document on-call escalation paths',
      ],
      estimatedEffort: '3-5 hours',
      baseImpact: 10,
    });

    this.templates.set('doc-freshness', {
      checkId: 'doc-freshness',
      category: 'documentation',
      title: 'Update outdated documentation',
      description: 'Review and update documentation to reflect current state of the service',
      actionItems: [
        'Review all documentation for accuracy',
        'Update outdated information and examples',
        'Remove deprecated features and endpoints',
        'Add documentation for new features',
        'Set up automated documentation freshness checks',
      ],
      estimatedEffort: '2-4 hours',
      baseImpact: 10,
    });

    // Testing templates
    this.templates.set('test-unit', {
      checkId: 'test-unit',
      category: 'testing',
      title: 'Add unit tests',
      description: 'Implement unit tests to verify individual components and functions',
      actionItems: [
        'Set up testing framework (Jest, pytest, etc.)',
        'Write unit tests for core business logic',
        'Test edge cases and error conditions',
        'Configure test coverage reporting',
        'Add tests to CI/CD pipeline',
      ],
      estimatedEffort: '8-16 hours',
      baseImpact: 30,
      documentationLinks: [
        'https://jestjs.io/docs/getting-started',
        'https://docs.pytest.org/',
      ],
    });

    this.templates.set('test-integration', {
      checkId: 'test-integration',
      category: 'testing',
      title: 'Add integration tests',
      description: 'Implement integration tests to verify component interactions',
      actionItems: [
        'Identify critical integration points',
        'Write integration tests for API endpoints',
        'Test database interactions',
        'Test external service integrations',
        'Add integration tests to CI/CD pipeline',
      ],
      estimatedEffort: '8-12 hours',
      baseImpact: 20,
    });

    this.templates.set('test-coverage', {
      checkId: 'test-coverage',
      category: 'testing',
      title: 'Improve code coverage',
      description: 'Increase test coverage to meet the minimum threshold',
      actionItems: [
        'Run coverage report to identify gaps',
        'Write tests for uncovered code paths',
        'Focus on critical business logic first',
        'Add tests for error handling',
        'Configure coverage thresholds in CI/CD',
      ],
      estimatedEffort: '4-8 hours',
      baseImpact: 30,
    });

    this.templates.set('test-passing', {
      checkId: 'test-passing',
      category: 'testing',
      title: 'Fix failing tests',
      description: 'Investigate and fix all failing tests',
      actionItems: [
        'Review test failure logs',
        'Fix broken tests or update test expectations',
        'Ensure tests are deterministic',
        'Fix flaky tests',
        'Verify all tests pass in CI/CD',
      ],
      estimatedEffort: '2-6 hours',
      baseImpact: 20,
    });

    // Monitoring templates
    this.templates.set('mon-metrics', {
      checkId: 'mon-metrics',
      category: 'monitoring',
      title: 'Add metrics instrumentation',
      description: 'Instrument your service to expose metrics for monitoring',
      actionItems: [
        'Add metrics library (Prometheus, StatsD, etc.)',
        'Instrument key endpoints and operations',
        'Expose metrics endpoint (/metrics)',
        'Track request rate, latency, and errors',
        'Configure metrics scraping in monitoring system',
      ],
      estimatedEffort: '4-6 hours',
      baseImpact: 25,
      documentationLinks: [
        'https://prometheus.io/docs/instrumenting/clientlibs/',
      ],
    });

    this.templates.set('mon-alerts', {
      checkId: 'mon-alerts',
      category: 'monitoring',
      title: 'Configure monitoring alerts',
      description: 'Set up alerts for critical service conditions',
      actionItems: [
        'Define alert thresholds for key metrics',
        'Create alerts for error rates and latency',
        'Set up alerts for resource exhaustion',
        'Configure alert routing and escalation',
        'Test alert notifications',
      ],
      estimatedEffort: '3-5 hours',
      baseImpact: 25,
    });

    this.templates.set('mon-logging', {
      checkId: 'mon-logging',
      category: 'monitoring',
      title: 'Implement structured logging',
      description: 'Add structured logging to improve observability',
      actionItems: [
        'Add structured logging library',
        'Log key events and operations',
        'Include correlation IDs for request tracing',
        'Log errors with stack traces',
        'Configure log aggregation and retention',
      ],
      estimatedEffort: '3-5 hours',
      baseImpact: 20,
    });

    this.templates.set('mon-dashboard', {
      checkId: 'mon-dashboard',
      category: 'monitoring',
      title: 'Create monitoring dashboard',
      description: 'Build a dashboard to visualize service health and performance',
      actionItems: [
        'Create dashboard in Datadog/Grafana',
        'Add key metrics visualizations',
        'Include SLI/SLO tracking',
        'Add error rate and latency graphs',
        'Link dashboard in service catalog',
      ],
      estimatedEffort: '2-4 hours',
      baseImpact: 15,
    });

    this.templates.set('mon-slos', {
      checkId: 'mon-slos',
      category: 'monitoring',
      title: 'Define Service Level Objectives',
      description: 'Establish SLOs to measure service reliability',
      actionItems: [
        'Define SLIs (availability, latency, error rate)',
        'Set realistic SLO targets',
        'Implement SLO tracking and reporting',
        'Create error budget policies',
        'Review SLOs regularly with team',
      ],
      estimatedEffort: '4-6 hours',
      baseImpact: 15,
    });

    // Security templates
    this.templates.set('sec-scanning', {
      checkId: 'sec-scanning',
      category: 'security',
      title: 'Enable security scanning',
      description: 'Configure automated security scanning for vulnerabilities',
      actionItems: [
        'Enable GitHub Advanced Security or similar tool',
        'Configure SAST (static analysis) scanning',
        'Set up dependency vulnerability scanning',
        'Configure container image scanning',
        'Add security checks to CI/CD pipeline',
      ],
      estimatedEffort: '2-4 hours',
      baseImpact: 30,
      documentationLinks: [
        'https://docs.github.com/en/code-security',
      ],
    });

    this.templates.set('sec-vulnerabilities', {
      checkId: 'sec-vulnerabilities',
      category: 'security',
      title: 'Fix security vulnerabilities',
      description: 'Address identified security vulnerabilities',
      actionItems: [
        'Review vulnerability scan results',
        'Prioritize high and critical severity issues',
        'Update vulnerable dependencies',
        'Apply security patches',
        'Verify fixes with re-scan',
      ],
      estimatedEffort: '4-8 hours',
      baseImpact: 30,
    });

    this.templates.set('sec-dependencies', {
      checkId: 'sec-dependencies',
      category: 'security',
      title: 'Update dependencies',
      description: 'Keep dependencies up-to-date to reduce security risks',
      actionItems: [
        'Review outdated dependencies',
        'Update to latest stable versions',
        'Test for breaking changes',
        'Enable automated dependency updates (Dependabot)',
        'Set up regular dependency review process',
      ],
      estimatedEffort: '2-4 hours',
      baseImpact: 20,
    });

    this.templates.set('sec-secrets', {
      checkId: 'sec-secrets',
      category: 'security',
      title: 'Enable secrets scanning',
      description: 'Scan for accidentally committed secrets',
      actionItems: [
        'Enable GitHub secret scanning or similar tool',
        'Scan repository history for secrets',
        'Rotate any exposed credentials',
        'Add pre-commit hooks to prevent secret commits',
        'Document secret management practices',
      ],
      estimatedEffort: '2-3 hours',
      baseImpact: 20,
    });

    // Cost efficiency templates
    this.templates.set('cost-budget', {
      checkId: 'cost-budget',
      category: 'costEfficiency',
      title: 'Reduce costs to meet budget',
      description: 'Optimize resource usage to stay within allocated budget',
      actionItems: [
        'Review current resource allocation',
        'Identify cost optimization opportunities',
        'Right-size compute resources',
        'Optimize database and storage usage',
        'Request budget increase if justified',
      ],
      estimatedEffort: '4-8 hours',
      baseImpact: 40,
    });

    this.templates.set('cost-utilization', {
      checkId: 'cost-utilization',
      category: 'costEfficiency',
      title: 'Improve resource utilization',
      description: 'Increase resource utilization to reduce waste',
      actionItems: [
        'Analyze resource usage patterns',
        'Right-size over-provisioned resources',
        'Implement auto-scaling',
        'Optimize container resource requests/limits',
        'Consider spot instances for non-critical workloads',
      ],
      estimatedEffort: '4-6 hours',
      baseImpact: 30,
    });

    this.templates.set('cost-trend', {
      checkId: 'cost-trend',
      category: 'costEfficiency',
      title: 'Address increasing cost trend',
      description: 'Investigate and address rising costs',
      actionItems: [
        'Analyze cost increase drivers',
        'Review recent changes and deployments',
        'Identify cost anomalies',
        'Implement cost optimization measures',
        'Set up cost alerts for future increases',
      ],
      estimatedEffort: '3-5 hours',
      baseImpact: 20,
    });

    this.templates.set('cost-rightsizing', {
      checkId: 'cost-rightsizing',
      category: 'costEfficiency',
      title: 'Right-size resources',
      description: 'Adjust resource allocation to match actual usage',
      actionItems: [
        'Review resource utilization metrics',
        'Identify over-provisioned resources',
        'Adjust CPU and memory allocations',
        'Test performance after changes',
        'Monitor for resource constraints',
      ],
      estimatedEffort: '2-4 hours',
      baseImpact: 10,
    });
  }

  /**
   * Generate improvement suggestions for a service
   */
  generateSuggestions(scorecard: ServiceScorecard): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Collect all failed and warning checks
    const problematicChecks: Array<{
      check: Check;
      category: CategoryType;
      categoryScore: CategoryScore;
    }> = [];

    for (const [categoryName, categoryScore] of Object.entries(scorecard.categories)) {
      for (const check of categoryScore.checks) {
        if (check.status === 'fail' || check.status === 'warning') {
          problematicChecks.push({
            check,
            category: categoryName as CategoryType,
            categoryScore,
          });
        }
      }
    }

    // Generate suggestions from templates
    for (const { check, category, categoryScore } of problematicChecks) {
      const template = this.templates.get(check.id);
      if (template) {
        const suggestion = this.createSuggestionFromTemplate(
          template,
          check,
          categoryScore,
          scorecard.overallScore,
        );
        suggestions.push(suggestion);
      }
    }

    // Sort by priority
    return this.prioritizeSuggestions(suggestions);
  }

  /**
   * Create a suggestion from a template
   */
  private createSuggestionFromTemplate(
    template: SuggestionTemplate,
    check: Check,
    categoryScore: CategoryScore,
    overallScore: number,
  ): Suggestion {
    // Calculate impact
    const impact = this.calculateImpact(
      template.baseImpact,
      check,
      categoryScore,
      overallScore,
    );

    // Determine priority
    const priority = this.calculatePriority(check, impact, overallScore);

    return {
      id: `suggestion-${template.checkId}`,
      category: template.category,
      priority,
      title: template.title,
      description: template.description,
      actionItems: template.actionItems,
      estimatedEffort: template.estimatedEffort,
      impact: this.formatImpact(impact),
    };
  }

  /**
   * Calculate impact score for a suggestion
   */
  private calculateImpact(
    baseImpact: number,
    check: Check,
    categoryScore: CategoryScore,
    overallScore: number,
  ): number {
    let impact = baseImpact;

    // Increase impact for required checks
    if (check.required) {
      impact *= 1.5;
    }

    // Increase impact based on check weight
    impact *= check.weight * 2;

    // Increase impact based on category weight
    impact *= categoryScore.weight * 5;

    // Increase impact if overall score is low
    if (overallScore < 50) {
      impact *= 1.3;
    } else if (overallScore < 70) {
      impact *= 1.1;
    }

    // Cap impact at 100
    return Math.min(impact, 100);
  }

  /**
   * Calculate priority for a suggestion
   */
  private calculatePriority(
    check: Check,
    impact: number,
    overallScore: number,
  ): 'high' | 'medium' | 'low' {
    // High priority: required checks or high impact
    if (check.required && check.status === 'fail') {
      return 'high';
    }

    if (impact >= 60) {
      return 'high';
    }

    // Medium priority: warnings on required checks or medium impact
    if (check.required && check.status === 'warning') {
      return 'medium';
    }

    if (impact >= 30) {
      return 'medium';
    }

    // Low priority: everything else
    return 'low';
  }

  /**
   * Format impact as a string
   */
  private formatImpact(impact: number): string {
    const scoreImprovement = Math.round(impact / 10);
    return `+${scoreImprovement} points to overall score`;
  }

  /**
   * Prioritize suggestions by priority and impact
   */
  private prioritizeSuggestions(suggestions: Suggestion[]): Suggestion[] {
    const priorityOrder = { high: 0, medium: 1, low: 2 };

    return suggestions.sort((a, b) => {
      // Sort by priority first
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // Then by impact (extract number from impact string)
      const impactA = parseInt(a.impact.match(/\d+/)?.[0] || '0', 10);
      const impactB = parseInt(b.impact.match(/\d+/)?.[0] || '0', 10);
      return impactB - impactA;
    });
  }

  /**
   * Generate improvement roadmap
   */
  generateRoadmap(scorecard: ServiceScorecard): ImprovementRoadmap {
    const suggestions = this.generateSuggestions(scorecard);

    // Convert suggestions to roadmap items
    const roadmapItems = suggestions.map(suggestion =>
      this.convertToRoadmapItem(suggestion, scorecard),
    );

    // Categorize into roadmap phases
    const quickWins = roadmapItems.filter(
      item => item.roadmapPhase === 'quick-wins',
    );
    const criticalFixes = roadmapItems.filter(
      item => item.roadmapPhase === 'critical-fixes',
    );
    const longTermImprovements = roadmapItems.filter(
      item => item.roadmapPhase === 'long-term',
    );

    // Calculate potential score
    const totalImprovementPotential = roadmapItems.reduce(
      (sum, item) => sum + item.estimatedScoreImprovement,
      0,
    );
    const potentialScore = Math.min(
      100,
      scorecard.overallScore + totalImprovementPotential,
    );

    return {
      serviceId: scorecard.serviceId,
      currentScore: scorecard.overallScore,
      potentialScore,
      totalImprovementPotential,
      quickWins,
      criticalFixes,
      longTermImprovements,
      generatedAt: new Date(),
    };
  }

  /**
   * Convert suggestion to roadmap item
   */
  private convertToRoadmapItem(
    suggestion: Suggestion,
    scorecard: ServiceScorecard,
  ): RoadmapItem {
    // Extract score improvement from impact string
    const scoreImprovement = parseInt(
      suggestion.impact.match(/\d+/)?.[0] || '0',
      10,
    );

    // Determine effort level from estimated effort string
    const effort = this.parseEffortLevel(suggestion.estimatedEffort);

    // Determine impact level
    const impact = this.parseImpactLevel(scoreImprovement);

    // Determine roadmap phase
    const roadmapPhase = this.determineRoadmapPhase(
      suggestion.priority,
      effort,
      impact,
    );

    // Count affected checks (simplified - in reality would analyze dependencies)
    const checksAffected = 1;

    return {
      id: suggestion.id,
      category: suggestion.category,
      title: suggestion.title,
      description: suggestion.description,
      priority: suggestion.priority,
      effort,
      impact,
      estimatedScoreImprovement: scoreImprovement,
      checksAffected,
      actionItems: suggestion.actionItems,
      roadmapPhase,
    };
  }

  /**
   * Parse effort level from estimated effort string
   */
  private parseEffortLevel(estimatedEffort: string): 'low' | 'medium' | 'high' {
    const hours = parseInt(estimatedEffort.match(/\d+/)?.[0] || '0', 10);

    if (hours <= 4) {
      return 'low';
    } else if (hours <= 8) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  /**
   * Parse impact level from score improvement
   */
  private parseImpactLevel(scoreImprovement: number): 'low' | 'medium' | 'high' {
    if (scoreImprovement >= 5) {
      return 'high';
    } else if (scoreImprovement >= 3) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Determine roadmap phase based on priority, effort, and impact
   */
  private determineRoadmapPhase(
    priority: 'high' | 'medium' | 'low',
    effort: 'low' | 'medium' | 'high',
    impact: 'low' | 'medium' | 'high',
  ): 'quick-wins' | 'critical-fixes' | 'long-term' {
    // Quick wins: low effort, high impact
    if (effort === 'low' && (impact === 'high' || impact === 'medium')) {
      return 'quick-wins';
    }

    // Critical fixes: high priority required checks
    if (priority === 'high') {
      return 'critical-fixes';
    }

    // Long-term: high effort or low priority
    return 'long-term';
  }
}
