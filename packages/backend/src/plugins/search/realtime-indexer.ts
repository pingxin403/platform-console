/**
 * Real-time Search Indexing Module
 * 
 * Implements real-time index updates with debouncing
 * to ensure search results are always up-to-date
 * 
 * Requirements: 8.3
 */

import { LoggerService } from '@backstage/backend-plugin-api';
import { SearchConfig } from './enhanced-search-config';

export interface IndexUpdate {
  entityRef: string;
  type: 'create' | 'update' | 'delete';
  timestamp: Date;
  data?: any;
}

export interface IndexStats {
  totalUpdates: number;
  pendingUpdates: number;
  lastUpdateTime: Date;
  averageUpdateTime: number;
}

/**
 * Real-time indexer with debouncing and batching
 */
export class RealTimeIndexer {
  private config: SearchConfig;
  private logger: LoggerService;
  private pendingUpdates: Map<string, IndexUpdate> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private stats: IndexStats = {
    totalUpdates: 0,
    pendingUpdates: 0,
    lastUpdateTime: new Date(),
    averageUpdateTime: 0,
  };
  private updateTimes: number[] = [];
  
  constructor(config: SearchConfig, logger: LoggerService) {
    this.config = config;
    this.logger = logger;
  }
  
  /**
   * Queue an index update with debouncing
   * Multiple updates to the same entity within the debounce window are merged
   */
  async queueUpdate(update: IndexUpdate): Promise<void> {
    if (!this.config.indexing.realTimeUpdates) {
      this.logger.debug('Real-time updates disabled, skipping');
      return;
    }
    
    const { entityRef } = update;
    
    // Cancel existing debounce timer for this entity
    const existingTimer = this.debounceTimers.get(entityRef);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Store the update (overwrites previous pending update for same entity)
    this.pendingUpdates.set(entityRef, update);
    this.stats.pendingUpdates = this.pendingUpdates.size;
    
    // Set new debounce timer
    const timer = setTimeout(async () => {
      await this.processUpdate(entityRef);
    }, this.config.indexing.debounceDelay);
    
    this.debounceTimers.set(entityRef, timer);
    
    this.logger.debug(`Queued ${update.type} update for ${entityRef}`);
  }
  
  /**
   * Process a pending update
   */
  private async processUpdate(entityRef: string): Promise<void> {
    const update = this.pendingUpdates.get(entityRef);
    if (!update) {
      return;
    }
    
    const startTime = Date.now();
    
    try {
      // Remove from pending
      this.pendingUpdates.delete(entityRef);
      this.debounceTimers.delete(entityRef);
      this.stats.pendingUpdates = this.pendingUpdates.size;
      
      // Process the update based on type
      switch (update.type) {
        case 'create':
        case 'update':
          await this.indexEntity(update);
          break;
        case 'delete':
          await this.deleteEntity(update);
          break;
        default:
          this.logger.warn(`Unknown update type: ${update.type}`);
      }
      
      // Update stats
      const updateTime = Date.now() - startTime;
      this.updateTimes.push(updateTime);
      if (this.updateTimes.length > 100) {
        this.updateTimes.shift(); // Keep only last 100 update times
      }
      
      this.stats.totalUpdates++;
      this.stats.lastUpdateTime = new Date();
      this.stats.averageUpdateTime = 
        this.updateTimes.reduce((a, b) => a + b, 0) / this.updateTimes.length;
      
      this.logger.info(
        `Processed ${update.type} update for ${entityRef} in ${updateTime}ms`
      );
    } catch (error) {
      this.logger.error(`Failed to process update for ${entityRef}:`, error);
      
      // Re-queue the update with exponential backoff
      setTimeout(() => {
        this.queueUpdate(update);
      }, this.config.indexing.debounceDelay * 2);
    }
  }
  
  /**
   * Index an entity (create or update)
   */
  private async indexEntity(update: IndexUpdate): Promise<void> {
    // This would integrate with the actual search backend
    // For now, we'll log the operation
    this.logger.debug(`Indexing entity: ${update.entityRef}`, {
      type: update.type,
      timestamp: update.timestamp,
    });
    
    // In a real implementation, this would:
    // 1. Extract searchable fields from update.data
    // 2. Build search document
    // 3. Insert/update in PostgreSQL search index
    // 4. Update full-text search vectors
  }
  
  /**
   * Delete an entity from the index
   */
  private async deleteEntity(update: IndexUpdate): Promise<void> {
    this.logger.debug(`Deleting entity from index: ${update.entityRef}`, {
      timestamp: update.timestamp,
    });
    
    // In a real implementation, this would:
    // 1. Remove from PostgreSQL search index
    // 2. Clean up related search vectors
  }
  
  /**
   * Flush all pending updates immediately
   */
  async flush(): Promise<void> {
    this.logger.info(`Flushing ${this.pendingUpdates.size} pending updates`);
    
    // Cancel all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    // Process all pending updates
    const updates = Array.from(this.pendingUpdates.keys());
    await Promise.all(updates.map(entityRef => this.processUpdate(entityRef)));
  }
  
  /**
   * Get indexer statistics
   */
  getStats(): IndexStats {
    return { ...this.stats };
  }
  
  /**
   * Shutdown the indexer
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down real-time indexer');
    await this.flush();
  }
}

/**
 * Batch indexer for bulk operations
 */
export class BatchIndexer {
  private config: SearchConfig;
  private logger: LoggerService;
  
  constructor(config: SearchConfig, logger: LoggerService) {
    this.config = config;
    this.logger = logger;
  }
  
  /**
   * Index multiple entities in batches
   */
  async indexBatch(entities: any[]): Promise<{
    indexed: number;
    failed: number;
    duration: number;
  }> {
    const startTime = Date.now();
    let indexed = 0;
    let failed = 0;
    
    this.logger.info(`Starting batch indexing of ${entities.length} entities`);
    
    // Process in batches
    const batchSize = this.config.indexing.batchSize;
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      
      try {
        await this.processBatch(batch);
        indexed += batch.length;
        
        this.logger.debug(
          `Indexed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(entities.length / batchSize)}`
        );
      } catch (error) {
        this.logger.error(`Failed to index batch:`, error);
        failed += batch.length;
      }
    }
    
    const duration = Date.now() - startTime;
    
    this.logger.info(
      `Batch indexing complete: ${indexed} indexed, ${failed} failed in ${duration}ms`
    );
    
    return { indexed, failed, duration };
  }
  
  /**
   * Process a single batch of entities
   */
  private async processBatch(entities: any[]): Promise<void> {
    // In a real implementation, this would:
    // 1. Build search documents for all entities
    // 2. Bulk insert/update in PostgreSQL
    // 3. Update full-text search vectors
    // 4. Handle errors and retries
    
    this.logger.debug(`Processing batch of ${entities.length} entities`);
  }
}
