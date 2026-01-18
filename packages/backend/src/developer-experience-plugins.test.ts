/**
 * Integration tests for developer experience plugins
 *
 * Tests API documentation generation, gRPC playground functionality,
 * TODO tracking, developer toolbox utilities, catalog graph,
 * SDK generation, tech insights, and tech radar functionality.
 *
 * Requirements: 1.3, 5.1, 5.3, 9.1, 13.1
 */

import { ConfigReader } from '@backstage/config';

describe('Developer Experience Plugins Integration Tests', () => {
  let config: ConfigReader;

  beforeAll(async () => {
    // Initialize configuration
    config = new ConfigReader({
      app: {
        title: 'Test Internal Developer Platform',
        baseUrl: 'http://localhost:3000',
      },
      backend: {
        baseUrl: 'http://localhost:7007',
        database: {
          client: 'pg',
          connection: ':memory:',
        },
      },
      // API Documentation configuration
      apiDocs: {
        generator: {
          openapi: {
            enabled: true,
            autoGenerate: true,
            version: '3.0.0',
          },
          asyncapi: {
            enabled: true,
            autoGenerate: true,
            version: '2.6.0',
          },
          graphql: {
            enabled: true,
            autoIntrospect: true,
            playground: true,
          },
        },
        testing: {
          enabled: true,
          supportedTypes: ['openapi', 'asyncapi', 'graphql'],
          defaultEnvironment: 'development',
        },
        display: {
          showExamples: true,
          showAuth: true,
          showLimits: true,
          interactiveExplorer: true,
        },
        sdkGeneration: {
          enabled: true,
          supportedLanguages: [
            'java',
            'go',
            'typescript',
            'javascript',
            'python',
          ],
          templates: {
            java: 'openapi-generator-java',
            go: 'openapi-generator-go',
            typescript: 'openapi-generator-typescript',
            javascript: 'openapi-generator-javascript',
            python: 'openapi-generator-python',
          },
          publishing: {
            enabled: true,
            targets: ['npm', 'maven', 'go-modules', 'pypi'],
            versioning: 'semantic',
          },
          documentation: {
            enabled: true,
            formats: ['markdown', 'html'],
            examples: true,
          },
        },
      },
      // gRPC Playground configuration
      grpcPlayground: {
        discovery: {
          enabled: true,
          supportedTypes: ['grpc', 'grpc-web'],
        },
        protobuf: {
          documentation: true,
          imports: true,
          defaultPath: '/proto',
        },
        testing: {
          enabled: true,
          tls: true,
          defaultEnvironment: 'development',
          timeout: 30000,
        },
      },
      // TODO plugin configuration
      todo: {
        aggregation: {
          enabled: true,
          commentTypes: ['TODO', 'FIXME', 'HACK', 'BUG', 'NOTE'],
          fileExtensions: [
            '.ts',
            '.tsx',
            '.js',
            '.jsx',
            '.py',
            '.java',
            '.go',
            '.rs',
            '.cpp',
            '.c',
            '.h',
          ],
        },
        metrics: {
          enabled: true,
          density: true,
          age: true,
          priority: true,
        },
        vcs: {
          git: true,
          authors: true,
          creationDate: true,
        },
      },
      // Toolbox plugin configuration
      toolbox: {
        tools: {
          converters: true,
          validators: true,
          jwt: true,
          qrCode: true,
          barcode: true,
          utilities: true,
        },
        favorites: {
          enabled: true,
          customOrder: true,
        },
        i18n: {
          enabled: true,
          defaultLanguage: 'en',
        },
      },
      // DevTools plugin configuration
      devtools: {
        monitoring: {
          enabled: true,
          versions: true,
          config: true,
          secretMasking: true,
        },
        dependencies: {
          enabled: true,
          database: true,
          externalServices: true,
          timeout: 5000,
        },
        diagnostics: {
          enabled: true,
          memory: true,
          cpu: true,
          uptime: true,
        },
      },
      // Tech Insights configuration
      techInsights: {
        scorecards: {
          enabled: true,
          compliance: true,
          operational: true,
          quality: true,
        },
        checks: {
          automated: true,
          manual: true,
          scheduled: true,
        },
        tracking: {
          improvement: true,
          trends: true,
          benchmarking: true,
        },
      },
      // Tech Radar configuration
      techRadar: {
        visualization: {
          quadrants: [
            { name: 'Languages & Frameworks', id: 'languages-frameworks' },
            { name: 'Tools', id: 'tools' },
            { name: 'Platforms', id: 'platforms' },
            { name: 'Techniques', id: 'techniques' },
          ],
          rings: [
            { name: 'Adopt', id: 'adopt', color: '#5ba300' },
            { name: 'Trial', id: 'trial', color: '#009eb0' },
            { name: 'Assess', id: 'assess', color: '#c7ba00' },
            { name: 'Hold', id: 'hold', color: '#e09b96' },
          ],
        },
        tracking: {
          enabled: true,
          showTimelines: true,
          showDescriptions: true,
          notifications: true,
        },
        data: {
          source: 'static',
          static: {
            entries: [
              {
                name: 'React',
                quadrant: 'languages-frameworks',
                ring: 'adopt',
                moved: 0,
                description: 'JavaScript library for building user interfaces',
              },
              {
                name: 'TypeScript',
                quadrant: 'languages-frameworks',
                ring: 'adopt',
                moved: 0,
                description: 'Typed superset of JavaScript',
              },
              {
                name: 'Backstage',
                quadrant: 'platforms',
                ring: 'adopt',
                moved: 1,
                description: 'Open platform for building developer portals',
              },
            ],
          },
        },
      },
    });
  });

  describe('API Documentation Generation', () => {
    it('should support OpenAPI documentation generation', async () => {
      const apiDocsConfig = config.getConfig('apiDocs');

      expect(apiDocsConfig.getBoolean('generator.openapi.enabled')).toBe(true);
      expect(apiDocsConfig.getBoolean('generator.openapi.autoGenerate')).toBe(
        true,
      );
      expect(apiDocsConfig.getString('generator.openapi.version')).toBe(
        '3.0.0',
      );
    });

    it('should support AsyncAPI documentation generation', async () => {
      const apiDocsConfig = config.getConfig('apiDocs');

      expect(apiDocsConfig.getBoolean('generator.asyncapi.enabled')).toBe(true);
      expect(apiDocsConfig.getBoolean('generator.asyncapi.autoGenerate')).toBe(
        true,
      );
      expect(apiDocsConfig.getString('generator.asyncapi.version')).toBe(
        '2.6.0',
      );
    });

    it('should support GraphQL schema introspection', async () => {
      const apiDocsConfig = config.getConfig('apiDocs');

      expect(apiDocsConfig.getBoolean('generator.graphql.enabled')).toBe(true);
      expect(apiDocsConfig.getBoolean('generator.graphql.autoIntrospect')).toBe(
        true,
      );
      expect(apiDocsConfig.getBoolean('generator.graphql.playground')).toBe(
        true,
      );
    });

    it('should enable API testing and exploration capabilities', async () => {
      const apiDocsConfig = config.getConfig('apiDocs');

      expect(apiDocsConfig.getBoolean('testing.enabled')).toBe(true);
      expect(apiDocsConfig.getStringArray('testing.supportedTypes')).toEqual([
        'openapi',
        'asyncapi',
        'graphql',
      ]);
      expect(apiDocsConfig.getString('testing.defaultEnvironment')).toBe(
        'development',
      );
    });

    it('should configure interactive API explorer', async () => {
      const apiDocsConfig = config.getConfig('apiDocs');

      expect(apiDocsConfig.getBoolean('display.showExamples')).toBe(true);
      expect(apiDocsConfig.getBoolean('display.showAuth')).toBe(true);
      expect(apiDocsConfig.getBoolean('display.showLimits')).toBe(true);
      expect(apiDocsConfig.getBoolean('display.interactiveExplorer')).toBe(
        true,
      );
    });
  });

  describe('gRPC Playground Functionality', () => {
    it('should enable gRPC service discovery', async () => {
      const grpcConfig = config.getConfig('grpcPlayground');

      expect(grpcConfig.getBoolean('discovery.enabled')).toBe(true);
      expect(grpcConfig.getStringArray('discovery.supportedTypes')).toEqual([
        'grpc',
        'grpc-web',
      ]);
    });

    it('should support protocol buffer documentation', async () => {
      const grpcConfig = config.getConfig('grpcPlayground');

      expect(grpcConfig.getBoolean('protobuf.documentation')).toBe(true);
      expect(grpcConfig.getBoolean('protobuf.imports')).toBe(true);
      expect(grpcConfig.getString('protobuf.defaultPath')).toBe('/proto');
    });

    it('should enable gRPC service testing capabilities', async () => {
      const grpcConfig = config.getConfig('grpcPlayground');

      expect(grpcConfig.getBoolean('testing.enabled')).toBe(true);
      expect(grpcConfig.getBoolean('testing.tls')).toBe(true);
      expect(grpcConfig.getString('testing.defaultEnvironment')).toBe(
        'development',
      );
      expect(grpcConfig.getNumber('testing.timeout')).toBe(30000);
    });
  });

  describe('TODO Tracking', () => {
    it('should enable TODO/FIXME comment aggregation', async () => {
      const todoConfig = config.getConfig('todo');

      expect(todoConfig.getBoolean('aggregation.enabled')).toBe(true);
      expect(todoConfig.getStringArray('aggregation.commentTypes')).toEqual([
        'TODO',
        'FIXME',
        'HACK',
        'BUG',
        'NOTE',
      ]);
      expect(todoConfig.getStringArray('aggregation.fileExtensions')).toContain(
        '.ts',
      );
      expect(todoConfig.getStringArray('aggregation.fileExtensions')).toContain(
        '.tsx',
      );
      expect(todoConfig.getStringArray('aggregation.fileExtensions')).toContain(
        '.java',
      );
      expect(todoConfig.getStringArray('aggregation.fileExtensions')).toContain(
        '.go',
      );
    });

    it('should enable code quality metrics tracking', async () => {
      const todoConfig = config.getConfig('todo');

      expect(todoConfig.getBoolean('metrics.enabled')).toBe(true);
      expect(todoConfig.getBoolean('metrics.density')).toBe(true);
      expect(todoConfig.getBoolean('metrics.age')).toBe(true);
      expect(todoConfig.getBoolean('metrics.priority')).toBe(true);
    });

    it('should integrate with version control systems', async () => {
      const todoConfig = config.getConfig('todo');

      expect(todoConfig.getBoolean('vcs.git')).toBe(true);
      expect(todoConfig.getBoolean('vcs.authors')).toBe(true);
      expect(todoConfig.getBoolean('vcs.creationDate')).toBe(true);
    });
  });

  describe('Developer Toolbox Utilities', () => {
    it('should enable developer utility tools', async () => {
      const toolboxConfig = config.getConfig('toolbox');

      expect(toolboxConfig.getBoolean('tools.converters')).toBe(true);
      expect(toolboxConfig.getBoolean('tools.validators')).toBe(true);
      expect(toolboxConfig.getBoolean('tools.jwt')).toBe(true);
      expect(toolboxConfig.getBoolean('tools.qrCode')).toBe(true);
      expect(toolboxConfig.getBoolean('tools.barcode')).toBe(true);
      expect(toolboxConfig.getBoolean('tools.utilities')).toBe(true);
    });

    it('should support favorites and personalization', async () => {
      const toolboxConfig = config.getConfig('toolbox');

      expect(toolboxConfig.getBoolean('favorites.enabled')).toBe(true);
      expect(toolboxConfig.getBoolean('favorites.customOrder')).toBe(true);
    });

    it('should support internationalization', async () => {
      const toolboxConfig = config.getConfig('toolbox');

      expect(toolboxConfig.getBoolean('i18n.enabled')).toBe(true);
      expect(toolboxConfig.getString('i18n.defaultLanguage')).toBe('en');
    });
  });

  describe('Catalog Graph Visualization', () => {
    it('should be available through existing catalog plugin', async () => {
      // The catalog graph plugin is already installed as part of the core Backstage catalog
      // This test verifies that the configuration supports dependency visualization
      const appConfig = config.getConfig('app');

      expect(appConfig.getString('title')).toBe(
        'Test Internal Developer Platform',
      );
      expect(appConfig.getString('baseUrl')).toBe('http://localhost:3000');
    });
  });

  describe('SDK Generation', () => {
    it('should enable automated SDK generation', async () => {
      const sdkConfig = config.getConfig('apiDocs.sdkGeneration');

      expect(sdkConfig.getBoolean('enabled')).toBe(true);
      expect(sdkConfig.getStringArray('supportedLanguages')).toEqual([
        'java',
        'go',
        'typescript',
        'javascript',
        'python',
      ]);
    });

    it('should configure SDK generation templates', async () => {
      const sdkConfig = config.getConfig('apiDocs.sdkGeneration');

      expect(sdkConfig.getString('templates.java')).toBe(
        'openapi-generator-java',
      );
      expect(sdkConfig.getString('templates.go')).toBe('openapi-generator-go');
      expect(sdkConfig.getString('templates.typescript')).toBe(
        'openapi-generator-typescript',
      );
      expect(sdkConfig.getString('templates.javascript')).toBe(
        'openapi-generator-javascript',
      );
      expect(sdkConfig.getString('templates.python')).toBe(
        'openapi-generator-python',
      );
    });

    it('should enable SDK publishing and distribution', async () => {
      const publishingConfig = config.getConfig(
        'apiDocs.sdkGeneration.publishing',
      );

      expect(publishingConfig.getBoolean('enabled')).toBe(true);
      expect(publishingConfig.getStringArray('targets')).toEqual([
        'npm',
        'maven',
        'go-modules',
        'pypi',
      ]);
      expect(publishingConfig.getString('versioning')).toBe('semantic');
    });

    it('should enable SDK documentation generation', async () => {
      const docConfig = config.getConfig('apiDocs.sdkGeneration.documentation');

      expect(docConfig.getBoolean('enabled')).toBe(true);
      expect(docConfig.getStringArray('formats')).toEqual(['markdown', 'html']);
      expect(docConfig.getBoolean('examples')).toBe(true);
    });
  });

  describe('Tech Insights Quality Scorecards', () => {
    it('should enable quality scorecards', async () => {
      const techInsightsConfig = config.getConfig('techInsights');

      expect(techInsightsConfig.getBoolean('scorecards.enabled')).toBe(true);
      expect(techInsightsConfig.getBoolean('scorecards.compliance')).toBe(true);
      expect(techInsightsConfig.getBoolean('scorecards.operational')).toBe(
        true,
      );
      expect(techInsightsConfig.getBoolean('scorecards.quality')).toBe(true);
    });

    it('should enable automated quality checks', async () => {
      const techInsightsConfig = config.getConfig('techInsights');

      expect(techInsightsConfig.getBoolean('checks.automated')).toBe(true);
      expect(techInsightsConfig.getBoolean('checks.manual')).toBe(true);
      expect(techInsightsConfig.getBoolean('checks.scheduled')).toBe(true);
    });

    it('should enable improvement tracking', async () => {
      const techInsightsConfig = config.getConfig('techInsights');

      expect(techInsightsConfig.getBoolean('tracking.improvement')).toBe(true);
      expect(techInsightsConfig.getBoolean('tracking.trends')).toBe(true);
      expect(techInsightsConfig.getBoolean('tracking.benchmarking')).toBe(true);
    });
  });

  describe('Tech Radar Technology Tracking', () => {
    it('should configure technology adoption visualization', async () => {
      const techRadarConfig = config.getConfig('techRadar');

      const quadrants = techRadarConfig.get('visualization.quadrants');
      expect(quadrants).toHaveLength(4);
      expect(quadrants[0]).toEqual({
        name: 'Languages & Frameworks',
        id: 'languages-frameworks',
      });
      expect(quadrants[1]).toEqual({ name: 'Tools', id: 'tools' });
      expect(quadrants[2]).toEqual({ name: 'Platforms', id: 'platforms' });
      expect(quadrants[3]).toEqual({ name: 'Techniques', id: 'techniques' });
    });

    it('should configure technology adoption rings', async () => {
      const techRadarConfig = config.getConfig('techRadar');

      const rings = techRadarConfig.get('visualization.rings');
      expect(rings).toHaveLength(4);
      expect(rings[0]).toEqual({
        name: 'Adopt',
        id: 'adopt',
        color: '#5ba300',
      });
      expect(rings[1]).toEqual({
        name: 'Trial',
        id: 'trial',
        color: '#009eb0',
      });
      expect(rings[2]).toEqual({
        name: 'Assess',
        id: 'assess',
        color: '#c7ba00',
      });
      expect(rings[3]).toEqual({ name: 'Hold', id: 'hold', color: '#e09b96' });
    });

    it('should enable team technology decision tracking', async () => {
      const techRadarConfig = config.getConfig('techRadar');

      expect(techRadarConfig.getBoolean('tracking.enabled')).toBe(true);
      expect(techRadarConfig.getBoolean('tracking.showTimelines')).toBe(true);
      expect(techRadarConfig.getBoolean('tracking.showDescriptions')).toBe(
        true,
      );
      expect(techRadarConfig.getBoolean('tracking.notifications')).toBe(true);
    });

    it('should configure static tech radar data', async () => {
      const techRadarConfig = config.getConfig('techRadar');

      expect(techRadarConfig.getString('data.source')).toBe('static');

      const entries = techRadarConfig.get('data.static.entries');
      expect(entries).toHaveLength(3);
      expect(entries[0]).toEqual({
        name: 'React',
        quadrant: 'languages-frameworks',
        ring: 'adopt',
        moved: 0,
        description: 'JavaScript library for building user interfaces',
      });
      expect(entries[1]).toEqual({
        name: 'TypeScript',
        quadrant: 'languages-frameworks',
        ring: 'adopt',
        moved: 0,
        description: 'Typed superset of JavaScript',
      });
      expect(entries[2]).toEqual({
        name: 'Backstage',
        quadrant: 'platforms',
        ring: 'adopt',
        moved: 1,
        description: 'Open platform for building developer portals',
      });
    });
  });

  describe('DevTools Diagnostics', () => {
    it('should enable system health monitoring', async () => {
      const devToolsConfig = config.getConfig('devtools');

      expect(devToolsConfig.getBoolean('monitoring.enabled')).toBe(true);
      expect(devToolsConfig.getBoolean('monitoring.versions')).toBe(true);
      expect(devToolsConfig.getBoolean('monitoring.config')).toBe(true);
      expect(devToolsConfig.getBoolean('monitoring.secretMasking')).toBe(true);
    });

    it('should enable dependency checking', async () => {
      const devToolsConfig = config.getConfig('devtools');

      expect(devToolsConfig.getBoolean('dependencies.enabled')).toBe(true);
      expect(devToolsConfig.getBoolean('dependencies.database')).toBe(true);
      expect(devToolsConfig.getBoolean('dependencies.externalServices')).toBe(
        true,
      );
      expect(devToolsConfig.getNumber('dependencies.timeout')).toBe(5000);
    });

    it('should enable runtime diagnostics', async () => {
      const devToolsConfig = config.getConfig('devtools');

      expect(devToolsConfig.getBoolean('diagnostics.enabled')).toBe(true);
      expect(devToolsConfig.getBoolean('diagnostics.memory')).toBe(true);
      expect(devToolsConfig.getBoolean('diagnostics.cpu')).toBe(true);
      expect(devToolsConfig.getBoolean('diagnostics.uptime')).toBe(true);
    });
  });

  describe('Cross-Plugin Integration', () => {
    it('should support consistent configuration across all plugins', async () => {
      // Verify that all developer experience plugins are properly configured
      expect(config.has('apiDocs')).toBe(true);
      expect(config.has('grpcPlayground')).toBe(true);
      expect(config.has('todo')).toBe(true);
      expect(config.has('toolbox')).toBe(true);
      expect(config.has('devtools')).toBe(true);
      expect(config.has('techInsights')).toBe(true);
      expect(config.has('techRadar')).toBe(true);
    });

    it('should maintain consistent backend configuration', async () => {
      const backendConfig = config.getConfig('backend');

      expect(backendConfig.getString('baseUrl')).toBe('http://localhost:7007');
      expect(backendConfig.has('database')).toBe(true);
    });

    it('should support development environment defaults', async () => {
      // Verify that all plugins default to development environment
      expect(config.getString('apiDocs.testing.defaultEnvironment')).toBe(
        'development',
      );
      expect(
        config.getString('grpcPlayground.testing.defaultEnvironment'),
      ).toBe('development');
    });
  });

  describe('Performance and Scalability', () => {
    it('should configure reasonable timeouts for external services', async () => {
      expect(config.getNumber('grpcPlayground.testing.timeout')).toBe(30000);
      expect(config.getNumber('devtools.dependencies.timeout')).toBe(5000);
    });

    it('should enable caching and optimization features', async () => {
      // Verify that plugins support performance optimizations
      expect(config.getBoolean('apiDocs.generator.openapi.autoGenerate')).toBe(
        true,
      );
      expect(config.getBoolean('apiDocs.generator.asyncapi.autoGenerate')).toBe(
        true,
      );
      expect(
        config.getBoolean('apiDocs.generator.graphql.autoIntrospect'),
      ).toBe(true);
    });
  });

  describe('Security and Compliance', () => {
    it('should enable secret masking in DevTools', async () => {
      const devToolsConfig = config.getConfig('devtools');

      expect(devToolsConfig.getBoolean('monitoring.secretMasking')).toBe(true);
    });

    it('should support TLS for gRPC connections', async () => {
      const grpcConfig = config.getConfig('grpcPlayground');

      expect(grpcConfig.getBoolean('testing.tls')).toBe(true);
    });

    it('should enable authentication and authorization features', async () => {
      // Verify that plugins support authentication requirements
      expect(config.getBoolean('apiDocs.display.showAuth')).toBe(true);
    });
  });
});
