/**
 * Property-based tests for deployment status visibility
 * Feature: internal-developer-platform, Property 7: Deployment status visibility
 * Validates: Requirements 3.1, 3.2, 3.3
 */

import fc from 'fast-check';
import { ArgocdService } from './argocd/argocd-service';
import { Config } from '@backstage/config';
import { Logger } from 'winston';
import { Entity } from '@backstage/catalog-model';

// Mock logger for testing
const mockLogger: Logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as any;

// Mock config for testing
const mockConfig: Config = {
  getString: jest.fn().mockReturnValue('https://argocd.company.com'),
  getOptionalString: jest.fn().mockReturnValue('https://argocd.company.com'),
} as any;

describe('Deployment Status Visibility Property Tests', () => {
  let argocdService: ArgocdService;

  beforeEach(() => {
    argocdService = new ArgocdService(mockConfig, mockLogger);
  });

  /**
   * Property 7: Deployment status visibility
   * For any service with Argo CD integration, the Developer_Portal should display
   * current deployment status, real-time sync information during deployments,
   * and error messages with log links for failed deployments
   * Validates: Requirements 3.1, 3.2, 3.3
   */
  test('Property 7: Deployment status visibility', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary service entities with Argo CD annotations
        fc.record({
          apiVersion: fc.constant('backstage.io/v1alpha1'),
          metadata: fc.record(
            {
              name: fc
                .string({ minLength: 1, maxLength: 50 })
                .filter(s => /^[a-z0-9-]+$/.test(s)),
              annotations: fc.record(
                {
                  'argocd/app-name': fc
                    .string({ minLength: 1, maxLength: 50 })
                    .filter(s => /^[a-z0-9-]+$/.test(s)),
                },
                { requiredKeys: ['argocd/app-name'] },
              ),
            },
            { requiredKeys: ['name', 'annotations'] },
          ),
          kind: fc.constant('Component'),
          spec: fc.record({
            type: fc.constantFrom('service', 'website', 'library'),
            owner: fc.string({ minLength: 1, maxLength: 30 }),
          }),
        }),
        async (entity: Entity) => {
          // Act: Get deployment status for the service
          const deploymentStatus = await argocdService.getDeploymentStatus(
            entity,
          );

          // Assert: Deployment status should be available for services with Argo CD annotations
          if (entity.metadata.annotations?.['argocd/app-name']) {
            // Requirement 3.1: Current deployment status should be displayed
            expect(deploymentStatus).toBeDefined();
            expect(deploymentStatus).not.toBeNull();

            if (deploymentStatus) {
              // Status should have required fields
              expect(deploymentStatus.applicationName).toBeDefined();
              expect(deploymentStatus.health).toMatch(
                /^(Healthy|Progressing|Degraded|Suspended|Missing|Unknown)$/,
              );
              expect(deploymentStatus.sync).toMatch(
                /^(Synced|OutOfSync|Unknown)$/,
              );
              expect(deploymentStatus.environment).toBeDefined();
              expect(deploymentStatus.namespace).toBeDefined();
              expect(typeof deploymentStatus.canSync).toBe('boolean');

              // Requirement 3.2: Real-time sync information should be available
              if (deploymentStatus.lastSyncTime) {
                expect(new Date(deploymentStatus.lastSyncTime)).toBeInstanceOf(
                  Date,
                );
                expect(
                  new Date(deploymentStatus.lastSyncTime).getTime(),
                ).toBeLessThanOrEqual(Date.now());
              }

              // Requirement 3.3: Error messages with log links for failed deployments
              if (
                deploymentStatus.health === 'Degraded' ||
                deploymentStatus.sync === 'OutOfSync'
              ) {
                // Should have error information or log URL available
                const hasErrors =
                  deploymentStatus.errors && deploymentStatus.errors.length > 0;
                const hasLogUrl = Boolean(deploymentStatus.logUrl);
                const hasErrorInfo = hasErrors || hasLogUrl;
                expect(hasErrorInfo).toBe(true);

                // If errors exist, they should have proper structure
                if (
                  deploymentStatus.errors &&
                  deploymentStatus.errors.length > 0
                ) {
                  deploymentStatus.errors.forEach(error => {
                    expect(error.message).toBeDefined();
                    expect(error.type).toBeDefined();
                    expect(error.severity).toMatch(
                      /^(low|medium|high|critical)$/,
                    );
                    expect(typeof error.recoverable).toBe('boolean');
                    expect(Array.isArray(error.suggestedActions)).toBe(true);
                  });
                }

                // Log URL should be accessible
                if (deploymentStatus.logUrl) {
                  expect(deploymentStatus.logUrl).toMatch(/^https?:\/\/.+/);
                }
              }
            }
          } else {
            // Services without Argo CD annotations should return null
            expect(deploymentStatus).toBeNull();
          }
        },
      ),
      { numRuns: 30, timeout: 8000 },
    );
  }, 10000);

  /**
   * Additional property test for multi-environment deployment status consistency
   */
  test('Multi-environment status consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          apiVersion: fc.constant('backstage.io/v1alpha1'),
          metadata: fc.record(
            {
              name: fc
                .string({ minLength: 1, maxLength: 50 })
                .filter(s => /^[a-z0-9-]+$/.test(s)),
              annotations: fc.record(
                {
                  'argocd/app-name': fc
                    .string({ minLength: 1, maxLength: 50 })
                    .filter(s => /^[a-z0-9-]+$/.test(s)),
                },
                { requiredKeys: ['argocd/app-name'] },
              ),
            },
            { requiredKeys: ['name', 'annotations'] },
          ),
          kind: fc.constant('Component'),
          spec: fc.record({
            type: fc.constant('service'),
            owner: fc.string({ minLength: 1, maxLength: 30 }),
          }),
        }),
        async (entity: Entity) => {
          // Act: Get multi-environment deployment status
          const multiStatus = await argocdService.getMultiEnvironmentStatus(
            entity,
          );

          if (multiStatus) {
            // Assert: Multi-environment status should be consistent
            expect(multiStatus.serviceName).toBe(entity.metadata.name);
            expect(multiStatus.overallHealth).toMatch(
              /^(Healthy|Degraded|Unknown)$/,
            );
            expect(typeof multiStatus.environments).toBe('object');

            // Each environment should have valid status
            Object.entries(multiStatus.environments).forEach(
              ([env, status]) => {
                expect(['development', 'staging', 'production']).toContain(env);
                expect(status.applicationName).toContain(
                  env === 'production' ? 'prod' : env,
                );
                expect(status.environment).toBe(env);
                expect(status.health).toMatch(
                  /^(Healthy|Progressing|Degraded|Suspended|Missing|Unknown)$/,
                );
                expect(status.sync).toMatch(/^(Synced|OutOfSync|Unknown)$/);
              },
            );

            // Overall health should reflect individual environment health
            const environmentHealths = Object.values(
              multiStatus.environments,
            ).map(s => s.health);
            if (environmentHealths.includes('Degraded')) {
              expect(multiStatus.overallHealth).toBe('Degraded');
            } else if (environmentHealths.includes('Unknown')) {
              expect(multiStatus.overallHealth).toBe('Unknown');
            } else {
              expect(multiStatus.overallHealth).toBe('Healthy');
            }
          }
        },
      ),
      { numRuns: 20, timeout: 6000 },
    );
  }, 8000);

  /**
   * Property test for deployment status caching behavior
   */
  test('Deployment status caching consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          apiVersion: fc.constant('backstage.io/v1alpha1'),
          metadata: fc.record(
            {
              name: fc
                .string({ minLength: 1, maxLength: 50 })
                .filter(s => /^[a-z0-9-]+$/.test(s)),
              annotations: fc.record(
                {
                  'argocd/app-name': fc
                    .string({ minLength: 1, maxLength: 50 })
                    .filter(s => /^[a-z0-9-]+$/.test(s)),
                },
                { requiredKeys: ['argocd/app-name'] },
              ),
            },
            { requiredKeys: ['name', 'annotations'] },
          ),
          kind: fc.constant('Component'),
        }),
        async (entity: Entity) => {
          // Act: Get deployment status twice in quick succession
          const status1 = await argocdService.getDeploymentStatus(entity);
          const status2 = await argocdService.getDeploymentStatus(entity);

          // Assert: Cached results should be consistent
          if (status1 && status2) {
            expect(status1.applicationName).toBe(status2.applicationName);
            expect(status1.health).toBe(status2.health);
            expect(status1.sync).toBe(status2.sync);
            expect(status1.environment).toBe(status2.environment);
            expect(status1.namespace).toBe(status2.namespace);

            // Cache should provide same timestamp within cache TTL
            expect(status1.lastSyncTime).toBe(status2.lastSyncTime);
          }
        },
      ),
      { numRuns: 30, timeout: 8000 },
    );
  }, 10000);
});
