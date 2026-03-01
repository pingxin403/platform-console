/**
 * Unit tests for RBAC Policy Module
 */

import { ConfigReader } from '@backstage/config';
import { getVoidLogger } from '@backstage/backend-common';
import { RBACPolicy } from './rbac-policy-module';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { BackstageIdentityResponse } from '@backstage/plugin-auth-node';

describe('RBACPolicy', () => {
  let policy: RBACPolicy;
  let config: ConfigReader;
  const logger = getVoidLogger();

  beforeEach(() => {
    config = new ConfigReader({
      permission: {
        enabled: true,
        roles: {
          admin: {
            permissions: ['*'],
          },
          developer: {
            permissions: ['catalog:read', 'catalog:write', 'scaffolder:read'],
          },
          viewer: {
            permissions: ['catalog:read'],
          },
          contractor: {
            permissions: ['catalog:read'],
            boundaries: {
              namespaces: ['public'],
            },
          },
        },
        userRoles: {
          github: {
            'platform-team': 'admin',
            'backend-team': 'developer',
            'default': 'viewer',
          },
        },
      },
    });

    policy = new RBACPolicy(config, logger);
  });

  describe('Permission Checking', () => {
    it('should allow admin to access all resources', async () => {
      const user: BackstageIdentityResponse = {
        identity: {
          userEntityRef: 'user:default/admin',
          ownershipEntityRefs: ['group:default/platform-team'],
        },
        token: 'test-token',
      };

      const request = {
        permission: {
          type: 'catalog',
          name: 'catalog.entity.read',
          attributes: { action: 'read' },
        },
      };

      const result = await policy.handle(request as any, user);
      expect(result.result).toBe(AuthorizeResult.ALLOW);
    });

    it('should allow developer to read catalog', async () => {
      const user: BackstageIdentityResponse = {
        identity: {
          userEntityRef: 'user:default/developer',
          ownershipEntityRefs: ['group:default/backend-team'],
        },
        token: 'test-token',
      };

      const request = {
        permission: {
          type: 'catalog',
          name: 'catalog.entity.read',
          attributes: { action: 'read' },
        },
      };

      const result = await policy.handle(request as any, user);
      expect(result.result).toBe(AuthorizeResult.ALLOW);
    });

    it('should deny developer from deleting catalog entities', async () => {
      const user: BackstageIdentityResponse = {
        identity: {
          userEntityRef: 'user:default/developer',
          ownershipEntityRefs: ['group:default/backend-team'],
        },
        token: 'test-token',
      };

      const request = {
        permission: {
          type: 'catalog',
          name: 'catalog.entity.delete',
          attributes: { action: 'delete' },
        },
      };

      const result = await policy.handle(request as any, user);
      expect(result.result).toBe(AuthorizeResult.DENY);
    });

    it('should deny viewer from writing to catalog', async () => {
      const user: BackstageIdentityResponse = {
        identity: {
          userEntityRef: 'user:default/viewer',
          ownershipEntityRefs: [],
        },
        token: 'test-token',
      };

      const request = {
        permission: {
          type: 'catalog',
          name: 'catalog.entity.write',
          attributes: { action: 'write' },
        },
      };

      const result = await policy.handle(request as any, user);
      expect(result.result).toBe(AuthorizeResult.DENY);
    });

    it('should deny unauthenticated users', async () => {
      const request = {
        permission: {
          type: 'catalog',
          name: 'catalog.entity.read',
          attributes: { action: 'read' },
        },
      };

      const result = await policy.handle(request as any, undefined);
      expect(result.result).toBe(AuthorizeResult.DENY);
    });
  });

  describe('Role Caching', () => {
    it('should cache user roles', async () => {
      const user: BackstageIdentityResponse = {
        identity: {
          userEntityRef: 'user:default/test',
          ownershipEntityRefs: ['group:default/backend-team'],
        },
        token: 'test-token',
      };

      const request = {
        permission: {
          type: 'catalog',
          name: 'catalog.entity.read',
          attributes: { action: 'read' },
        },
      };

      // First call - should cache
      await policy.handle(request as any, user);

      // Second call - should use cache
      const result = await policy.handle(request as any, user);
      expect(result.result).toBe(AuthorizeResult.ALLOW);
    });

    it('should invalidate user cache', async () => {
      const userId = 'user:default/test';
      
      // Invalidate cache
      policy.invalidateUserCache(userId);
      
      // Should not throw error
      expect(() => policy.invalidateUserCache(userId)).not.toThrow();
    });

    it('should clear all caches', () => {
      // Clear all caches
      policy.clearCache();
      
      // Should not throw error
      expect(() => policy.clearCache()).not.toThrow();
    });
  });

  describe('Wildcard Permissions', () => {
    it('should support wildcard permissions', async () => {
      const user: BackstageIdentityResponse = {
        identity: {
          userEntityRef: 'user:default/admin',
          ownershipEntityRefs: ['group:default/platform-team'],
        },
        token: 'test-token',
      };

      const request = {
        permission: {
          type: 'kubernetes',
          name: 'kubernetes.cluster.read',
          attributes: { action: 'read' },
        },
      };

      const result = await policy.handle(request as any, user);
      expect(result.result).toBe(AuthorizeResult.ALLOW);
    });

    it('should support resource-level wildcards', async () => {
      const customConfig = new ConfigReader({
        permission: {
          roles: {
            developer: {
              permissions: ['catalog:*'],
            },
          },
          userRoles: {
            github: {
              'backend-team': 'developer',
            },
          },
        },
      });

      const customPolicy = new RBACPolicy(customConfig, logger);

      const user: BackstageIdentityResponse = {
        identity: {
          userEntityRef: 'user:default/developer',
          ownershipEntityRefs: ['group:default/backend-team'],
        },
        token: 'test-token',
      };

      const request = {
        permission: {
          type: 'catalog',
          name: 'catalog.entity.delete',
          attributes: { action: 'delete' },
        },
      };

      const result = await customPolicy.handle(request as any, user);
      expect(result.result).toBe(AuthorizeResult.ALLOW);
    });
  });

  describe('Error Handling', () => {
    it('should fail closed on errors', async () => {
      const invalidUser = {
        identity: null,
      } as any;

      const request = {
        permission: {
          type: 'catalog',
          name: 'catalog.entity.read',
          attributes: { action: 'read' },
        },
      };

      const result = await policy.handle(request as any, invalidUser);
      expect(result.result).toBe(AuthorizeResult.DENY);
    });

    it('should handle unknown roles gracefully', async () => {
      const user: BackstageIdentityResponse = {
        identity: {
          userEntityRef: 'user:default/unknown',
          ownershipEntityRefs: ['group:default/unknown-team'],
        },
        token: 'test-token',
      };

      const request = {
        permission: {
          type: 'catalog',
          name: 'catalog.entity.read',
          attributes: { action: 'read' },
        },
      };

      const result = await policy.handle(request as any, user);
      // Should use default role (viewer)
      expect(result.result).toBe(AuthorizeResult.ALLOW);
    });
  });

  describe('Default Configuration', () => {
    it('should use default config when none provided', () => {
      const emptyConfig = new ConfigReader({});
      const defaultPolicy = new RBACPolicy(emptyConfig, logger);
      
      expect(defaultPolicy).toBeDefined();
    });
  });
});
