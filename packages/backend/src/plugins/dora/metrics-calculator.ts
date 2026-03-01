/**
 * DORA metrics calculator
 * 
 * Aggregates data from multiple sources and calculates DORA metrics:
 * - Deployment Frequency
 * - Lead Time for Changes
 * - Change Failure Rate
 * - Mean Time to Recovery (MTTR)
 */

import { Logger } from 'winston';
import {
  DORAMetrics,
  DeploymentData,
  PullRequestData,
  IncidentData,
  DORACollectorConfig,
  DORAPerformanceLevel,
  TimePeriod,
  CalculationResult,
} from './types';

export class MetricsCalculator {
  private readonly logger: Logger;
  private readonly config: DORACollectorConfig;

  constructor(logger: Logger, config: DORACollectorConfig) {
    this.logger = logger;
    this.config = config;
  }

  /**
   * Calculate DORA metrics for a service
   */
  async calculateServiceMetrics(
    serviceId: string,
    serviceName: string,
    deployments: DeploymentData[],
    pullRequests: PullRequestData[],
    incidents: IncidentData[],
    period: TimePeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<CalculationResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      this.logger.info('Calculating DORA metrics', {
        serviceId,
        period,
        deployments: deployments.length,
        pullRequests: pullRequests.length,
        incidents: incidents.length,
      });

      // Filter data for this service
      const serviceDeployments = deployments.filter(d => d.serviceId === serviceId);
      const servicePRs = pullRequests.filter(pr => pr.serviceId === serviceId);
      const serviceIncidents = incidents.filter(i => i.serviceId === serviceId);

      // Calculate each metric
      const deploymentFrequency = this.calculateDeploymentFrequency(
        serviceDeployments,
        startDate,
        endDate,
      );

      const leadTimeForChanges = this.calculateLeadTimeForChanges(servicePRs);

      const changeFailureRate = this.calculateChangeFailureRate(
        serviceDeployments,
        serviceIncidents,
      );

      const meanTimeToRecovery = this.calculateMeanTimeToRecovery(serviceIncidents);

      // Determine overall trend
      const trend = this.determineTrend(
        deploymentFrequency.level,
        leadTimeForChanges.level,
        changeFailureRate.level,
        meanTimeToRecovery.level,
      );

      const metrics: DORAMetrics = {
        entityId: serviceId,
        entityType: 'service',
        entityName: serviceName,
        period,
        startDate,
        endDate,
        deploymentFrequency,
        leadTimeForChanges,
        changeFailureRate,
        meanTimeToRecovery,
        trend,
        calculatedAt: new Date(),
        dataCompleteness: {
          deployments: serviceDeployments.length > 0,
          pullRequests: servicePRs.length > 0,
          incidents: serviceIncidents.length > 0,
        },
      };

      const duration = Date.now() - startTime;

      this.logger.info('DORA metrics calculation completed', {
        serviceId,
        duration,
        trend,
      });

      return {
        success: true,
        entityId: serviceId,
        entityType: 'service',
        metrics,
        errors,
        calculatedAt: new Date(),
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = `Metrics calculation failed for ${serviceId}: ${error}`;
      this.logger.error(errorMsg);

      return {
        success: false,
        entityId: serviceId,
        entityType: 'service',
        errors: [errorMsg],
        calculatedAt: new Date(),
        duration,
      };
    }
  }

  /**
   * Calculate deployment frequency
   */
  private calculateDeploymentFrequency(
    deployments: DeploymentData[],
    startDate: Date,
    endDate: Date,
  ): DORAMetrics['deploymentFrequency'] {
    const periodDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    const totalDeployments = deployments.length;
    const successfulDeployments = deployments.filter(
      d => d.status === 'success',
    ).length;
    const failedDeployments = deployments.filter(
      d => d.status === 'failed' || d.status === 'rollback',
    ).length;

    // Calculate deployments per day
    const deploymentsPerDay = periodDays > 0 ? totalDeployments / periodDays : 0;

    // Determine performance level based on thresholds
    const level = this.getDeploymentFrequencyLevel(deploymentsPerDay);

    // Determine unit based on frequency
    let value: number;
    let unit: 'per_day' | 'per_week' | 'per_month';

    if (deploymentsPerDay >= 1) {
      value = deploymentsPerDay;
      unit = 'per_day';
    } else if (deploymentsPerDay >= 1 / 7) {
      value = deploymentsPerDay * 7;
      unit = 'per_week';
    } else {
      value = deploymentsPerDay * 30;
      unit = 'per_month';
    }

    return {
      value: Math.round(value * 100) / 100,
      unit,
      level,
      rawData: {
        totalDeployments,
        successfulDeployments,
        failedDeployments,
        periodDays,
      },
    };
  }

  /**
   * Calculate lead time for changes
   */
  private calculateLeadTimeForChanges(
    pullRequests: PullRequestData[],
  ): DORAMetrics['leadTimeForChanges'] {
    if (pullRequests.length === 0) {
      return {
        value: 0,
        unit: 'hours',
        level: 'low',
        rawData: {
          averageLeadTime: 0,
          medianLeadTime: 0,
          p95LeadTime: 0,
          totalPRs: 0,
        },
      };
    }

    // Calculate lead time for each PR (first commit to merge)
    const leadTimes = pullRequests
      .filter(pr => pr.mergedAt !== null)
      .map(pr => {
        const leadTime =
          (pr.mergedAt!.getTime() - pr.firstCommitAt.getTime()) /
          (1000 * 60 * 60); // in hours
        return leadTime;
      });

    if (leadTimes.length === 0) {
      return {
        value: 0,
        unit: 'hours',
        level: 'low',
        rawData: {
          averageLeadTime: 0,
          medianLeadTime: 0,
          p95LeadTime: 0,
          totalPRs: pullRequests.length,
        },
      };
    }

    // Calculate statistics
    const averageLeadTime =
      leadTimes.reduce((sum, lt) => sum + lt, 0) / leadTimes.length;
    const sortedLeadTimes = [...leadTimes].sort((a, b) => a - b);
    const medianLeadTime =
      sortedLeadTimes[Math.floor(sortedLeadTimes.length / 2)];
    const p95Index = Math.floor(sortedLeadTimes.length * 0.95);
    const p95LeadTime = sortedLeadTimes[p95Index];

    // Determine performance level
    const level = this.getLeadTimeLevel(averageLeadTime);

    // Determine unit
    const unit = averageLeadTime >= 24 ? 'days' : 'hours';
    const value = unit === 'days' ? averageLeadTime / 24 : averageLeadTime;

    return {
      value: Math.round(value * 100) / 100,
      unit,
      level,
      rawData: {
        averageLeadTime,
        medianLeadTime,
        p95LeadTime,
        totalPRs: pullRequests.length,
      },
    };
  }

  /**
   * Calculate change failure rate
   */
  private calculateChangeFailureRate(
    deployments: DeploymentData[],
    incidents: IncidentData[],
  ): DORAMetrics['changeFailureRate'] {
    const totalDeployments = deployments.length;

    if (totalDeployments === 0) {
      return {
        value: 0,
        level: 'elite',
        rawData: {
          totalDeployments: 0,
          failedDeployments: 0,
          rollbacks: 0,
          hotfixes: 0,
          incidents: 0,
        },
      };
    }

    const failedDeployments = deployments.filter(d => d.status === 'failed').length;
    const rollbacks = deployments.filter(d => d.status === 'rollback').length;

    // Count incidents related to deployments
    const deploymentIncidents = incidents.filter(
      i => i.relatedDeploymentId !== undefined,
    ).length;

    // Calculate failure rate
    const failures = failedDeployments + rollbacks + deploymentIncidents;
    const failureRate = (failures / totalDeployments) * 100;

    // Determine performance level
    const level = this.getChangeFailureRateLevel(failureRate);

    return {
      value: Math.round(failureRate * 100) / 100,
      level,
      rawData: {
        totalDeployments,
        failedDeployments,
        rollbacks,
        hotfixes: 0, // Would need to detect hotfix PRs
        incidents: deploymentIncidents,
      },
    };
  }

  /**
   * Calculate mean time to recovery
   */
  private calculateMeanTimeToRecovery(
    incidents: IncidentData[],
  ): DORAMetrics['meanTimeToRecovery'] {
    const resolvedIncidents = incidents.filter(i => i.resolvedAt !== null);

    if (resolvedIncidents.length === 0) {
      return {
        value: 0,
        unit: 'hours',
        level: 'elite',
        rawData: {
          averageMTTR: 0,
          medianMTTR: 0,
          totalIncidents: incidents.length,
          resolvedIncidents: 0,
        },
      };
    }

    // Calculate recovery time for each incident
    const recoveryTimes = resolvedIncidents.map(i => {
      const recoveryTime =
        (i.resolvedAt!.getTime() - i.detectedAt.getTime()) / (1000 * 60 * 60); // in hours
      return recoveryTime;
    });

    // Calculate statistics
    const averageMTTR =
      recoveryTimes.reduce((sum, rt) => sum + rt, 0) / recoveryTimes.length;
    const sortedRecoveryTimes = [...recoveryTimes].sort((a, b) => a - b);
    const medianMTTR =
      sortedRecoveryTimes[Math.floor(sortedRecoveryTimes.length / 2)];

    // Determine performance level
    const level = this.getMTTRLevel(averageMTTR);

    // Determine unit
    const unit = averageMTTR >= 24 ? 'days' : 'hours';
    const value = unit === 'days' ? averageMTTR / 24 : averageMTTR;

    return {
      value: Math.round(value * 100) / 100,
      unit,
      level,
      rawData: {
        averageMTTR,
        medianMTTR,
        totalIncidents: incidents.length,
        resolvedIncidents: resolvedIncidents.length,
      },
    };
  }

  /**
   * Get deployment frequency performance level
   */
  private getDeploymentFrequencyLevel(
    deploymentsPerDay: number,
  ): DORAPerformanceLevel {
    const thresholds = this.config.thresholds.deploymentFrequency;

    if (deploymentsPerDay >= thresholds.elite) {
      return 'elite';
    } else if (deploymentsPerDay >= thresholds.high) {
      return 'high';
    } else if (deploymentsPerDay >= thresholds.medium) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get lead time performance level
   */
  private getLeadTimeLevel(leadTimeHours: number): DORAPerformanceLevel {
    const thresholds = this.config.thresholds.leadTime;

    if (leadTimeHours <= thresholds.elite) {
      return 'elite';
    } else if (leadTimeHours <= thresholds.high) {
      return 'high';
    } else if (leadTimeHours <= thresholds.medium) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get change failure rate performance level
   */
  private getChangeFailureRateLevel(
    failureRate: number,
  ): DORAPerformanceLevel {
    const thresholds = this.config.thresholds.changeFailureRate;

    if (failureRate <= thresholds.elite) {
      return 'elite';
    } else if (failureRate <= thresholds.high) {
      return 'high';
    } else if (failureRate <= thresholds.medium) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get MTTR performance level
   */
  private getMTTRLevel(mttrHours: number): DORAPerformanceLevel {
    const thresholds = this.config.thresholds.mttr;

    if (mttrHours <= thresholds.elite) {
      return 'elite';
    } else if (mttrHours <= thresholds.high) {
      return 'high';
    } else if (mttrHours <= thresholds.medium) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Determine overall trend based on performance levels
   */
  private determineTrend(
    deploymentFrequencyLevel: DORAPerformanceLevel,
    leadTimeLevel: DORAPerformanceLevel,
    changeFailureRateLevel: DORAPerformanceLevel,
    mttrLevel: DORAPerformanceLevel,
  ): 'improving' | 'stable' | 'declining' {
    // Simple heuristic: count elite/high vs medium/low
    const levels = [
      deploymentFrequencyLevel,
      leadTimeLevel,
      changeFailureRateLevel,
      mttrLevel,
    ];

    const eliteHighCount = levels.filter(
      l => l === 'elite' || l === 'high',
    ).length;

    if (eliteHighCount >= 3) {
      return 'improving';
    } else if (eliteHighCount >= 2) {
      return 'stable';
    } else {
      return 'declining';
    }
  }
}
