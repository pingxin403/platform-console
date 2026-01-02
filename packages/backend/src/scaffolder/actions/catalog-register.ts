/**
 * Custom Scaffolder action for automatic catalog registration
 * Validates: Requirements 2.4
 */

import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { CatalogApi } from '@backstage/catalog-client';
import { Entity } from '@backstage/catalog-model';
import { Logger } from 'winston';
import { z } from 'zod';

// Input schema for the catalog registration action
const inputSchema = z.object({
  repoContentsUrl: z.string().describe('Repository contents URL'),
  catalogInfoPath: z.string().default('/catalog-info.yaml').describe('Path to catalog-info.yaml file'),
  waitForRegistration: z.boolean().default(true).describe('Wait for entity to be fully processed'),
  maxWaitTime: z.number().default(300).describe('Maximum wait time in seconds'),
  validateEntity: z.boolean().default(true).describe('Validate entity before registration'),
});

// Output schema for the action
const outputSchema = z.object({
  entityRef: z.string().describe('Catalog entity reference'),
  catalogInfoUrl: z.string().describe('URL to the catalog-info.yaml file'),
  entityUrl: z.string().describe('URL to the entity in the catalog'),
  registrationTime: z.string().describe('ISO timestamp of registration'),
});

export interface CatalogRegisterActionOptions {
  catalogApi: CatalogApi;
  logger: Logger;
  catalogBaseUrl: string;
}

/**
 * Creates a custom Scaffolder action for automatic catalog registration
 */
export function createCatalogRegisterAction(options: CatalogRegisterActionOptions) {
  const { catalogApi, logger, catalogBaseUrl } = options;

  return createTemplateAction<typeof inputSchema, typeof outputSchema>({
    id: 'catalog:register:auto',
    description: 'Automatically register a service in the Backstage catalog with validation and monitoring',
    schema: {
      input: inputSchema,
      output: outputSchema,
    },
    async handler(ctx) {
      const {
        repoContentsUrl,
        catalogInfoPath,
        waitForRegistration,
        maxWaitTime,
        validateEntity,
      } = ctx.input;

      const catalogInfoUrl = `${repoContentsUrl}${catalogInfoPath}`;
      const registrationTime = new Date().toISOString();

      ctx.logger.info(`Starting automatic catalog registration for: ${catalogInfoUrl}`);

      try {
        // Validate entity before registration if requested
        if (validateEntity) {
          await validateCatalogEntity(catalogInfoUrl, ctx.logger);
        }

        // Register the entity in the catalog
        const registrationResult = await catalogApi.addLocation({
          type: 'url',
          target: catalogInfoUrl,
        });

        if (!registrationResult.entities || registrationResult.entities.length === 0) {
          throw new Error('No entities were registered from the catalog-info.yaml file');
        }

        const entity = registrationResult.entities[0];
        const entityRef = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
        const entityUrl = `${catalogBaseUrl}/catalog/${entity.kind}/${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;

        ctx.logger.info(`Entity registered successfully: ${entityRef}`);

        // Wait for entity to be fully processed if requested
        if (waitForRegistration) {
          await waitForEntityProcessing(catalogApi, entityRef, maxWaitTime, ctx.logger);
        }

        // Verify registration was successful
        await verifyEntityRegistration(catalogApi, entityRef, ctx.logger);

        ctx.output('entityRef', entityRef);
        ctx.output('catalogInfoUrl', catalogInfoUrl);
        ctx.output('entityUrl', entityUrl);
        ctx.output('registrationTime', registrationTime);

        ctx.logger.info(`Automatic catalog registration completed successfully for: ${entityRef}`);

      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to register service in catalog: ${error.message}`);
        }
        throw error;
      }
    },
  });
}

/**
 * Validate catalog entity before registration
 */
async function validateCatalogEntity(catalogInfoUrl: string, logger: Logger): Promise<void> {
  logger.info(`Validating catalog entity at: ${catalogInfoUrl}`);

  try {
    // Fetch the catalog-info.yaml file
    const response = await fetch(catalogInfoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch catalog-info.yaml: ${response.status} ${response.statusText}`);
    }

    const catalogContent = await response.text();
    
    // Basic YAML validation
    const yaml = require('yaml');
    let parsedEntity: any;
    
    try {
      parsedEntity = yaml.parse(catalogContent);
    } catch (yamlError) {
      throw new Error(`Invalid YAML format: ${yamlError}`);
    }

    // Handle multiple documents in YAML
    const entities = Array.isArray(parsedEntity) ? parsedEntity : [parsedEntity];

    // Validate each entity
    for (const entity of entities) {
      validateEntityStructure(entity);
    }

    logger.info('Catalog entity validation passed');

  } catch (error) {
    logger.error(`Catalog entity validation failed: ${error}`);
    throw error;
  }
}

/**
 * Validate entity structure
 */
function validateEntityStructure(entity: any): void {
  // Check required fields
  if (!entity.apiVersion) {
    throw new Error('Missing required field: apiVersion');
  }

  if (!entity.kind) {
    throw new Error('Missing required field: kind');
  }

  if (!entity.metadata) {
    throw new Error('Missing required field: metadata');
  }

  if (!entity.metadata.name) {
    throw new Error('Missing required field: metadata.name');
  }

  if (!entity.spec) {
    throw new Error('Missing required field: spec');
  }

  // Validate apiVersion format
  if (!entity.apiVersion.includes('backstage.io')) {
    throw new Error(`Invalid apiVersion: ${entity.apiVersion}. Must be a Backstage API version`);
  }

  // Validate kind
  const validKinds = ['Component', 'API', 'Resource', 'System', 'Domain', 'Location', 'User', 'Group'];
  if (!validKinds.includes(entity.kind)) {
    throw new Error(`Invalid kind: ${entity.kind}. Must be one of: ${validKinds.join(', ')}`);
  }

  // Validate metadata.name format
  const namePattern = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
  if (!namePattern.test(entity.metadata.name)) {
    throw new Error(`Invalid metadata.name format: ${entity.metadata.name}. Must be lowercase alphanumeric with hyphens or underscores`);
  }

  // Component-specific validations
  if (entity.kind === 'Component') {
    if (!entity.spec.type) {
      throw new Error('Component entities must have spec.type');
    }

    if (!entity.spec.owner) {
      throw new Error('Component entities must have spec.owner');
    }

    if (!entity.spec.lifecycle) {
      entity.spec.lifecycle = 'experimental'; // Set default if missing
    }
  }

  // API-specific validations
  if (entity.kind === 'API') {
    if (!entity.spec.type) {
      throw new Error('API entities must have spec.type');
    }

    if (!entity.spec.owner) {
      throw new Error('API entities must have spec.owner');
    }
  }

  // Resource-specific validations
  if (entity.kind === 'Resource') {
    if (!entity.spec.type) {
      throw new Error('Resource entities must have spec.type');
    }

    if (!entity.spec.owner) {
      throw new Error('Resource entities must have spec.owner');
    }
  }
}

/**
 * Wait for entity to be fully processed by the catalog
 */
async function waitForEntityProcessing(
  catalogApi: CatalogApi,
  entityRef: string,
  maxWaitTime: number,
  logger: Logger
): Promise<void> {
  logger.info(`Waiting for entity to be processed: ${entityRef}`);

  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < maxWaitTime * 1000) {
    try {
      // Try to fetch the entity
      const entity = await catalogApi.getEntityByRef(entityRef);
      
      if (entity) {
        // Check if entity is fully processed (no processing errors)
        const hasProcessingErrors = entity.metadata.annotations?.['backstage.io/managed-by-location-processing-error'];
        
        if (!hasProcessingErrors) {
          logger.info(`Entity fully processed: ${entityRef}`);
          return;
        }
      }
    } catch (error) {
      // Entity not found yet, continue waiting
    }

    logger.info(`Entity still processing, waiting ${pollInterval / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  logger.warn(`Entity processing timeout after ${maxWaitTime}s, but registration may still succeed`);
}

/**
 * Verify entity registration was successful
 */
async function verifyEntityRegistration(
  catalogApi: CatalogApi,
  entityRef: string,
  logger: Logger
): Promise<void> {
  try {
    const entity = await catalogApi.getEntityByRef(entityRef);
    
    if (!entity) {
      throw new Error(`Entity not found after registration: ${entityRef}`);
    }

    // Check for processing errors
    const processingError = entity.metadata.annotations?.['backstage.io/managed-by-location-processing-error'];
    if (processingError) {
      logger.warn(`Entity registered with processing errors: ${processingError}`);
    }

    // Check entity status
    const entityStatus = entity.status;
    if (entityStatus?.items) {
      const errorItems = entityStatus.items.filter(item => item.level === 'error');
      if (errorItems.length > 0) {
        logger.warn(`Entity has status errors: ${errorItems.map(item => item.message).join(', ')}`);
      }
    }

    logger.info(`Entity registration verified: ${entityRef}`);

  } catch (error) {
    logger.error(`Failed to verify entity registration: ${error}`);
    throw error;
  }
}

/**
 * Automatic service registration workflow
 */
export class AutomaticServiceRegistration {
  constructor(
    private catalogApi: CatalogApi,
    private logger: Logger,
    private catalogBaseUrl: string
  ) {}

  /**
   * Register a service automatically after project creation
   */
  async registerService(config: {
    repoContentsUrl: string;
    catalogInfoPath?: string;
    projectName: string;
    templateType: string;
  }): Promise<{
    entityRef: string;
    catalogInfoUrl: string;
    entityUrl: string;
    registrationTime: string;
  }> {
    const { repoContentsUrl, catalogInfoPath = '/catalog-info.yaml', projectName, templateType } = config;
    
    this.logger.info(`Starting automatic service registration for project: ${projectName}`);

    try {
      // Validate the catalog entity
      const catalogInfoUrl = `${repoContentsUrl}${catalogInfoPath}`;
      await validateCatalogEntity(catalogInfoUrl, this.logger);

      // Register in catalog
      const registrationResult = await this.catalogApi.addLocation({
        type: 'url',
        target: catalogInfoUrl,
      });

      if (!registrationResult.entities || registrationResult.entities.length === 0) {
        throw new Error('No entities were registered');
      }

      const entity = registrationResult.entities[0];
      const entityRef = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
      const entityUrl = `${this.catalogBaseUrl}/catalog/${entity.kind}/${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
      const registrationTime = new Date().toISOString();

      // Wait for processing
      await waitForEntityProcessing(this.catalogApi, entityRef, 300, this.logger);

      // Verify registration
      await verifyEntityRegistration(this.catalogApi, entityRef, this.logger);

      this.logger.info(`Service registration completed successfully: ${entityRef}`);

      return {
        entityRef,
        catalogInfoUrl,
        entityUrl,
        registrationTime,
      };

    } catch (error) {
      this.logger.error(`Automatic service registration failed: ${error}`);
      throw error;
    }
  }

  /**
   * Check if a service is already registered
   */
  async isServiceRegistered(serviceName: string): Promise<boolean> {
    try {
      const entity = await this.catalogApi.getEntityByRef(`Component:default/${serviceName}`);
      return !!entity;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get registration status for a service
   */
  async getRegistrationStatus(entityRef: string): Promise<{
    registered: boolean;
    hasErrors: boolean;
    errors: string[];
    lastUpdated?: string;
  }> {
    try {
      const entity = await this.catalogApi.getEntityByRef(entityRef);
      
      if (!entity) {
        return {
          registered: false,
          hasErrors: false,
          errors: [],
        };
      }

      const processingError = entity.metadata.annotations?.['backstage.io/managed-by-location-processing-error'];
      const statusErrors = entity.status?.items?.filter(item => item.level === 'error') || [];
      
      const errors: string[] = [];
      if (processingError) {
        errors.push(processingError);
      }
      errors.push(...statusErrors.map(item => item.message));

      return {
        registered: true,
        hasErrors: errors.length > 0,
        errors,
        lastUpdated: entity.metadata.annotations?.['backstage.io/managed-by-location-last-updated'],
      };

    } catch (error) {
      return {
        registered: false,
        hasErrors: true,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }
}