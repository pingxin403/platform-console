/**
 * Audit Logger for RBAC Permission Checks
 * 
 * Records all permission checks, grants, and denials for security auditing
 * Stores audit logs in database with 90-day retention
 */

import { Logger } from 'winston';
import { Knex } from 'knex';

export interface AuditEvent {
  id?: string;
  timestamp: Date;
  userId: string;
  userRole: string;
  permission: string;
  resource?: string;
  resourceType?: string;
  action: string;
  decision: 'ALLOW' | 'DENY';
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export class AuditLogger {
  private logger: Logger;
  private database: Knex;
  private readonly TABLE_NAME = 'permission_audit_logs';
  private readonly RETENTION_DAYS = 90;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(database: Knex, logger: Logger) {
    this.database = database;
    this.logger = logger;
  }

  /**
   * Initialize the audit logger
   * Creates the audit log table if it doesn't exist
   */
  async initialize() {
    try {
      // Check if table exists
      const hasTable = await this.database.schema.hasTable(this.TABLE_NAME);
      
      if (!hasTable) {
        this.logger.info(`Creating audit log table: ${this.TABLE_NAME}`);
        
        await this.database.schema.createTable(this.TABLE_NAME, table => {
          table.uuid('id').primary().defaultTo(this.database.raw('gen_random_uuid()'));
          table.timestamp('timestamp').notNullable().defaultTo(this.database.fn.now());
          table.string('user_id').notNullable().index();
          table.string('user_role').notNullable();
          table.string('permission').notNullable().index();
          table.string('resource').nullable();
          table.string('resource_type').nullable().index();
          table.string('action').notNullable();
          table.enum('decision', ['ALLOW', 'DENY']).notNullable().index();
          table.text('reason').nullable();
          table.string('ip_address').nullable();
          table.text('user_agent').nullable();
          table.integer('duration').nullable(); // milliseconds
          table.jsonb('metadata').nullable();
          
          // Indexes for common queries
          table.index(['timestamp', 'decision']);
          table.index(['user_id', 'timestamp']);
          table.index(['permission', 'decision']);
        });
        
        this.logger.info('Audit log table created successfully');
      }

      // Start cleanup job
      this.startCleanupJob();
      
      this.logger.info('Audit logger initialized');
    } catch (error) {
      this.logger.error('Failed to initialize audit logger', error);
      throw error;
    }
  }

  /**
   * Log an audit event
   */
  async logEvent(event: AuditEvent): Promise<void> {
    try {
      await this.database(this.TABLE_NAME).insert({
        timestamp: event.timestamp,
        user_id: event.userId,
        user_role: event.userRole,
        permission: event.permission,
        resource: event.resource,
        resource_type: event.resourceType,
        action: event.action,
        decision: event.decision,
        reason: event.reason,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
        duration: event.duration,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      });

      // Also log to Winston for real-time monitoring
      const logLevel = event.decision === 'DENY' ? 'warn' : 'info';
      this.logger.log(logLevel, 'Permission audit event', {
        userId: event.userId,
        permission: event.permission,
        decision: event.decision,
        duration: event.duration,
      });
    } catch (error) {
      this.logger.error('Failed to log audit event', error);
      // Don't throw - we don't want audit logging failures to break permission checks
    }
  }

  /**
   * Query audit logs
   */
  async queryLogs(filters: {
    userId?: string;
    permission?: string;
    decision?: 'ALLOW' | 'DENY';
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]> {
    try {
      let query = this.database(this.TABLE_NAME).select('*');

      if (filters.userId) {
        query = query.where('user_id', filters.userId);
      }

      if (filters.permission) {
        query = query.where('permission', 'like', `%${filters.permission}%`);
      }

      if (filters.decision) {
        query = query.where('decision', filters.decision);
      }

      if (filters.startDate) {
        query = query.where('timestamp', '>=', filters.startDate);
      }

      if (filters.endDate) {
        query = query.where('timestamp', '<=', filters.endDate);
      }

      query = query.orderBy('timestamp', 'desc');

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.offset(filters.offset);
      }

      const rows = await query;

      return rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        userId: row.user_id,
        userRole: row.user_role,
        permission: row.permission,
        resource: row.resource,
        resourceType: row.resource_type,
        action: row.action,
        decision: row.decision,
        reason: row.reason,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        duration: row.duration,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } catch (error) {
      this.logger.error('Failed to query audit logs', error);
      throw error;
    }
  }

  /**
   * Get audit statistics
   */
  async getStatistics(timeRange: { start: Date; end: Date }): Promise<{
    totalEvents: number;
    allowedEvents: number;
    deniedEvents: number;
    topUsers: Array<{ userId: string; count: number }>;
    topPermissions: Array<{ permission: string; count: number }>;
    denialRate: number;
  }> {
    try {
      // Total events
      const totalResult = await this.database(this.TABLE_NAME)
        .count('* as count')
        .where('timestamp', '>=', timeRange.start)
        .where('timestamp', '<=', timeRange.end)
        .first();
      const totalEvents = parseInt(totalResult?.count as string || '0', 10);

      // Allowed events
      const allowedResult = await this.database(this.TABLE_NAME)
        .count('* as count')
        .where('timestamp', '>=', timeRange.start)
        .where('timestamp', '<=', timeRange.end)
        .where('decision', 'ALLOW')
        .first();
      const allowedEvents = parseInt(allowedResult?.count as string || '0', 10);

      // Denied events
      const deniedEvents = totalEvents - allowedEvents;

      // Top users
      const topUsersResult = await this.database(this.TABLE_NAME)
        .select('user_id')
        .count('* as count')
        .where('timestamp', '>=', timeRange.start)
        .where('timestamp', '<=', timeRange.end)
        .groupBy('user_id')
        .orderBy('count', 'desc')
        .limit(10);
      const topUsers = topUsersResult.map(row => ({
        userId: row.user_id,
        count: parseInt(row.count as string, 10),
      }));

      // Top permissions
      const topPermissionsResult = await this.database(this.TABLE_NAME)
        .select('permission')
        .count('* as count')
        .where('timestamp', '>=', timeRange.start)
        .where('timestamp', '<=', timeRange.end)
        .groupBy('permission')
        .orderBy('count', 'desc')
        .limit(10);
      const topPermissions = topPermissionsResult.map(row => ({
        permission: row.permission,
        count: parseInt(row.count as string, 10),
      }));

      // Denial rate
      const denialRate = totalEvents > 0 ? (deniedEvents / totalEvents) * 100 : 0;

      return {
        totalEvents,
        allowedEvents,
        deniedEvents,
        topUsers,
        topPermissions,
        denialRate,
      };
    } catch (error) {
      this.logger.error('Failed to get audit statistics', error);
      throw error;
    }
  }

  /**
   * Start cleanup job to remove old audit logs
   */
  private startCleanupJob() {
    // Run cleanup daily
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldLogs().catch(error => {
        this.logger.error('Error in audit log cleanup', error);
      });
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Run initial cleanup
    this.cleanupOldLogs().catch(error => {
      this.logger.error('Error in initial audit log cleanup', error);
    });

    this.logger.info(`Audit log cleanup job started (retention: ${this.RETENTION_DAYS} days)`);
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  private async cleanupOldLogs() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

      const deleted = await this.database(this.TABLE_NAME)
        .where('timestamp', '<', cutoffDate)
        .delete();

      if (deleted > 0) {
        this.logger.info(`Cleaned up ${deleted} old audit log entries`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old audit logs', error);
    }
  }

  /**
   * Stop the audit logger
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.info('Audit logger stopped');
    }
  }
}
