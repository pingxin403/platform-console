/**
 * Custom RBAC Policy Module for Internal Developer Platform
 * 
 * Implements fine-grained access control with:
 * - Role-based permissions
 * - Resource-level access control
 * - Permission synchronization (5 minutes)
 * - Audit logging
 */

import {
  BackstageIdentityResponse,
} from '@backstage/plugin-auth-node';
import {
  AuthorizeResult,
  PolicyDecision,
  isResourcePermission,
} from '@backstage/plugin-permission-common';
import {
  PermissionPolicy,
  PolicyQuery,
} from '@backstage/plugin-permission-node';
import { Config } from '@backstage/config';
import { Logger } from 'winston';

interface RolePermissions {
  permissions: string[];
  boundaries?: {
    namespaces?: string[];
    dataRetention?: string;
    requireApproval?: string[];
  };
}

interface RBACConfig {
  roles: Record<string, RolePermissions>;
  userRoles: {
    github: Record<string, string>;
    users?: Record<string, string>;
  };
  resources?: {
    catalog?: {
      sensitive?: string[];
      public?: string[];
    };
    kubernetes?: {
      production?: {
        namespaces: string[];
        requiredRole: string;
      };
      staging?: {
        namespaces: string[];
        requiredRole: string;
      };
      development?: {
        namespaces: string[];
        requiredRole: string;
      };
    };
  };
}

/**
 * Custom RBAC Policy implementation
 */
export class RBACPolicy implements PermissionPolicy {
  private config: RBACConfig;
  private logger: Logger;
  private roleCache: Map<string, { role: string; timestamp: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(config: Config, logger: Logger) {
    this.logger = logger;
    this.roleCache = new Map();
    
    // Load RBAC configuration
    this.config = this.loadConfig(config);
    
    // Start cache cleanup interval
    this.startCacheCleanup();
    
    this.logger.info('RBAC Policy initialized with custom rules');
  }

  private loadConfig(config: Config): RBACConfig {
    const permissionConfig = config.getOptionalConfig('permission');
    
    if (!permissionConfig) {
      this.logger.warn('No permission configuration found, using defaults');
      return this.getDefaultConfig();
    }

    return {
      roles: permissionConfig.getOptional('roles') || this.getDefaultConfig().roles,
      userRoles: permissionConfig.getOptional('userRoles') || this.getDefaultConfig().userRoles,
      resources: permissionConfig.getOptional('resources'),
    };
  }

  private getDefaultConfig(): RBACConfig {
    return {
      roles: {
        admin: {
          permissions: [
            'catalog:read',
            'catalog:write',
            'catalog:delete',
            'scaffolder:read',
            'scaffolder:write',
            'techdocs:read',
            'techdocs:write',
            'kubernetes:read',
            'kubernetes:write',
            'permission:read',
            'permission:write',
          ],
        },
        developer: {
          permissions: [
            'catalog:read',
            'catalog:write',
            'scaffolder:read',
            'scaffolder:write',
            'techdocs:read',
            'techdocs:write',
            'kubernetes:read',
          ],
        },
        viewer: {
          permissions: [
            'catalog:read',
            'techdocs:read',
            'kubernetes:read',
          ],
        },
        contractor: {
          permissions: [
            'catalog:read',
            'techdocs:read',
          ],
          boundaries: {
            namespaces: ['public', 'documentation'],
            dataRetention: '30d',
            requireApproval: ['scaffolder:write', 'kubernetes:write'],
          },
        },
        anonymous: {
          permissions: [], // Unauthenticated users have no permissions
        },
      },
      userRoles: {
        github: {
          'platform-team': 'admin',
          'engineering-leads': 'admin',
          'backend-team': 'developer',
          'frontend-team': 'developer',
          'mobile-team': 'developer',
          'contractors': 'contractor',
          'default': 'viewer',
        },
      },
    };
  }

  private startCacheCleanup() {
    // Clean up expired cache entries every minute
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.roleCache.entries()) {
        if (now - value.timestamp > this.CACHE_TTL) {
          this.roleCache.delete(key);
          this.logger.debug(`Removed expired role cache for ${key}`);
        }
      }
    }, 60 * 1000);
  }

  async handle(
    request: PolicyQuery,
    user?: BackstageIdentityResponse,
  ): Promise<PolicyDecision> {
    const startTime = Date.now();
    
    try {
      // Get user role with caching
      const userRole = await this.getUserRole(user);
      
      // Get permission string
      const permission = request.permission;
      const permissionName = `${permission.type}:${permission.attributes.action || 'read'}`;
      
      // Check if user has permission
      const hasPermission = this.checkPermission(userRole, permissionName, request);
      
      const decision = hasPermission ? AuthorizeResult.ALLOW : AuthorizeResult.DENY;
      
      // Log audit event
      this.logAuditEvent({
        user: user?.identity.userEntityRef || 'anonymous',
        permission: permissionName,
        resource: isResourcePermission(permission) ? permission.resourceType : undefined,
        decision,
        duration: Date.now() - startTime,
      });
      
      return { result: decision };
    } catch (error) {
      this.logger.error('Error in RBAC policy evaluation', error);
      // Fail closed - deny access on error
      return { result: AuthorizeResult.DENY };
    }
  }

  private async getUserRole(user?: BackstageIdentityResponse): Promise<string> {
    if (!user) {
      return 'anonymous'; // Unauthenticated users have no permissions
    }

    const userId = user.identity.userEntityRef;
    
    // Check cache first
    const cached = this.roleCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.role;
    }

    // Determine role from user's GitHub teams
    const role = this.determineRoleFromUser(user);
    
    // Cache the role
    this.roleCache.set(userId, {
      role,
      timestamp: Date.now(),
    });
    
    this.logger.debug(`Cached role ${role} for user ${userId}`);
    
    return role;
  }

  private determineRoleFromUser(user: BackstageIdentityResponse): string {
    // Extract GitHub teams from user identity
    const ownershipEntityRefs = user.identity.ownershipEntityRefs || [];
    
    // Check each team against role mappings
    for (const entityRef of ownershipEntityRefs) {
      // Extract team name from entity ref (format: group:default/team-name)
      const match = entityRef.match(/group:default\/(.+)/);
      if (match) {
        const teamName = match[1];
        const role = this.config.userRoles.github[teamName];
        if (role) {
          this.logger.debug(`User ${user.identity.userEntityRef} assigned role ${role} from team ${teamName}`);
          return role;
        }
      }
    }

    // Check individual user overrides
    const userEmail = user.identity.userEntityRef;
    if (this.config.userRoles.users) {
      const userRole = this.config.userRoles.users[userEmail];
      if (userRole) {
        this.logger.debug(`User ${userEmail} assigned role ${userRole} from user override`);
        return userRole;
      }
    }

    // Default role
    const defaultRole = this.config.userRoles.github['default'] || 'viewer';
    this.logger.debug(`User ${user.identity.userEntityRef} assigned default role ${defaultRole}`);
    return defaultRole;
  }

  private checkPermission(
    userRole: string,
    permissionName: string,
    request: PolicyQuery,
  ): boolean {
    const roleConfig = this.config.roles[userRole];
    
    if (!roleConfig) {
      this.logger.warn(`Unknown role: ${userRole}`);
      return false;
    }

    // Check if role has the permission
    const hasPermission = roleConfig.permissions.some(p => {
      // Support wildcard permissions
      if (p === '*') return true;
      if (p.endsWith(':*')) {
        const prefix = p.slice(0, -2);
        return permissionName.startsWith(prefix);
      }
      return p === permissionName;
    });

    if (!hasPermission) {
      return false;
    }

    // Check resource-specific restrictions
    if (isResourcePermission(request.permission)) {
      return this.checkResourcePermission(userRole, request);
    }

    return true;
  }

  private checkResourcePermission(
    userRole: string,
    request: PolicyQuery,
  ): boolean {
    const permission = request.permission;
    
    if (!isResourcePermission(permission)) {
      return true;
    }

    const resourceType = permission.resourceType;
    
    // Check Kubernetes namespace restrictions
    if (resourceType === 'kubernetes') {
      return this.checkKubernetesPermission(userRole, request);
    }

    // Check catalog entity restrictions
    if (resourceType === 'catalog-entity') {
      return this.checkCatalogPermission(userRole, request);
    }

    return true;
  }

  private checkKubernetesPermission(
    userRole: string,
    request: PolicyQuery,
  ): boolean {
    const k8sConfig = this.config.resources?.kubernetes;
    
    if (!k8sConfig) {
      return true; // No restrictions configured
    }

    // Extract namespace from request (if available)
    // This would need to be passed in the request context
    const namespace = (request as any).resourceRef?.namespace;
    
    if (!namespace) {
      return true; // No namespace specified
    }

    // Check production namespace restrictions
    if (k8sConfig.production) {
      const isProdNamespace = k8sConfig.production.namespaces.some(ns => 
        namespace === ns || namespace.startsWith(ns.replace('*', ''))
      );
      
      if (isProdNamespace) {
        return userRole === k8sConfig.production.requiredRole;
      }
    }

    // Check staging namespace restrictions
    if (k8sConfig.staging) {
      const isStagingNamespace = k8sConfig.staging.namespaces.some(ns => 
        namespace === ns || namespace.startsWith(ns.replace('*', ''))
      );
      
      if (isStagingNamespace) {
        const allowedRoles = [k8sConfig.staging.requiredRole, 'admin'];
        return allowedRoles.includes(userRole);
      }
    }

    return true;
  }

  private checkCatalogPermission(
    userRole: string,
    request: PolicyQuery,
  ): boolean {
    const catalogConfig = this.config.resources?.catalog;
    
    if (!catalogConfig) {
      return true; // No restrictions configured
    }

    // Extract entity ref from request
    const entityRef = (request as any).resourceRef;
    
    if (!entityRef) {
      return true; // No entity specified
    }

    // Check if entity is sensitive
    if (catalogConfig.sensitive) {
      const isSensitive = catalogConfig.sensitive.includes(entityRef);
      if (isSensitive && userRole === 'contractor') {
        return false; // Contractors can't access sensitive entities
      }
    }

    return true;
  }

  private logAuditEvent(event: {
    user: string;
    permission: string;
    resource?: string;
    decision: AuthorizeResult;
    duration: number;
  }) {
    this.logger.info('RBAC audit event', {
      timestamp: new Date().toISOString(),
      ...event,
    });
  }

  /**
   * Invalidate role cache for a specific user
   * Used when user roles are updated
   */
  public invalidateUserCache(userId: string) {
    this.roleCache.delete(userId);
    this.logger.info(`Invalidated role cache for user ${userId}`);
  }

  /**
   * Clear all role caches
   * Used when RBAC configuration is updated
   */
  public clearCache() {
    this.roleCache.clear();
    this.logger.info('Cleared all role caches');
  }
}
