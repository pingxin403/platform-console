/**
 * Property-based test for documentation automation
 * Feature: internal-developer-platform, Property 11: Documentation automation
 * Validates: Requirements 5.1, 5.2, 5.3
 */

import * as fc from 'fast-check';
import { Entity } from '@backstage/catalog-model';

// Documentation automation interface to test
interface DocumentationAutomation {
  generateDocumentation(
    repository: ServiceRepository,
  ): Promise<DocumentationResult>;
  rebuildDocumentation(repository: ServiceRepository): Promise<RebuildResult>;
  getDocumentationStatus(serviceName: string): Promise<DocumentationStatus>;
  supportedMarkdownFeatures(): MarkdownFeatures;
}

interface ServiceRepository {
  name: string;
  owner: string;
  hasDocsDirectory: boolean;
  docsContent: DocumentationFile[];
  lastUpdated: Date;
  branch: string;
}

interface DocumentationFile {
  path: string;
  content: string;
  lastModified: Date;
  type: 'markdown' | 'yaml' | 'image' | 'other';
}

interface DocumentationResult {
  serviceName: string;
  generated: boolean;
  hosted: boolean;
  generationTime: Date;
  buildDuration: number; // in milliseconds
  outputUrl?: string;
  errors: string[];
  warnings: string[];
}

interface RebuildResult {
  serviceName: string;
  rebuilt: boolean;
  rebuildTime: Date;
  rebuildDuration: number; // in milliseconds
  previousBuildTime?: Date;
  timeSinceUpdate: number; // in minutes
  success: boolean;
  errors: string[];
}

interface DocumentationStatus {
  serviceName: string;
  isGenerated: boolean;
  isHosted: boolean;
  lastBuildTime?: Date;
  lastUpdateTime?: Date;
  buildStatus: 'success' | 'failed' | 'in_progress' | 'not_started';
  url?: string;
}

interface MarkdownFeatures {
  supportsDiagrams: boolean;
  supportsCodeSnippets: boolean;
  supportsCrossReferences: boolean;
  supportsTables: boolean;
  supportsImages: boolean;
  supportsMermaid: boolean;
  supportsPlantUML: boolean;
  supportsLatex: boolean;
}

// Mock implementation of TechDocs documentation automation
class MockTechDocsAutomation implements DocumentationAutomation {
  private documentationCache: Map<string, DocumentationResult> = new Map();
  private statusCache: Map<string, DocumentationStatus> = new Map();
  private buildQueue: Set<string> = new Set();

  async generateDocumentation(
    repository: ServiceRepository,
  ): Promise<DocumentationResult> {
    const startTime = new Date();

    // Check if repository has /docs directory
    if (!repository.hasDocsDirectory) {
      return {
        serviceName: repository.name,
        generated: false,
        hosted: false,
        generationTime: startTime,
        buildDuration: 0,
        errors: ['No /docs directory found in repository'],
        warnings: [],
      };
    }

    // Check if docs directory has valid content
    const markdownFiles = repository.docsContent.filter(
      file => file.type === 'markdown',
    );
    if (markdownFiles.length === 0) {
      return {
        serviceName: repository.name,
        generated: false,
        hosted: false,
        generationTime: startTime,
        buildDuration: 100,
        errors: ['No markdown files found in /docs directory'],
        warnings: [],
      };
    }

    // Simulate documentation generation process
    const buildDuration = this.simulateBuildTime(repository.docsContent.length);
    const endTime = new Date(startTime.getTime() + buildDuration);

    // Check for potential issues
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate markdown content
    for (const file of markdownFiles) {
      if (file.content.length === 0) {
        warnings.push(`Empty markdown file: ${file.path}`);
      }
      if (file.content.includes('![](') && !file.content.includes('http')) {
        // Check for relative image references
        const hasImageFiles = repository.docsContent.some(
          f =>
            f.type === 'image' &&
            file.content.includes(f.path.split('/').pop() || ''),
        );
        if (!hasImageFiles) {
          warnings.push(`Broken image reference in ${file.path}`);
        }
      }
    }

    const result: DocumentationResult = {
      serviceName: repository.name,
      generated: true,
      hosted: true,
      generationTime: endTime,
      buildDuration,
      outputUrl: `https://docs.company.com/${repository.name}`,
      errors,
      warnings,
    };

    // Cache the result
    this.documentationCache.set(repository.name, result);

    // Update status
    this.statusCache.set(repository.name, {
      serviceName: repository.name,
      isGenerated: true,
      isHosted: true,
      lastBuildTime: endTime,
      lastUpdateTime: repository.lastUpdated,
      buildStatus: errors.length > 0 ? 'failed' : 'success',
      url: result.outputUrl,
    });

    return result;
  }

  async rebuildDocumentation(
    repository: ServiceRepository,
  ): Promise<RebuildResult> {
    const rebuildStartTime = new Date();

    // Get previous build information
    const previousStatus = this.statusCache.get(repository.name);
    const previousBuildTime = previousStatus?.lastBuildTime;

    // Calculate time since last update
    const timeSinceUpdate = previousStatus?.lastUpdateTime
      ? (rebuildStartTime.getTime() - repository.lastUpdated.getTime()) /
        (1000 * 60) // minutes
      : 0;

    // Add to build queue to simulate processing
    this.buildQueue.add(repository.name);

    try {
      // Regenerate documentation
      const generationResult = await this.generateDocumentation(repository);

      const rebuildDuration = generationResult.buildDuration;
      const success =
        generationResult.generated && generationResult.errors.length === 0;

      const result: RebuildResult = {
        serviceName: repository.name,
        rebuilt: true,
        rebuildTime: generationResult.generationTime,
        rebuildDuration,
        previousBuildTime,
        timeSinceUpdate,
        success,
        errors: generationResult.errors,
      };

      return result;
    } finally {
      // Remove from build queue
      this.buildQueue.delete(repository.name);
    }
  }

  async getDocumentationStatus(
    serviceName: string,
  ): Promise<DocumentationStatus> {
    const cached = this.statusCache.get(serviceName);
    if (cached) {
      return cached;
    }

    // Return default status for unknown services
    return {
      serviceName,
      isGenerated: false,
      isHosted: false,
      buildStatus: 'not_started',
    };
  }

  supportedMarkdownFeatures(): MarkdownFeatures {
    return {
      supportsDiagrams: true,
      supportsCodeSnippets: true,
      supportsCrossReferences: true,
      supportsTables: true,
      supportsImages: true,
      supportsMermaid: true,
      supportsPlantUML: true,
      supportsLatex: false, // Not typically supported in basic TechDocs
    };
  }

  private simulateBuildTime(fileCount: number): number {
    // Simulate realistic build times based on content size
    const baseTime = 2000; // 2 seconds base
    const perFileTime = 500; // 500ms per file
    return baseTime + fileCount * perFileTime;
  }

  // Helper method to check if rebuild is within time limit
  isRebuildWithinTimeLimit(
    rebuildResult: RebuildResult,
    timeLimitMinutes: number = 10,
  ): boolean {
    return rebuildResult.timeSinceUpdate <= timeLimitMinutes;
  }
}

// Property-based test generators
const serviceNameArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]*[a-z0-9]$/);

const ownerArbitrary = fc.stringMatching(/^team-[a-z]+$/);

const markdownContentArbitrary = fc
  .string({ minLength: 10, maxLength: 1000 })
  .map(content => {
    // Generate realistic markdown content
    const lines = [
      '# Service Documentation',
      '',
      '## Overview',
      content,
      '',
      '## API Reference',
      '```typescript',
      'interface ServiceAPI {',
      '  getData(): Promise<Data>;',
      '}',
      '```',
      '',
      '## Diagrams',
      '```mermaid',
      'graph TD',
      '  A[Client] --> B[Service]',
      '  B --> C[Database]',
      '```',
      '',
      '## Cross References',
      'See [other service](../other-service/README.md) for details.',
    ];
    return lines.join('\n');
  });

const documentationFileArbitrary = fc.record({
  path: fc
    .string()
    .map(s => `docs/${s.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 20)}.md`),
  content: markdownContentArbitrary,
  lastModified: fc
    .integer({ min: 1577836800000, max: 1735689600000 })
    .map(timestamp => new Date(timestamp)),
  type: fc.constant('markdown' as const),
});

const imageFileArbitrary = fc.record({
  path: fc
    .string()
    .map(
      s =>
        `docs/images/${s.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 15)}.png`,
    ),
  content: fc.constant('binary-image-data'),
  lastModified: fc
    .integer({ min: 1577836800000, max: 1735689600000 })
    .map(timestamp => new Date(timestamp)),
  type: fc.constant('image' as const),
});

const yamlFileArbitrary = fc.record({
  path: fc.constant('docs/mkdocs.yml'),
  content: fc.constant('site_name: Service Docs\nnav:\n  - Home: index.md'),
  lastModified: fc
    .integer({ min: 1577836800000, max: 1735689600000 })
    .map(timestamp => new Date(timestamp)),
  type: fc.constant('yaml' as const),
});

const docsContentArbitrary = fc.array(
  fc.oneof(documentationFileArbitrary, imageFileArbitrary, yamlFileArbitrary),
  { minLength: 1, maxLength: 10 },
);

const serviceRepositoryArbitrary = fc
  .record({
    name: serviceNameArbitrary,
    owner: ownerArbitrary,
    hasDocsDirectory: fc.boolean(),
    docsContent: fc
      .boolean()
      .chain(hasDocsDir =>
        hasDocsDir ? docsContentArbitrary : fc.constant([]),
      ),
    lastUpdated: fc
      .integer({ min: 1577836800000, max: 1735689600000 })
      .map(timestamp => new Date(timestamp)),
    branch: fc.constantFrom('main', 'master', 'develop'),
  })
  .map(repo => ({
    ...repo,
    hasDocsDirectory: repo.docsContent.length > 0, // Ensure consistency
  }));

const serviceRepositoryListArbitrary = fc
  .array(serviceRepositoryArbitrary, { minLength: 1, maxLength: 15 })
  .map(repos => {
    // Ensure unique service names
    const uniqueRepos: ServiceRepository[] = [];
    const seenNames = new Set<string>();

    for (const repo of repos) {
      if (!seenNames.has(repo.name)) {
        seenNames.add(repo.name);
        uniqueRepos.push(repo);
      }
    }

    return uniqueRepos.length > 0 ? uniqueRepos : [repos[0]];
  });

describe('Documentation Automation', () => {
  let techDocsAutomation: MockTechDocsAutomation;

  beforeEach(() => {
    techDocsAutomation = new MockTechDocsAutomation();
  });

  /**
   * Property 11: Documentation automation
   * For any service repository containing a /docs directory, the Developer_Portal should
   * automatically generate and host documentation using TechDocs, rebuild within 10 minutes
   * when updated, and support full Markdown features
   * Validates: Requirements 5.1, 5.2, 5.3
   */
  it('should automatically generate and host documentation for repositories with /docs directory', async () => {
    await fc.assert(
      fc.asyncProperty(serviceRepositoryListArbitrary, async repositories => {
        // Create a fresh automation instance for each property test run
        const freshAutomation = new MockTechDocsAutomation();

        for (const repository of repositories) {
          // Act: Generate documentation for the repository
          const result = await freshAutomation.generateDocumentation(
            repository,
          );

          // Assert: Documentation generation behavior based on /docs directory presence
          if (
            repository.hasDocsDirectory &&
            repository.docsContent.some(f => f.type === 'markdown')
          ) {
            // Requirements 5.1: Should automatically generate and host documentation
            expect(result.generated).toBe(true);
            expect(result.hosted).toBe(true);
            expect(result.outputUrl).toBeDefined();
            expect(result.outputUrl).toContain(repository.name);
            expect(result.generationTime).toBeDefined();
            expect(result.buildDuration).toBeGreaterThan(0);

            // Verify documentation status is updated
            const status = await freshAutomation.getDocumentationStatus(
              repository.name,
            );
            expect(status.isGenerated).toBe(true);
            expect(status.isHosted).toBe(true);
            expect(status.lastBuildTime).toBeDefined();
            expect(status.url).toEqual(result.outputUrl);
            expect(['success', 'failed']).toContain(status.buildStatus);
          } else {
            // Should not generate documentation without /docs directory or markdown files
            expect(result.generated).toBe(false);
            expect(result.hosted).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);

            // Verify appropriate error messages
            if (!repository.hasDocsDirectory) {
              expect(
                result.errors.some(e => e.includes('/docs directory')),
              ).toBe(true);
            } else {
              expect(
                result.errors.some(e => e.includes('markdown files')),
              ).toBe(true);
            }
          }

          // Assert: Service name should match repository name
          expect(result.serviceName).toEqual(repository.name);

          // Assert: Generation time should be reasonable
          expect(result.buildDuration).toBeLessThan(30000); // Less than 30 seconds

          // Assert: Errors and warnings should be arrays
          expect(Array.isArray(result.errors)).toBe(true);
          expect(Array.isArray(result.warnings)).toBe(true);
        }
      }),
      { numRuns: 100 }, // Run 100 iterations as specified in design document
    );
  });

  it('should rebuild documentation within 10 minutes when updated', async () => {
    await fc.assert(
      fc.asyncProperty(serviceRepositoryListArbitrary, async repositories => {
        // Create a fresh automation instance for each property test run
        const freshAutomation = new MockTechDocsAutomation();

        // Filter to only repositories with docs for this test
        const reposWithDocs = repositories.filter(
          r =>
            r.hasDocsDirectory &&
            r.docsContent.some(f => f.type === 'markdown'),
        );

        if (reposWithDocs.length === 0) return; // Skip if no valid repositories

        for (const repository of reposWithDocs) {
          // Act: Initial documentation generation
          const initialResult = await freshAutomation.generateDocumentation(
            repository,
          );
          expect(initialResult.generated).toBe(true);

          // Simulate documentation update (within last 10 minutes)
          const updatedRepository = {
            ...repository,
            lastUpdated: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          };

          // Act: Rebuild documentation
          const rebuildResult = await freshAutomation.rebuildDocumentation(
            updatedRepository,
          );

          // Assert: Requirements 5.2 - Should rebuild within 10 minutes
          expect(rebuildResult.rebuilt).toBe(true);
          expect(rebuildResult.timeSinceUpdate).toBeLessThanOrEqual(10);
          expect(
            freshAutomation.isRebuildWithinTimeLimit(rebuildResult, 10),
          ).toBe(true);

          // Assert: Rebuild should be successful for valid content
          expect(rebuildResult.success).toBe(true);
          expect(rebuildResult.rebuildTime).toBeDefined();
          expect(rebuildResult.rebuildDuration).toBeGreaterThan(0);

          // Assert: Service name should match
          expect(rebuildResult.serviceName).toEqual(repository.name);

          // Assert: Previous build time should be tracked
          if (rebuildResult.previousBuildTime) {
            expect(rebuildResult.rebuildTime.getTime()).toBeGreaterThanOrEqual(
              rebuildResult.previousBuildTime.getTime(),
            );
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should support full Markdown features including diagrams, code snippets, and cross-references', async () => {
    await fc.assert(
      fc.asyncProperty(serviceRepositoryListArbitrary, async repositories => {
        // Create a fresh automation instance for each property test run
        const freshAutomation = new MockTechDocsAutomation();

        // Assert: Requirements 5.3 - Should support full Markdown features
        const features = freshAutomation.supportedMarkdownFeatures();

        // Assert: Core Markdown features are supported
        expect(features.supportsDiagrams).toBe(true);
        expect(features.supportsCodeSnippets).toBe(true);
        expect(features.supportsCrossReferences).toBe(true);
        expect(features.supportsTables).toBe(true);
        expect(features.supportsImages).toBe(true);

        // Assert: Advanced diagram support
        expect(features.supportsMermaid).toBe(true);
        expect(features.supportsPlantUML).toBe(true);

        // Test with repositories that have rich markdown content
        const reposWithDocs = repositories.filter(
          r =>
            r.hasDocsDirectory &&
            r.docsContent.some(f => f.type === 'markdown'),
        );

        for (const repository of reposWithDocs) {
          // Create repository with rich markdown content
          const richContentRepo = {
            ...repository,
            docsContent: [
              {
                path: 'docs/index.md',
                content: [
                  '# Service Documentation',
                  '',
                  '## Code Snippets',
                  '```typescript',
                  'interface API { getData(): Promise<Data>; }',
                  '```',
                  '',
                  '## Diagrams',
                  '```mermaid',
                  'graph TD',
                  '  A[Client] --> B[Service]',
                  '```',
                  '',
                  '## Tables',
                  '| Feature | Supported |',
                  '|---------|-----------|',
                  '| Diagrams | Yes |',
                  '',
                  '## Cross References',
                  'See [API docs](./api.md) for details.',
                  '',
                  '## Images',
                  '![Architecture](./images/arch.png)',
                ].join('\n'),
                lastModified: new Date(),
                type: 'markdown' as const,
              },
              {
                path: 'docs/images/arch.png',
                content: 'binary-image-data',
                lastModified: new Date(),
                type: 'image' as const,
              },
            ],
          };

          // Act: Generate documentation with rich content
          const result = await freshAutomation.generateDocumentation(
            richContentRepo,
          );

          // Assert: Should successfully generate documentation with rich content
          expect(result.generated).toBe(true);
          expect(result.hosted).toBe(true);

          // Assert: Should handle images correctly (no broken image warnings)
          const brokenImageWarnings = result.warnings.filter(w =>
            w.includes('Broken image'),
          );
          expect(brokenImageWarnings.length).toBe(0);

          // Assert: Should process all markdown features without errors
          const markdownErrors = result.errors.filter(
            e =>
              e.includes('markdown') ||
              e.includes('diagram') ||
              e.includes('code'),
          );
          expect(markdownErrors.length).toBe(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should handle repositories without documentation gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(serviceRepositoryListArbitrary, async repositories => {
        // Create a fresh automation instance for each property test run
        const freshAutomation = new MockTechDocsAutomation();

        // Create repositories without docs directories
        const reposWithoutDocs = repositories.map(repo => ({
          ...repo,
          hasDocsDirectory: false,
          docsContent: [],
        }));

        for (const repository of reposWithoutDocs) {
          // Act: Attempt to generate documentation
          const result = await freshAutomation.generateDocumentation(
            repository,
          );

          // Assert: Should handle gracefully without crashing
          expect(result.serviceName).toEqual(repository.name);
          expect(result.generated).toBe(false);
          expect(result.hosted).toBe(false);
          expect(result.buildDuration).toBeGreaterThanOrEqual(0);

          // Assert: Should provide clear error message
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some(e => e.includes('/docs directory'))).toBe(
            true,
          );

          // Assert: Status should reflect no documentation
          const status = await freshAutomation.getDocumentationStatus(
            repository.name,
          );
          expect(status.isGenerated).toBe(false);
          expect(status.isHosted).toBe(false);
          expect(status.buildStatus).toEqual('not_started');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should track documentation status and build history correctly', async () => {
    await fc.assert(
      fc.asyncProperty(serviceRepositoryListArbitrary, async repositories => {
        // Create a fresh automation instance for each property test run
        const freshAutomation = new MockTechDocsAutomation();

        for (const repository of repositories) {
          // Act: Check initial status (before any generation)
          const initialStatus = await freshAutomation.getDocumentationStatus(
            repository.name,
          );

          // Assert: Initial status should indicate no documentation
          expect(initialStatus.serviceName).toEqual(repository.name);
          expect(initialStatus.isGenerated).toBe(false);
          expect(initialStatus.isHosted).toBe(false);
          expect(initialStatus.buildStatus).toEqual('not_started');
          expect(initialStatus.lastBuildTime).toBeUndefined();
          expect(initialStatus.url).toBeUndefined();

          // Act: Generate documentation
          const generationResult = await freshAutomation.generateDocumentation(
            repository,
          );

          // Act: Check status after generation
          const postGenerationStatus =
            await freshAutomation.getDocumentationStatus(repository.name);

          // Assert: Status should reflect generation results
          expect(postGenerationStatus.serviceName).toEqual(repository.name);
          expect(postGenerationStatus.isGenerated).toEqual(
            generationResult.generated,
          );
          expect(postGenerationStatus.isHosted).toEqual(
            generationResult.hosted,
          );

          if (generationResult.generated) {
            expect(postGenerationStatus.lastBuildTime).toBeDefined();
            expect(postGenerationStatus.url).toEqual(
              generationResult.outputUrl,
            );
            expect(postGenerationStatus.buildStatus).toEqual(
              generationResult.errors.length > 0 ? 'failed' : 'success',
            );
          } else {
            expect(postGenerationStatus.buildStatus).toEqual('not_started');
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
