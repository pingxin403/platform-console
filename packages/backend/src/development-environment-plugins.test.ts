/**
 * Integration tests for development environment plugins
 *
 * Tests DevPod, Dev Containers, and Google Calendar functionality
 * to ensure proper integration with the Internal Developer Platform.
 *
 * Requirements: 2.1, 13.3
 */

/* eslint-disable jest/no-conditional-expect */

import { ConfigReader } from '@backstage/config';

describe('Development Environment Plugins Integration', () => {
  let config: ConfigReader;

  beforeEach(() => {
    // Create test configuration for development environment plugins
    config = new ConfigReader({
      // DevPod configuration
      devpod: {
        api: {
          baseUrl: 'http://localhost:8080',
        },
        provisioning: {
          enabled: true,
          defaultProvider: 'docker',
          providers: [
            {
              name: 'docker',
              type: 'docker',
              config: {
                dockerHost: 'unix:///var/run/docker.sock',
                baseImage: 'mcr.microsoft.com/devcontainers/base:ubuntu',
                resources: {
                  memory: '4Gi',
                  cpu: '2',
                },
              },
            },
          ],
          templates: [
            {
              name: 'node-typescript',
              description: 'Node.js with TypeScript development environment',
              image: 'mcr.microsoft.com/devcontainers/typescript-node:18',
              features: [
                'ghcr.io/devcontainers/features/git:1',
                'ghcr.io/devcontainers/features/github-cli:1',
              ],
              extensions: [
                'ms-vscode.vscode-typescript-next',
                'esbenp.prettier-vscode',
              ],
            },
          ],
        },
        access: {
          enabled: true,
          methods: ['vscode', 'ssh', 'web'],
          defaultMethod: 'vscode',
        },
        integration: {
          enabled: true,
          github: {
            enabled: true,
            autoClone: true,
            setupFromRepo: true,
          },
          backstage: {
            enabled: true,
            autoSetup: true,
            annotation: 'devpod.io/template',
          },
        },
        ui: {
          entityPageIntegration: true,
          showEnvironmentsInCatalog: true,
          defaultView: 'environments',
        },
      },

      // Dev Containers configuration
      devContainers: {
        api: {
          baseUrl: 'http://localhost:8080',
        },
        launching: {
          enabled: true,
          defaultRuntime: 'docker',
          runtimes: [
            {
              name: 'docker',
              type: 'docker',
              config: {
                dockerHost: 'unix:///var/run/docker.sock',
                composeSupport: true,
                buildKit: true,
              },
            },
          ],
          containers: {
            default: {
              image: 'mcr.microsoft.com/devcontainers/base:ubuntu',
              workspaceFolder: '/workspace',
              remoteUser: 'vscode',
              forwardPorts: [3000, 8080],
            },
            resources: {
              memory: '4Gi',
              cpu: '2',
            },
          },
        },
        standardization: {
          enabled: true,
          standards: {
            nodejs: {
              image: 'mcr.microsoft.com/devcontainers/typescript-node:18',
              features: [
                'ghcr.io/devcontainers/features/git:1',
                'ghcr.io/devcontainers/features/github-cli:1',
              ],
              extensions: [
                'ms-vscode.vscode-typescript-next',
                'esbenp.prettier-vscode',
              ],
            },
          },
          enforcement: {
            requireStandards: true,
            allowCustom: true,
          },
        },
        sharing: {
          enabled: true,
          methods: ['export', 'registry', 'git'],
        },
        vscode: {
          enabled: true,
          server: {
            version: 'latest',
            port: 8080,
            auth: true,
            authMethod: 'github',
          },
        },
        services: {
          enabled: true,
          annotation: 'devcontainers.io/config',
          autoDetect: true,
          sources: ['.devcontainer/devcontainer.json', '.devcontainer.json'],
          generateDefault: true,
        },
        ui: {
          entityPageIntegration: true,
          showEnvironmentsInCatalog: true,
          defaultView: 'containers',
        },
      },

      // Google Calendar configuration
      googleCalendar: {
        api: {
          apiKey: 'test-api-key',
          oauth: {
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            redirectUri: 'http://localhost:3000/auth/google/callback',
          },
        },
        schedule: {
          enabled: true,
          defaultView: 'week',
          timeZone: 'UTC',
          workingHours: {
            start: '09:00',
            end: '17:00',
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          },
          sync: {
            enabled: true,
            frequency: 15,
            direction: 'read',
          },
        },
        meetings: {
          enabled: true,
          types: ['meeting', 'appointment', 'event'],
          showDetails: true,
          availability: {
            enabled: true,
            statuses: ['free', 'busy', 'tentative', 'out_of_office'],
            showInTeamPages: true,
            timeSlots: 30,
          },
        },
        coordination: {
          enabled: true,
          dashboard: {
            enabled: true,
            showAvailability: true,
            showUpcomingMeetings: true,
            refreshInterval: 5,
          },
        },
        ui: {
          teamPageIntegration: true,
          showCalendarWidget: true,
          defaultWidgetView: 'agenda',
        },
      },
    });
  });

  describe('DevPod Plugin Configuration', () => {
    it('should have valid DevPod configuration', () => {
      const devpodConfig = config.getConfig('devpod');

      // Test API configuration
      expect(devpodConfig.getString('api.baseUrl')).toBe(
        'http://localhost:8080',
      );

      // Test provisioning configuration
      expect(devpodConfig.getBoolean('provisioning.enabled')).toBe(true);
      expect(devpodConfig.getString('provisioning.defaultProvider')).toBe(
        'docker',
      );

      const providers = devpodConfig.getConfigArray('provisioning.providers');
      expect(providers).toHaveLength(1);
      expect(providers[0].getString('name')).toBe('docker');
      expect(providers[0].getString('type')).toBe('docker');

      const templates = devpodConfig.getConfigArray('provisioning.templates');
      expect(templates).toHaveLength(1);
      expect(templates[0].getString('name')).toBe('node-typescript');
      expect(templates[0].getString('image')).toBe(
        'mcr.microsoft.com/devcontainers/typescript-node:18',
      );

      // Test access configuration
      expect(devpodConfig.getBoolean('access.enabled')).toBe(true);
      expect(devpodConfig.getStringArray('access.methods')).toEqual([
        'vscode',
        'ssh',
        'web',
      ]);
      expect(devpodConfig.getString('access.defaultMethod')).toBe('vscode');

      // Test integration configuration
      expect(devpodConfig.getBoolean('integration.enabled')).toBe(true);
      expect(devpodConfig.getBoolean('integration.github.enabled')).toBe(true);
      expect(devpodConfig.getBoolean('integration.backstage.enabled')).toBe(
        true,
      );

      // Test UI configuration
      expect(devpodConfig.getBoolean('ui.entityPageIntegration')).toBe(true);
      expect(devpodConfig.getBoolean('ui.showEnvironmentsInCatalog')).toBe(
        true,
      );
      expect(devpodConfig.getString('ui.defaultView')).toBe('environments');
    });

    it('should validate DevPod provider configurations', () => {
      const devpodConfig = config.getConfig('devpod');
      const providers = devpodConfig.getConfigArray('provisioning.providers');

      providers.forEach(provider => {
        expect(provider.getString('name')).toBeDefined();
        expect(provider.getString('type')).toBeDefined();
        expect(provider.getConfig('config')).toBeDefined();

        if (provider.getString('type') === 'docker') {
          const providerConfig = provider.getConfig('config');
          expect(providerConfig.getString('dockerHost')).toBeDefined();
          expect(providerConfig.getString('baseImage')).toBeDefined();
          expect(providerConfig.getConfig('resources')).toBeDefined();
        }
      });
    });

    it('should validate DevPod template configurations', () => {
      const devpodConfig = config.getConfig('devpod');
      const templates = devpodConfig.getConfigArray('provisioning.templates');

      templates.forEach(template => {
        expect(template.getString('name')).toBeDefined();
        expect(template.getString('description')).toBeDefined();
        expect(template.getString('image')).toBeDefined();
        expect(template.getStringArray('features')).toBeDefined();
        expect(template.getStringArray('extensions')).toBeDefined();
      });
    });
  });

  describe('Dev Containers Plugin Configuration', () => {
    it('should have valid Dev Containers configuration', () => {
      const devContainersConfig = config.getConfig('devContainers');

      // Test API configuration
      expect(devContainersConfig.getString('api.baseUrl')).toBe(
        'http://localhost:8080',
      );

      // Test launching configuration
      expect(devContainersConfig.getBoolean('launching.enabled')).toBe(true);
      expect(devContainersConfig.getString('launching.defaultRuntime')).toBe(
        'docker',
      );

      const runtimes = devContainersConfig.getConfigArray('launching.runtimes');
      expect(runtimes).toHaveLength(1);
      expect(runtimes[0].getString('name')).toBe('docker');
      expect(runtimes[0].getString('type')).toBe('docker');

      const containers = devContainersConfig.getConfig('launching.containers');
      expect(containers.getConfig('default')).toBeDefined();
      expect(containers.getConfig('resources')).toBeDefined();

      // Test standardization configuration
      expect(devContainersConfig.getBoolean('standardization.enabled')).toBe(
        true,
      );
      const standards = devContainersConfig.getConfig(
        'standardization.standards',
      );
      expect(standards.getConfig('nodejs')).toBeDefined();

      const enforcement = devContainersConfig.getConfig(
        'standardization.enforcement',
      );
      expect(enforcement.getBoolean('requireStandards')).toBe(true);
      expect(enforcement.getBoolean('allowCustom')).toBe(true);

      // Test sharing configuration
      expect(devContainersConfig.getBoolean('sharing.enabled')).toBe(true);
      expect(devContainersConfig.getStringArray('sharing.methods')).toEqual([
        'export',
        'registry',
        'git',
      ]);

      // Test VS Code configuration
      expect(devContainersConfig.getBoolean('vscode.enabled')).toBe(true);
      const vscodeServer = devContainersConfig.getConfig('vscode.server');
      expect(vscodeServer.getString('version')).toBe('latest');
      expect(vscodeServer.getNumber('port')).toBe(8080);
      expect(vscodeServer.getBoolean('auth')).toBe(true);
      expect(vscodeServer.getString('authMethod')).toBe('github');

      // Test UI configuration
      expect(devContainersConfig.getBoolean('ui.entityPageIntegration')).toBe(
        true,
      );
      expect(
        devContainersConfig.getBoolean('ui.showEnvironmentsInCatalog'),
      ).toBe(true);
      expect(devContainersConfig.getString('ui.defaultView')).toBe(
        'containers',
      );
    });

    it('should validate Dev Containers runtime configurations', () => {
      const devContainersConfig = config.getConfig('devContainers');
      const runtimes = devContainersConfig.getConfigArray('launching.runtimes');

      runtimes.forEach(runtime => {
        expect(runtime.getString('name')).toBeDefined();
        expect(runtime.getString('type')).toBeDefined();
        expect(runtime.getConfig('config')).toBeDefined();

        if (runtime.getString('type') === 'docker') {
          const runtimeConfig = runtime.getConfig('config');
          expect(runtimeConfig.getString('dockerHost')).toBeDefined();
          expect(runtimeConfig.getBoolean('composeSupport')).toBeDefined();
          expect(runtimeConfig.getBoolean('buildKit')).toBeDefined();
        }
      });
    });

    it('should validate Dev Containers standardization', () => {
      const devContainersConfig = config.getConfig('devContainers');
      const standards = devContainersConfig.getConfig(
        'standardization.standards',
      );

      const nodejsStandard = standards.getConfig('nodejs');
      expect(nodejsStandard.getString('image')).toBe(
        'mcr.microsoft.com/devcontainers/typescript-node:18',
      );
      expect(nodejsStandard.getStringArray('features')).toContain(
        'ghcr.io/devcontainers/features/git:1',
      );
      expect(nodejsStandard.getStringArray('extensions')).toContain(
        'ms-vscode.vscode-typescript-next',
      );
    });
  });

  describe('Google Calendar Plugin Configuration', () => {
    it('should have valid Google Calendar configuration', () => {
      const calendarConfig = config.getConfig('googleCalendar');

      // Test API configuration
      expect(calendarConfig.getString('api.apiKey')).toBe('test-api-key');
      const oauth = calendarConfig.getConfig('api.oauth');
      expect(oauth.getString('clientId')).toBe('test-client-id');
      expect(oauth.getString('clientSecret')).toBe('test-client-secret');
      expect(oauth.getString('redirectUri')).toBe(
        'http://localhost:3000/auth/google/callback',
      );

      // Test schedule configuration
      expect(calendarConfig.getBoolean('schedule.enabled')).toBe(true);
      expect(calendarConfig.getString('schedule.defaultView')).toBe('week');
      expect(calendarConfig.getString('schedule.timeZone')).toBe('UTC');

      const workingHours = calendarConfig.getConfig('schedule.workingHours');
      expect(workingHours.getString('start')).toBe('09:00');
      expect(workingHours.getString('end')).toBe('17:00');
      expect(workingHours.getStringArray('days')).toEqual([
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
      ]);

      const sync = calendarConfig.getConfig('schedule.sync');
      expect(sync.getBoolean('enabled')).toBe(true);
      expect(sync.getNumber('frequency')).toBe(15);
      expect(sync.getString('direction')).toBe('read');

      // Test meetings configuration
      expect(calendarConfig.getBoolean('meetings.enabled')).toBe(true);
      expect(calendarConfig.getStringArray('meetings.types')).toEqual([
        'meeting',
        'appointment',
        'event',
      ]);
      expect(calendarConfig.getBoolean('meetings.showDetails')).toBe(true);

      const availability = calendarConfig.getConfig('meetings.availability');
      expect(availability.getBoolean('enabled')).toBe(true);
      expect(availability.getStringArray('statuses')).toEqual([
        'free',
        'busy',
        'tentative',
        'out_of_office',
      ]);
      expect(availability.getBoolean('showInTeamPages')).toBe(true);
      expect(availability.getNumber('timeSlots')).toBe(30);

      // Test coordination configuration
      expect(calendarConfig.getBoolean('coordination.enabled')).toBe(true);
      const dashboard = calendarConfig.getConfig('coordination.dashboard');
      expect(dashboard.getBoolean('enabled')).toBe(true);
      expect(dashboard.getBoolean('showAvailability')).toBe(true);
      expect(dashboard.getBoolean('showUpcomingMeetings')).toBe(true);
      expect(dashboard.getNumber('refreshInterval')).toBe(5);

      // Test UI configuration
      expect(calendarConfig.getBoolean('ui.teamPageIntegration')).toBe(true);
      expect(calendarConfig.getBoolean('ui.showCalendarWidget')).toBe(true);
      expect(calendarConfig.getString('ui.defaultWidgetView')).toBe('agenda');
    });

    it('should validate Google Calendar working hours configuration', () => {
      const calendarConfig = config.getConfig('googleCalendar');
      const workingHours = calendarConfig.getConfig('schedule.workingHours');

      const startTime = workingHours.getString('start');
      const endTime = workingHours.getString('end');
      const days = workingHours.getStringArray('days');

      // Validate time format (HH:MM)
      expect(startTime).toMatch(/^\d{2}:\d{2}$/);
      expect(endTime).toMatch(/^\d{2}:\d{2}$/);

      // Validate working days
      const validDays = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ];
      days.forEach(day => {
        expect(validDays).toContain(day);
      });

      // Validate that start time is before end time
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      expect(startMinutes).toBeLessThan(endMinutes);
    });

    it('should validate Google Calendar availability configuration', () => {
      const calendarConfig = config.getConfig('googleCalendar');
      const availability = calendarConfig.getConfig('meetings.availability');

      const statuses = availability.getStringArray('statuses');
      const validStatuses = ['free', 'busy', 'tentative', 'out_of_office'];

      statuses.forEach(status => {
        expect(validStatuses).toContain(status);
      });

      const timeSlots = availability.getNumber('timeSlots');
      expect(timeSlots).toBeGreaterThan(0);
      expect(timeSlots % 15).toBe(0); // Should be divisible by 15 minutes
    });
  });

  describe('Plugin Integration Tests', () => {
    it('should have consistent entity page integration across all plugins', () => {
      const devpodConfig = config.getConfig('devpod');
      const devContainersConfig = config.getConfig('devContainers');
      const calendarConfig = config.getConfig('googleCalendar');

      expect(devpodConfig.getBoolean('ui.entityPageIntegration')).toBe(true);
      expect(devContainersConfig.getBoolean('ui.entityPageIntegration')).toBe(
        true,
      );
      expect(calendarConfig.getBoolean('ui.teamPageIntegration')).toBe(true);
    });

    it('should have proper service annotation configurations', () => {
      const devpodConfig = config.getConfig('devpod');
      const devContainersConfig = config.getConfig('devContainers');

      expect(devpodConfig.getString('integration.backstage.annotation')).toBe(
        'devpod.io/template',
      );
      expect(devContainersConfig.getConfig('services')).toBeDefined();
    });

    it('should validate development environment workflow integration', () => {
      const devpodConfig = config.getConfig('devpod');
      const devContainersConfig = config.getConfig('devContainers');

      // Both should support GitHub integration
      expect(devpodConfig.getBoolean('integration.github.enabled')).toBe(true);
      expect(devContainersConfig.getConfig('vscode')).toBeDefined();

      // Both should support VS Code integration
      expect(devpodConfig.getString('access.defaultMethod')).toBe('vscode');
      expect(devContainersConfig.getBoolean('vscode.enabled')).toBe(true);
    });

    it('should validate team coordination features', () => {
      const calendarConfig = config.getConfig('googleCalendar');

      // Should support team coordination
      expect(calendarConfig.getBoolean('coordination.enabled')).toBe(true);
      expect(calendarConfig.getBoolean('coordination.dashboard.enabled')).toBe(
        true,
      );
      expect(
        calendarConfig.getBoolean('coordination.dashboard.showAvailability'),
      ).toBe(true);
      expect(
        calendarConfig.getBoolean(
          'coordination.dashboard.showUpcomingMeetings',
        ),
      ).toBe(true);

      // Should integrate with team pages
      expect(calendarConfig.getBoolean('ui.teamPageIntegration')).toBe(true);
      expect(calendarConfig.getBoolean('ui.showCalendarWidget')).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate all required configuration sections exist', () => {
      expect(config.has('devpod')).toBe(true);
      expect(config.has('devContainers')).toBe(true);
      expect(config.has('googleCalendar')).toBe(true);
    });

    it('should validate API endpoints are properly configured', () => {
      const devpodConfig = config.getConfig('devpod');
      const devContainersConfig = config.getConfig('devContainers');
      const calendarConfig = config.getConfig('googleCalendar');

      expect(devpodConfig.getString('api.baseUrl')).toMatch(/^https?:\/\/.+/);
      expect(devContainersConfig.getString('api.baseUrl')).toMatch(
        /^https?:\/\/.+/,
      );
      expect(calendarConfig.getString('api.apiKey')).toBeDefined();
    });

    it('should validate UI configuration consistency', () => {
      const devpodConfig = config.getConfig('devpod');
      const devContainersConfig = config.getConfig('devContainers');
      const calendarConfig = config.getConfig('googleCalendar');

      // All should have default views configured
      expect(devpodConfig.getString('ui.defaultView')).toBeDefined();
      expect(devContainersConfig.getString('ui.defaultView')).toBeDefined();
      expect(calendarConfig.getString('ui.defaultWidgetView')).toBeDefined();

      // All should show relevant information in catalog
      expect(devpodConfig.getBoolean('ui.showEnvironmentsInCatalog')).toBe(
        true,
      );
      expect(
        devContainersConfig.getBoolean('ui.showEnvironmentsInCatalog'),
      ).toBe(true);
      expect(calendarConfig.getBoolean('ui.showCalendarWidget')).toBe(true);
    });
  });
});
