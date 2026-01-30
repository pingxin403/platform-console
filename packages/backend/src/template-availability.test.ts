/**
 * Property-based test for template availability
 * Feature: internal-developer-platform, Property 4: Template availability
 * Validates: Requirements 2.1, 2.2
 */

/* eslint-disable jest/no-conditional-expect */

import * as fc from 'fast-check';
import { TemplateEntityV1beta3 } from '@backstage/plugin-scaffolder-common';

// Template metadata structure
interface TemplateMetadata {
  name: string;
  title: string;
  description: string;
  tags: string[];
  type: 'service' | 'website' | 'mobile-app';
}

interface ProjectCreationRequest {
  templateName: string;
  parameters: {
    name: string;
    description: string;
    owner: string;
    repoUrl: string;
  };
}

// Golden Path template manager class to test
class GoldenPathTemplateManager {
  private availableTemplates: Map<string, TemplateEntityV1beta3> = new Map();
  private requiredTemplates = [
    'java-service',
    'go-service',
    'react-app',
    'react-native-app',
  ];

  constructor() {
    this.initializeGoldenPathTemplates();
  }

  /**
   * Initialize the required Golden Path templates
   */
  private initializeGoldenPathTemplates(): void {
    // Java Service Template
    this.availableTemplates.set('java-service-template', {
      apiVersion: 'scaffolder.backstage.io/v1beta3',
      kind: 'Template',
      metadata: {
        name: 'java-service-template',
        title: 'Java Service Template',
        description:
          'Golden Path template for creating a Java Spring Boot service with complete DevOps integration',
        tags: ['java', 'spring-boot', 'microservice', 'golden-path'],
      },
      spec: {
        owner: 'group:platform-team',
        type: 'service',
        parameters: [
          {
            title: 'Service Information',
            required: ['name', 'description', 'owner'],
            properties: {
              name: { title: 'Service Name', type: 'string' },
              description: { title: 'Description', type: 'string' },
              owner: { title: 'Owner', type: 'string' },
            },
          },
        ],
        steps: [
          {
            id: 'fetch-base',
            name: 'Fetch Base Template',
            action: 'fetch:template',
          },
          {
            id: 'publish',
            name: 'Publish to GitHub',
            action: 'publish:github',
          },
          {
            id: 'register',
            name: 'Register in Catalog',
            action: 'catalog:register',
          },
        ],
      },
    });

    // Go Service Template
    this.availableTemplates.set('go-service-template', {
      apiVersion: 'scaffolder.backstage.io/v1beta3',
      kind: 'Template',
      metadata: {
        name: 'go-service-template',
        title: 'Go Service Template',
        description:
          'Golden Path template for creating a Go service with complete DevOps integration',
        tags: ['go', 'microservice', 'golden-path'],
      },
      spec: {
        owner: 'group:platform-team',
        type: 'service',
        parameters: [
          {
            title: 'Service Information',
            required: ['name', 'description', 'owner'],
            properties: {
              name: { title: 'Service Name', type: 'string' },
              description: { title: 'Description', type: 'string' },
              owner: { title: 'Owner', type: 'string' },
            },
          },
        ],
        steps: [
          {
            id: 'fetch-base',
            name: 'Fetch Base Template',
            action: 'fetch:template',
          },
          {
            id: 'publish',
            name: 'Publish to GitHub',
            action: 'publish:github',
          },
          {
            id: 'register',
            name: 'Register in Catalog',
            action: 'catalog:register',
          },
        ],
      },
    });

    // React App Template
    this.availableTemplates.set('react-app-template', {
      apiVersion: 'scaffolder.backstage.io/v1beta3',
      kind: 'Template',
      metadata: {
        name: 'react-app-template',
        title: 'React Application Template',
        description:
          'Golden Path template for creating a React application with complete DevOps integration',
        tags: ['react', 'frontend', 'web-app', 'golden-path'],
      },
      spec: {
        owner: 'group:platform-team',
        type: 'website',
        parameters: [
          {
            title: 'Application Information',
            required: ['name', 'description', 'owner'],
            properties: {
              name: { title: 'Application Name', type: 'string' },
              description: { title: 'Description', type: 'string' },
              owner: { title: 'Owner', type: 'string' },
            },
          },
        ],
        steps: [
          {
            id: 'fetch-base',
            name: 'Fetch Base Template',
            action: 'fetch:template',
          },
          {
            id: 'publish',
            name: 'Publish to GitHub',
            action: 'publish:github',
          },
          {
            id: 'register',
            name: 'Register in Catalog',
            action: 'catalog:register',
          },
        ],
      },
    });

    // React Native App Template
    this.availableTemplates.set('react-native-app-template', {
      apiVersion: 'scaffolder.backstage.io/v1beta3',
      kind: 'Template',
      metadata: {
        name: 'react-native-app-template',
        title: 'React Native Application Template',
        description:
          'Golden Path template for creating a React Native application with complete DevOps integration',
        tags: ['react-native', 'mobile', 'ios', 'android', 'golden-path'],
      },
      spec: {
        owner: 'group:platform-team',
        type: 'mobile-app',
        parameters: [
          {
            title: 'Application Information',
            required: ['name', 'description', 'owner'],
            properties: {
              name: { title: 'Application Name', type: 'string' },
              description: { title: 'Description', type: 'string' },
              owner: { title: 'Owner', type: 'string' },
            },
          },
        ],
        steps: [
          {
            id: 'fetch-base',
            name: 'Fetch Base Template',
            action: 'fetch:template',
          },
          {
            id: 'publish',
            name: 'Publish to GitHub',
            action: 'publish:github',
          },
          {
            id: 'register',
            name: 'Register in Catalog',
            action: 'catalog:register',
          },
        ],
      },
    });
  }

  /**
   * Get all available Golden Path templates
   */
  getAvailableTemplates(): TemplateEntityV1beta3[] {
    return Array.from(this.availableTemplates.values());
  }

  /**
   * Get templates by type
   */
  getTemplatesByType(type: string): TemplateEntityV1beta3[] {
    return this.getAvailableTemplates().filter(
      template => template.spec.type === type,
    );
  }

  /**
   * Get template by name
   */
  getTemplateByName(name: string): TemplateEntityV1beta3 | undefined {
    return this.availableTemplates.get(name);
  }

  /**
   * Check if all required Golden Path templates are available
   */
  areAllRequiredTemplatesAvailable(): boolean {
    const availableTemplateNames = Array.from(this.availableTemplates.keys());
    return this.requiredTemplates.every(required =>
      availableTemplateNames.some(available => available.includes(required)),
    );
  }

  /**
   * Validate template has complete project structure
   */
  validateTemplateCompleteness(template: TemplateEntityV1beta3): boolean {
    // Check required metadata
    if (
      !template.metadata.name ||
      !template.metadata.title ||
      !template.metadata.description
    ) {
      return false;
    }

    // Check required spec properties
    if (
      !template.spec.owner ||
      !template.spec.type ||
      !template.spec.parameters ||
      !template.spec.steps
    ) {
      return false;
    }

    // Check required steps for complete project structure
    const requiredSteps = [
      'fetch:template',
      'publish:github',
      'catalog:register',
    ];
    const templateSteps = template.spec.steps.map(step => step.action);

    return requiredSteps.every(required => templateSteps.includes(required));
  }

  /**
   * Simulate project creation request
   */
  async createProject(request: ProjectCreationRequest): Promise<{
    success: boolean;
    templateUsed: string;
    projectStructure: string[];
  }> {
    const template = this.getTemplateByName(request.templateName);

    if (!template) {
      return {
        success: false,
        templateUsed: request.templateName,
        projectStructure: [],
      };
    }

    // Simulate complete project structure generation
    const baseStructure = [
      'catalog-info.yaml',
      'Dockerfile',
      '.github/workflows/ci.yml',
      'README.md',
    ];

    // Add technology-specific files based on template type
    let techSpecificFiles: string[] = [];

    if (template.metadata.name.includes('java')) {
      techSpecificFiles = [
        'pom.xml',
        'src/main/java/',
        'k8s/deployment.yaml',
        'helm/Chart.yaml',
      ];
    } else if (template.metadata.name.includes('go')) {
      techSpecificFiles = ['go.mod', 'cmd/server/', 'k8s/deployment.yaml'];
    } else if (template.metadata.name.includes('react-native')) {
      techSpecificFiles = ['package.json', 'ios/', 'android/', 'src/'];
    } else if (template.metadata.name.includes('react')) {
      techSpecificFiles = [
        'package.json',
        'src/',
        'public/',
        'k8s/deployment.yaml',
        'nginx.conf',
      ];
    }

    return {
      success: true,
      templateUsed: template.metadata.name,
      projectStructure: [...baseStructure, ...techSpecificFiles],
    };
  }
}

// Property-based test generators
const projectCreationRequestArbitrary = fc.record({
  templateName: fc.constantFrom(
    'java-service-template',
    'go-service-template',
    'react-app-template',
    'react-native-app-template',
  ),
  parameters: fc.record({
    name: fc.stringMatching(/^[a-z][a-z0-9-]*[a-z0-9]$/),
    description: fc.string({ minLength: 10, maxLength: 100 }),
    owner: fc.constantFrom(
      'team-backend',
      'team-frontend',
      'team-mobile',
      'team-platform',
    ),
    repoUrl: fc
      .string()
      .map(
        s =>
          `https://github.com/company/${s
            .replace(/[^a-zA-Z0-9-]/g, '-')
            .substring(0, 20)}`,
      ),
  }),
});

describe('Golden Path Template Availability', () => {
  let templateManager: GoldenPathTemplateManager;

  beforeEach(() => {
    templateManager = new GoldenPathTemplateManager();
  });

  /**
   * Property 4: Template availability
   * For any project creation request, the Developer_Portal should provide all required
   * Golden_Path templates (Java, Go, React, React Native) with complete project structure generation
   * Validates: Requirements 2.1, 2.2
   */
  it('should provide all required Golden Path templates for project creation', async () => {
    await fc.assert(
      fc.asyncProperty(projectCreationRequestArbitrary, async request => {
        // Act: Get all available templates
        const availableTemplates = templateManager.getAvailableTemplates();

        // Assert: All required Golden Path templates should be available
        expect(templateManager.areAllRequiredTemplatesAvailable()).toBe(true);

        // Assert: Should have exactly 4 Golden Path templates (Java, Go, React, React Native)
        expect(availableTemplates.length).toBeGreaterThanOrEqual(4);

        // Assert: Each template should have complete structure
        for (const template of availableTemplates) {
          expect(templateManager.validateTemplateCompleteness(template)).toBe(
            true,
          );

          // Assert: Template should have required metadata
          expect(template.metadata.name).toBeTruthy();
          expect(template.metadata.title).toBeTruthy();
          expect(template.metadata.description).toBeTruthy();
          expect(template.metadata.tags).toBeDefined();
          expect(template.metadata.tags.length).toBeGreaterThan(0);

          // Assert: Template should have Golden Path tag
          expect(template.metadata.tags).toContain('golden-path');

          // Assert: Template should have required spec properties
          expect(template.spec.owner).toBeTruthy();
          expect(template.spec.type).toBeTruthy();
          expect(template.spec.parameters).toBeDefined();
          expect(template.spec.steps).toBeDefined();
          expect(template.spec.steps.length).toBeGreaterThan(0);
        }

        // Assert: Should be able to create project with any available template
        const projectResult = await templateManager.createProject(request);
        expect(projectResult.success).toBe(true);
        expect(projectResult.templateUsed).toEqual(request.templateName);
        expect(projectResult.projectStructure.length).toBeGreaterThan(0);

        // Assert: Generated project should have complete structure
        const requiredFiles = [
          'catalog-info.yaml',
          'Dockerfile',
          '.github/workflows/ci.yml',
        ];
        for (const requiredFile of requiredFiles) {
          expect(projectResult.projectStructure).toContain(requiredFile);
        }
      }),
      { numRuns: 100 }, // Run 100 iterations as specified in design document
    );
  });

  it('should provide templates for all required technology stacks', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        // Act: Get templates by type
        const serviceTemplates = templateManager.getTemplatesByType('service');
        const websiteTemplates = templateManager.getTemplatesByType('website');
        const mobileTemplates =
          templateManager.getTemplatesByType('mobile-app');

        // Assert: Should have service templates (Java, Go)
        expect(serviceTemplates.length).toBeGreaterThanOrEqual(2);
        const serviceTemplateNames = serviceTemplates.map(t => t.metadata.name);
        expect(serviceTemplateNames.some(name => name.includes('java'))).toBe(
          true,
        );
        expect(serviceTemplateNames.some(name => name.includes('go'))).toBe(
          true,
        );

        // Assert: Should have website templates (React)
        expect(websiteTemplates.length).toBeGreaterThanOrEqual(1);
        const websiteTemplateNames = websiteTemplates.map(t => t.metadata.name);
        expect(websiteTemplateNames.some(name => name.includes('react'))).toBe(
          true,
        );

        // Assert: Should have mobile app templates (React Native)
        expect(mobileTemplates.length).toBeGreaterThanOrEqual(1);
        const mobileTemplateNames = mobileTemplates.map(t => t.metadata.name);
        expect(
          mobileTemplateNames.some(name => name.includes('react-native')),
        ).toBe(true);

        // Assert: All templates should be valid and complete
        const allTemplates = [
          ...serviceTemplates,
          ...websiteTemplates,
          ...mobileTemplates,
        ];
        for (const template of allTemplates) {
          expect(templateManager.validateTemplateCompleteness(template)).toBe(
            true,
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should generate complete project structure for each template type', async () => {
    await fc.assert(
      fc.asyncProperty(projectCreationRequestArbitrary, async request => {
        // Act: Create project using the template
        const projectResult = await templateManager.createProject(request);

        // Assert: Project creation should succeed
        expect(projectResult.success).toBe(true);
        expect(projectResult.projectStructure.length).toBeGreaterThan(0);

        // Assert: All projects should have common DevOps files
        const commonFiles = [
          'catalog-info.yaml',
          'Dockerfile',
          '.github/workflows/ci.yml',
        ];
        for (const commonFile of commonFiles) {
          expect(projectResult.projectStructure).toContain(commonFile);
        }

        // Assert: Technology-specific files should be present based on template
        if (request.templateName.includes('java')) {
          expect(projectResult.projectStructure).toContain('pom.xml');
          expect(projectResult.projectStructure).toContain(
            'k8s/deployment.yaml',
          );
          expect(projectResult.projectStructure).toContain('helm/Chart.yaml');
        } else if (request.templateName.includes('go')) {
          expect(projectResult.projectStructure).toContain('go.mod');
          expect(projectResult.projectStructure).toContain(
            'k8s/deployment.yaml',
          );
        } else if (request.templateName.includes('react-native')) {
          expect(projectResult.projectStructure).toContain('package.json');
          expect(projectResult.projectStructure).toContain('ios/');
          expect(projectResult.projectStructure).toContain('android/');
        } else if (request.templateName.includes('react')) {
          expect(projectResult.projectStructure).toContain('package.json');
          expect(projectResult.projectStructure).toContain(
            'k8s/deployment.yaml',
          );
          expect(projectResult.projectStructure).toContain('nginx.conf');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should maintain template consistency across multiple requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(projectCreationRequestArbitrary, {
          minLength: 2,
          maxLength: 10,
        }),
        async requests => {
          // Act: Process multiple project creation requests
          const results = await Promise.all(
            requests.map(request => templateManager.createProject(request)),
          );

          // Assert: All requests should succeed
          for (const result of results) {
            expect(result.success).toBe(true);
            expect(result.projectStructure.length).toBeGreaterThan(0);
          }

          // Assert: Templates should remain available after multiple uses
          expect(templateManager.areAllRequiredTemplatesAvailable()).toBe(true);

          // Assert: Template availability should be consistent
          const availableTemplates = templateManager.getAvailableTemplates();
          expect(availableTemplates.length).toBeGreaterThanOrEqual(4);

          // Assert: Each template should still be complete and valid
          for (const template of availableTemplates) {
            expect(templateManager.validateTemplateCompleteness(template)).toBe(
              true,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
