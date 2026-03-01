/**
 * DORA metrics data collector orchestrator
 * 
 * Coordinates data collection from multiple sources and metric calculation
 */

import { Logger } from 'winston';
import { ArgoCDCollector } from './argocd-collector';
import { GitHubCollector } from './github-collector';
import { IncidentCollector } from './incident-collector';
import { MetricsCalculator } from './metrics-calculator';
import {
  DORACollectorConfig,
  DORAMetrics,
  DeploymentData,
  PullRequestData,
  IncidentData,
  CollectionResult,
  CalculationResult,
  TimePeriod,
} from './types';

export class DORADataCollector {
  private readonly logger: Logger;
  private readonly config: DORACollectorConfig;
  private readonly argoCDCollector: ArgoCDCollector;
  private readonly githubCollector: GitHubCollector;
  private readonly incidentCollector: IncidentCollector;
  private readonly metricsCalculator: MetricsCalculator;

  // In-memory storage for collected data
  private deployments: DeploymentData[] = [];
  private pullRequests: PullRequestData[] = [];
  private incidents: IncidentData[] = [];

  constructor(logger: Logger, config: DORACollectorConfig) {
    this.logger = logger;
    this.config = config;

    // Initialize collectors
    this.argoCDCollector = new ArgoCDCollector(logger, config.argocd);
    this.githubCollector = new GitHubCollector(logger, config.github);
    this.incidentCollector = new IncidentCollector(logger, config.incidents);
    this.metricsCalculator = new MetricsCalculator(logger, config);
  }

  /**
   * Collect data from all sources
   */
  async collectAllData(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    success: boolean;
    results: CollectionResult[];
    deployments: DeploymentData[];
    pullRequests: PullRequestData[];
    incidents: IncidentData[];
  }> {
    this.logger.info('Starting DORA data collection from all sources', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const results: CollectionResult[] = [];

    // Collect from Argo CD
    if (this.config.argocd.enabled) {
      try {
        const result = await this.argoCDCollector.collectDeployments(
          startDate,
          endDate,
        );
        results.push(result);
        
        // Store collected deployments
        // Note: In a real implementation, we'd get the data from the collector
        // For now, we'll need to modify the collectors to return the data
      } catch (error) {
        this.logger.error('Argo CD collection failed', { error });
        results.push({
          success: false,
          source: 'argocd',
          recordsCollected: 0,
          errors: [String(error)],
          collectedAt: new Date(),
          duration: 0,
        });
      }
    }

    // Collect from GitHub
    if (this.config.github.enabled) {
      try {
        const result = await this.githubCollector.collectPullRequests(
          startDate,
          endDate,
        );
        results.push(result);
      } catch (error) {
        this.logger.error('GitHub collection failed', { error });
        results.push({
          success: false,
          source: 'github',
          recordsCollected: 0,
          errors: [String(error)],
          collectedAt: new Date(),
          duration: 0,
        });
      }
    }

    // Collect from incident systems
    if (
      this.config.incidents.jira?.enabled ||
      this.config.incidents.pagerduty?.enabled
    ) {
      try {
        const result = await this.incidentCollector.collectIncidents(
          startDate,
          endDate,
        );
        results.push(result);
      } catch (error) {
        this.logger.error('Incident collection failed', { error });
        results.push({
          success: false,
          source: 'jira',
          recordsCollected: 0,
          errors: [String(error)],
          collectedAt: new Date(),
          duration: 0,
        });
      }
    }

    const success = results.every(r => r.success);

    this.logger.info('DORA data collection completed', {
      success,
      totalResults: results.length,
      totalRecords:
        this.deployments.length +
        this.pullRequests.length +
        this.incidents.length,
    });

    return {
      success,
      results,
      deployments: this.deployments,
      pullRequests: this.pullRequests,
      incidents: this.incidents,
    };
  }

  /**
   * Calculate metrics for a service
   */
  async calculateServiceMetrics(
    serviceId: string,
    serviceName: string,
    period: TimePeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<CalculationResult> {
    this.logger.info('Calculating service metrics', {
      serviceId,
      serviceName,
      period,
    });

    return this.metricsCalculator.calculateServiceMetrics(
      serviceId,
      serviceName,
      this.deployments,
      this.pullRequests,
      this.incidents,
      period,
      startDate,
      endDate,
    );
  }

  /**
   * Calculate metrics for all services
   */
  async calculateAllServiceMetrics(
    period: TimePeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<CalculationResult[]> {
    this.logger.info('Calculating metrics for all services', { period });

    // Get unique service IDs from collected data
    const serviceIds = new Set<string>();
    const serviceNames = new Map<string, string>();

    this.deployments.forEach(d => {
      serviceIds.add(d.serviceId);
      serviceNames.set(d.serviceId, d.serviceName);
    });

    this.pullRequests.forEach(pr => {
      serviceIds.add(pr.serviceId);
      serviceNames.set(pr.serviceId, pr.serviceName);
    });

    this.incidents.forEach(i => {
      serviceIds.add(i.serviceId);
      serviceNames.set(i.serviceId, i.serviceName);
    });

    // Calculate metrics for each service
    const results: CalculationResult[] = [];

    for (const serviceId of serviceIds) {
      const serviceName = serviceNames.get(serviceId) || serviceId;
      const result = await this.calculateServiceMetrics(
        serviceId,
        serviceName,
        period,
        startDate,
        endDate,
      );
      results.push(result);
    }

    this.logger.info('Completed metrics calculation for all services', {
      totalServices: results.length,
      successful: results.filter(r => r.success).length,
    });

    return results;
  }

  /**
   * Run full collection and calculation cycle
   */
  async runCollectionCycle(
    period: TimePeriod = 'weekly',
  ): Promise<{
    success: boolean;
    collectionResults: CollectionResult[];
    calculationResults: CalculationResult[];
  }> {
    this.logger.info('Starting DORA collection cycle', { period });

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'daily':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    // Collect data
    const collectionResult = await this.collectAllData(startDate, endDate);

    // Calculate metrics
    const calculationResults = await this.calculateAllServiceMetrics(
      period,
      startDate,
      endDate,
    );

    const success =
      collectionResult.success &&
      calculationResults.every(r => r.success);

    this.logger.info('DORA collection cycle completed', {
      success,
      services: calculationResults.length,
    });

    return {
      success,
      collectionResults: collectionResult.results,
      calculationResults,
    };
  }

  /**
   * Get collected deployments
   */
  getDeployments(): DeploymentData[] {
    return this.deployments;
  }

  /**
   * Get collected pull requests
   */
  getPullRequests(): PullRequestData[] {
    return this.pullRequests;
  }

  /**
   * Get collected incidents
   */
  getIncidents(): IncidentData[] {
    return this.incidents;
  }

  /**
   * Set deployments (for testing or external data injection)
   */
  setDeployments(deployments: DeploymentData[]): void {
    this.deployments = deployments;
  }

  /**
   * Set pull requests (for testing or external data injection)
   */
  setPullRequests(pullRequests: PullRequestData[]): void {
    this.pullRequests = pullRequests;
  }

  /**
   * Set incidents (for testing or external data injection)
   */
  setIncidents(incidents: IncidentData[]): void {
    this.incidents = incidents;
  }
}
