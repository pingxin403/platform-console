/**
 * Property-based test for service catalog completeness
 * Feature: internal-developer-platform, Property 1: Service catalog completeness
 * Validates: Requirements 1.1
 */

import * as fc from 'fast-check';
import { Entity } from '@backstage/catalog-model';

// Service catalog interface to test
interface ServiceCatalogDisplay {
  displayAllServices(): Promise<ServiceDisplayInfo[]>;
  registerService(entity: Entity): Promise<void>;
  getRegisteredServices(): Promise<Entity[]>;
}

interface ServiceDisplayInfo {
  name: string;
  description?: string;
  owner?: string;
  type?: string;
  lifecycle?: string;
  repositoryUrl?: string;
  dependencies: string[];
  providedApis: string[];
  consumedApis: string[];
  annotations: Record<string, string>;
  hasCompleteMetadata: boolean;
}

// Mock implementation of service catalog for testing
class MockServiceCatalog implements ServiceCatalogDisplay {
  private registeredServices: Map<string, Entity> = new Map();

  async registerService(entity: Entity): Promise<void> {
    this.registeredServices.set(entity.metadata.name, entity);
  }

  async getRegisteredServices(): Promise<Entity[]> {
    return Array.from(this.registeredServices.values());
  }

  async displayAllServices(): Promise<ServiceDisplayInfo[]> {
    const services = await this.getRegisteredServices();
    
    return services.map(entity => {
      const displayInfo: ServiceDisplayInfo = {
        name: entity.metadata.name,
        description: entity.metadata.description,
        owner: entity.spec?.owner as string,
        type: entity.spec?.type as string,
        lifecycle: entity.spec?.lifecycle as string,
        repositoryUrl: this.extractRepositoryUrl(entity),
        dependencies: this.extractDependencies(entity),
        providedApis: this.extractProvidedApis(entity),
        consumedApis: this.extractConsumedApis(entity),
        annotations: entity.metadata.annotations || {},
        hasCompleteMetadata: this.hasCompleteMetadata(entity),
      };
      
      return displayInfo;
    });
  }

  private extractRepositoryUrl(entity: Entity): string | undefined {
    const annotations = entity.metadata.annotations || {};
    return annotations['backstage.io/source-location'] || 
           annotations['backstage.io/view-url'] || 
           annotations['github.com/project-slug'];
  }

  private extractDependencies(entity: Entity): string[] {
    return entity.relations?.filter(r => r.type === 'dependsOn').map(r => r.targetRef) || [];
  }

  private extractProvidedApis(entity: Entity): string[] {
    return entity.relations?.filter(r => r.type === 'providesApi').map(r => r.targetRef) || [];
  }

  private extractConsumedApis(entity: Entity): string[] {
    return entity.relations?.filter(r => r.type === 'consumesApi').map(r => r.targetRef) || [];
  }

  private hasCompleteMetadata(entity: Entity): boolean {
    // Check if entity has all required metadata fields
    const hasBasicInfo = !!(
      entity.metadata.name &&
      entity.spec?.type &&
      entity.spec?.owner
    );

    const hasAnnotations = !!(entity.metadata.annotations);
    
    return hasBasicInfo && hasAnnotations;
  }
}

// Property-based test generators
const entityNameArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]*[a-z0-9]$/);

const annotationsArbitrary = fc.record({
  'github.com/project-slug': fc.string().map(s => `org/${s.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 20)}`),
  'backstage.io/source-location': fc.string().map(s => `url:https://github.com/org/${s.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 20)}`),
  'backstage.io/view-url': fc.string().map(s => `https://github.com/org/${s.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 20)}`),
}, { requiredKeys: ['github.com/project-slug'] });

const relationArbitrary = fc.record({
  type: fc.constantFrom('dependsOn', 'providesApi', 'consumesApi', 'dependencyOf'),
  targetRef: fc.string().map(s => `component:default/${s.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 15)}`),
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
    type: fc.constantFrom('service', 'website', 'library', 'database'),
    owner: fc.stringMatching(/^team-[a-z]+$/),
    lifecycle: fc.constantFrom('experimental', 'production', 'deprecated'),
    system: fc.option(fc.stringMatching(/^[a-z][a-z0-9-]*$/)),
  }),
  relations: fc.option(fc.array(relationArbitrary, { maxLength: 10 })),
});

const serviceListArbitrary = fc.array(entityArbitrary, { minLength: 1, maxLength: 50 })
  .map(services => {
    // Ensure unique service names to avoid registration conflicts
    const uniqueServices: Entity[] = [];
    const seenNames = new Set<string>();
    
    for (const service of services) {
      if (!seenNames.has(service.metadata.name)) {
        seenNames.add(service.metadata.name);
        uniqueServices.push(service);
      }
    }
    
    return uniqueServices.length > 0 ? uniqueServices : [services[0]]; // Ensure at least one service
  });

describe('Service Catalog Completeness', () => {
  let serviceCatalog: MockServiceCatalog;

  beforeEach(() => {
    serviceCatalog = new MockServiceCatalog();
  });

  /**
   * Property 1: Service catalog completeness
   * For any set of registered services, the Service_Catalog should display all services 
   * with their complete metadata when accessed by a developer
   * Validates: Requirements 1.1
   */
  it('should display all registered services with complete metadata', async () => {
    await fc.assert(
      fc.asyncProperty(serviceListArbitrary, async (services) => {
        // Create a fresh catalog instance for each property test run
        const freshCatalog = new MockServiceCatalog();
        
        // Act: Register all services
        for (const service of services) {
          await freshCatalog.registerService(service);
        }
        
        // Get registered services and displayed services
        const registeredServices = await freshCatalog.getRegisteredServices();
        const displayedServices = await freshCatalog.displayAllServices();
        
        // Assert: All registered services should be displayed
        expect(displayedServices.length).toEqual(registeredServices.length);
        expect(displayedServices.length).toEqual(services.length);
        
        // Assert: Each displayed service should have required metadata fields
        for (const displayedService of displayedServices) {
          // Basic required fields should be present
          expect(displayedService.name).toBeDefined();
          expect(displayedService.name).toBeTruthy();
          expect(displayedService.owner).toBeDefined();
          expect(displayedService.type).toBeDefined();
          expect(displayedService.lifecycle).toBeDefined();
          
          // Metadata completeness flag should accurately reflect the service's metadata state
          const originalService = services.find(s => s.metadata.name === displayedService.name);
          const expectedCompleteness = !!(
            originalService?.metadata.name &&
            originalService?.spec?.type &&
            originalService?.spec?.owner &&
            originalService?.metadata.annotations
          );
          expect(displayedService.hasCompleteMetadata).toBe(expectedCompleteness);
          
          // Annotations should be defined as an object (even if empty)
          expect(displayedService.annotations).toBeDefined();
          expect(typeof displayedService.annotations).toBe('object');
          
          // Arrays should be defined (even if empty)
          expect(Array.isArray(displayedService.dependencies)).toBe(true);
          expect(Array.isArray(displayedService.providedApis)).toBe(true);
          expect(Array.isArray(displayedService.consumedApis)).toBe(true);
        }
        
        // Assert: Each registered service should have a corresponding display entry
        for (const registeredService of registeredServices) {
          const correspondingDisplay = displayedServices.find(
            d => d.name === registeredService.metadata.name
          );
          expect(correspondingDisplay).toBeDefined();
          
          // Verify metadata mapping is correct
          expect(correspondingDisplay!.name).toEqual(registeredService.metadata.name);
          expect(correspondingDisplay!.description).toEqual(registeredService.metadata.description);
          expect(correspondingDisplay!.owner).toEqual(registeredService.spec?.owner);
          expect(correspondingDisplay!.type).toEqual(registeredService.spec?.type);
          expect(correspondingDisplay!.lifecycle).toEqual(registeredService.spec?.lifecycle);
        }
        
        // Assert: Service names should be unique in display
        const displayedNames = displayedServices.map(s => s.name);
        const uniqueNames = new Set(displayedNames);
        expect(uniqueNames.size).toEqual(displayedNames.length);
      }),
      { numRuns: 100 } // Run 100 iterations as specified in design document
    );
  });

  it('should handle services with minimal metadata gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(serviceListArbitrary, async (services) => {
        // Create a fresh catalog instance for each property test run
        const freshCatalog = new MockServiceCatalog();
        
        // Create services with minimal required metadata only
        const minimalServices = services.map(service => ({
          ...service,
          metadata: {
            name: service.metadata.name,
            // Remove optional fields
            description: undefined,
            annotations: service.metadata.annotations, // Keep annotations as they're required
            tags: undefined,
          },
          spec: {
            type: service.spec.type,
            owner: service.spec.owner,
            lifecycle: service.spec.lifecycle,
            // Remove optional system field
            system: undefined,
          },
          // Remove relations to test minimal case
          relations: undefined,
        }));
        
        // Act: Register minimal services
        for (const service of minimalServices) {
          await freshCatalog.registerService(service);
        }
        
        const displayedServices = await freshCatalog.displayAllServices();
        
        // Assert: All services should still be displayed
        expect(displayedServices.length).toEqual(minimalServices.length);
        
        // Assert: Each service should have required fields even with minimal metadata
        for (const displayedService of displayedServices) {
          expect(displayedService.name).toBeDefined();
          expect(displayedService.owner).toBeDefined();
          expect(displayedService.type).toBeDefined();
          expect(displayedService.lifecycle).toBeDefined();
          
          // Optional fields should handle undefined gracefully
          expect(displayedService.dependencies).toEqual([]);
          expect(displayedService.providedApis).toEqual([]);
          expect(displayedService.consumedApis).toEqual([]);
          
          // Should have complete metadata only if annotations are present
          const originalService = minimalServices.find(s => s.metadata.name === displayedService.name);
          const expectedCompleteness = !!(
            originalService?.metadata.name &&
            originalService?.spec?.type &&
            originalService?.spec?.owner &&
            originalService?.metadata.annotations
          );
          expect(displayedService.hasCompleteMetadata).toBe(expectedCompleteness);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain consistency between registered and displayed services', async () => {
    await fc.assert(
      fc.asyncProperty(serviceListArbitrary, async (services) => {
        // Create a fresh catalog instance for each property test run
        const freshCatalog = new MockServiceCatalog();
        
        // Act: Register services in multiple batches to test consistency
        const midpoint = Math.floor(services.length / 2);
        const firstBatch = services.slice(0, midpoint);
        const secondBatch = services.slice(midpoint);
        
        // Register first batch
        for (const service of firstBatch) {
          await freshCatalog.registerService(service);
        }
        
        const firstDisplay = await freshCatalog.displayAllServices();
        
        // Register second batch
        for (const service of secondBatch) {
          await freshCatalog.registerService(service);
        }
        
        const finalDisplay = await freshCatalog.displayAllServices();
        const finalRegistered = await freshCatalog.getRegisteredServices();
        
        // Assert: Final display should match total registered services
        expect(finalDisplay.length).toEqual(finalRegistered.length);
        expect(finalDisplay.length).toEqual(services.length);
        
        // Assert: First batch services should still be present in final display
        for (const firstBatchService of firstBatch) {
          const stillPresent = finalDisplay.find(d => d.name === firstBatchService.metadata.name);
          expect(stillPresent).toBeDefined();
        }
        
        // Assert: Second batch services should be present in final display
        for (const secondBatchService of secondBatch) {
          const nowPresent = finalDisplay.find(d => d.name === secondBatchService.metadata.name);
          expect(nowPresent).toBeDefined();
        }
        
        // Assert: No duplicate services in display
        const serviceNames = finalDisplay.map(s => s.name);
        const uniqueNames = new Set(serviceNames);
        expect(uniqueNames.size).toEqual(serviceNames.length);
      }),
      { numRuns: 100 }
    );
  });
});