/**
 * Bottleneck identification and quantification analyzer
 * 
 * Analyzes workflow timing data to identify friction points, quantify impact,
 * and generate actionable recommendations.
 */

import { Logger } from 'winston';
import {
  WorkflowTiming,
  FrictionArea,
  Bottleneck,
  BottleneckAnalysisConfig,
  WorkflowAnalysisResult,
  WorkflowStage,
  BottleneckSeverity,
  RecommendationTemplate,
  RecommendationAction,
} from './bottleneck-types';

export class BottleneckAnalyzer {
  private readonly logger: Logger;
  private readonly config: BottleneckAnalysisConfig;

  // In-memory storage for workflow timing data
  private workflowTimings: WorkflowTiming[] = [];

  constructor(logger: Logger, config: BottleneckAnalysisConfig) {
    this.logger = logger;
    this.config = config;
  }

  /**
   * Track workflow timing
   */
  async trackWorkflowTiming(timing: WorkflowTiming): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    this.workflowTimings.push(timing);

    this.logger.debug('Workflow timing tracked', {
      stage: timing.stage,
      duration: timing.duration,
      entityId: timing.entityId,
    });
  }

  /**
   * Analyze workflows and identify bottlenecks
   */
  async analyzeBottlenecks(
    startDate: Date,
    endDate: Date,
  ): Promise<WorkflowAnalysisResult> {
    const startTime = Date.now();

    try {
      if (!this.config.enabled) {
        return {
          success: false,
          bottlenecks: [],
          frictionAreas: [],
          summary: {
            totalBottlenecks: 0,
            criticalBottlenecks: 0,
            totalTimeWasted: 0,
            affectedUsers: 0,
            mostProblematicStage: 'code_review',
          },
          errors: ['Bottleneck analysis is disabled'],
          analyzedAt: new Date(),
          duration: Date.now() - startTime,
        };
      }

      this.logger.info('Analyzing bottlenecks', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      // Filter timings within the period
      const periodTimings = this.workflowTimings.filter(
        t => t.startTime >= startDate && t.endTime <= endDate,
      );

      if (periodTimings.length < this.config.analysis.minDataPoints) {
        return {
          success: false,
          bottlenecks: [],
          frictionAreas: [],
          summary: {
            totalBottlenecks: 0,
            criticalBottlenecks: 0,
            totalTimeWasted: 0,
            affectedUsers: 0,
            mostProblematicStage: 'code_review',
          },
          errors: [`Insufficient data points: ${periodTimings.length} < ${this.config.analysis.minDataPoints}`],
          analyzedAt: new Date(),
          duration: Date.now() - startTime,
        };
      }

      // Identify friction areas
      const frictionAreas = this.identifyFrictionAreas(periodTimings);

      // Identify bottlenecks from friction areas
      const bottlenecks = this.identifyBottlenecks(frictionAreas, periodTimings, startDate, endDate);

      // Generate summary
      const summary = this.generateSummary(bottlenecks, frictionAreas);

      const duration = Date.now() - startTime;

      this.logger.info('Bottleneck analysis completed', {
        duration,
        totalBottlenecks: bottlenecks.length,
        criticalBottlenecks: summary.criticalBottlenecks,
      });

      return {
        success: true,
        bottlenecks,
        frictionAreas,
        summary,
        errors: [],
        analyzedAt: new Date(),
        duration,
      };
    } catch (error) {
      this.logger.error('Failed to analyze bottlenecks', { error });
      return {
        success: false,
        bottlenecks: [],
        frictionAreas: [],
        summary: {
          totalBottlenecks: 0,
          criticalBottlenecks: 0,
          totalTimeWasted: 0,
          affectedUsers: 0,
          mostProblematicStage: 'code_review',
        },
        errors: [String(error)],
        analyzedAt: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Identify high friction areas
   */
  private identifyFrictionAreas(timings: WorkflowTiming[]): FrictionArea[] {
    const frictionAreas: FrictionArea[] = [];

    // Group timings by stage
    const stageGroups = new Map<WorkflowStage, WorkflowTiming[]>();
    timings.forEach(t => {
      if (!stageGroups.has(t.stage)) {
        stageGroups.set(t.stage, []);
      }
      stageGroups.get(t.stage)!.push(t);
    });

    // Analyze each stage
    stageGroups.forEach((stageTimings, stage) => {
      if (stageTimings.length < this.config.thresholds.minOccurrences) {
        return;
      }

      const durations = stageTimings.map(t => t.duration).sort((a, b) => a - b);
      const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const medianDuration = durations[Math.floor(durations.length / 2)];
      const p95Index = Math.floor(durations.length * (this.config.analysis.outlierPercentile / 100));
      const p95Duration = durations[p95Index];

      // Check if this stage exceeds the threshold
      const threshold = this.config.thresholds.minDuration[stage];
      if (averageDuration >= threshold || p95Duration >= threshold * 1.5) {
        // Calculate trend (compare with older data)
        const trend = this.calculateTrend(stage, stageTimings);

        frictionAreas.push({
          stage,
          averageDuration,
          medianDuration,
          p95Duration,
          occurrences: stageTimings.length,
          affectedEntities: [...new Set(stageTimings.map(t => t.entityId))],
          trend,
        });
      }
    });

    // Sort by severity (p95Duration)
    frictionAreas.sort((a, b) => b.p95Duration - a.p95Duration);

    return frictionAreas;
  }

  /**
   * Calculate trend for a workflow stage
   */
  private calculateTrend(
    stage: WorkflowStage,
    recentTimings: WorkflowTiming[],
  ): 'worsening' | 'stable' | 'improving' {
    if (recentTimings.length < 10) {
      return 'stable';
    }

    // Sort by time
    const sorted = [...recentTimings].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // Split into two halves
    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);

    // Calculate average duration for each half
    const firstAvg = firstHalf.reduce((sum, t) => sum + t.duration, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, t) => sum + t.duration, 0) / secondHalf.length;

    // Compare with 10% threshold
    if (secondAvg > firstAvg * 1.1) {
      return 'worsening';
    } else if (secondAvg < firstAvg * 0.9) {
      return 'improving';
    }

    return 'stable';
  }

  /**
   * Identify bottlenecks from friction areas
   */
  private identifyBottlenecks(
    frictionAreas: FrictionArea[],
    timings: WorkflowTiming[],
    startDate: Date,
    endDate: Date,
  ): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    frictionAreas.forEach((area, index) => {
      // Get timings for this stage
      const stageTimings = timings.filter(t => t.stage === area.stage);

      // Calculate impact
      const affectedUsers = new Set(
        stageTimings.filter(t => t.userId).map(t => t.userId!),
      ).size;

      const affectedEntities = area.affectedEntities.length;
      const averageDelay = area.averageDuration;

      // Calculate total time wasted (in hours)
      const totalTimeWasted = (stageTimings.reduce((sum, t) => sum + t.duration, 0) / 60);

      // Calculate frequency (occurrences per week)
      const periodDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      const frequency = (area.occurrences / periodDays) * 7;

      // Determine severity
      const severity = this.determineSeverity(area, affectedUsers, totalTimeWasted);

      // Skip if not significant enough
      if (affectedUsers < this.config.thresholds.minAffectedUsers && severity === 'low') {
        return;
      }

      // Generate recommendations
      const recommendations = this.generateRecommendations(area, stageTimings);

      // Identify contributing factors
      const contributingFactors = this.identifyContributingFactors(area, stageTimings);

      const bottleneck: Bottleneck = {
        id: `bottleneck-${area.stage}-${Date.now()}-${index}`,
        area: this.getStageDisplayName(area.stage),
        stage: area.stage,
        description: this.generateDescription(area),
        severity,
        impact: {
          affectedUsers,
          affectedEntities,
          averageDelay,
          totalTimeWasted,
          frequency,
        },
        contributingFactors,
        recommendations,
        detectedAt: new Date(),
        period: {
          start: startDate,
          end: endDate,
        },
      };

      bottlenecks.push(bottleneck);
    });

    // Sort by severity and impact
    bottlenecks.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.impact.totalTimeWasted - a.impact.totalTimeWasted;
    });

    return bottlenecks;
  }

  /**
   * Determine bottleneck severity
   */
  private determineSeverity(
    area: FrictionArea,
    affectedUsers: number,
    totalTimeWasted: number,
  ): BottleneckSeverity {
    const threshold = this.config.thresholds.minDuration[area.stage];

    // Critical: p95 > 3x threshold AND (affects many users OR wastes significant time)
    if (area.p95Duration > threshold * 3 && (affectedUsers > 10 || totalTimeWasted > 100)) {
      return 'critical';
    }

    // High: p95 > 2x threshold AND affects multiple users
    if (area.p95Duration > threshold * 2 && affectedUsers > 5) {
      return 'high';
    }

    // Medium: p95 > 1.5x threshold OR affects some users
    if (area.p95Duration > threshold * 1.5 || affectedUsers > 3) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Generate description for bottleneck
   */
  private generateDescription(area: FrictionArea): string {
    const stageName = this.getStageDisplayName(area.stage);
    const threshold = this.config.thresholds.minDuration[area.stage];

    return `${stageName} is taking significantly longer than expected. ` +
      `Average duration is ${Math.round(area.averageDuration)} minutes ` +
      `(expected: ${threshold} minutes), with 95th percentile at ${Math.round(area.p95Duration)} minutes. ` +
      `This affects ${area.affectedEntities.length} entities and is ${area.trend}.`;
  }

  /**
   * Identify contributing factors
   */
  private identifyContributingFactors(
    area: FrictionArea,
    timings: WorkflowTiming[],
  ): string[] {
    const factors: string[] = [];

    // Check for high variance
    const durations = timings.map(t => t.duration);
    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev > avg * 0.5) {
      factors.push('High variability in duration suggests inconsistent process or resource availability');
    }

    // Check for trend
    if (area.trend === 'worsening') {
      factors.push('Duration is increasing over time, indicating growing problem');
    }

    // Check for specific stage issues
    switch (area.stage) {
      case 'code_review':
        if (area.averageDuration > 480) { // > 8 hours
          factors.push('Code reviews taking more than a day may indicate lack of reviewers or complex changes');
        }
        break;
      case 'ci_build':
        if (area.p95Duration > area.averageDuration * 2) {
          factors.push('Large variance in build times suggests flaky tests or resource contention');
        }
        break;
      case 'deployment':
        if (area.averageDuration > 60) { // > 1 hour
          factors.push('Long deployment times may indicate manual steps or slow rollout strategy');
        }
        break;
      case 'incident_response':
        if (area.averageDuration > 120) { // > 2 hours
          factors.push('Long incident response times may indicate poor monitoring or unclear runbooks');
        }
        break;
      case 'approval':
        if (area.averageDuration > 1440) { // > 1 day
          factors.push('Approval delays suggest bottleneck in decision-making process');
        }
        break;
    }

    return factors;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    area: FrictionArea,
    timings: WorkflowTiming[],
  ): Bottleneck['recommendations'] {
    const recommendations: Bottleneck['recommendations'] = [];

    // Get recommendation templates for this stage
    const templates = this.getRecommendationTemplates(area.stage);

    // Select relevant recommendations based on the specific issues
    templates.forEach(template => {
      recommendations.push({
        action: template.description,
        priority: template.priority,
        estimatedImpact: template.estimatedImpact,
        estimatedEffort: template.estimatedEffort,
      });
    });

    // Limit to top 3 recommendations
    return recommendations.slice(0, 3);
  }

  /**
   * Get recommendation templates for a workflow stage
   */
  private getRecommendationTemplates(stage: WorkflowStage): RecommendationTemplate[] {
    const templates: Record<WorkflowStage, RecommendationTemplate[]> = {
      code_review: [
        {
          action: 'automate_process',
          title: 'Automate Code Review Checks',
          description: 'Implement automated code review tools (linters, static analysis) to reduce manual review time',
          priority: 'high',
          estimatedImpact: 'Reduce review time by 30-40%',
          estimatedEffort: '1-2 weeks',
        },
        {
          action: 'process_change',
          title: 'Implement Review SLAs',
          description: 'Set and enforce SLAs for code reviews (e.g., 4 hours for small PRs, 1 day for large PRs)',
          priority: 'medium',
          estimatedImpact: 'Reduce average review time by 20-30%',
          estimatedEffort: '1 week',
        },
        {
          action: 'training_required',
          title: 'Train More Reviewers',
          description: 'Expand the pool of qualified code reviewers to distribute the load',
          priority: 'medium',
          estimatedImpact: 'Reduce review bottleneck by 25%',
          estimatedEffort: '2-4 weeks',
        },
      ],
      ci_build: [
        {
          action: 'optimize_configuration',
          title: 'Optimize CI Pipeline',
          description: 'Parallelize tests, cache dependencies, and optimize build configuration',
          priority: 'high',
          estimatedImpact: 'Reduce build time by 40-50%',
          estimatedEffort: '1-2 weeks',
        },
        {
          action: 'increase_resources',
          title: 'Increase CI Resources',
          description: 'Add more CI runners or upgrade to faster machines',
          priority: 'medium',
          estimatedImpact: 'Reduce build time by 20-30%',
          estimatedEffort: '1 week',
        },
        {
          action: 'automate_process',
          title: 'Implement Test Selection',
          description: 'Run only affected tests based on code changes',
          priority: 'medium',
          estimatedImpact: 'Reduce test time by 30-40%',
          estimatedEffort: '2-3 weeks',
        },
      ],
      deployment: [
        {
          action: 'automate_process',
          title: 'Automate Deployment Process',
          description: 'Eliminate manual steps in deployment pipeline',
          priority: 'high',
          estimatedImpact: 'Reduce deployment time by 50-60%',
          estimatedEffort: '2-3 weeks',
        },
        {
          action: 'optimize_configuration',
          title: 'Optimize Rollout Strategy',
          description: 'Implement faster rollout strategy (e.g., blue-green deployment)',
          priority: 'medium',
          estimatedImpact: 'Reduce deployment time by 30-40%',
          estimatedEffort: '1-2 weeks',
        },
        {
          action: 'add_monitoring',
          title: 'Add Deployment Monitoring',
          description: 'Implement automated health checks to speed up validation',
          priority: 'medium',
          estimatedImpact: 'Reduce validation time by 20-30%',
          estimatedEffort: '1 week',
        },
      ],
      incident_response: [
        {
          action: 'improve_documentation',
          title: 'Create Runbooks',
          description: 'Document common incident response procedures and troubleshooting steps',
          priority: 'high',
          estimatedImpact: 'Reduce MTTR by 30-40%',
          estimatedEffort: '2-3 weeks',
        },
        {
          action: 'add_monitoring',
          title: 'Improve Monitoring',
          description: 'Add better observability and alerting to detect issues faster',
          priority: 'high',
          estimatedImpact: 'Reduce detection time by 40-50%',
          estimatedEffort: '2-4 weeks',
        },
        {
          action: 'training_required',
          title: 'Incident Response Training',
          description: 'Train team on incident response procedures and tools',
          priority: 'medium',
          estimatedImpact: 'Reduce MTTR by 20-30%',
          estimatedEffort: '1-2 weeks',
        },
      ],
      service_creation: [
        {
          action: 'automate_process',
          title: 'Improve Templates',
          description: 'Optimize scaffolder templates to reduce manual configuration',
          priority: 'high',
          estimatedImpact: 'Reduce creation time by 40-50%',
          estimatedEffort: '1-2 weeks',
        },
        {
          action: 'improve_documentation',
          title: 'Improve Onboarding Docs',
          description: 'Create better documentation and tutorials for service creation',
          priority: 'medium',
          estimatedImpact: 'Reduce creation time by 20-30%',
          estimatedEffort: '1 week',
        },
      ],
      documentation: [
        {
          action: 'automate_process',
          title: 'Automate Documentation',
          description: 'Generate documentation from code comments and API schemas',
          priority: 'medium',
          estimatedImpact: 'Reduce documentation time by 30-40%',
          estimatedEffort: '2-3 weeks',
        },
        {
          action: 'process_change',
          title: 'Documentation Templates',
          description: 'Provide templates and examples for common documentation needs',
          priority: 'medium',
          estimatedImpact: 'Reduce documentation time by 20-30%',
          estimatedEffort: '1 week',
        },
      ],
      approval: [
        {
          action: 'process_change',
          title: 'Implement Approval SLAs',
          description: 'Set and enforce SLAs for approval processes',
          priority: 'high',
          estimatedImpact: 'Reduce approval time by 40-50%',
          estimatedEffort: '1 week',
        },
        {
          action: 'automate_process',
          title: 'Automate Low-Risk Approvals',
          description: 'Implement automated approval for low-risk changes',
          priority: 'high',
          estimatedImpact: 'Reduce approval time by 50-60%',
          estimatedEffort: '2-3 weeks',
        },
      ],
    };

    return templates[stage] || [];
  }

  /**
   * Generate summary
   */
  private generateSummary(
    bottlenecks: Bottleneck[],
    frictionAreas: FrictionArea[],
  ): WorkflowAnalysisResult['summary'] {
    const totalBottlenecks = bottlenecks.length;
    const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical').length;
    const totalTimeWasted = bottlenecks.reduce((sum, b) => sum + b.impact.totalTimeWasted, 0);
    const affectedUsers = Math.max(...bottlenecks.map(b => b.impact.affectedUsers), 0);

    // Find most problematic stage
    const stageImpact = new Map<WorkflowStage, number>();
    bottlenecks.forEach(b => {
      const current = stageImpact.get(b.stage) || 0;
      stageImpact.set(b.stage, current + b.impact.totalTimeWasted);
    });

    let mostProblematicStage: WorkflowStage = 'code_review';
    let maxImpact = 0;
    stageImpact.forEach((impact, stage) => {
      if (impact > maxImpact) {
        maxImpact = impact;
        mostProblematicStage = stage;
      }
    });

    return {
      totalBottlenecks,
      criticalBottlenecks,
      totalTimeWasted,
      affectedUsers,
      mostProblematicStage,
    };
  }

  /**
   * Get stage display name
   */
  private getStageDisplayName(stage: WorkflowStage): string {
    const displayNames: Record<WorkflowStage, string> = {
      code_review: 'Code Review',
      ci_build: 'CI Build',
      deployment: 'Deployment',
      incident_response: 'Incident Response',
      service_creation: 'Service Creation',
      documentation: 'Documentation',
      approval: 'Approval Process',
    };

    return displayNames[stage];
  }

  /**
   * Get workflow timings (for testing)
   */
  getWorkflowTimings(): WorkflowTiming[] {
    return this.workflowTimings;
  }

  /**
   * Set workflow timings (for testing)
   */
  setWorkflowTimings(timings: WorkflowTiming[]): void {
    this.workflowTimings = timings;
  }

  /**
   * Clear workflow timings (for testing)
   */
  clearWorkflowTimings(): void {
    this.workflowTimings = [];
  }
}
