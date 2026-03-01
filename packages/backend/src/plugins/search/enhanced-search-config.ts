/**
 * Enhanced Search Configuration for Backstage
 * 
 * Implements:
 * - Real-time indexing updates
 * - Optimized relevance ranking
 * - Enhanced search filters (type, tags, owner)
 * - PostgreSQL full-text search optimization
 * 
 * Requirements: 8.3
 */

import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';

export interface SearchConfig {
  // PostgreSQL configuration
  pg: {
    enabled: boolean;
    highlightPreTag: string;
    highlightPostTag: string;
    // Full-text search configuration
    searchConfig: string; // PostgreSQL text search configuration (e.g., 'english')
    rankWeights: {
      title: number;
      description: number;
      tags: number;
      content: number;
    };
  };
  
  // Indexing configuration
  indexing: {
    batchSize: number;
    refreshInterval: number; // seconds
    realTimeUpdates: boolean;
    debounceDelay: number; // milliseconds for real-time updates
  };
  
  // Search result configuration
  results: {
    maxResults: number;
    defaultResults: number;
    suggestions: boolean;
    highlightFragmentSize: number;
  };
  
  // Filter configuration
  filters: {
    enableTypeFilter: boolean;
    enableTagsFilter: boolean;
    enableOwnerFilter: boolean;
    enableLifecycleFilter: boolean;
  };
}

/**
 * Load and validate search configuration from app-config.yaml
 */
export function loadSearchConfig(config: Config, logger: LoggerService): SearchConfig {
  const searchConfig = config.getOptionalConfig('search');
  
  if (!searchConfig) {
    logger.warn('No search configuration found, using defaults');
    return getDefaultSearchConfig();
  }
  
  const pgConfig = searchConfig.getOptionalConfig('pg');
  const indexingConfig = searchConfig.getOptionalConfig('indexing');
  const resultsConfig = searchConfig.getOptionalConfig('results');
  const filtersConfig = searchConfig.getOptionalConfig('filters');
  
  return {
    pg: {
      enabled: pgConfig?.getOptionalBoolean('enabled') ?? true,
      highlightPreTag: pgConfig?.getOptionalString('highlightPreTag') ?? '<mark>',
      highlightPostTag: pgConfig?.getOptionalString('highlightPostTag') ?? '</mark>',
      searchConfig: pgConfig?.getOptionalString('searchConfig') ?? 'english',
      rankWeights: {
        title: pgConfig?.getOptionalNumber('rankWeights.title') ?? 1.0,
        description: pgConfig?.getOptionalNumber('rankWeights.description') ?? 0.8,
        tags: pgConfig?.getOptionalNumber('rankWeights.tags') ?? 0.6,
        content: pgConfig?.getOptionalNumber('rankWeights.content') ?? 0.4,
      },
    },
    indexing: {
      batchSize: indexingConfig?.getOptionalNumber('batchSize') ?? 1000,
      refreshInterval: indexingConfig?.getOptionalNumber('refreshInterval') ?? 600,
      realTimeUpdates: indexingConfig?.getOptionalBoolean('realTimeUpdates') ?? true,
      debounceDelay: indexingConfig?.getOptionalNumber('debounceDelay') ?? 1000,
    },
    results: {
      maxResults: resultsConfig?.getOptionalNumber('maxResults') ?? 25,
      defaultResults: resultsConfig?.getOptionalNumber('defaultResults') ?? 10,
      suggestions: resultsConfig?.getOptionalBoolean('suggestions') ?? true,
      highlightFragmentSize: resultsConfig?.getOptionalNumber('highlightFragmentSize') ?? 150,
    },
    filters: {
      enableTypeFilter: filtersConfig?.getOptionalBoolean('enableTypeFilter') ?? true,
      enableTagsFilter: filtersConfig?.getOptionalBoolean('enableTagsFilter') ?? true,
      enableOwnerFilter: filtersConfig?.getOptionalBoolean('enableOwnerFilter') ?? true,
      enableLifecycleFilter: filtersConfig?.getOptionalBoolean('enableLifecycleFilter') ?? true,
    },
  };
}

/**
 * Get default search configuration
 */
export function getDefaultSearchConfig(): SearchConfig {
  return {
    pg: {
      enabled: true,
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
      searchConfig: 'english',
      rankWeights: {
        title: 1.0,
        description: 0.8,
        tags: 0.6,
        content: 0.4,
      },
    },
    indexing: {
      batchSize: 1000,
      refreshInterval: 600,
      realTimeUpdates: true,
      debounceDelay: 1000,
    },
    results: {
      maxResults: 25,
      defaultResults: 10,
      suggestions: true,
      highlightFragmentSize: 150,
    },
    filters: {
      enableTypeFilter: true,
      enableTagsFilter: true,
      enableOwnerFilter: true,
      enableLifecycleFilter: true,
    },
  };
}

/**
 * PostgreSQL full-text search query builder
 * Implements optimized relevance ranking
 */
export class PostgresSearchQueryBuilder {
  private config: SearchConfig;
  
  constructor(config: SearchConfig) {
    this.config = config;
  }
  
  /**
   * Build a PostgreSQL full-text search query with relevance ranking
   */
  buildSearchQuery(searchTerm: string, filters?: {
    types?: string[];
    tags?: string[];
    owners?: string[];
    lifecycle?: string[];
  }): string {
    const { rankWeights, searchConfig } = this.config.pg;
    
    // Sanitize search term
    const sanitizedTerm = this.sanitizeSearchTerm(searchTerm);
    
    // Build the base query with ts_rank for relevance
    let query = `
      SELECT 
        *,
        (
          ${rankWeights.title} * ts_rank(to_tsvector('${searchConfig}', COALESCE(title, '')), to_tsquery('${searchConfig}', '${sanitizedTerm}')) +
          ${rankWeights.description} * ts_rank(to_tsvector('${searchConfig}', COALESCE(description, '')), to_tsquery('${searchConfig}', '${sanitizedTerm}')) +
          ${rankWeights.tags} * ts_rank(to_tsvector('${searchConfig}', COALESCE(array_to_string(tags, ' '), '')), to_tsquery('${searchConfig}', '${sanitizedTerm}')) +
          ${rankWeights.content} * ts_rank(to_tsvector('${searchConfig}', COALESCE(content, '')), to_tsquery('${searchConfig}', '${sanitizedTerm}'))
        ) AS relevance_score,
        ts_headline('${searchConfig}', COALESCE(content, ''), to_tsquery('${searchConfig}', '${sanitizedTerm}'), 
          'MaxFragmentSize=${this.config.results.highlightFragmentSize}, MaxWords=20, MinWords=10, StartSel=${this.config.pg.highlightPreTag}, StopSel=${this.config.pg.highlightPostTag}'
        ) AS highlighted_content
      FROM search_index
      WHERE (
        to_tsvector('${searchConfig}', COALESCE(title, '')) @@ to_tsquery('${searchConfig}', '${sanitizedTerm}') OR
        to_tsvector('${searchConfig}', COALESCE(description, '')) @@ to_tsquery('${searchConfig}', '${sanitizedTerm}') OR
        to_tsvector('${searchConfig}', COALESCE(array_to_string(tags, ' '), '')) @@ to_tsquery('${searchConfig}', '${sanitizedTerm}') OR
        to_tsvector('${searchConfig}', COALESCE(content, '')) @@ to_tsquery('${searchConfig}', '${sanitizedTerm}')
      )
    `;
    
    // Add filters
    if (filters) {
      if (filters.types && filters.types.length > 0) {
        query += ` AND type = ANY(ARRAY[${filters.types.map(t => `'${t}'`).join(', ')}])`;
      }
      
      if (filters.tags && filters.tags.length > 0) {
        query += ` AND tags && ARRAY[${filters.tags.map(t => `'${t}'`).join(', ')}]`;
      }
      
      if (filters.owners && filters.owners.length > 0) {
        query += ` AND owner = ANY(ARRAY[${filters.owners.map(o => `'${o}'`).join(', ')}])`;
      }
      
      if (filters.lifecycle && filters.lifecycle.length > 0) {
        query += ` AND lifecycle = ANY(ARRAY[${filters.lifecycle.map(l => `'${l}'`).join(', ')}])`;
      }
    }
    
    // Order by relevance score
    query += ` ORDER BY relevance_score DESC, last_updated DESC`;
    
    // Limit results
    query += ` LIMIT ${this.config.results.maxResults}`;
    
    return query;
  }
  
  /**
   * Sanitize search term for PostgreSQL full-text search
   * Converts to tsquery format and handles special characters
   */
  private sanitizeSearchTerm(term: string): string {
    // Remove special characters that could break tsquery
    let sanitized = term.replace(/[^\w\s-]/g, ' ');
    
    // Split into words and join with & (AND operator)
    const words = sanitized.trim().split(/\s+/).filter(w => w.length > 0);
    
    if (words.length === 0) {
      return '';
    }
    
    // Add prefix matching for each word (word:*)
    return words.map(w => `${w}:*`).join(' & ');
  }
  
  /**
   * Build index creation query for PostgreSQL
   */
  buildIndexCreationQuery(): string[] {
    const { searchConfig } = this.config.pg;
    
    return [
      // Create GIN index for full-text search on title
      `CREATE INDEX IF NOT EXISTS idx_search_title_fts 
       ON search_index USING GIN (to_tsvector('${searchConfig}', COALESCE(title, '')))`,
      
      // Create GIN index for full-text search on description
      `CREATE INDEX IF NOT EXISTS idx_search_description_fts 
       ON search_index USING GIN (to_tsvector('${searchConfig}', COALESCE(description, '')))`,
      
      // Create GIN index for full-text search on content
      `CREATE INDEX IF NOT EXISTS idx_search_content_fts 
       ON search_index USING GIN (to_tsvector('${searchConfig}', COALESCE(content, '')))`,
      
      // Create GIN index for tags array
      `CREATE INDEX IF NOT EXISTS idx_search_tags 
       ON search_index USING GIN (tags)`,
      
      // Create B-tree indexes for filters
      `CREATE INDEX IF NOT EXISTS idx_search_type 
       ON search_index (type)`,
      
      `CREATE INDEX IF NOT EXISTS idx_search_owner 
       ON search_index (owner)`,
      
      `CREATE INDEX IF NOT EXISTS idx_search_lifecycle 
       ON search_index (lifecycle)`,
      
      // Create index for last_updated for sorting
      `CREATE INDEX IF NOT EXISTS idx_search_last_updated 
       ON search_index (last_updated DESC)`,
    ];
  }
}
