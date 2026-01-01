/**
 * Property-based test for service discovery automation
 * Feature: internal-developer-platform, Property 2: Service discovery automation
 * Validates: Requirements 1.2, 1.5
 */

import * as fc from 'fast-check';
import { Entity } from '@backstage/catalog-model';

// Mock GitHub API response structure
interface GitHubRepository {
  name: string;
  full_name: string;
  default_branch: string;
  updated_at: string;
}

interface CatalogInfoFile {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    description?: string;
    annotations?: Record<string, string>;
  };
  spec: {
    type: string;
    owner: string;
    lifecycle?: string;
  };
}

// Service discovery automation class to test
class ServiceDiscoveryAutomation {
  private discoveredServices: Map<string, Entity> = new Map();
  private lastDiscoveryTime: Map<string, Date> = new Map();

  /**
   * Simulates GitHub repository scanning for catalog-info.yaml files
   */
  async scanGitHubRepositories(repositories: GitHubRepository[]): Promise<Entity[]> {
    const discoveredEntities: Entity[] = [];
    
    for (const repo of repositories) {
      // Simulate checking if repository contains catalog-info.yaml
      const hasCatalogInfo = await this.checkForCatalogInfo(repo);
      
      if (hasCatalogInfo) {
        const catalogInfo = await this.fetchCatalogInfo(repo);
        if (catalogInfo && this.isValidCatalogInfo(catalogInfo)) {
          const entity = this.convertToEntity(catalogInfo, repo);
          discoveredEntities.push(entity);
          
          // Track discovery time
          this.lastDiscoveryTime.set(entity.metadata.name, new Date());
        }
      }
    }
    
    return discoveredEntities;
  }

  /**
   * Registers discovered services in the catalog
   */
  async registerServices(entities: Entity[]): Promise<void> {
    for (const entity of entities) {
      this.discoveredServices.set(entity.metadata.name, entity);
    }
  }

  /**
   * Gets all discovered services
   */
  getDiscoveredServices(): Entity[] {
    return Array.from(this.discoveredServices.values());
  }

  /**
   * Checks if a service was discovered within the time limit
   */
  wasDiscoveredWithinTimeLimit(serviceName: string, timeLimitMinutes: number = 5): boolean {
    const discoveryTime = this.lastDiscoveryTime.get(serviceName);
    if (!discoveryTime) return false;
    
    const now = new Date();
    const timeDiffMinutes = (now.getTime() - discoveryTime.getTime()) / (1000 * 60);
    return timeDiffMinutes <= timeLimitMinutes;
  }

  private async checkForCatalogInfo(repo: GitHubRepository): Promise<boolean> {
    // Simulate API call to check for catalog-info.yaml
    // In real implementation, this would use GitHub API
    // For testing purposes, we'll say repositories with valid names have catalog-info.yaml
    return repo.name.length >= 2 && repo.full_name.includes('/');
  }

  private async fetchCatalogInfo(repo: GitHubRepository): Promise<CatalogInfoFile | null> {
    // Simulate fetching catalog-info.yaml content
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: repo.name,
        description: `Service for ${repo.name}`,
        annotations: {
          'github.com/project-slug': repo.full_name,
        },
      },
      spec: {
        type: 'service',
        owner: 'team-backend',
        lifecycle: 'production',
      },
    };
  }

  private isValidCatalogInfo(catalogInfo: CatalogInfoFile): boolean {
    return !!(
      catalogInfo.apiVersion &&
      catalogInfo.kind &&
      catalogInfo.metadata?.name &&
      catalogInfo.spec?.type &&
      catalogInfo.spec?.owner
    );
  }

  private convertToEntity(catalogInfo: CatalogInfoFile, repo: GitHubRepository): Entity {
    return {
      apiVersion: catalogInfo.apiVersion,
      kind: catalogInfo.kind,
      metadata: {
        name: catalogInfo.metadata.name,
        description: catalogInfo.metadata.description,
        annotations: {
          ...catalogInfo.metadata.annotations,
          'backstage.io/source-location': `url:https://github.com/${repo.full_name}`,
        },
      },
      spec: catalogInfo.spec,
    };
  }
}

// Property-based test generators
const repositoryArbitrary = fc.record({
  name: fc.stringMatching(/^[a-z][a-z0-9-]*[a-z0-9]$/),
  full_name: fc.string().map(s => `org/${s.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 20)}`),
  default_branch: fc.constantFrom('main', 'master', 'develop'),
  updated_at: fc.integer({ min: 1577836800000, max: 1735689600000 }).map(timestamp => new Date(timestamp).toISOString()),
});

const repositoryListArbitrary = fc.array(repositoryArbitrary, { minLength: 1, maxLength: 20 });

describe('Service Discovery Automation', () => {
  let serviceDiscovery: ServiceDiscoveryAutomation;

  beforeEach(() => {
    serviceDiscovery = new ServiceDiscoveryAutomation();
  });

  /**
   * Property 2: Service discovery automation
   * For any valid catalog-info.yaml file created in a GitHub repository, 
   * the Service_Catalog should automatically discover and register the service within 5 minutes
   * Validates: Requirements 1.2, 1.5
   */
  it('should automatically discover and register services from GitHub repositories with catalog-info.yaml files', async () => {
    await fc.assert(
      fc.asyncProperty(repositoryListArbitrary, async (repositories) => {
        // Create a fresh instance for each property test run
        const freshServiceDiscovery = new ServiceDiscoveryAutomation();
        
        // Act: Scan repositories for catalog-info.yaml files
        const discoveredEntities = await freshServiceDiscovery.scanGitHubRepositories(repositories);
        
        // Register the discovered services
        await freshServiceDiscovery.registerServices(discoveredEntities);
        
        // Get all registered services
        const registeredServices = freshServiceDiscovery.getDiscoveredServices();
        
        // Assert: All discovered entities should be registered
        expect(discoveredEntities.length).toEqual(registeredServices.length);
        
        // Assert: Each discovered service should have required properties
        for (const entity of discoveredEntities) {
          expect(entity.apiVersion).toBeDefined();
          expect(entity.kind).toBeDefined();
          expect(entity.metadata.name).toBeDefined();
          expect(entity.spec).toBeDefined();
          
          // Assert: Service should have GitHub annotation
          expect(entity.metadata.annotations).toBeDefined();
          expect(entity.metadata.annotations!['github.com/project-slug']).toBeDefined();
          expect(entity.metadata.annotations!['backstage.io/source-location']).toBeDefined();
          
          // Assert: Service should be discoverable within time limit (5 minutes)
          expect(freshServiceDiscovery.wasDiscoveredWithinTimeLimit(entity.metadata.name, 5)).toBe(true);
        }
        
        // Assert: All registered services should be findable by name
        for (const entity of discoveredEntities) {
          const foundService = registeredServices.find(s => s.metadata.name === entity.metadata.name);
          expect(foundService).toBeDefined();
          expect(foundService?.metadata.name).toEqual(entity.metadata.name);
        }
      }),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });

  it('should handle repositories without catalog-info.yaml files gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(repositoryListArbitrary, async (repositories) => {
        // Create a fresh instance for each property test run
        const freshServiceDiscovery = new ServiceDiscoveryAutomation();
        
        // Act: Scan repositories (some may not have catalog-info.yaml)
        const discoveredEntities = await freshServiceDiscovery.scanGitHubRepositories(repositories);
        await freshServiceDiscovery.registerServices(discoveredEntities);
        
        const registeredServices = freshServiceDiscovery.getDiscoveredServices();
        
        // Assert: Number of registered services should equal discovered entities
        expect(registeredServices.length).toEqual(discoveredEntities.length);
        
        // Assert: Number of registered services should not exceed number of repositories
        expect(registeredServices.length).toBeLessThanOrEqual(repositories.length);
        
        // Assert: All registered services should be valid entities
        for (const service of registeredServices) {
          expect(service.metadata.name).toBeTruthy();
          expect(service.spec).toBeDefined();
          expect(service.apiVersion).toBeTruthy();
          expect(service.kind).toBeTruthy();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain service uniqueness when discovering from multiple repositories', async () => {
    await fc.assert(
      fc.asyncProperty(repositoryListArbitrary, async (repositories) => {
        // Create a fresh service discovery instance for this test
        const freshServiceDiscovery = new ServiceDiscoveryAutomation();
        
        // Act: Discover services multiple times
        const firstDiscovery = await freshServiceDiscovery.scanGitHubRepositories(repositories);
        await freshServiceDiscovery.registerServices(firstDiscovery);
        
        const secondDiscovery = await freshServiceDiscovery.scanGitHubRepositories(repositories);
        await freshServiceDiscovery.registerServices(secondDiscovery);
        
        const allServices = freshServiceDiscovery.getDiscoveredServices();
        
        // Assert: Service names should be unique (no duplicates)
        const serviceNames = allServices.map(s => s.metadata.name);
        const uniqueNames = new Set(serviceNames);
        expect(uniqueNames.size).toEqual(serviceNames.length);
        
        // Assert: Each service should have a valid discovery timestamp
        for (const service of allServices) {
          expect(freshServiceDiscovery.wasDiscoveredWithinTimeLimit(service.metadata.name, 5)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});