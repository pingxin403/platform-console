/**
 * Tests for enhanced search configuration
 */

import { ConfigReader } from '@backstage/config';
import { mockServices } from '@backstage/backend-test-utils';
import {
  loadSearchConfig,
  getDefaultSearchConfig,
  PostgresSearchQueryBuilder,
} from './enhanced-search-config';

describe('Enhanced Search Configuration', () => {
  const logger = mockServices.logger.mock();

  describe('loadSearchConfig', () => {
    it('should load configuration from config object', () => {
      const config = new ConfigReader({
        search: {
          pg: {
            enabled: true,
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
        },
      });

      const searchConfig = loadSearchConfig(config, logger);

      expect(searchConfig.pg.enabled).toBe(true);
      expect(searchConfig.pg.searchConfig).toBe('english');
      expect(searchConfig.pg.rankWeights.title).toBe(1.0);
      expect(searchConfig.indexing.realTimeUpdates).toBe(true);
      expect(searchConfig.results.maxResults).toBe(25);
      expect(searchConfig.filters.enableTypeFilter).toBe(true);
    });

    it('should use defaults when configuration is missing', () => {
      const config = new ConfigReader({});
      const searchConfig = loadSearchConfig(config, logger);

      expect(searchConfig.pg.enabled).toBe(true);
      expect(searchConfig.pg.searchConfig).toBe('english');
      expect(searchConfig.indexing.realTimeUpdates).toBe(true);
      expect(searchConfig.results.maxResults).toBe(25);
    });

    it('should merge partial configuration with defaults', () => {
      const config = new ConfigReader({
        search: {
          pg: {
            searchConfig: 'spanish',
          },
          indexing: {
            batchSize: 500,
          },
        },
      });

      const searchConfig = loadSearchConfig(config, logger);

      expect(searchConfig.pg.searchConfig).toBe('spanish');
      expect(searchConfig.indexing.batchSize).toBe(500);
      expect(searchConfig.indexing.realTimeUpdates).toBe(true); // default
      expect(searchConfig.results.maxResults).toBe(25); // default
    });
  });

  describe('getDefaultSearchConfig', () => {
    it('should return valid default configuration', () => {
      const config = getDefaultSearchConfig();

      expect(config.pg.enabled).toBe(true);
      expect(config.pg.searchConfig).toBe('english');
      expect(config.pg.rankWeights.title).toBe(1.0);
      expect(config.pg.rankWeights.description).toBe(0.8);
      expect(config.pg.rankWeights.tags).toBe(0.6);
      expect(config.pg.rankWeights.content).toBe(0.4);
      expect(config.indexing.batchSize).toBe(1000);
      expect(config.indexing.refreshInterval).toBe(600);
      expect(config.indexing.realTimeUpdates).toBe(true);
      expect(config.indexing.debounceDelay).toBe(1000);
      expect(config.results.maxResults).toBe(25);
      expect(config.results.defaultResults).toBe(10);
      expect(config.results.suggestions).toBe(true);
      expect(config.results.highlightFragmentSize).toBe(150);
      expect(config.filters.enableTypeFilter).toBe(true);
      expect(config.filters.enableTagsFilter).toBe(true);
      expect(config.filters.enableOwnerFilter).toBe(true);
      expect(config.filters.enableLifecycleFilter).toBe(true);
    });
  });

  describe('PostgresSearchQueryBuilder', () => {
    let queryBuilder: PostgresSearchQueryBuilder;

    beforeEach(() => {
      const config = getDefaultSearchConfig();
      queryBuilder = new PostgresSearchQueryBuilder(config);
    });

    describe('buildSearchQuery', () => {
      it('should build basic search query', () => {
        const query = queryBuilder.buildSearchQuery('test');

        expect(query).toContain('SELECT');
        expect(query).toContain('ts_rank');
        expect(query).toContain('to_tsvector');
        expect(query).toContain('to_tsquery');
        expect(query).toContain('test:*');
        expect(query).toContain('ORDER BY relevance_score DESC');
        expect(query).toContain('LIMIT 25');
      });

      it('should include rank weights in query', () => {
        const query = queryBuilder.buildSearchQuery('test');

        expect(query).toContain('1 *'); // title weight
        expect(query).toContain('0.8 *'); // description weight
        expect(query).toContain('0.6 *'); // tags weight
        expect(query).toContain('0.4 *'); // content weight
      });

      it('should include highlighting in query', () => {
        const query = queryBuilder.buildSearchQuery('test');

        expect(query).toContain('ts_headline');
        expect(query).toContain('MaxFragmentSize=150');
        expect(query).toContain('StartSel=<mark>');
        expect(query).toContain('StopSel=</mark>');
      });

      it('should handle multi-word queries', () => {
        const query = queryBuilder.buildSearchQuery('test service api');

        expect(query).toContain('test:* & service:* & api:*');
      });

      it('should apply type filter', () => {
        const query = queryBuilder.buildSearchQuery('test', {
          types: ['Component', 'API'],
        });

        expect(query).toContain("type = ANY(ARRAY['Component', 'API'])");
      });

      it('should apply tags filter', () => {
        const query = queryBuilder.buildSearchQuery('test', {
          tags: ['backend', 'api'],
        });

        expect(query).toContain("tags && ARRAY['backend', 'api']");
      });

      it('should apply owner filter', () => {
        const query = queryBuilder.buildSearchQuery('test', {
          owners: ['team-platform', 'team-backend'],
        });

        expect(query).toContain(
          "owner = ANY(ARRAY['team-platform', 'team-backend'])"
        );
      });

      it('should apply lifecycle filter', () => {
        const query = queryBuilder.buildSearchQuery('test', {
          lifecycle: ['production', 'experimental'],
        });

        expect(query).toContain(
          "lifecycle = ANY(ARRAY['production', 'experimental'])"
        );
      });

      it('should apply multiple filters', () => {
        const query = queryBuilder.buildSearchQuery('test', {
          types: ['Component'],
          tags: ['backend'],
          owners: ['team-platform'],
          lifecycle: ['production'],
        });

        expect(query).toContain("type = ANY(ARRAY['Component'])");
        expect(query).toContain("tags && ARRAY['backend']");
        expect(query).toContain("owner = ANY(ARRAY['team-platform'])");
        expect(query).toContain("lifecycle = ANY(ARRAY['production'])");
      });

      it('should sanitize special characters in search term', () => {
        const query = queryBuilder.buildSearchQuery('test@#$%service');

        // Special characters should be removed and words joined with &
        expect(query).toContain('test:* & service:*');
        // The sanitized term should not contain special chars in the tsquery parameter
        expect(query).toMatch(/to_tsquery\('english', 'test:\* & service:\*'\)/);
      });
    });

    describe('buildIndexCreationQuery', () => {
      it('should return array of index creation queries', () => {
        const queries = queryBuilder.buildIndexCreationQuery();

        expect(queries).toBeInstanceOf(Array);
        expect(queries.length).toBeGreaterThan(0);
      });

      it('should include GIN indexes for full-text search', () => {
        const queries = queryBuilder.buildIndexCreationQuery();

        const ginIndexes = queries.filter(q => q.includes('USING GIN'));
        expect(ginIndexes.length).toBeGreaterThan(0);

        expect(queries.some(q => q.includes('idx_search_title_fts'))).toBe(
          true
        );
        expect(queries.some(q => q.includes('idx_search_description_fts'))).toBe(
          true
        );
        expect(queries.some(q => q.includes('idx_search_content_fts'))).toBe(
          true
        );
        expect(queries.some(q => q.includes('idx_search_tags'))).toBe(true);
      });

      it('should include B-tree indexes for filters', () => {
        const queries = queryBuilder.buildIndexCreationQuery();

        expect(queries.some(q => q.includes('idx_search_type'))).toBe(true);
        expect(queries.some(q => q.includes('idx_search_owner'))).toBe(true);
        expect(queries.some(q => q.includes('idx_search_lifecycle'))).toBe(
          true
        );
        expect(queries.some(q => q.includes('idx_search_last_updated'))).toBe(
          true
        );
      });

      it('should use IF NOT EXISTS for safe index creation', () => {
        const queries = queryBuilder.buildIndexCreationQuery();

        queries.forEach(query => {
          expect(query).toContain('IF NOT EXISTS');
        });
      });
    });
  });
});
