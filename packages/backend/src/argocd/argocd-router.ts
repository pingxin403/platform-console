/**
 * Argo CD API router for deployment status and operations
 * Provides REST endpoints for Argo CD integration
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { Router } from 'express';
import { Logger } from 'winston';
import { Config } from '@backstage/config';
import { CatalogApi } from '@backstage/catalog-client';
import { ArgocdService, DeploymentStatus, MultiEnvironmentStatus, SyncResult } from './argocd-service';
import { Entity } from '@backstage/catalog-model';

export interface ArgocdRouterOptions {
  config: Config;
  logger: Logger;
  catalogApi: CatalogApi;
}

/**
 * Create Argo CD API router
 */
export function createArgocdRouter(options: ArgocdRouterOptions): Router {
  const { config, logger, catalogApi } = options;
  const router = Router();
  const argocdService = new ArgocdService(config, logger);

  /**
   * Get deployment status for a service
   * GET /api/argocd/status/:serviceName
   */
  router.get('/status/:serviceName', async (req, res) => {
    const { serviceName } = req.params;
    
    try {
      logger.debug(`Getting deployment status for service: ${serviceName}`);

      // Get entity from catalog
      const entity = await getEntityFromCatalog(catalogApi, serviceName);
      if (!entity) {
        return res.status(404).json({
          error: 'Service not found in catalog',
          serviceName,
        });
      }

      // Get deployment status
      const status = await argocdService.getDeploymentStatus(entity);
      
      if (!status) {
        return res.status(404).json({
          error: 'No Argo CD application found for service',
          serviceName,
        });
      }

      res.json({
        serviceName,
        status,
        applicationUrl: argocdService.getApplicationUrl(status.applicationName),
        logsUrl: status.logUrl,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to get deployment status for ${serviceName}: ${errorMessage}`);
      
      res.status(500).json({
        error: 'Failed to get deployment status',
        details: errorMessage,
        serviceName,
      });
    }
  });

  /**
   * Get multi-environment deployment status for a service
   * GET /api/argocd/status/:serviceName/environments
   */
  router.get('/status/:serviceName/environments', async (req, res) => {
    const { serviceName } = req.params;
    
    try {
      logger.debug(`Getting multi-environment status for service: ${serviceName}`);

      // Get entity from catalog
      const entity = await getEntityFromCatalog(catalogApi, serviceName);
      if (!entity) {
        return res.status(404).json({
          error: 'Service not found in catalog',
          serviceName,
        });
      }

      // Get multi-environment status
      const multiStatus = await argocdService.getMultiEnvironmentStatus(entity);
      
      if (!multiStatus) {
        return res.status(404).json({
          error: 'No Argo CD applications found for service environments',
          serviceName,
        });
      }

      // Add application URLs for each environment
      const enrichedStatus = {
        ...multiStatus,
        environments: Object.fromEntries(
          Object.entries(multiStatus.environments).map(([env, status]) => [
            env,
            {
              ...status,
              applicationUrl: argocdService.getApplicationUrl(status.applicationName),
              logsUrl: status.logUrl,
            },
          ])
        ),
      };

      res.json(enrichedStatus);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to get multi-environment status for ${serviceName}: ${errorMessage}`);
      
      res.status(500).json({
        error: 'Failed to get multi-environment status',
        details: errorMessage,
        serviceName,
      });
    }
  });

  /**
   * Trigger manual sync for a service
   * POST /api/argocd/sync/:serviceName
   */
  router.post('/sync/:serviceName', async (req, res) => {
    const { serviceName } = req.params;
    const { environment, prune = false, dryRun = false, force = false } = req.body;
    
    try {
      logger.info(`Triggering sync for service: ${serviceName}, environment: ${environment || 'default'}`);

      // Get entity from catalog
      const entity = await getEntityFromCatalog(catalogApi, serviceName);
      if (!entity) {
        return res.status(404).json({
          error: 'Service not found in catalog',
          serviceName,
        });
      }

      // Determine application name
      const annotations = entity.metadata.annotations || {};
      let appName = annotations['argocd/app-name'];
      
      if (!appName) {
        return res.status(404).json({
          error: 'No Argo CD application annotation found for service',
          serviceName,
        });
      }

      // Append environment suffix if specified
      if (environment && environment !== 'production') {
        appName = appName.includes('-') ? 
          `${appName.split('-')[0]}-${environment}` : 
          `${appName}-${environment}`;
      }

      // Check user permissions (simplified for demo)
      const userEmail = req.headers['x-user-email'] as string || 'demo@company.com';
      const canSync = await argocdService.canUserSync(appName, userEmail);
      
      if (!canSync) {
        return res.status(403).json({
          error: 'User does not have permission to sync this application',
          serviceName,
          applicationName: appName,
        });
      }

      // Trigger sync
      const syncResult = await argocdService.syncApplication(appName, {
        prune,
        dryRun,
        force,
        triggeredBy: userEmail,
      });

      if (syncResult.success) {
        res.json({
          success: true,
          serviceName,
          applicationName: appName,
          syncId: syncResult.syncId,
          operation: syncResult.operation,
          estimatedDuration: syncResult.estimatedDuration,
          applicationUrl: argocdService.getApplicationUrl(appName),
        });
      } else {
        res.status(500).json({
          success: false,
          error: syncResult.error,
          serviceName,
          applicationName: appName,
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to sync service ${serviceName}: ${errorMessage}`);
      
      res.status(500).json({
        success: false,
        error: 'Failed to trigger sync',
        details: errorMessage,
        serviceName,
      });
    }
  });

  /**
   * Get Argo CD health status
   * GET /api/argocd/health
   */
  router.get('/health', async (req, res) => {
    try {
      const health = await argocdService.healthCheck();
      
      res.json({
        service: 'argocd',
        ...health,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Argo CD health check failed: ${errorMessage}`);
      
      res.status(500).json({
        service: 'argocd',
        healthy: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Get application logs URL
   * GET /api/argocd/logs/:serviceName
   */
  router.get('/logs/:serviceName', async (req, res) => {
    const { serviceName } = req.params;
    const { environment } = req.query;
    
    try {
      // Get entity from catalog
      const entity = await getEntityFromCatalog(catalogApi, serviceName);
      if (!entity) {
        return res.status(404).json({
          error: 'Service not found in catalog',
          serviceName,
        });
      }

      const annotations = entity.metadata.annotations || {};
      let appName = annotations['argocd/app-name'];
      
      if (!appName) {
        return res.status(404).json({
          error: 'No Argo CD application annotation found for service',
          serviceName,
        });
      }

      // Append environment suffix if specified
      if (environment && environment !== 'production') {
        appName = `${appName}-${environment}`;
      }

      const logsUrl = argocdService.getDeploymentLogsUrl(appName, environment as string);
      
      res.json({
        serviceName,
        applicationName: appName,
        environment: environment || 'production',
        logsUrl,
        applicationUrl: argocdService.getApplicationUrl(appName),
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to get logs URL for ${serviceName}: ${errorMessage}`);
      
      res.status(500).json({
        error: 'Failed to get logs URL',
        details: errorMessage,
        serviceName,
      });
    }
  });

  /**
   * Get sync operation status
   * GET /api/argocd/sync/:syncId/status
   */
  router.get('/sync/:syncId/status', async (req, res) => {
    const { syncId } = req.params;
    
    try {
      const operation = await argocdService.getSyncOperationStatus(syncId);
      
      if (!operation) {
        return res.status(404).json({
          error: 'Sync operation not found',
          syncId,
        });
      }

      res.json({
        syncId,
        operation,
        applicationUrl: argocdService.getApplicationUrl(operation.applicationName),
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to get sync operation status for ${syncId}: ${errorMessage}`);
      
      res.status(500).json({
        error: 'Failed to get sync operation status',
        details: errorMessage,
        syncId,
      });
    }
  });

  /**
   * Get sync history for a service
   * GET /api/argocd/sync-history/:serviceName
   */
  router.get('/sync-history/:serviceName', async (req, res) => {
    const { serviceName } = req.params;
    const { limit = 10 } = req.query;
    
    try {
      // Get entity from catalog
      const entity = await getEntityFromCatalog(catalogApi, serviceName);
      if (!entity) {
        return res.status(404).json({
          error: 'Service not found in catalog',
          serviceName,
        });
      }

      const annotations = entity.metadata.annotations || {};
      const appName = annotations['argocd/app-name'];
      
      if (!appName) {
        return res.status(404).json({
          error: 'No Argo CD application annotation found for service',
          serviceName,
        });
      }

      const history = await argocdService.getSyncHistory(appName, Number(limit));
      
      res.json({
        serviceName,
        applicationName: appName,
        history,
        applicationUrl: argocdService.getApplicationUrl(appName),
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to get sync history for ${serviceName}: ${errorMessage}`);
      
      res.status(500).json({
        error: 'Failed to get sync history',
        details: errorMessage,
        serviceName,
      });
    }
  });

  /**
   * Get error details and recovery actions for a service
   * GET /api/argocd/errors/:serviceName
   */
  router.get('/errors/:serviceName', async (req, res) => {
    const { serviceName } = req.params;
    
    try {
      // Get entity from catalog
      const entity = await getEntityFromCatalog(catalogApi, serviceName);
      if (!entity) {
        return res.status(404).json({
          error: 'Service not found in catalog',
          serviceName,
        });
      }

      const annotations = entity.metadata.annotations || {};
      const appName = annotations['argocd/app-name'];
      
      if (!appName) {
        return res.status(404).json({
          error: 'No Argo CD application annotation found for service',
          serviceName,
        });
      }

      const errorDetails = await argocdService.getErrorDetails(appName);
      
      res.json({
        serviceName,
        applicationName: appName,
        ...errorDetails,
        applicationUrl: argocdService.getApplicationUrl(appName),
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to get error details for ${serviceName}: ${errorMessage}`);
      
      res.status(500).json({
        error: 'Failed to get error details',
        details: errorMessage,
        serviceName,
      });
    }
  });

  return router;
}

/**
 * Helper function to get entity from catalog
 */
async function getEntityFromCatalog(catalogApi: CatalogApi, serviceName: string): Promise<Entity | null> {
  try {
    const entities = await catalogApi.getEntities({
      filter: {
        'metadata.name': serviceName,
        kind: 'Component',
      },
    });

    return entities.items.length > 0 ? entities.items[0] : null;

  } catch (error) {
    throw new Error(`Failed to get entity from catalog: ${error}`);
  }
}

// Export types
export type { DeploymentStatus, MultiEnvironmentStatus, SyncResult };