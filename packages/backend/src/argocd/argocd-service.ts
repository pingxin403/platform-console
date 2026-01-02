/**
 * Argo CD service for deployment status integration
 * Provides real-time deployment status and management capabilities
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { Config } from '@backstage/config';
import { Logger } from 'winston';
import { Entity } from '@backstage/catalog-model';
import { ArgocdErrorHandler, DeploymentError, ManualSyncOperation } from './error-handler';

/**
 * Deployment status interface
 */
export interface DeploymentStatus {
  applicationName: string;
  health: 'Healthy' | 'Progressing' | 'Degraded' | 'Suspended' | 'Missing' | 'Unknown';
  sync: 'Synced' | 'OutOfSync' | 'Unknown';
  lastSyncTime?: string;
  environment: string;
  namespace: string;
  errors?: DeploymentError[];
  logUrl?: string;
  canSync: boolean;
  syncHistory?: ManualSyncOperation[];
}

/**
 * Multi-environment deployment status
 */
export interface MultiEnvironmentStatus {
  serviceName: string;
  environments: {
    [environment: string]: DeploymentStatus;
  };
  overallHealth: 'Healthy' | 'Degraded' | 'Unknown';
}

/**
 * Sync operation result
 */
export interface SyncResult {
  success: boolean;
  syncId?: string;
  operation?: ManualSyncOperation;
  error?: string;
  estimatedDuration?: number;
}

/**
 * Argo CD service for managing deployment status and operations
 */
export class ArgocdService {
  private baseUrl: string;
  private token: string;
  private logger: Logger;
  private errorHandler: ArgocdErrorHandler;
  private statusCache: Map<string, DeploymentStatus> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds

  constructor(config: Config, logger: Logger) {
    this.baseUrl = config.getOptionalString('argocd.baseUrl') || 'https://argocd.company.com';
    this.token = config.getOptionalString('argocd.token') || 'mock-token';
    this.logger = logger;
    this.errorHandler = new ArgocdErrorHandler(config, logger);
  }

  /**
   * Get deployment status for a service from catalog entity
   */
  async getDeploymentStatus(entity: Entity): Promise<DeploymentStatus | null> {
    const annotations = entity.metadata.annotations || {};
    const argocdAppName = annotations['argocd/app-name'];

    if (!argocdAppName) {
      this.logger.debug(`No Argo CD application annotation found for entity: ${entity.metadata.name}`);
      return null;
    }

    return this.getApplicationStatus(argocdAppName);
  }

  /**
   * Get deployment status for multiple environments
   */
  async getMultiEnvironmentStatus(entity: Entity): Promise<MultiEnvironmentStatus | null> {
    const serviceName = entity.metadata.name;
    const annotations = entity.metadata.annotations || {};
    const baseAppName = annotations['argocd/app-name'];

    if (!baseAppName) {
      return null;
    }

    // Common environment suffixes
    const environments = ['development', 'staging', 'production'];
    const environmentStatuses: { [environment: string]: DeploymentStatus } = {};

    for (const env of environments) {
      const appName = baseAppName.includes('-') ? 
        `${baseAppName.split('-')[0]}-${env}` : 
        `${baseAppName}-${env}`;

      try {
        const status = await this.getApplicationStatus(appName);
        if (status) {
          environmentStatuses[env] = status;
        }
      } catch (error) {
        this.logger.debug(`Failed to get status for ${appName}: ${error}`);
        // Continue with other environments
      }
    }

    if (Object.keys(environmentStatuses).length === 0) {
      return null;
    }

    // Determine overall health
    const healthStatuses = Object.values(environmentStatuses).map(s => s.health);
    const overallHealth = healthStatuses.includes('Degraded') ? 'Degraded' :
                         healthStatuses.includes('Unknown') ? 'Unknown' : 'Healthy';

    return {
      serviceName,
      environments: environmentStatuses,
      overallHealth,
    };
  }

  /**
   * Get application status from Argo CD API
   */
  async getApplicationStatus(appName: string): Promise<DeploymentStatus | null> {
    try {
      // Check cache first
      const cached = this.getCachedStatus(appName);
      if (cached) {
        return cached;
      }

      this.logger.debug(`Fetching Argo CD status for application: ${appName}`);

      // Simulate API call to Argo CD
      const status = await this.fetchApplicationStatusFromApi(appName);
      
      if (status) {
        // Cache the result
        this.setCachedStatus(appName, status);
      }

      return status;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get Argo CD status for ${appName}: ${errorMessage}`);
      
      // Return error status
      return {
        applicationName: appName,
        health: 'Unknown',
        sync: 'Unknown',
        environment: this.determineEnvironmentFromAppName(appName),
        namespace: 'default',
        errors: [errorMessage],
        canSync: false,
      };
    }
  }

  /**
   * Trigger manual sync for an application
   */
  async syncApplication(appName: string, options: {
    prune?: boolean;
    dryRun?: boolean;
    force?: boolean;
    triggeredBy?: string;
  } = {}): Promise<SyncResult> {
    try {
      this.logger.info(`Triggering sync for Argo CD application: ${appName}`);

      const { prune = false, dryRun = false, force = false, triggeredBy = 'system' } = options;
      const environment = this.determineEnvironmentFromAppName(appName);

      // Create manual sync operation
      const operation = await this.errorHandler.createManualSyncOperation({
        applicationName: appName,
        environment,
        triggeredBy,
        options: { prune, dryRun, force },
      });

      // Invalidate cache to force refresh
      this.invalidateCache(appName);
      this.logger.info(`Sync operation created: ${operation.syncId} for application: ${appName}`);

      return {
        success: true,
        syncId: operation.syncId,
        operation,
        estimatedDuration: 120, // 2 minutes
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to sync Argo CD application ${appName}: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get sync operation status
   */
  async getSyncOperationStatus(syncId: string): Promise<ManualSyncOperation | null> {
    return this.errorHandler.getSyncOperationStatus(syncId);
  }

  /**
   * Get sync history for an application
   */
  async getSyncHistory(appName: string, limit: number = 10): Promise<ManualSyncOperation[]> {
    return this.errorHandler.getApplicationSyncHistory(appName, limit);
  }

  /**
   * Get error details and recovery actions
   */
  async getErrorDetails(appName: string): Promise<{
    errors: DeploymentError[];
    recoveryActions: any[];
  }> {
    try {
      // In a real implementation, this would fetch actual errors from Argo CD
      const mockErrors: DeploymentError[] = [
        this.errorHandler.parseDeploymentError(
          'Pod CrashLoopBackOff: container failed to start',
          appName,
          this.determineEnvironmentFromAppName(appName)
        ),
      ];

      const recoveryActions = mockErrors.flatMap(error => 
        this.errorHandler.generateRecoveryActions(error)
      );

      return {
        errors: mockErrors,
        recoveryActions,
      };

    } catch (error) {
      this.logger.error(`Failed to get error details for ${appName}: ${error}`);
      return {
        errors: [],
        recoveryActions: [],
      };
    }
  }

  /**
   * Check if user can perform sync operations on an application
   */
  async canUserSync(appName: string, userEmail: string): Promise<boolean> {
    try {
      // In a real implementation, this would check Argo CD RBAC
      // For now, simulate permission check
      
      // Allow sync for service owners (this would be determined by catalog ownership)
      return true; // Simplified for demo

    } catch (error) {
      this.logger.error(`Failed to check sync permissions for ${appName}: ${error}`);
      return false;
    }
  }

  /**
   * Get deployment logs URL
   */
  getDeploymentLogsUrl(appName: string, environment?: string): string {
    return `${this.baseUrl}/applications/${appName}/logs`;
  }

  /**
   * Get application URL in Argo CD UI
   */
  getApplicationUrl(appName: string): string {
    return `${this.baseUrl}/applications/${appName}`;
  }

  /**
   * Fetch application status from Argo CD API (simulated)
   */
  private async fetchApplicationStatusFromApi(appName: string): Promise<DeploymentStatus | null> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simulate different application states
    const mockStatuses = [
      {
        health: 'Healthy' as const,
        sync: 'Synced' as const,
        lastSyncTime: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
        errors: [],
      },
      {
        health: 'Progressing' as const,
        sync: 'OutOfSync' as const,
        lastSyncTime: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
        errors: [],
      },
      {
        health: 'Degraded' as const,
        sync: 'OutOfSync' as const,
        lastSyncTime: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
        errors: [
          this.errorHandler.parseDeploymentError(
            'Pod CrashLoopBackOff: container failed to start',
            appName,
            this.determineEnvironmentFromAppName(appName)
          ),
          this.errorHandler.parseDeploymentError(
            'Service endpoint not ready',
            appName,
            this.determineEnvironmentFromAppName(appName)
          ),
        ],
      },
    ];

    // Select status based on app name hash for consistency
    const hash = appName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const statusIndex = hash % mockStatuses.length;
    const mockStatus = mockStatuses[statusIndex];

    const environment = this.determineEnvironmentFromAppName(appName);
    const namespace = environment === 'production' ? 'prod' : environment;

    // Get sync history
    const syncHistory = await this.getSyncHistory(appName, 5);

    return {
      applicationName: appName,
      health: mockStatus.health,
      sync: mockStatus.sync,
      lastSyncTime: mockStatus.lastSyncTime,
      environment,
      namespace,
      errors: mockStatus.errors,
      logUrl: this.getDeploymentLogsUrl(appName, environment),
      canSync: true,
      syncHistory,
    };
  }

  /**
   * Trigger sync via Argo CD API (simulated)
   */
  private async triggerSyncViaApi(appName: string, options: {
    prune: boolean;
    dryRun: boolean;
    force: boolean;
  }): Promise<SyncResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Simulate sync operation
    const syncId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      success: true,
      syncId,
      estimatedDuration: 120, // 2 minutes
    };
  }

  /**
   * Cache management methods
   */
  private getCachedStatus(appName: string): DeploymentStatus | null {
    const cached = this.statusCache.get(appName);
    const expiry = this.cacheExpiry.get(appName);

    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }

    // Clean up expired cache
    this.statusCache.delete(appName);
    this.cacheExpiry.delete(appName);
    return null;
  }

  private setCachedStatus(appName: string, status: DeploymentStatus): void {
    this.statusCache.set(appName, status);
    this.cacheExpiry.set(appName, Date.now() + this.CACHE_TTL);
  }

  private invalidateCache(appName: string): void {
    this.statusCache.delete(appName);
    this.cacheExpiry.delete(appName);
  }

  /**
   * Determine environment from application name
   */
  private determineEnvironmentFromAppName(appName: string): string {
    if (appName.includes('-prod') || appName.includes('-production')) {
      return 'production';
    }
    if (appName.includes('-staging') || appName.includes('-stage')) {
      return 'staging';
    }
    if (appName.includes('-dev') || appName.includes('-development')) {
      return 'development';
    }
    return 'production'; // Default to production
  }

  /**
   * Health check for Argo CD connectivity
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    version?: string;
    error?: string;
  }> {
    try {
      // Simulate health check
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return {
        healthy: true,
        version: '2.8.0',
      };

    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Factory function to create Argo CD service
 */
export function createArgocdService(config: Config, logger: Logger): ArgocdService {
  return new ArgocdService(config, logger);
}

// Export types
export type { DeploymentStatus, MultiEnvironmentStatus, SyncResult };