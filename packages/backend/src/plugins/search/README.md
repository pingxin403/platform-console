# Enhanced Backstage Search Configuration

This module implements enhanced search capabilities for the Internal Developer Platform, including real-time indexing, optimized relevance ranking, and advanced filtering.

## Features

### 1. PostgreSQL Full-Text Search Backend
- **Full-text search** with PostgreSQL's native text search capabilities
- **GIN indexes** for fast full-text queries
- **Relevance ranking** with configurable weights for different fields
- **Highlighted search results** with customizable fragment size

### 2. Real-Time Indexing
- **Immediate index updates** when entities are created, updated, or deleted
- **Debouncing** to prevent excessive index updates (configurable delay)
- **Batching** for bulk indexing operations
- **Statistics tracking** for monitoring indexer performance

### 3. Optimized Relevance Ranking
- **Weighted scoring** across multiple fields:
  - Title: 1.0 (highest weight)
  - Description: 0.8
  - Tags: 0.6
  - Content: 0.4 (lowest weight)
- **Recency boost** for recently updated documents
- **PostgreSQL ts_rank** for relevance calculation

### 4. Advanced Filtering
- **Type filter**: Filter by entity kind (Component, API, Resource, etc.)
- **Tags filter**: Filter by entity tags (autocomplete)
- **Owner filter**: Filter by entity owner (autocomplete)
- **Lifecycle filter**: Filter by lifecycle stage (experimental, production, deprecated)

## Configuration

### app-config.yaml

```yaml
search:
  # PostgreSQL search engine configuration
  pg:
    enabled: true
    highlightPreTag: '<mark>'
    highlightPostTag: '</mark>'
    searchConfig: 'english' # PostgreSQL text search configuration
    rankWeights:
      title: 1.0
      description: 0.8
      tags: 0.6
      content: 0.4
  
  # Indexing configuration
  indexing:
    batchSize: 1000
    refreshInterval: 600 # seconds
    realTimeUpdates: true
    debounceDelay: 1000 # milliseconds
  
  # Search result configuration
  results:
    maxResults: 25
    defaultResults: 10
    suggestions: true
    highlightFragmentSize: 150
  
  # Filter configuration
  filters:
    enableTypeFilter: true
    enableTagsFilter: true
    enableOwnerFilter: true
    enableLifecycleFilter: true
```

## Architecture

### Components

1. **enhanced-search-config.ts**
   - Configuration loading and validation
   - PostgreSQL query builder with relevance ranking
   - Index creation queries

2. **realtime-indexer.ts**
   - Real-time index update queue with debouncing
   - Batch indexer for bulk operations
   - Statistics tracking and monitoring

### PostgreSQL Indexes

The following indexes are created for optimal search performance:

```sql
-- Full-text search indexes (GIN)
CREATE INDEX idx_search_title_fts ON search_index USING GIN (to_tsvector('english', title));
CREATE INDEX idx_search_description_fts ON search_index USING GIN (to_tsvector('english', description));
CREATE INDEX idx_search_content_fts ON search_index USING GIN (to_tsvector('english', content));

-- Array index for tags
CREATE INDEX idx_search_tags ON search_index USING GIN (tags);

-- B-tree indexes for filters
CREATE INDEX idx_search_type ON search_index (type);
CREATE INDEX idx_search_owner ON search_index (owner);
CREATE INDEX idx_search_lifecycle ON search_index (lifecycle);
CREATE INDEX idx_search_last_updated ON search_index (last_updated DESC);
```

## Usage

### Backend Integration

The search backend is automatically configured in `packages/backend/src/index.ts`:

```typescript
// Search plugin with PostgreSQL backend
backend.add(import('@backstage/plugin-search-backend'));
backend.add(import('@backstage/plugin-search-backend-module-pg'));

// Search collators
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs'));
```

### Frontend Integration

The enhanced SearchPage component is located at `packages/app/src/components/search/SearchPage.tsx` and includes:

- Search bar with autocomplete
- Type filter (Software Catalog, Documentation)
- Kind filter (Component, API, Resource, etc.)
- Lifecycle filter (experimental, production, deprecated)
- Tags filter (autocomplete with all available tags)
- Owner filter (autocomplete with all owners)

## Performance

### Indexing Performance
- **Batch indexing**: 1000 entities per batch
- **Real-time updates**: < 1 second latency (with 1s debounce)
- **Average update time**: Tracked and reported in statistics

### Search Performance
- **Query time**: < 100ms for most queries (with proper indexes)
- **Result limit**: 25 results per page (configurable)
- **Highlight generation**: Optimized fragment size (150 characters)

## Monitoring

### Indexer Statistics

The real-time indexer tracks the following statistics:

```typescript
interface IndexStats {
  totalUpdates: number;      // Total number of updates processed
  pendingUpdates: number;    // Number of updates waiting to be processed
  lastUpdateTime: Date;      // Timestamp of last update
  averageUpdateTime: number; // Average time to process an update (ms)
}
```

Access statistics via:

```typescript
const stats = realTimeIndexer.getStats();
console.log(`Total updates: ${stats.totalUpdates}`);
console.log(`Pending updates: ${stats.pendingUpdates}`);
console.log(`Average update time: ${stats.averageUpdateTime}ms`);
```

## Troubleshooting

### Slow Search Queries

1. **Check indexes**: Ensure all PostgreSQL indexes are created
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'search_index';
   ```

2. **Analyze query plan**: Use EXPLAIN ANALYZE to identify bottlenecks
   ```sql
   EXPLAIN ANALYZE SELECT * FROM search_index WHERE ...;
   ```

3. **Adjust rank weights**: Lower weights for less important fields

### Index Update Delays

1. **Check debounce delay**: Reduce `debounceDelay` in configuration
2. **Monitor pending updates**: Check `stats.pendingUpdates`
3. **Flush manually**: Call `realTimeIndexer.flush()` to process all pending updates

### Missing Search Results

1. **Verify entity is indexed**: Check `search_index` table
2. **Check collator configuration**: Ensure entity type is included in `entityTypes`
3. **Verify search term**: Try different search terms or use wildcards

## Requirements

This implementation satisfies:
- **Requirement 8.3**: Unified search with relevance ranking and filtering
- **Task 20.1**: Configure Backstage search and optimize indexing

## Future Enhancements

- [ ] Fuzzy search for typo tolerance
- [ ] Search analytics and popular queries
- [ ] Personalized search results based on user activity
- [ ] Search result caching for common queries
- [ ] Multi-language support for non-English content
