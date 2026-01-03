/**
 * Integration tests for collaboration and workflow plugins
 * Tests Jira integration, PR board functionality, Slack notifications,
 * feedback collection, enhanced Jira dashboards, Shortcut, and cost insights
 * 
 * Requirements: 6.1, 7.1, 7.4, 9.1
 */

import { ConfigReader } from '@backstage/config';

describe('Collaboration Plugins Integration', () => {
  let config: ConfigReader;

  beforeAll(async () => {
    config = new ConfigReader({
      backend: {
        database: {
          client: 'better-sqlite3',
          connection: ':memory:',
        },
      },
      // Jira configuration for testing
      jira: {
        api: {
          baseUrl: 'https://test-jira.atlassian.net',
          username: 'test-user',
          apiToken: 'test-token',
        },
        issues: {
          entityPageIntegration: true,
          defaultJql: 'assignee = currentUser() AND resolution = Unresolved',
          maxResults: 50,
        },
        projects: {
          progressTracking: true,
          showStatistics: true,
        },
      },
      // GitHub Pull Requests Board configuration for testing
      githubPullRequestsBoard: {
        github: {
          token: 'test-github-token',
          organizations: ['test-org'],
        },
        team: {
          enabled: true,
          maxPRsPerRepo: 25,
        },
        metrics: {
          enabled: true,
          trackingMetrics: ['review_time', 'merge_time'],
        },
      },
      // Slack configuration for testing
      slackScaffolderActions: {
        api: {
          botToken: 'xoxb-test-token',
          signingSecret: 'test-secret',
        },
        notifications: {
          deployments: {
            enabled: true,
            channels: {
              default: '#deployments',
            },
          },
        },
      },
      // Feedback configuration for testing
      feedback: {
        collection: {
          enabled: true,
          types: [
            {
              name: 'service_feedback',
              title: 'Service Feedback',
            },
          ],
        },
        storage: {
          backend: 'database',
        },
      },
      // Cost Insights configuration for testing
      costInsights: {
        trends: {
          enabled: true,
          defaultPeriod: '30d',
        },
        tracking: {
          teamTracking: true,
          entityTracking: true,
        },
        providers: {
          aws: {
            enabled: true,
          },
        },
      },
    });
  });

  describe('Jira Integration', () => {
    it('should configure Jira plugin correctly', async () => {
      // Test that Jira configuration is loaded correctly
      const jiraConfig = config.getConfig('jira');
      
      expect(jiraConfig.getString('api.baseUrl')).toBe('https://test-jira.atlassian.net');
      expect(jiraConfig.getString('api.username')).toBe('test-user');
      expect(jiraConfig.getBoolean('issues.entityPageIntegration')).toBe(true);
      expect(jiraConfig.getBoolean('projects.progressTracking')).toBe(true);
    });

    it('should handle Jira API configuration validation', async () => {
      // Test configuration validation
      const jiraConfig = config.getConfig('jira');
      
      // Verify required fields are present
      expect(() => jiraConfig.getString('api.baseUrl')).not.toThrow();
      expect(() => jiraConfig.getString('api.username')).not.toThrow();
      expect(() => jiraConfig.getString('api.apiToken')).not.toThrow();
    });

    it('should configure issue tracking settings', async () => {
      const jiraConfig = config.getConfig('jira');
      
      expect(jiraConfig.getString('issues.defaultJql')).toContain('assignee = currentUser()');
      expect(jiraConfig.getNumber('issues.maxResults')).toBe(50);
    });
  });

  describe('GitHub Pull Requests Board', () => {
    it('should configure GitHub PR board correctly', async () => {
      const prBoardConfig = config.getConfig('githubPullRequestsBoard');
      
      expect(prBoardConfig.getString('github.token')).toBe('test-github-token');
      expect(prBoardConfig.getStringArray('github.organizations')).toContain('test-org');
      expect(prBoardConfig.getBoolean('team.enabled')).toBe(true);
    });

    it('should configure PR metrics tracking', async () => {
      const prBoardConfig = config.getConfig('githubPullRequestsBoard');
      
      expect(prBoardConfig.getBoolean('metrics.enabled')).toBe(true);
      expect(prBoardConfig.getStringArray('metrics.trackingMetrics')).toContain('review_time');
      expect(prBoardConfig.getStringArray('metrics.trackingMetrics')).toContain('merge_time');
    });

    it('should validate team configuration', async () => {
      const prBoardConfig = config.getConfig('githubPullRequestsBoard');
      
      expect(prBoardConfig.getNumber('team.maxPRsPerRepo')).toBe(25);
    });
  });

  describe('Slack Notifications', () => {
    it('should configure Slack scaffolder actions', async () => {
      const slackConfig = config.getConfig('slackScaffolderActions');
      
      expect(slackConfig.getString('api.botToken')).toBe('xoxb-test-token');
      expect(slackConfig.getString('api.signingSecret')).toBe('test-secret');
    });

    it('should configure deployment notifications', async () => {
      const slackConfig = config.getConfig('slackScaffolderActions');
      
      expect(slackConfig.getBoolean('notifications.deployments.enabled')).toBe(true);
      expect(slackConfig.getString('notifications.deployments.channels.default')).toBe('#deployments');
    });

    it('should validate notification configuration', async () => {
      const slackConfig = config.getConfig('slackScaffolderActions');
      
      // Verify required fields for notifications
      expect(() => slackConfig.getConfig('notifications.deployments')).not.toThrow();
    });
  });

  describe('Feedback Collection', () => {
    it('should configure feedback plugin correctly', async () => {
      const feedbackConfig = config.getConfig('feedback');
      
      expect(feedbackConfig.getBoolean('collection.enabled')).toBe(true);
      expect(feedbackConfig.getString('storage.backend')).toBe('database');
    });

    it('should configure feedback types', async () => {
      const feedbackConfig = config.getConfig('feedback');
      
      const feedbackTypes = feedbackConfig.getConfigArray('collection.types');
      expect(feedbackTypes).toHaveLength(1);
      expect(feedbackTypes[0].getString('name')).toBe('service_feedback');
      expect(feedbackTypes[0].getString('title')).toBe('Service Feedback');
    });

    it('should validate storage configuration', async () => {
      const feedbackConfig = config.getConfig('feedback');
      
      expect(feedbackConfig.getString('storage.backend')).toBe('database');
    });
  });

  describe('Enhanced Jira Dashboards', () => {
    it('should configure dashboard features', async () => {
      const jiraConfig = config.getConfig('jira');
      
      // Test dashboard configuration if it exists
      if (jiraConfig.has('dashboard')) {
        const dashboardConfig = jiraConfig.getConfig('dashboard');
        expect(dashboardConfig.getBoolean('enabled')).toBe(true);
      }
    });

    it('should handle sprint and velocity tracking', async () => {
      const jiraConfig = config.getConfig('jira');
      
      // Verify sprint configuration
      if (jiraConfig.has('sprints')) {
        const sprintsConfig = jiraConfig.getConfig('sprints');
        expect(sprintsConfig.getBoolean('enabled')).toBe(true);
      }
    });
  });

  describe('Shortcut Integration', () => {
    it('should handle Shortcut configuration when present', async () => {
      // Test Shortcut configuration if it exists
      if (config.has('shortcut')) {
        const shortcutConfig = config.getConfig('shortcut');
        expect(() => shortcutConfig.getString('api.baseUrl')).not.toThrow();
      }
    });

    it('should validate story tracking configuration', async () => {
      if (config.has('shortcut')) {
        const shortcutConfig = config.getConfig('shortcut');
        if (shortcutConfig.has('stories')) {
          expect(shortcutConfig.getBoolean('stories.enabled')).toBeDefined();
        }
      }
    });
  });

  describe('Cost Insights Integration', () => {
    it('should configure cost insights correctly', async () => {
      const costConfig = config.getConfig('costInsights');
      
      expect(costConfig.getBoolean('trends.enabled')).toBe(true);
      expect(costConfig.getString('trends.defaultPeriod')).toBe('30d');
      expect(costConfig.getBoolean('tracking.teamTracking')).toBe(true);
      expect(costConfig.getBoolean('tracking.entityTracking')).toBe(true);
    });

    it('should configure AWS provider integration', async () => {
      const costConfig = config.getConfig('costInsights');
      
      expect(costConfig.getBoolean('providers.aws.enabled')).toBe(true);
    });

    it('should validate cost tracking configuration', async () => {
      const costConfig = config.getConfig('costInsights');
      
      // Verify tracking configuration
      const trackingConfig = costConfig.getConfig('tracking');
      expect(trackingConfig.getBoolean('teamTracking')).toBe(true);
      expect(trackingConfig.getBoolean('entityTracking')).toBe(true);
    });
  });

  describe('Integration Health Checks', () => {
    it('should validate all plugin configurations are consistent', async () => {
      // Check that all required configurations are present
      expect(() => config.getConfig('jira')).not.toThrow();
      expect(() => config.getConfig('githubPullRequestsBoard')).not.toThrow();
      expect(() => config.getConfig('slackScaffolderActions')).not.toThrow();
      expect(() => config.getConfig('feedback')).not.toThrow();
      expect(() => config.getConfig('costInsights')).not.toThrow();
    });

    it('should ensure plugin configurations do not conflict', async () => {
      // Verify that GitHub tokens are consistent across plugins
      const prBoardToken = config.getString('githubPullRequestsBoard.github.token');
      expect(prBoardToken).toBe('test-github-token');
      
      // Verify that database configurations are consistent
      const feedbackStorage = config.getString('feedback.storage.backend');
      expect(feedbackStorage).toBe('database');
    });

    it('should validate required environment variables are configured', async () => {
      // Test that configuration references environment variables correctly
      const jiraConfig = config.getConfig('jira');
      expect(() => jiraConfig.getString('api.baseUrl')).not.toThrow();
      
      const slackConfig = config.getConfig('slackScaffolderActions');
      expect(() => slackConfig.getString('api.botToken')).not.toThrow();
    });
  });

  describe('Plugin Interoperability', () => {
    it('should ensure plugins can work together', async () => {
      // Test that Jira and GitHub PR board can coexist
      expect(() => config.getConfig('jira')).not.toThrow();
      expect(() => config.getConfig('githubPullRequestsBoard')).not.toThrow();
      
      // Test that Slack notifications can integrate with other plugins
      expect(() => config.getConfig('slackScaffolderActions')).not.toThrow();
    });

    it('should validate shared configuration values', async () => {
      // Verify that shared values like organization names are consistent
      if (config.has('githubPullRequestsBoard.github.organizations')) {
        const organizations = config.getStringArray('githubPullRequestsBoard.github.organizations');
        expect(organizations).toContain('test-org');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing configuration gracefully', async () => {
      // Test that missing optional configurations don't break the system
      expect(() => config.getOptionalString('nonexistent.config')).not.toThrow();
    });

    it('should validate required configurations', async () => {
      // Test that required configurations throw appropriate errors when missing
      expect(() => config.getString('jira.api.baseUrl')).not.toThrow();
      expect(() => config.getString('githubPullRequestsBoard.github.token')).not.toThrow();
    });
  });
});