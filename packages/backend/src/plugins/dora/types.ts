/**
 * Type definitions for DORA metrics data collection
 * 
 * This module defines the core types for collecting and aggregating DORA metrics
 * from multiple data sources (Argo CD, GitHub, incident systems).
 */

/**
 * DORA metric performance levels based on industry benchmarks
 */
export type DORAPerformanceLevel = 'elite' | 'high' | 'medium' | 'low';

/**
 * Time period for metric aggregation
 */
export type TimePeriod = 'daily' | 'weekly' | 'monthly';

/**
 * Deployment data from Argo CD
 */
export interface DeploymentData {
  serviceId: string;
  serviceName: string;
  environment: 'development' | 'staging' | 'production';
  deploymentId: string;
  revision: string;
  deployedAt: Date;
  status: 'success' | 'failed' | 'rollback';
  triggeredBy: string;
  duration: number; // in seconds
}

/**
 * Pull request data from GitHub
 */
export interface PullRequestData {
  serviceId: string;
  serviceName: string;
  prNumber: number;
  title: string;
  createdAt: Date;
  mergedAt: Date | null;
  firstCommitAt: Date;
  author: string;
  linesAdded: number;
  linesDeleted: number;
  filesChanged: number;
  reviewers: string[];
  approvedAt: Date | null;
}

/**
 * Incident data from event systems (Jira, PagerDuty, etc.)
 */
export interface IncidentData {
  serviceId: string;
  serviceName: string;
  incidentId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  createdAt: Date;
  resolvedAt: Date | null;
  detectedAt: Date;
  acknowledgedAt: Date | null;
  relatedDeploymentId?: string;
  rootCause?: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'closed';
}

/**
 * Aggregated DORA metrics for a service or team
 */
export interface DORAMetrics {
  entityId: string; // service or team ID
  entityType: 'service' | 'team';
  entityName: string;
  period: TimePeriod;
  startDate: Date;
  endDate: Date;
  
  // Deployment Frequency
  deploymentFrequency: {
    value: number;
    unit: 'per_day' | 'per_week' | 'per_month';
    level: DORAPerformanceLevel;
    rawData: {
      totalDeployments: number;
      successfulDeployments: number;
      failedDeployments: number;
      periodDays: number;
    };
  };
  
  // Lead Time for Changes
  leadTimeForChanges: {
    value: number; // in hours
    unit: 'hours' | 'days';
    level: DORAPerformanceLevel;
    rawData: {
      averageLeadTime: number; // in hours
      medianLeadTime: number; // in hours
      p95LeadTime: number; // in hours
      totalPRs: number;
    };
  };
  
  // Change Failure Rate
  changeFailureRate: {
    value: number; // percentage
    level: DORAPerformanceLevel;
    rawData: {
      totalDeployments: number;
      failedDeployments: number;
      rollbacks: number;
      hotfixes: number;
      incidents: number;
    };
  };
  
  // Mean Time to Recovery (MTTR)
  meanTimeToRecovery: {
    value: number; // in hours
    unit: 'hours' | 'days';
    level: DORAPerformanceLevel;
    rawData: {
      averageMTTR: number; // in hours
      medianMTTR: number; // in hours
      totalIncidents: number;
      resolvedIncidents: number;
    };
  };
  
  // Overall trend
  trend: 'improving' | 'stable' | 'declining';
  
  // Metadata
  calculatedAt: Date;
  dataCompleteness: {
    deployments: boolean;
    pullRequests: boolean;
    incidents: boolean;
  };
}

/**
 * Configuration for DORA metrics collection
 */
export interface DORACollectorConfig {
  // Argo CD configuration
  argocd: {
    enabled: boolean;
    apiUrl: string;
    token: string;
    namespaces?: string[];
  };
  
  // GitHub configuration
  github: {
    enabled: boolean;
    token: string;
    organizations: string[];
    repositories?: string[];
  };
  
  // Incident system configuration
  incidents: {
    // Jira configuration
    jira?: {
      enabled: boolean;
      serverUrl: string;
      username: string;
      apiToken: string;
      projectKeys: string[];
    };
    
    // PagerDuty configuration
    pagerduty?: {
      enabled: boolean;
      token: string;
      serviceIds: string[];
    };
  };
  
  // Collection settings
  collection: {
    // How often to collect data (in minutes)
    intervalMinutes: number;
    // How far back to look for historical data (in days)
    lookbackDays: number;
    // Batch size for data collection
    batchSize: number;
  };
  
  // Performance level thresholds
  thresholds: {
    deploymentFrequency: {
      elite: number; // deployments per day
      high: number;
      medium: number;
    };
    leadTime: {
      elite: number; // hours
      high: number;
      medium: number;
    };
    changeFailureRate: {
      elite: number; // percentage
      high: number;
      medium: number;
    };
    mttr: {
      elite: number; // hours
      high: number;
      medium: number;
    };
  };
}

/**
 * Data collection result
 */
export interface CollectionResult {
  success: boolean;
  source: 'argocd' | 'github' | 'jira' | 'pagerduty';
  recordsCollected: number;
  errors: string[];
  collectedAt: Date;
  duration: number; // in milliseconds
}

/**
 * Metrics calculation result
 */
export interface CalculationResult {
  success: boolean;
  entityId: string;
  entityType: 'service' | 'team';
  metrics?: DORAMetrics;
  errors: string[];
  calculatedAt: Date;
  duration: number; // in milliseconds
}
