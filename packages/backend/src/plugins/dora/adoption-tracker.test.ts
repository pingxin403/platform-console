/**
 * Unit tests for AdoptionTracker
 */

import { Logger } from 'winston';
import { AdoptionTracker } from './adoption-tracker';
import { AdoptionAnalyticsConfig, UserActivity, ServiceCreationEvent } from './adoption-types';

// Mock logger
const mockLogger: Logger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as any;

describe('AdoptionTracker', () => {
  let tracker: AdoptionTracker;
  let config: AdoptionAnalyticsConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      retentionDays: 90,
      aggregation: {
        dailySummaries: true,
        weeklySummaries: true,
      },
      trackedFeatures: ['catalog', 'scaffolder', 'techdocs', 'kubernetes'],
      privacy: {
        anonymizeUsers: false,
        excludedUsers: [],
      },
    };

    tracker = new AdoptionTracker(mockLogger, config);
  });

  describe('trackActivity', () => {
    it('should track user activity successfully', async () => {
      const result = await tracker.trackActivity(
        'user1',
        'John Doe',
        'john@example.com',
        'view_service',
        'catalog',
      );

      expect(result.success).toBe(true);
      expect(result.activityId).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);

      const activities = tracker.getActivities();
      expect(activities).toHaveLength(1);
      expect(activities[0].userId).toBe('user1');
      expect(activities[0].action).toBe('view_service');
      expect(activities[0].feature).toBe('catalog');
    });

    it('should not track activity when disabled', async () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledTracker = new AdoptionTracker(mockLogger, disabledConfig);

      const result = await disabledTracker.trackActivity(
        'user1',
        'John Doe',
        'john@example.com',
        'view_service',
        'catalog',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Adoption tracking is disabled');
    });

    it('should exclude users from tracking', async () => {
      const excludedConfig = {
        ...config,
        privacy: {
          ...config.privacy,
          excludedUsers: ['admin'],
        },
      };
      const excludedTracker = new AdoptionTracker(mockLogger, excludedConfig);

      const result = await excludedTracker.trackActivity(
        'admin',
        'Admin User',
        'admin@example.com',
        'view_service',
        'catalog',
      );

      expect(result.success).toBe(true);
      const activities = excludedTracker.getActivities();
      expect(activities).toHaveLength(0);
    });

    it('should anonymize user data when configured', async () => {
      const anonymizedConfig = {
        ...config,
        privacy: {
          ...config.privacy,
          anonymizeUsers: true,
        },
      };
      const anonymizedTracker = new AdoptionTracker(mockLogger, anonymizedConfig);

      await anonymizedTracker.trackActivity(
        'user1',
        'John Doe',
        'john@example.com',
        'view_service',
        'catalog',
      );

      const activities = anonymizedTracker.getActivities();
      expect(activities[0].userId).not.toBe('user1');
      expect(activities[0].userId).toMatch(/^user_\d+$/);
      expect(activities[0].userName).toBe('Anonymous');
      expect(activities[0].email).toBe('anonymous@example.com');
    });

    it('should track activity with metadata', async () => {
      const metadata = { serviceId: 'service1', action: 'view' };

      await tracker.trackActivity(
        'user1',
        'John Doe',
        'john@example.com',
        'view_service',
        'catalog',
        metadata,
      );

      const activities = tracker.getActivities();
      expect(activities[0].metadata).toEqual(metadata);
    });
  });

  describe('trackServiceCreation', () => {
    it('should track service creation successfully', async () => {
      const result = await tracker.trackServiceCreation(
        'service1',
        'My Service',
        'template1',
        'Go Service',
        'user1',
        'team1',
      );

      expect(result.success).toBe(true);
      expect(result.activityId).toBe('service1');

      const serviceCreations = tracker.getServiceCreations();
      expect(serviceCreations).toHaveLength(1);
      expect(serviceCreations[0].serviceId).toBe('service1');
      expect(serviceCreations[0].serviceName).toBe('My Service');
      expect(serviceCreations[0].templateName).toBe('Go Service');
      expect(serviceCreations[0].team).toBe('team1');

      // Should also create an activity
      const activities = tracker.getActivities();
      expect(activities).toHaveLength(1);
      expect(activities[0].action).toBe('create_service');
      expect(activities[0].feature).toBe('scaffolder');
    });

    it('should not track service creation when disabled', async () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledTracker = new AdoptionTracker(mockLogger, disabledConfig);

      const result = await disabledTracker.trackServiceCreation(
        'service1',
        'My Service',
        'template1',
        'Go Service',
        'user1',
        'team1',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Adoption tracking is disabled');
    });
  });

  describe('calculateAdoptionMetrics', () => {
    beforeEach(() => {
      // Set up test data
      const now = new Date();
      const activities: UserActivity[] = [
        // User 1 - active today
        {
          userId: 'user1',
          userName: 'User 1',
          email: 'user1@example.com',
          timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
          action: 'view_service',
          feature: 'catalog',
        },
        {
          userId: 'user1',
          userName: 'User 1',
          email: 'user1@example.com',
          timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
          action: 'create_service',
          feature: 'scaffolder',
        },
        // User 2 - active this week
        {
          userId: 'user2',
          userName: 'User 2',
          email: 'user2@example.com',
          timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          action: 'view_docs',
          feature: 'techdocs',
        },
        // User 3 - active this month
        {
          userId: 'user3',
          userName: 'User 3',
          email: 'user3@example.com',
          timestamp: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
          action: 'view_pods',
          feature: 'kubernetes',
        },
      ];

      const serviceCreations: ServiceCreationEvent[] = [
        {
          serviceId: 'service1',
          serviceName: 'Service 1',
          templateId: 'template1',
          templateName: 'Go Service',
          createdBy: 'user1',
          createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          team: 'team1',
        },
        {
          serviceId: 'service2',
          serviceName: 'Service 2',
          templateId: 'template2',
          templateName: 'React App',
          createdBy: 'user2',
          createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
          team: 'team2',
        },
      ];

      tracker.setActivities(activities);
      tracker.setServiceCreations(serviceCreations);
    });

    it('should calculate adoption metrics successfully', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const result = await tracker.calculateAdoptionMetrics(startDate, endDate);

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should calculate user activity metrics correctly', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const result = await tracker.calculateAdoptionMetrics(startDate, endDate);

      expect(result.metrics?.userActivity.dailyActiveUsers).toBe(1); // user1
      expect(result.metrics?.userActivity.weeklyActiveUsers).toBe(2); // user1, user2
      expect(result.metrics?.userActivity.monthlyActiveUsers).toBe(3); // user1, user2, user3
      expect(result.metrics?.userActivity.totalUsers).toBe(3);
    });

    it('should calculate service creation metrics correctly', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const result = await tracker.calculateAdoptionMetrics(startDate, endDate);

      expect(result.metrics?.serviceCreation.servicesCreatedInPeriod).toBe(2);
      expect(result.metrics?.serviceCreation.totalServices).toBe(2);
      expect(result.metrics?.serviceCreation.creationRate).toBeGreaterThan(0);
      expect(result.metrics?.serviceCreation.byTemplate).toEqual({
        'Go Service': 1,
        'React App': 1,
      });
      expect(result.metrics?.serviceCreation.byTeam).toEqual({
        team1: 1,
        team2: 1,
      });
    });

    it('should calculate feature usage metrics correctly', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const result = await tracker.calculateAdoptionMetrics(startDate, endDate);

      expect(result.metrics?.featureUsage.topFeatures).toBeDefined();
      expect(result.metrics?.featureUsage.topFeatures.length).toBeGreaterThan(0);
      expect(result.metrics?.featureUsage.totalFeatureUsage).toBe(4);
    });

    it('should calculate engagement metrics correctly', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const result = await tracker.calculateAdoptionMetrics(startDate, endDate);

      expect(result.metrics?.engagement.averageSessionsPerUser).toBeGreaterThan(0);
      expect(result.metrics?.engagement.averageActionsPerSession).toBeGreaterThan(0);
      expect(result.metrics?.engagement.returnRate).toBeGreaterThanOrEqual(0);
      expect(result.metrics?.engagement.returnRate).toBeLessThanOrEqual(100);
    });

    it('should handle empty data gracefully', async () => {
      const emptyTracker = new AdoptionTracker(mockLogger, config);
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const result = await emptyTracker.calculateAdoptionMetrics(startDate, endDate);

      expect(result.success).toBe(true);
      expect(result.metrics?.userActivity.totalUsers).toBe(0);
      expect(result.metrics?.serviceCreation.totalServices).toBe(0);
    });

    it('should calculate trends correctly', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const result = await tracker.calculateAdoptionMetrics(startDate, endDate);

      expect(result.metrics?.userActivity.activeUserTrend).toMatch(
        /^(increasing|stable|decreasing)$/,
      );
      expect(result.metrics?.serviceCreation.creationTrend).toMatch(
        /^(increasing|stable|decreasing)$/,
      );
    });
  });

  describe('data management', () => {
    it('should get and set activities', () => {
      const activities: UserActivity[] = [
        {
          userId: 'user1',
          userName: 'User 1',
          email: 'user1@example.com',
          timestamp: new Date(),
          action: 'view_service',
          feature: 'catalog',
        },
      ];

      tracker.setActivities(activities);
      expect(tracker.getActivities()).toEqual(activities);
    });

    it('should get and set service creations', () => {
      const serviceCreations: ServiceCreationEvent[] = [
        {
          serviceId: 'service1',
          serviceName: 'Service 1',
          templateId: 'template1',
          templateName: 'Go Service',
          createdBy: 'user1',
          createdAt: new Date(),
          team: 'team1',
        },
      ];

      tracker.setServiceCreations(serviceCreations);
      expect(tracker.getServiceCreations()).toEqual(serviceCreations);
    });
  });
});
