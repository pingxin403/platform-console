/**
 * Property-based test for service information display
 * Feature: internal-developer-platform, Property 3: Service information display
 * Validates: Requirements 1.3, 1.4
 */

import * as fc from 'fast-check';
import { Entity } from '@backstage/catalog-model';

// Service information display interface to test
interface ServiceInformationDisplay {
  displayServiceInfo(entity: Entity): Promise<ServiceDisplayInfo>;
  getOwnerInfo(entity: Entity): OwnerInfo;
  getRepositoryLinks(entity: Entity): RepositoryLinks;
  getDeploymentStatus(entity: Entity): Promise<DeploymentStatus>;
  getDependencyGraph(entity: Entity): DependencyGraph;
}

interface ServiceDisplayInfo {
  name: string;
  description?: string;
  type: string;
  lifecycle: string;
  system?: string;
  owner: OwnerInfo;
  repository: RepositoryLinks;
  deploymentStatus: DeploymentStatus;
  dependencies: DependencyGraph;
  hasRequiredInfo: boolean;
}

interface OwnerInfo {
  owner: string;
  ownerType?: string;
  ownerLink?: string;
  isDisplayed: boolean;
}

interface RepositoryLinks {
  repositoryUrl?: string;
  sourceLocation?: string;
  viewUrl?: string;
  editUrl?: string;
  hasRepositoryLink: boolean;
}

interface DeploymentStatus {
  status: 'unknown' | 'healthy' | 'degraded' | 'error';
  environment?: string;
  lastDeployed?: Date;
  isDisplayed: boolean;
}

interface DependencyGraph {
  dependencies: string[];
  dependents: string[];
  providedApis: string[];
  consumedApis: string[];
  hasVisualGraph: boolean;
  isDisplayed: boolean;
}

// Mock implementation of service information display
class MockServiceInformationDisplay implements ServiceInformationDisplay {
  private deploymentStatuses: Map<string, DeploymentStatus> = new Map();

  async displayServiceInfo(entity: Entity): Promise<ServiceDisplayInfo> {
    const owner = this.getOwnerInfo(entity);
    const repository = this.getRepositoryLinks(entity);
    const deploymentStatus = await this.getDeploymentStatus(entity);
    const dependencies = this.getDependencyGraph(entity);

    return {
      name: entity.metadata.name,
      description: entity.metadata.description,
      type: entity.spec?.type as string,
      lifecycle: entity.spec?.lifecycle as string,
      system: entity.spec?.system as string,
      owner,
      repository,
      deploymentStatus,
      dependencies,
      hasRequiredInfo: this.hasRequiredInformation(entity, owner, repository, deploymentStatus, dependencies),
    };
  }

  getOwnerInfo(entity: Entity): OwnerInfo {
    const owner = entity.spec?.owner as string;
    const ownerRelation = entity.relations?.find(r => r.type === 'ownedBy');
    
    return {
      owner: owner || 'Not specified',
      ownerType: ownerRelation?.targetRef.split(':')[0],
      ownerLink: ownerRelation ? `/catalog/${ownerRelation.targetRef.replace(':', '/')}` : undefined,
      isDisplayed: !!owner,
    };
  }

  getRepositoryLinks(entity: Entity): RepositoryLinks {
    const annotations = entity.metadata.annotations || {};
    const sourceLocation = annotations['backstage.io/source-location'];
    const viewUrl = annotations['backstage.io/view-url'];
    const editUrl = annotations['backstage.io/edit-url'];
    const githubSlug = annotations['github.com/project-slug'];

    let repositoryUrl: string | undefined;
    
    if (viewUrl) {
      repositoryUrl = viewUrl;
    } else if (editUrl) {
      repositoryUrl = editUrl.replace('/edit/', '/');
    } else if (sourceLocation) {
      repositoryUrl = sourceLocation.replace('url:', '');
    } else if (githubSlug) {
      repositoryUrl = `https://github.com/${githubSlug}`;
    }

    return {
      repositoryUrl,
      sourceLocation,
      viewUrl,
      editUrl,
      hasRepositoryLink: !!repositoryUrl,
    };
  }

  async getDeploymentStatus(entity: Entity): Promise<DeploymentStatus> {
    // Check if entity has deployment annotations
    const annotations = entity.metadata.annotations || {};
    const argocdApp = annotations['argocd/app-name'];
    
    if (argocdApp) {
      // Simulate fetching deployment status from Argo CD
      const cachedStatus = this.deploymentStatuses.get(entity.metadata.name);
      if (cachedStatus) {
        return cachedStatus;
      }

      // Simulate deployment status based on lifecycle
      const lifecycle = entity.spec?.lifecycle as string;
      let status: DeploymentStatus['status'] = 'unknown';
      
      if (lifecycle === 'production') {
        status = 'healthy';
      } else if (lifecycle === 'experimental') {
        status = 'degraded';
      }

      const deploymentStatus: DeploymentStatus = {
        status,
        environment: lifecycle,
        lastDeployed: new Date(),
        isDisplayed: true,
      };

      this.deploymentStatuses.set(entity.metadata.name, deploymentStatus);
      return deploymentStatus;
    }

    return {
      status: 'unknown',
      isDisplayed: false,
    };
  }

  getDependencyGraph(entity: Entity): DependencyGraph {
    const relations = entity.relations || [];
    
    const dependencies = relations
      .filter(r => r.type === 'dependsOn')
      .map(r => r.targetRef);
    
    const dependents = relations
      .filter(r => r.type === 'dependencyOf')
      .map(r => r.targetRef);
    
    const providedApis = relations
      .filter(r => r.type === 'providesApi')
      .map(r => r.targetRef);
    
    const consumedApis = relations
      .filter(r => r.type === 'consumesApi')
      .map(r => r.targetRef);

    const hasAnyRelations = dependencies.length > 0 || dependents.length > 0 || 
                           providedApis.length > 0 || consumedApis.length > 0;

    return {
      dependencies,
      dependents,
      providedApis,
      consumedApis,
      hasVisualGraph: hasAnyRelations,
      isDisplayed: hasAnyRelations,
    };
  }

  private hasRequiredInformation(
    entity: Entity,
    owner: OwnerInfo,
    repository: RepositoryLinks,
    deploymentStatus: DeploymentStatus,
    dependencies: DependencyGraph
  ): boolean {
    // Required information includes: name, type, owner, and at least one of repository/deployment/dependencies
    return !!(
      entity.metadata.name &&
      entity.spec?.type &&
      owner.isDisplayed &&
      (repository.hasRepositoryLink || deploymentStatus.isDisplayed || dependencies.isDisplayed)
    );
  }
}

// Property-based test generators
const entityNameArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]*[a-z0-9]$/);

const ownerArbitrary = fc.stringMatching(/^team-[a-z]+$/);

const annotationsArbitrary = fc.record({
  'github.com/project-slug': fc.string().map(s => `org/${s.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 20)}`),
  'backstage.io/source-location': fc.string().map(s => `url:https://github.com/org/${s.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 20)}`),
  'backstage.io/view-url': fc.string().map(s => `https://github.com/org/${s.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 20)}`),
  'backstage.io/edit-url': fc.string().map(s => `https://github.com/org/${s.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 20)}/edit/main/catalog-info.yaml`),
  'argocd/app-name': fc.string().map(s => `${s.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 15)}-prod`),
}, { requiredKeys: [] });

const relationArbitrary = fc.record({
  type: fc.constantFrom('dependsOn', 'dependencyOf', 'providesApi', 'consumesApi', 'ownedBy'),
  targetRef: fc.string().map(s => {
    const cleanName = s.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 15);
    return `component:default/${cleanName}`;
  }),
});

const entityArbitrary = fc.record({
  apiVersion: fc.constant('backstage.io/v1alpha1'),
  kind: fc.constantFrom('Component', 'API', 'Resource'),
  metadata: fc.record({
    name: entityNameArbitrary,
    description: fc.option(fc.string({ minLength: 10, maxLength: 100 })),
    annotations: fc.option(annotationsArbitrary),
    tags: fc.option(fc.array(fc.stringMatching(/^[a-z][a-z0-9-]*$/), { maxLength: 5 })),
  }),
  spec: fc.record({
    type: fc.constantFrom('service', 'website', 'library', 'database', 'api'),
    owner: ownerArbitrary,
    lifecycle: fc.constantFrom('experimental', 'production', 'deprecated'),
    system: fc.option(fc.stringMatching(/^[a-z][a-z0-9-]*$/)),
  }),
  relations: fc.option(fc.array(relationArbitrary, { maxLength: 10 })),
});

const serviceEntityListArbitrary = fc.array(entityArbitrary, { minLength: 1, maxLength: 20 })
  .map(entities => {
    // Ensure unique entity names
    const uniqueEntities: Entity[] = [];
    const seenNames = new Set<string>();
    
    for (const entity of entities) {
      if (!seenNames.has(entity.metadata.name)) {
        seenNames.add(entity.metadata.name);
        uniqueEntities.push(entity);
      }
    }
    
    return uniqueEntities.length > 0 ? uniqueEntities : [entities[0]];
  });

describe('Service Information Display', () => {
  let serviceDisplay: MockServiceInformationDisplay;

  beforeEach(() => {
    serviceDisplay = new MockServiceInformationDisplay();
  });

  /**
   * Property 3: Service information display
   * For any service in the catalog, viewing the service should display owner information, 
   * repository links, deployment status, and dependency graph (if dependencies exist)
   * Validates: Requirements 1.3, 1.4
   */
  it('should display complete service information including owner, repository, deployment status, and dependencies', async () => {
    await fc.assert(
      fc.asyncProperty(serviceEntityListArbitrary, async (entities) => {
        // Create a fresh display instance for each property test run
        const freshDisplay = new MockServiceInformationDisplay();
        
        for (const entity of entities) {
          // Act: Display service information
          const serviceInfo = await freshDisplay.displayServiceInfo(entity);
          
          // Assert: Basic service information should be displayed
          expect(serviceInfo.name).toBeDefined();
          expect(serviceInfo.name).toBeTruthy();
          expect(serviceInfo.type).toBeDefined();
          expect(serviceInfo.type).toBeTruthy();
          
          // Assert: Owner information should be displayed (Requirements 1.3)
          expect(serviceInfo.owner).toBeDefined();
          expect(serviceInfo.owner.owner).toBeDefined();
          if (entity.spec?.owner) {
            expect(serviceInfo.owner.isDisplayed).toBe(true);
            expect(serviceInfo.owner.owner).toEqual(entity.spec.owner);
            
            // If there's an owner relation, should have owner link
            const ownerRelation = entity.relations?.find(r => r.type === 'ownedBy');
            if (ownerRelation) {
              expect(serviceInfo.owner.ownerLink).toBeDefined();
              expect(serviceInfo.owner.ownerType).toBeDefined();
            }
          }
          
          // Assert: Repository links should be displayed when available (Requirements 1.3)
          expect(serviceInfo.repository).toBeDefined();
          const annotations = entity.metadata.annotations || {};
          const hasRepositoryAnnotations = !!(
            annotations['backstage.io/view-url'] ||
            annotations['backstage.io/edit-url'] ||
            annotations['backstage.io/source-location'] ||
            annotations['github.com/project-slug']
          );
          
          if (hasRepositoryAnnotations) {
            expect(serviceInfo.repository.hasRepositoryLink).toBe(true);
            expect(serviceInfo.repository.repositoryUrl).toBeDefined();
            expect(serviceInfo.repository.repositoryUrl).toBeTruthy();
          }
          
          // Assert: Deployment status should be displayed when deployment annotations exist (Requirements 1.3)
          expect(serviceInfo.deploymentStatus).toBeDefined();
          const hasDeploymentAnnotations = !!(annotations['argocd/app-name']);
          
          if (hasDeploymentAnnotations) {
            expect(serviceInfo.deploymentStatus.isDisplayed).toBe(true);
            expect(serviceInfo.deploymentStatus.status).toBeDefined();
            expect(['unknown', 'healthy', 'degraded', 'error']).toContain(serviceInfo.deploymentStatus.status);
          }
          
          // Assert: Dependency graph should be displayed when dependencies exist (Requirements 1.4)
          expect(serviceInfo.dependencies).toBeDefined();
          const relations = entity.relations || [];
          const hasRelations = relations.some(r => 
            ['dependsOn', 'dependencyOf', 'providesApi', 'consumesApi'].includes(r.type)
          );
          
          if (hasRelations) {
            expect(serviceInfo.dependencies.isDisplayed).toBe(true);
            expect(serviceInfo.dependencies.hasVisualGraph).toBe(true);
            
            // Check that relations are properly categorized
            const dependsOnRelations = relations.filter(r => r.type === 'dependsOn');
            const dependencyOfRelations = relations.filter(r => r.type === 'dependencyOf');
            const providesApiRelations = relations.filter(r => r.type === 'providesApi');
            const consumesApiRelations = relations.filter(r => r.type === 'consumesApi');
            
            expect(serviceInfo.dependencies.dependencies.length).toEqual(dependsOnRelations.length);
            expect(serviceInfo.dependencies.dependents.length).toEqual(dependencyOfRelations.length);
            expect(serviceInfo.dependencies.providedApis.length).toEqual(providesApiRelations.length);
            expect(serviceInfo.dependencies.consumedApis.length).toEqual(consumesApiRelations.length);
          } else {
            // If no relations, dependency graph should still be defined but empty
            expect(serviceInfo.dependencies.dependencies).toEqual([]);
            expect(serviceInfo.dependencies.dependents).toEqual([]);
            expect(serviceInfo.dependencies.providedApis).toEqual([]);
            expect(serviceInfo.dependencies.consumedApis).toEqual([]);
          }
          
          // Assert: Service should have required information for proper display
          const hasOwner = !!entity.spec?.owner;
          const hasRepository = hasRepositoryAnnotations;
          const hasDeployment = hasDeploymentAnnotations;
          const hasDependencies = hasRelations;
          
          if (hasOwner && (hasRepository || hasDeployment || hasDependencies)) {
            expect(serviceInfo.hasRequiredInfo).toBe(true);
          }
        }
      }),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });

  it('should handle services with minimal information gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(serviceEntityListArbitrary, async (entities) => {
        // Create a fresh display instance for each property test run
        const freshDisplay = new MockServiceInformationDisplay();
        
        // Create entities with minimal information
        const minimalEntities = entities.map(entity => ({
          ...entity,
          metadata: {
            name: entity.metadata.name,
            // Remove optional fields
            description: undefined,
            annotations: undefined,
            tags: undefined,
          },
          spec: {
            type: entity.spec.type,
            owner: entity.spec.owner,
            lifecycle: entity.spec.lifecycle,
            // Remove optional system field
            system: undefined,
          },
          // Remove relations
          relations: undefined,
        }));
        
        for (const entity of minimalEntities) {
          // Act: Display service information for minimal entity
          const serviceInfo = await freshDisplay.displayServiceInfo(entity);
          
          // Assert: Basic information should still be displayed
          expect(serviceInfo.name).toEqual(entity.metadata.name);
          expect(serviceInfo.type).toEqual(entity.spec.type);
          expect(serviceInfo.lifecycle).toEqual(entity.spec.lifecycle);
          
          // Assert: Owner information should be displayed even with minimal data
          expect(serviceInfo.owner.isDisplayed).toBe(true);
          expect(serviceInfo.owner.owner).toEqual(entity.spec.owner);
          
          // Assert: Repository should handle absence of annotations gracefully
          expect(serviceInfo.repository.hasRepositoryLink).toBe(false);
          expect(serviceInfo.repository.repositoryUrl).toBeUndefined();
          
          // Assert: Deployment status should handle absence of deployment annotations
          expect(serviceInfo.deploymentStatus.isDisplayed).toBe(false);
          expect(serviceInfo.deploymentStatus.status).toEqual('unknown');
          
          // Assert: Dependencies should handle absence of relations gracefully
          expect(serviceInfo.dependencies.isDisplayed).toBe(false);
          expect(serviceInfo.dependencies.hasVisualGraph).toBe(false);
          expect(serviceInfo.dependencies.dependencies).toEqual([]);
          expect(serviceInfo.dependencies.dependents).toEqual([]);
          expect(serviceInfo.dependencies.providedApis).toEqual([]);
          expect(serviceInfo.dependencies.consumedApis).toEqual([]);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should correctly extract and display repository information from various annotation formats', async () => {
    await fc.assert(
      fc.asyncProperty(serviceEntityListArbitrary, async (entities) => {
        // Create a fresh display instance for each property test run
        const freshDisplay = new MockServiceInformationDisplay();
        
        for (const entity of entities) {
          const repositoryInfo = freshDisplay.getRepositoryLinks(entity);
          const annotations = entity.metadata.annotations || {};
          
          // Assert: Repository URL extraction priority
          if (annotations['backstage.io/view-url']) {
            expect(repositoryInfo.repositoryUrl).toEqual(annotations['backstage.io/view-url']);
            expect(repositoryInfo.hasRepositoryLink).toBe(true);
          } else if (annotations['backstage.io/edit-url']) {
            expect(repositoryInfo.repositoryUrl).toEqual(annotations['backstage.io/edit-url'].replace('/edit/', '/'));
            expect(repositoryInfo.hasRepositoryLink).toBe(true);
          } else if (annotations['backstage.io/source-location']) {
            expect(repositoryInfo.repositoryUrl).toEqual(annotations['backstage.io/source-location'].replace('url:', ''));
            expect(repositoryInfo.hasRepositoryLink).toBe(true);
          } else if (annotations['github.com/project-slug']) {
            expect(repositoryInfo.repositoryUrl).toEqual(`https://github.com/${annotations['github.com/project-slug']}`);
            expect(repositoryInfo.hasRepositoryLink).toBe(true);
          } else {
            expect(repositoryInfo.hasRepositoryLink).toBe(false);
            expect(repositoryInfo.repositoryUrl).toBeUndefined();
          }
          
          // Assert: All annotation fields are preserved
          expect(repositoryInfo.sourceLocation).toEqual(annotations['backstage.io/source-location']);
          expect(repositoryInfo.viewUrl).toEqual(annotations['backstage.io/view-url']);
          expect(repositoryInfo.editUrl).toEqual(annotations['backstage.io/edit-url']);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should correctly categorize and display dependency relationships', async () => {
    await fc.assert(
      fc.asyncProperty(serviceEntityListArbitrary, async (entities) => {
        // Create a fresh display instance for each property test run
        const freshDisplay = new MockServiceInformationDisplay();
        
        for (const entity of entities) {
          const dependencyGraph = freshDisplay.getDependencyGraph(entity);
          const relations = entity.relations || [];
          
          // Assert: Dependencies are correctly categorized
          const expectedDependencies = relations.filter(r => r.type === 'dependsOn').map(r => r.targetRef);
          const expectedDependents = relations.filter(r => r.type === 'dependencyOf').map(r => r.targetRef);
          const expectedProvidedApis = relations.filter(r => r.type === 'providesApi').map(r => r.targetRef);
          const expectedConsumedApis = relations.filter(r => r.type === 'consumesApi').map(r => r.targetRef);
          
          expect(dependencyGraph.dependencies).toEqual(expectedDependencies);
          expect(dependencyGraph.dependents).toEqual(expectedDependents);
          expect(dependencyGraph.providedApis).toEqual(expectedProvidedApis);
          expect(dependencyGraph.consumedApis).toEqual(expectedConsumedApis);
          
          // Assert: Visual graph and display flags are set correctly
          const hasAnyRelations = expectedDependencies.length > 0 || 
                                 expectedDependents.length > 0 || 
                                 expectedProvidedApis.length > 0 || 
                                 expectedConsumedApis.length > 0;
          
          expect(dependencyGraph.hasVisualGraph).toEqual(hasAnyRelations);
          expect(dependencyGraph.isDisplayed).toEqual(hasAnyRelations);
        }
      }),
      { numRuns: 100 }
    );
  });
});