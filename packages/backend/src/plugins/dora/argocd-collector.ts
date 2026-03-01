/**
 * Argo CD data collector for DORA metrics
 * 
 * Collects deployment data from Argo CD including:
 * - Deployment frequency
 * - Deployment success/failure rates
 * - Rollback events
 */

import { Logger } from 'winston';
import axios, { AxiosInstance } from 'axios';
import { DeploymentData, DORACollectorConfig, CollectionResult } from './types';

export class ArgoCDCollector {
  private readonly logger: Logger;
  private readonly config: DORACollectorConfig['argocd'];
  private readonly client: AxiosInstance;

  constructor(logger: Logger, config: DORACollectorConfig['argocd']) {
    this.logger = logger;
    this.config = config;
    
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Collect deployment data from Argo CD
   */
  async collectDeployments(
    startDate: Date,
    endDate: Date,
  ): Promise<CollectionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const deployments: DeploymentData[] = [];

    try {
      this.logger.info('Starting Argo CD deployment data collection', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      // Get all applications
      const applications = await this.getApplications();
      
      this.logger.info(`Found ${applications.length} Argo CD applications`);

      // Collect deployment history for each application
      for (const app of applications) {
        try {
          const appDeployments = await this.getApplicationDeployments(
            app,
            startDate,
            endDate,
          );
          deployments.push(...appDeployments);
        } catch (error) {
          const errorMsg = `Failed to collect deployments for ${app.metadata.name}: ${error}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      const duration = Date.now() - startTime;
      
      this.logger.info('Argo CD deployment data collection completed', {
        recordsCollected: deployments.length,
        duration,
        errors: errors.length,
      });

      return {
        success: errors.length === 0,
        source: 'argocd',
        recordsCollected: deployments.length,
        errors,
        collectedAt: new Date(),
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = `Argo CD collection failed: ${error}`;
      this.logger.error(errorMsg);
      
      return {
        success: false,
        source: 'argocd',
        recordsCollected: 0,
        errors: [errorMsg],
        collectedAt: new Date(),
        duration,
      };
    }
  }

  /**
   * Get all Argo CD applications
   */
  private async getApplications(): Promise<any[]> {
    try {
      const response = await this.client.get('/api/v1/applications');
      return response.data.items || [];
    } catch (error) {
      this.logger.error('Failed to fetch Argo CD applications', { error });
      throw error;
    }
  }

  /**
   * Get deployment history for an application
   */
  private async getApplicationDeployments(
    app: any,
    startDate: Date,
    endDate: Date,
  ): Promise<DeploymentData[]> {
    const deployments: DeploymentData[] = [];
    
    try {
      // Get application history
      const response = await this.client.get(
        `/api/v1/applications/${app.metadata.name}/revisions`,
      );
      
      const revisions = response.data || [];
      
      for (const revision of revisions) {
        const deployedAt = new Date(revision.deployedAt);
        
        // Filter by date range
        if (deployedAt >= startDate && deployedAt <= endDate) {
          const deployment: DeploymentData = {
            serviceId: this.extractServiceId(app),
            serviceName: app.metadata.name,
            environment: this.extractEnvironment(app),
            deploymentId: revision.id || `${app.metadata.name}-${revision.revision}`,
            revision: revision.revision,
            deployedAt,
            status: this.mapSyncStatus(revision.syncStatus),
            triggeredBy: revision.initiatedBy?.username || 'system',
            duration: revision.duration || 0,
          };
          
          deployments.push(deployment);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to get deployment history for ${app.metadata.name}`, {
        error,
      });
    }
    
    return deployments;
  }

  /**
   * Extract service ID from Argo CD application
   */
  private extractServiceId(app: any): string {
    // Try to get service ID from annotations
    const annotations = app.metadata.annotations || {};
    return (
      annotations['backstage.io/kubernetes-id'] ||
      annotations['backstage.io/service-id'] ||
      app.metadata.name
    );
  }

  /**
   * Extract environment from Argo CD application
   */
  private extractEnvironment(
    app: any,
  ): 'development' | 'staging' | 'production' {
    const name = app.metadata.name.toLowerCase();
    const namespace = app.spec.destination.namespace?.toLowerCase() || '';
    
    if (name.includes('prod') || namespace.includes('prod')) {
      return 'production';
    } else if (name.includes('stag') || namespace.includes('stag')) {
      return 'staging';
    } else {
      return 'development';
    }
  }

  /**
   * Map Argo CD sync status to deployment status
   */
  private mapSyncStatus(
    syncStatus: string,
  ): 'success' | 'failed' | 'rollback' {
    const status = syncStatus?.toLowerCase() || '';
    
    if (status.includes('synced') || status.includes('healthy')) {
      return 'success';
    } else if (status.includes('rollback')) {
      return 'rollback';
    } else {
      return 'failed';
    }
  }

  /**
   * Get deployment data for storage
   */
  getDeploymentData(): DeploymentData[] {
    // This would be called after collectDeployments to get the collected data
    // For now, we'll implement this as part of the main collection flow
    return [];
  }
}
