/**
 * Permission Verification Middleware
 * 
 * Express middleware for verifying permissions on API endpoints
 * Integrates with RBAC policy and audit logging
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from 'winston';
import { AuditLogger } from './audit-logger';

export interface PermissionRequirement {
  permission: string;
  resource?: string;
  resourceType?: string;
}

export interface PermissionMiddlewareOptions {
  logger: Logger;
  auditLogger?: AuditLogger;
  onDenied?: (req: Request, res: Response, permission: PermissionRequirement) => void;
}

/**
 * Create permission verification middleware
 */
export function createPermissionMiddleware(
  requirement: PermissionRequirement,
  options: PermissionMiddlewareOptions,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      // Extract user from request (set by auth middleware)
      const user = (req as any).user;
      
      if (!user) {
        options.logger.warn('Permission check failed: No user in request');
        
        // Log audit event
        if (options.auditLogger) {
          await options.auditLogger.logEvent({
            timestamp: new Date(),
            userId: 'anonymous',
            userRole: 'none',
            permission: requirement.permission,
            resource: requirement.resource,
            resourceType: requirement.resourceType,
            action: 'access',
            decision: 'DENY',
            reason: 'No authenticated user',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            duration: Date.now() - startTime,
          });
        }
        
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // Check permission (this would integrate with the RBAC policy)
      const hasPermission = await checkUserPermission(user, requirement, options.logger);
      
      // Log audit event
      if (options.auditLogger) {
        await options.auditLogger.logEvent({
          timestamp: new Date(),
          userId: user.identity?.userEntityRef || 'unknown',
          userRole: user.role || 'unknown',
          permission: requirement.permission,
          resource: requirement.resource,
          resourceType: requirement.resourceType,
          action: 'access',
          decision: hasPermission ? 'ALLOW' : 'DENY',
          reason: hasPermission ? 'Permission granted' : 'Insufficient permissions',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          duration: Date.now() - startTime,
        });
      }

      if (!hasPermission) {
        options.logger.warn('Permission denied', {
          user: user.identity?.userEntityRef,
          permission: requirement.permission,
          resource: requirement.resource,
        });

        // Call custom denied handler if provided
        if (options.onDenied) {
          return options.onDenied(req, res, requirement);
        }

        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions',
          required: requirement.permission,
        });
      }

      // Permission granted, continue to next middleware
      next();
    } catch (error) {
      options.logger.error('Error in permission middleware', error);
      
      // Fail closed - deny access on error
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Permission check failed',
      });
    }
  };
}

/**
 * Check if user has required permission
 * This integrates with the RBAC policy
 */
async function checkUserPermission(
  user: any,
  requirement: PermissionRequirement,
  logger: Logger,
): Promise<boolean> {
  try {
    // Extract user role
    const userRole = user.role || 'viewer';
    
    // Parse permission string (format: "resource:action")
    const [resourceType, action] = requirement.permission.split(':');
    
    // Define role permissions (this should match the RBAC policy)
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'],
      'engineering-lead': [
        'catalog:*',
        'scaffolder:*',
        'techdocs:*',
        'kubernetes:*',
        'permission:read',
      ],
      developer: [
        'catalog:read',
        'catalog:write',
        'scaffolder:read',
        'scaffolder:write',
        'techdocs:read',
        'techdocs:write',
        'kubernetes:read',
      ],
      viewer: [
        'catalog:read',
        'techdocs:read',
        'kubernetes:read',
      ],
      contractor: [
        'catalog:read',
        'techdocs:read',
      ],
    };

    const permissions = rolePermissions[userRole] || [];
    
    // Check if user has permission
    const hasPermission = permissions.some(p => {
      if (p === '*') return true;
      if (p === requirement.permission) return true;
      if (p.endsWith(':*') && requirement.permission.startsWith(p.slice(0, -2))) return true;
      return false;
    });

    return hasPermission;
  } catch (error) {
    logger.error('Error checking user permission', error);
    return false; // Fail closed
  }
}

/**
 * Middleware to require specific role
 */
export function requireRole(
  requiredRole: string | string[],
  options: PermissionMiddlewareOptions,
) {
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userRole = user.role || 'viewer';
    
    if (!roles.includes(userRole)) {
      options.logger.warn('Role requirement not met', {
        user: user.identity?.userEntityRef,
        userRole,
        requiredRoles: roles,
      });

      // Log audit event
      if (options.auditLogger) {
        await options.auditLogger.logEvent({
          timestamp: new Date(),
          userId: user.identity?.userEntityRef || 'unknown',
          userRole,
          permission: `role:${roles.join('|')}`,
          action: 'access',
          decision: 'DENY',
          reason: `Required role: ${roles.join(' or ')}`,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient role',
        required: roles,
        current: userRole,
      });
    }

    next();
  };
}

/**
 * Middleware to check resource ownership
 */
export function requireOwnership(
  getResourceOwner: (req: Request) => Promise<string>,
  options: PermissionMiddlewareOptions,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    try {
      const resourceOwner = await getResourceOwner(req);
      const userId = user.identity?.userEntityRef;
      
      // Check if user is owner or admin
      const userRole = user.role || 'viewer';
      const isOwner = userId === resourceOwner;
      const isAdmin = userRole === 'admin' || userRole === 'engineering-lead';
      
      if (!isOwner && !isAdmin) {
        options.logger.warn('Ownership requirement not met', {
          user: userId,
          resourceOwner,
          userRole,
        });

        // Log audit event
        if (options.auditLogger) {
          await options.auditLogger.logEvent({
            timestamp: new Date(),
            userId: userId || 'unknown',
            userRole,
            permission: 'resource:ownership',
            resource: resourceOwner,
            action: 'access',
            decision: 'DENY',
            reason: 'Not resource owner',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          });
        }

        return res.status(403).json({
          error: 'Forbidden',
          message: 'Resource access denied',
          reason: 'Not resource owner',
        });
      }

      next();
    } catch (error) {
      options.logger.error('Error checking resource ownership', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Ownership check failed',
      });
    }
  };
}
