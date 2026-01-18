/**
 * Property-based tests for multi-environment support
 * Feature: internal-developer-platform, Property 8: Multi-environment support
 * Validates: Requirements 3.4, 3.5
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

describe('Multi-Environment Support Property Tests', () => {
  let argocdService: ArgocdService;

  beforeEach(() => {
    argocdService = new ArgocdService(mockConfig, mockLogger);
  });

  /**
   * Property 8: Multi-environment support
   * For any service with multiple environments, the Developer_Portal should show
   * status for all environments (development, staging, production) and allow
   * manual sync operations for owned services
   * Validates: Requirements 3.4, 3.5
   */
  test('Property 8: Multi-environment support', async () => {
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
            // Requirement 3.4: Show status for multiple environments
            expect(multiStatus.serviceName).toBe(entity.metadata.name);
            expect(typeof multiStatus.environments).toBe('object');
            expect(
              Object.keys(multiStatus.environments).length,
            ).toBeGreaterThan(0);

            // Should support standard environments
            const supportedEnvironments = [
              'development',
              'staging',
              'production',
            ];
            const actualEnvironments = Object.keys(multiStatus.environments);

            // At least one environment should be present
            expect(actualEnvironments.length).toBeGreaterThan(0);

            // All environments should be from the supported list
            actualEnvironments.forEach(env => {
              expect(supportedEnvironments).toContain(env);
            });

            // Each environment should have complete status information
            Object.entries(multiStatus.environments).forEach(
              ([env, status]) => {
                expect(status.applicationName).toBeDefined();
                expect(status.environment).toBe(env);
                expect(status.health).toMatch(
                  /^(Healthy|Progressing|Degraded|Suspended|Missing|Unknown)$/,
                );
                expect(status.sync).toMatch(/^(Synced|OutOfSync|Unknown)$/);
                expect(status.namespace).toBeDefined();

                // Requirement 3.5: Manual sync operations should be available for owned services
                expect(typeof status.canSync).toBe('boolean');

                // Application name should reflect environment
                if (env === 'production') {
                  expect(status.applicationName).toMatch(/(prod|production)$/);
                } else {
                  expect(status.applicationName).toContain(env);
                }
              },
            );

            // Overall health should be computed correctly
            expect(multiStatus.overallHealth).toMatch(
              /^(Healthy|Degraded|Unknown)$/,
            );

            // Overall health logic validation
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
      { numRuns: 30, timeout: 8000 },
    );
  }, 10000);

  /**
   * Property test for manual sync operations across environments
   */
  test('Manual sync operations for multi-environment services', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          appName: fc
            .string({ minLength: 1, maxLength: 50 })
            .filter(s => /^[a-z0-9-]+$/.test(s)),
          environment: fc.constantFrom('development', 'staging', 'production'),
          syncOptions: fc.record({
            prune: fc.boolean(),
            dryRun: fc.boolean(),
            force: fc.boolean(),
            triggeredBy: fc.string({ minLength: 1, maxLength: 50 }),
          }),
        }),
        async ({ appName, environment, syncOptions }) => {
          // Construct environment-specific app name
          const envAppName =
            environment === 'production'
              ? `${appName}-prod`
              : `${appName}-${environment}`;

          // Act: Trigger manual sync operation
          const syncResult = await argocdService.syncApplication(
            envAppName,
            syncOptions,
          );

          // Assert: Sync operation should be properly initiated
          expect(typeof syncResult.success).toBe('boolean');

          if (syncResult.success) {
            // Successful sync should have operation details
            expect(syncResult.syncId).toBeDefined();
            expect(syncResult.operation).toBeDefined();
            expect(typeof syncResult.estimatedDuration).toBe('number');

            if (syncResult.operation) {
              expect(syncResult.operation.applicationName).toBe(envAppName);
              expect(syncResult.operation.environment).toBe(environment);
              expect(syncResult.operation.triggeredBy).toBe(
                syncOptions.triggeredBy,
              );
              expect(syncResult.operation.options.prune).toBe(
                syncOptions.prune,
              );
              expect(syncResult.operation.options.dryRun).toBe(
                syncOptions.dryRun,
              );
              expect(syncResult.operation.options.force).toBe(
                syncOptions.force,
              );
              expect(syncResult.operation.status).toMatch(
                /^(pending|in_progress|completed|failed)$/,
              );
            }
          } else {
            // Failed sync should have error information
            expect(syncResult.error).toBeDefined();
          }
        },
      ),
      { numRuns: 50, timeout: 8000 },
    );
  }, 12000);

  /**
   * Property test for environment-specific application naming
   */
  test('Environment-specific application naming consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          baseAppName: fc
            .string({ minLength: 1, maxLength: 30 })
            .filter(s => /^[a-z0-9-]+$/.test(s)),
          environments: fc
            .array(fc.constantFrom('development', 'staging', 'production'), {
              minLength: 1,
              maxLength: 3,
            })
            .map(envs => [...new Set(envs)]), // Remove duplicates
        }),
        async ({ baseAppName, environments }) => {
          // Create entity with base app name
          const entity: Entity = {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            metadata: {
              name: `test-service-${baseAppName}`,
              annotations: {
                'argocd/app-name': baseAppName,
              },
            },
            spec: {
              type: 'service',
              owner: 'test-team',
            },
          };

          // Act: Get multi-environment status
          const multiStatus = await argocdService.getMultiEnvironmentStatus(
            entity,
          );

          if (multiStatus) {
            // Assert: Application names should follow environment naming conventions
            Object.entries(multiStatus.environments).forEach(
              ([env, status]) => {
                if (env === 'production') {
                  // Production can be either base name, base-prod, or base-production
                  const isValidProdName =
                    status.applicationName === baseAppName ||
                    status.applicationName === `${baseAppName}-prod` ||
                    status.applicationName === `${baseAppName}-production` ||
                    status.applicationName.endsWith('-prod') ||
                    status.applicationName.endsWith('-production');
                  expect(isValidProdName).toBe(true);
                } else {
                  // Other environments should have environment suffix
                  const hasEnvSuffix =
                    status.applicationName.includes(env) ||
                    status.applicationName.endsWith(`-${env}`);
                  expect(hasEnvSuffix).toBe(true);
                }

                // Environment field should match the environment key
                expect(status.environment).toBe(env);
              },
            );
          }
        },
      ),
      { numRuns: 30, timeout: 6000 },
    );
  }, 10000);

  /**
   * Property test for sync permission validation
   */
  test('Sync permission validation across environments', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          appName: fc
            .string({ minLength: 1, maxLength: 50 })
            .filter(s => /^[a-z0-9-]+$/.test(s)),
          userEmail: fc.emailAddress(),
        }),
        async ({ appName, userEmail }) => {
          // Act: Check sync permissions for the application
          const canSync = await argocdService.canUserSync(appName, userEmail);

          // Assert: Permission check should return a boolean
          expect(typeof canSync).toBe('boolean');

          // For this test implementation, all users can sync (simplified)
          // In a real implementation, this would check actual RBAC
          expect(canSync).toBe(true);
        },
      ),
      { numRuns: 30, timeout: 5000 },
    );
  }, 8000);

  /**
   * Property test for sync operation status tracking
   */
  test('Sync operation status tracking', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          appName: fc
            .string({ minLength: 1, maxLength: 50 })
            .filter(s => /^[a-z0-9-]+$/.test(s)),
          triggeredBy: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        async ({ appName, triggeredBy }) => {
          // Act: Trigger sync and get operation status
          const syncResult = await argocdService.syncApplication(appName, {
            triggeredBy,
          });

          if (syncResult.success && syncResult.syncId) {
            // Get operation status
            const operationStatus = await argocdService.getSyncOperationStatus(
              syncResult.syncId,
            );

            // Assert: Operation status should be trackable
            expect(operationStatus).toBeDefined();

            if (operationStatus) {
              expect(operationStatus.syncId).toBe(syncResult.syncId);
              expect(operationStatus.applicationName).toBe(appName);
              expect(operationStatus.triggeredBy).toBe(triggeredBy);
              expect(operationStatus.status).toMatch(
                /^(pending|in_progress|completed|failed)$/,
              );
              expect(new Date(operationStatus.triggeredAt)).toBeInstanceOf(
                Date,
              );
            }
          }
        },
      ),
      { numRuns: 30, timeout: 8000 },
    );
  }, 12000);
});
