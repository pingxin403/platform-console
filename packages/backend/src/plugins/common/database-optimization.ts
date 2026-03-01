/**
 * Database Query Optimization Utilities
 * 
 * Provides query optimization helpers and index recommendations
 * for PostgreSQL database
 */

import { Logger } from 'winston';
import { Knex } from 'knex';

/**
 * Database indexes for performance optimization
 * 
 * These indexes should be created in the database to optimize query performance
 */
export const RECOMMENDED_INDEXES = {
  // Cost data indexes
  cost_data: [
    {
      name: 'idx_cost_data_service_id',
      table: 'cost_data',
      columns: ['service_id'],
      type: 'btree',
      description: 'Optimize cost queries by service ID',
    },
    {
      name: 'idx_cost_data_timestamp',
      table: 'cost_data',
      columns: ['timestamp'],
      type: 'btree',
      description: 'Optimize time-range cost queries',
    },
    {
      name: 'idx_cost_data_service_timestamp',
      table: 'cost_data',
      columns: ['service_id', 'timestamp'],
      type: 'btree',
      description: 'Composite index for service cost history queries',
    },
  ],

  // Anomaly data indexes
  anomalies: [
    {
      name: 'idx_anomalies_service_id',
      table: 'anomalies',
      columns: ['service_id'],
      type: 'btree',
      description: 'Optimize anomaly queries by service ID',
    },
    {
      name: 'idx_anomalies_detected_at',
      table: 'anomalies',
      columns: ['detected_at'],
      type: 'btree',
      description: 'Optimize time-based anomaly queries',
    },
    {
      name: 'idx_anomalies_severity',
      table: 'anomalies',
      columns: ['severity'],
      type: 'btree',
      description: 'Optimize queries filtering by severity',
    },
    {
      name: 'idx_anomalies_resolved',
      table: 'anomalies',
      columns: ['resolved_at'],
      type: 'btree',
      description: 'Optimize queries for unresolved anomalies',
    },
  ],

  // Scorecard data indexes
  scorecards: [
    {
      name: 'idx_scorecards_service_id',
      table: 'scorecards',
      columns: ['service_id'],
      type: 'btree',
      description: 'Optimize scorecard queries by service ID',
    },
    {
      name: 'idx_scorecards_calculated_at',
      table: 'scorecards',
      columns: ['calculated_at'],
      type: 'btree',
      description: 'Optimize time-based scorecard queries',
    },
    {
      name: 'idx_scorecards_overall_score',
      table: 'scorecards',
      columns: ['overall_score'],
      type: 'btree',
      description: 'Optimize queries sorting by score',
    },
  ],

  // DORA metrics indexes
  dora_metrics: [
    {
      name: 'idx_dora_metrics_entity_id',
      table: 'dora_metrics',
      columns: ['entity_id'],
      type: 'btree',
      description: 'Optimize DORA metrics queries by entity ID',
    },
    {
      name: 'idx_dora_metrics_entity_type',
      table: 'dora_metrics',
      columns: ['entity_type'],
      type: 'btree',
      description: 'Optimize queries by entity type (service/team)',
    },
    {
      name: 'idx_dora_metrics_period',
      table: 'dora_metrics',
      columns: ['period_start', 'period_end'],
      type: 'btree',
      description: 'Optimize time-range DORA metrics queries',
    },
  ],

  // Catalog entities indexes (Backstage catalog)
  catalog_entities: [
    {
      name: 'idx_catalog_entities_kind',
      table: 'catalog_entities',
      columns: ['kind'],
      type: 'btree',
      description: 'Optimize queries by entity kind',
    },
    {
      name: 'idx_catalog_entities_namespace',
      table: 'catalog_entities',
      columns: ['namespace'],
      type: 'btree',
      description: 'Optimize queries by namespace',
    },
    {
      name: 'idx_catalog_entities_updated_at',
      table: 'catalog_entities',
      columns: ['updated_at'],
      type: 'btree',
      description: 'Optimize queries for recently updated entities',
    },
  ],
};

/**
 * Query optimization helper
 */
export class QueryOptimizer {
  private db: Knex;
  private logger: Logger;

  constructor(db: Knex, logger: Logger) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * Create recommended indexes
   */
  async createRecommendedIndexes(): Promise<void> {
    this.logger.info('Creating recommended database indexes...');

    for (const [category, indexes] of Object.entries(RECOMMENDED_INDEXES)) {
      for (const index of indexes) {
        try {
          await this.createIndexIfNotExists(index);
          this.logger.info(`Created index: ${index.name}`, {
            table: index.table,
            columns: index.columns,
          });
        } catch (error) {
          this.logger.error(`Failed to create index: ${index.name}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    this.logger.info('Database index creation completed');
  }

  /**
   * Create index if it doesn't exist
   */
  private async createIndexIfNotExists(index: {
    name: string;
    table: string;
    columns: string[];
    type: string;
  }): Promise<void> {
    // Check if index exists
    const exists = await this.indexExists(index.name, index.table);
    
    if (exists) {
      this.logger.debug(`Index already exists: ${index.name}`);
      return;
    }

    // Create index
    const columnList = index.columns.join(', ');
    const sql = `CREATE INDEX IF NOT EXISTS ${index.name} ON ${index.table} USING ${index.type} (${columnList})`;
    
    await this.db.raw(sql);
  }

  /**
   * Check if index exists
   */
  private async indexExists(indexName: string, tableName: string): Promise<boolean> {
    const result = await this.db.raw(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE indexname = ?
        AND tablename = ?
      ) as exists
    `, [indexName, tableName]);

    return result.rows[0]?.exists || false;
  }

  /**
   * Analyze query performance
   */
  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    try {
      const explainResult = await this.db.raw(`EXPLAIN ANALYZE ${query}`);
      const plan = explainResult.rows;

      return {
        query,
        plan,
        executionTime: this.extractExecutionTime(plan),
        recommendations: this.generateRecommendations(plan),
      };
    } catch (error) {
      this.logger.error('Query analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Extract execution time from EXPLAIN ANALYZE output
   */
  private extractExecutionTime(plan: any[]): number {
    const lastRow = plan[plan.length - 1];
    const match = lastRow?.['QUERY PLAN']?.match(/Execution Time: ([\d.]+) ms/);
    return match ? parseFloat(match[1]) : 0;
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(plan: any[]): string[] {
    const recommendations: string[] = [];
    const planText = JSON.stringify(plan);

    // Check for sequential scans
    if (planText.includes('Seq Scan')) {
      recommendations.push('Consider adding an index to avoid sequential scans');
    }

    // Check for high execution time
    const executionTime = this.extractExecutionTime(plan);
    if (executionTime > 1000) {
      recommendations.push('Query execution time is high (>1s), consider optimization');
    }

    // Check for nested loops
    if (planText.includes('Nested Loop')) {
      recommendations.push('Nested loop detected, consider using JOIN with indexes');
    }

    return recommendations;
  }

  /**
   * Get slow queries from PostgreSQL logs
   */
  async getSlowQueries(minDuration: number = 1000): Promise<SlowQuery[]> {
    try {
      // This requires pg_stat_statements extension
      const result = await this.db.raw(`
        SELECT
          query,
          calls,
          total_exec_time,
          mean_exec_time,
          max_exec_time
        FROM pg_stat_statements
        WHERE mean_exec_time > ?
        ORDER BY mean_exec_time DESC
        LIMIT 20
      `, [minDuration]);

      return result.rows.map((row: any) => ({
        query: row.query,
        calls: row.calls,
        totalTime: row.total_exec_time,
        meanTime: row.mean_exec_time,
        maxTime: row.max_exec_time,
      }));
    } catch (error) {
      this.logger.warn('pg_stat_statements extension not available', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Optimize table (VACUUM ANALYZE)
   */
  async optimizeTable(tableName: string): Promise<void> {
    try {
      await this.db.raw(`VACUUM ANALYZE ${tableName}`);
      this.logger.info(`Table optimized: ${tableName}`);
    } catch (error) {
      this.logger.error(`Failed to optimize table: ${tableName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get table statistics
   */
  async getTableStats(tableName: string): Promise<TableStats> {
    try {
      const result = await this.db.raw(`
        SELECT
          schemaname,
          tablename,
          n_live_tup as row_count,
          n_dead_tup as dead_rows,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        WHERE tablename = ?
      `, [tableName]);

      return result.rows[0] || null;
    } catch (error) {
      this.logger.error(`Failed to get table stats: ${tableName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

/**
 * Query analysis result
 */
export interface QueryAnalysis {
  query: string;
  plan: any[];
  executionTime: number;
  recommendations: string[];
}

/**
 * Slow query information
 */
export interface SlowQuery {
  query: string;
  calls: number;
  totalTime: number;
  meanTime: number;
  maxTime: number;
}

/**
 * Table statistics
 */
export interface TableStats {
  schemaname: string;
  tablename: string;
  row_count: number;
  dead_rows: number;
  last_vacuum: Date | null;
  last_autovacuum: Date | null;
  last_analyze: Date | null;
  last_autoanalyze: Date | null;
}

/**
 * Optimized query builder helpers
 */
export class OptimizedQueryBuilder {
  /**
   * Build optimized cost history query
   */
  static buildCostHistoryQuery(
    db: Knex,
    serviceId: string,
    startDate: Date,
    endDate: Date,
  ): Knex.QueryBuilder {
    return db('cost_data')
      .select('*')
      .where('service_id', serviceId)
      .whereBetween('timestamp', [startDate, endDate])
      .orderBy('timestamp', 'desc')
      .limit(1000); // Prevent unbounded queries
  }

  /**
   * Build optimized anomaly query
   */
  static buildAnomalyQuery(
    db: Knex,
    serviceId: string,
    unresolvedOnly: boolean = false,
  ): Knex.QueryBuilder {
    const query = db('anomalies')
      .select('*')
      .where('service_id', serviceId)
      .orderBy('detected_at', 'desc');

    if (unresolvedOnly) {
      query.whereNull('resolved_at');
    }

    return query.limit(100); // Prevent unbounded queries
  }

  /**
   * Build optimized scorecard query
   */
  static buildScorecardQuery(
    db: Knex,
    serviceId: string,
  ): Knex.QueryBuilder {
    return db('scorecards')
      .select('*')
      .where('service_id', serviceId)
      .orderBy('calculated_at', 'desc')
      .limit(1); // Get latest scorecard only
  }

  /**
   * Build optimized DORA metrics query
   */
  static buildDORAMetricsQuery(
    db: Knex,
    entityId: string,
    entityType: 'service' | 'team',
    startDate: Date,
    endDate: Date,
  ): Knex.QueryBuilder {
    return db('dora_metrics')
      .select('*')
      .where('entity_id', entityId)
      .where('entity_type', entityType)
      .where('period_start', '>=', startDate)
      .where('period_end', '<=', endDate)
      .orderBy('period_start', 'desc')
      .limit(100); // Prevent unbounded queries
  }
}
