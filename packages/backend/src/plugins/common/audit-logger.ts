/**
 * Audit Logger
 * 
 * Comprehensive audit logging for all sensitive operations.
 * Logs to multiple destinations (database, file, Sentry) with retention policies.
 */

import { Logger } from 'winston';
import { AuditLoggingConfig } from './security-config';
import * as Sentry from '@sentry/node';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  operation: string;
  actor: {
    userId?: string;
    username?: string;
    email?: string;
    ip?: string;
    userAgent?: string;
  };
  resource: {
    type: string;
    id?: string;
    name?: string;
  };
  action: 'create' | 'read' | 'update' | 'delete' | 'execute';
  status: 'success' | 'failure' | 'denied';
  details?: Record<string, any>;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
}

export interface AuditLogQuery {
  operation?: string;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class AuditLogger {
  private logs: AuditLogEntry[] = []; // In-memory buffer for testing

  constructor(
    private readonly config: AuditLoggingConfig,
    private readonly logger: Logger,
  ) {}

  /**
   * Log an audit event
   */
  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Check if operation should be audited
    if (!this.shouldAudit(entry.operation)) {
      return;
    }

    const auditEntry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      ...entry,
    };

    // Log to configured destinations
    const promises: Promise<void>[] = [];

    if (this.config.destinations.includes('database')) {
      promises.push(this.logToDatabase(auditEntry));
    }

    if (this.config.destinations.includes('file')) {
      promises.push(this.logToFile(auditEntry));
    }

    if (this.config.destinations.includes('sentry')) {
      promises.push(this.logToSentry(auditEntry));
    }

    try {
      await Promise.all(promises);
    } catch (error) {
      this.logger.error('Failed to write audit log', { error, entry: auditEntry });
    }
  }

  /**
   * Log authentication event
   */
  async logAuth(
    operation: 'login' | 'logout' | 'token.refresh',
    actor: AuditLogEntry['actor'],
    status: AuditLogEntry['status'],
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      operation: `auth.${operation}`,
      actor,
      resource: { type: 'auth' },
      action: 'execute',
      status,
      details,
    });
  }

  /**
   * Log catalog operation
   */
  async logCatalog(
    operation: 'entity.create' | 'entity.update' | 'entity.delete',
    actor: AuditLogEntry['actor'],
    resource: { id: string; name?: string },
    status: AuditLogEntry['status'],
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      operation: `catalog.${operation}`,
      actor,
      resource: { type: 'catalog-entity', ...resource },
      action: operation.split('.')[1] as AuditLogEntry['action'],
      status,
      details,
    });
  }

  /**
   * Log scaffolder operation
   */
  async logScaffolder(
    operation: 'task.create',
    actor: AuditLogEntry['actor'],
    resource: { id: string; name?: string },
    status: AuditLogEntry['status'],
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      operation: `scaffolder.${operation}`,
      actor,
      resource: { type: 'scaffolder-task', ...resource },
      action: 'create',
      status,
      details,
    });
  }

  /**
   * Log FinOps operation
   */
  async logFinOps(
    operation: 'budget.update' | 'cost-gate.override',
    actor: AuditLogEntry['actor'],
    resource: { id: string; name?: string },
    status: AuditLogEntry['status'],
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      operation: `finops.${operation}`,
      actor,
      resource: { type: 'finops', ...resource },
      action: operation.includes('update') ? 'update' : 'execute',
      status,
      details,
    });
  }

  /**
   * Log maturity gate operation
   */
  async logMaturity(
    operation: 'gate.override',
    actor: AuditLogEntry['actor'],
    resource: { id: string; name?: string },
    status: AuditLogEntry['status'],
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      operation: `maturity.${operation}`,
      actor,
      resource: { type: 'maturity-gate', ...resource },
      action: 'execute',
      status,
      details,
    });
  }

  /**
   * Log RBAC operation
   */
  async logRBAC(
    operation: 'permission.grant' | 'permission.revoke' | 'role.assign' | 'role.remove',
    actor: AuditLogEntry['actor'],
    resource: { id: string; name?: string },
    status: AuditLogEntry['status'],
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      operation: `rbac.${operation}`,
      actor,
      resource: { type: 'rbac', ...resource },
      action: operation.includes('grant') || operation.includes('assign') ? 'create' : 'delete',
      status,
      details,
    });
  }

  /**
   * Log API key operation
   */
  async logApiKey(
    operation: 'create' | 'rotate' | 'revoke',
    actor: AuditLogEntry['actor'],
    resource: { id: string; name?: string },
    status: AuditLogEntry['status'],
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      operation: `api-key.${operation}`,
      actor,
      resource: { type: 'api-key', ...resource },
      action: operation === 'revoke' ? 'delete' : operation === 'rotate' ? 'update' : 'create',
      status,
      details,
    });
  }

  /**
   * Query audit logs
   */
  async query(query: AuditLogQuery): Promise<AuditLogEntry[]> {
    // This is a simplified in-memory implementation
    // In production, this should query the database
    let results = [...this.logs];

    if (query.operation) {
      results = results.filter(log => log.operation === query.operation);
    }

    if (query.userId) {
      results = results.filter(log => log.actor.userId === query.userId);
    }

    if (query.resourceType) {
      results = results.filter(log => log.resource.type === query.resourceType);
    }

    if (query.resourceId) {
      results = results.filter(log => log.resource.id === query.resourceId);
    }

    if (query.action) {
      results = results.filter(log => log.action === query.action);
    }

    if (query.status) {
      results = results.filter(log => log.status === query.status);
    }

    if (query.startDate) {
      results = results.filter(log => log.timestamp >= query.startDate!);
    }

    if (query.endDate) {
      results = results.filter(log => log.timestamp <= query.endDate!);
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  async cleanup(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const beforeCount = this.logs.length;
    this.logs = this.logs.filter(log => log.timestamp >= cutoffDate);
    const deletedCount = beforeCount - this.logs.length;

    if (deletedCount > 0) {
      this.logger.info('Cleaned up old audit logs', {
        deletedCount,
        retentionDays: this.config.retentionDays,
      });
    }

    return deletedCount;
  }

  /**
   * Check if operation should be audited
   */
  private shouldAudit(operation: string): boolean {
    return this.config.sensitiveOperations.some(pattern => {
      if (pattern.endsWith('*')) {
        return operation.startsWith(pattern.slice(0, -1));
      }
      return operation === pattern;
    });
  }

  /**
   * Log to database
   */
  private async logToDatabase(entry: AuditLogEntry): Promise<void> {
    // In-memory storage for testing
    // In production, this should write to PostgreSQL
    this.logs.push(entry);
  }

  /**
   * Log to file
   */
  private async logToFile(entry: AuditLogEntry): Promise<void> {
    this.logger.log(this.config.logLevel, 'Audit log', {
      audit: true,
      ...entry,
    });
  }

  /**
   * Log to Sentry
   */
  private async logToSentry(entry: AuditLogEntry): Promise<void> {
    // Only log failures and denials to Sentry
    if (entry.status === 'failure' || entry.status === 'denied') {
      Sentry.captureMessage(`Audit: ${entry.operation}`, {
        level: entry.status === 'failure' ? 'error' : 'warning',
        tags: {
          operation: entry.operation,
          resourceType: entry.resource.type,
          action: entry.action,
          status: entry.status,
        },
        user: {
          id: entry.actor.userId,
          username: entry.actor.username,
          email: entry.actor.email,
          ip_address: entry.actor.ip,
        },
        extra: {
          resource: entry.resource,
          details: entry.details,
          error: entry.error,
        },
      });
    }
  }

  /**
   * Generate unique audit log ID
   */
  private generateId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create audit logger middleware for Express
 */
export function createAuditMiddleware(auditLogger: AuditLogger) {
  return async (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Capture response
    const originalSend = res.send;
    res.send = function (data: any) {
      res.send = originalSend;
      
      // Log after response is sent
      const duration = Date.now() - startTime;
      const status = res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'failure';

      // Extract operation from path
      const operation = extractOperation(req.path, req.method);
      
      if (operation) {
        auditLogger.log({
          operation,
          actor: {
            userId: req.user?.sub || req.user?.id,
            username: req.user?.name,
            email: req.user?.email,
            ip: req.ip,
            userAgent: req.get('user-agent'),
          },
          resource: {
            type: extractResourceType(req.path),
            id: extractResourceId(req.path),
          },
          action: mapMethodToAction(req.method),
          status,
          details: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
          },
        }).catch(error => {
          console.error('Failed to log audit event', error);
        });
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

function extractOperation(path: string, method: string): string | null {
  // Map paths to operations
  if (path.startsWith('/api/auth')) return 'auth.request';
  if (path.startsWith('/api/catalog/entities') && method === 'POST') return 'catalog.entity.create';
  if (path.startsWith('/api/catalog/entities') && method === 'DELETE') return 'catalog.entity.delete';
  if (path.startsWith('/api/scaffolder/v2/tasks') && method === 'POST') return 'scaffolder.task.create';
  if (path.startsWith('/api/finops/budget') && method === 'PUT') return 'finops.budget.update';
  if (path.startsWith('/api/finops/cost-gate/override')) return 'finops.cost-gate.override';
  if (path.startsWith('/api/maturity/gate/override')) return 'maturity.gate.override';
  
  return null;
}

function extractResourceType(path: string): string {
  if (path.startsWith('/api/catalog')) return 'catalog-entity';
  if (path.startsWith('/api/scaffolder')) return 'scaffolder-task';
  if (path.startsWith('/api/finops')) return 'finops';
  if (path.startsWith('/api/maturity')) return 'maturity';
  if (path.startsWith('/api/auth')) return 'auth';
  return 'unknown';
}

function extractResourceId(path: string): string | undefined {
  const parts = path.split('/');
  // Try to find UUID or entity ref in path
  for (const part of parts) {
    if (part.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return part;
    }
  }
  return undefined;
}

function mapMethodToAction(method: string): AuditLogEntry['action'] {
  switch (method.toUpperCase()) {
    case 'POST': return 'create';
    case 'GET': return 'read';
    case 'PUT':
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return 'execute';
  }
}
