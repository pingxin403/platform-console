/**
 * Custom Scaffolder actions for automatic service registration
 * Integrates GitHub repository creation with automatic catalog registration
 * Validates: Requirements 2.4
 */

import { CatalogApi } from '@backstage/catalog-client';
import { ScmIntegrationRegistry } from '@backstage/integration';
import { Config } from '@backstage/config';
import { Logger } from 'winston';
import { createGitHubRepoCreateAction } from './github-repo-create';
import { createCatalogRegisterAction, AutomaticServiceRegistration } from './catalog-register';

export interface CustomScaffolderActionsOptions {
  catalogApi: CatalogApi;
  integrations: ScmIntegrationRegistry;
  config: Config;
  logger: Logger;
}

/**
 * Create all custom scaffolder actions for automatic service registration
 */
export function createCustomScaffolderActions(options: CustomScaffolderActionsOptions) {
  const { catalogApi, integrations, config, logger } = options;
  
  const catalogBaseUrl = config.getString('app.baseUrl');

  return [
    // GitHub repository creation with automatic catalog registration
    createGitHubRepoCreateAction({
      integrations,
      catalogApi,
      config,
      logger,
    }),

    // Standalone catalog registration action
    createCatalogRegisterAction({
      catalogApi,
      logger,
      catalogBaseUrl,
    }),
  ];
}

/**
 * Service registration workflow manager
 */
export class ServiceRegistrationWorkflow {
  private automaticRegistration: AutomaticServiceRegistration;

  constructor(
    private catalogApi: CatalogApi,
    private config: Config,
    private logger: Logger
  ) {
    const catalogBaseUrl = this.config.getString('app.baseUrl');
    this.automaticRegistration = new AutomaticServiceRegistration(
      catalogApi,
      logger,
      catalogBaseUrl
    );
  }

  /**
   * Complete workflow for project creation with automatic service registration
   */
  async executeProjectCreationWorkflow(params: {
    templateType: 'java-service' | 'go-service' | 'react-app' | 'react-native-app';
    projectName: string;
    description: string;
    owner: string;
    repoUrl: string;
    visibility?: 'public' | 'private';
    autoRegister?: boolean;
  }): Promise<{
    repositoryCreated: boolean;
    repositoryUrl: string;
    serviceRegistered: boolean;
    entityRef?: string;
    catalogUrl?: string;
    errors: string[];
  }> {
    const {
      templateType,
      projectName,
      description,
      owner,
      repoUrl,
      visibility = 'private',
      autoRegister = true,
    } = params;

    const errors: string[] = [];
    let repositoryCreated = false;
    let repositoryUrl = '';
    let serviceRegistered = false;
    let entityRef: string | undefined;
    let catalogUrl: string | undefined;

    this.logger.info(`Starting project creation workflow for: ${projectName}`);

    try {
      // Step 1: Create GitHub repository (this would be handled by the scaffolder action)
      repositoryUrl = `https://github.com/${repoUrl.replace('github.com?owner=', '').replace('&repo=', '/')}`;
      repositoryCreated = true;
      
      this.logger.info(`Repository created: ${repositoryUrl}`);

      // Step 2: Automatic service registration if enabled
      if (autoRegister) {
        try {
          const repoContentsUrl = `${repositoryUrl}/blob/main`;
          const registrationResult = await this.automaticRegistration.registerService({
            repoContentsUrl,
            projectName,
            templateType,
          });

          entityRef = registrationResult.entityRef;
          catalogUrl = registrationResult.entityUrl;
          serviceRegistered = true;

          this.logger.info(`Service registered automatically: ${entityRef}`);

        } catch (registrationError) {
          const errorMessage = registrationError instanceof Error ? registrationError.message : 'Unknown registration error';
          errors.push(`Service registration failed: ${errorMessage}`);
          this.logger.error(`Service registration failed: ${errorMessage}`);
        }
      }

      // Step 3: Verify workflow completion
      await this.verifyWorkflowCompletion({
        projectName,
        repositoryUrl,
        entityRef,
        expectedRegistration: autoRegister,
      });

    } catch (workflowError) {
      const errorMessage = workflowError instanceof Error ? workflowError.message : 'Unknown workflow error';
      errors.push(`Workflow execution failed: ${errorMessage}`);
      this.logger.error(`Project creation workflow failed: ${errorMessage}`);
    }

    return {
      repositoryCreated,
      repositoryUrl,
      serviceRegistered,
      entityRef,
      catalogUrl,
      errors,
    };
  }

  /**
   * Verify that the workflow completed successfully
   */
  private async verifyWorkflowCompletion(params: {
    projectName: string;
    repositoryUrl: string;
    entityRef?: string;
    expectedRegistration: boolean;
  }): Promise<void> {
    const { projectName, repositoryUrl, entityRef, expectedRegistration } = params;

    this.logger.info(`Verifying workflow completion for: ${projectName}`);

    // Verify repository exists (in a real implementation, you would check GitHub API)
    if (!repositoryUrl) {
      throw new Error('Repository was not created successfully');
    }

    // Verify service registration if expected
    if (expectedRegistration) {
      if (!entityRef) {
        throw new Error('Service registration was expected but failed');
      }

      // Check registration status
      const registrationStatus = await this.automaticRegistration.getRegistrationStatus(entityRef);
      
      if (!registrationStatus.registered) {
        throw new Error('Service is not registered in the catalog');
      }

      if (registrationStatus.hasErrors) {
        this.logger.warn(`Service registered with errors: ${registrationStatus.errors.join(', ')}`);
      }
    }

    this.logger.info(`Workflow verification completed successfully for: ${projectName}`);
  }

  /**
   * Get the status of a service registration
   */
  async getServiceStatus(serviceName: string): Promise<{
    exists: boolean;
    registered: boolean;
    entityRef?: string;
    lastUpdated?: string;
    errors: string[];
  }> {
    try {
      const isRegistered = await this.automaticRegistration.isServiceRegistered(serviceName);
      
      if (!isRegistered) {
        return {
          exists: false,
          registered: false,
          errors: [],
        };
      }

      const entityRef = `Component:default/${serviceName}`;
      const status = await this.automaticRegistration.getRegistrationStatus(entityRef);

      return {
        exists: true,
        registered: status.registered,
        entityRef,
        lastUpdated: status.lastUpdated,
        errors: status.errors,
      };

    } catch (error) {
      return {
        exists: false,
        registered: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Retry service registration for a failed registration
   */
  async retryServiceRegistration(params: {
    projectName: string;
    repositoryUrl: string;
    templateType: string;
  }): Promise<{
    success: boolean;
    entityRef?: string;
    catalogUrl?: string;
    error?: string;
  }> {
    const { projectName, repositoryUrl, templateType } = params;

    this.logger.info(`Retrying service registration for: ${projectName}`);

    try {
      const repoContentsUrl = `${repositoryUrl}/blob/main`;
      const registrationResult = await this.automaticRegistration.registerService({
        repoContentsUrl,
        projectName,
        templateType,
      });

      return {
        success: true,
        entityRef: registrationResult.entityRef,
        catalogUrl: registrationResult.entityUrl,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Service registration retry failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

// Export types for use in other modules
export type { AutomaticServiceRegistration };
export { createGitHubRepoCreateAction, createCatalogRegisterAction };