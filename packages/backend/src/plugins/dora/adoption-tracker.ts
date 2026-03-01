/**
 * Platform adoption analytics tracker
 * 
 * Tracks user activity, service creation, and feature usage for platform adoption analysis
 */

import { Logger } from 'winston';
import {
  UserActivity,
  ServiceCreationEvent,
  FeatureUsage,
  AdoptionMetrics,
  DailyActiveUsersSummary,
  WeeklyActiveUsersSummary,
  AdoptionAnalyticsConfig,
  ActivityTrackingResult,
  AdoptionCalculationResult,
} from './adoption-types';

export class AdoptionTracker {
  private readonly logger: Logger;
  private readonly config: AdoptionAnalyticsConfig;

  // In-memory storage for activity data
  private activities: UserActivity[] = [];
  private serviceCreations: ServiceCreationEvent[] = [];
  private dailySummaries: Map<string, DailyActiveUsersSummary> = new Map();
  private weeklySummaries: Map<string, WeeklyActiveUsersSummary> = new Map();

  constructor(logger: Logger, config: AdoptionAnalyticsConfig) {
    this.logger = logger;
    this.config = config;

    // Start cleanup task for old data
    this.startDataCleanup();
  }

  /**
   * Track user activity
   */
  async trackActivity(
    userId: string,
    userName: string,
    email: string,
    action: string,
    feature: string,
    metadata?: Record<string, any>,
  ): Promise<ActivityTrackingResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        error: 'Adoption tracking is disabled',
        timestamp: new Date(),
      };
    }

    // Check if user is excluded
    if (this.config.privacy.excludedUsers.includes(userId)) {
      return {
        success: true,
        timestamp: new Date(),
      };
    }

    try {
      const activity: UserActivity = {
        userId: this.config.privacy.anonymizeUsers ? this.anonymizeUserId(userId) : userId,
        userName: this.config.privacy.anonymizeUsers ? 'Anonymous' : userName,
        email: this.config.privacy.anonymizeUsers ? 'anonymous@example.com' : email,
        timestamp: new Date(),
        action,
        feature,
        metadata,
      };

      this.activities.push(activity);

      this.logger.debug('Activity tracked', {
        userId: activity.userId,
        action,
        feature,
      });

      return {
        success: true,
        activityId: `${activity.userId}-${activity.timestamp.getTime()}`,
        timestamp: activity.timestamp,
      };
    } catch (error) {
      this.logger.error('Failed to track activity', { error, userId, action, feature });
      return {
        success: false,
        error: String(error),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Track service creation
   */
  async trackServiceCreation(
    serviceId: string,
    serviceName: string,
    templateId: string,
    templateName: string,
    createdBy: string,
    team: string,
  ): Promise<ActivityTrackingResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        error: 'Adoption tracking is disabled',
        timestamp: new Date(),
      };
    }

    try {
      const event: ServiceCreationEvent = {
        serviceId,
        serviceName,
        templateId,
        templateName,
        createdBy: this.config.privacy.anonymizeUsers ? this.anonymizeUserId(createdBy) : createdBy,
        createdAt: new Date(),
        team,
      };

      this.serviceCreations.push(event);

      // Also track as user activity
      await this.trackActivity(
        createdBy,
        'User',
        'user@example.com',
        'create_service',
        'scaffolder',
        {
          serviceId,
          serviceName,
          templateId,
          templateName,
          team,
        },
      );

      this.logger.info('Service creation tracked', {
        serviceId,
        serviceName,
        templateName,
        team,
      });

      return {
        success: true,
        activityId: serviceId,
        timestamp: event.createdAt,
      };
    } catch (error) {
      this.logger.error('Failed to track service creation', { error, serviceId });
      return {
        success: false,
        error: String(error),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Calculate adoption metrics for a time period
   */
  async calculateAdoptionMetrics(
    startDate: Date,
    endDate: Date,
  ): Promise<AdoptionCalculationResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Calculating adoption metrics', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      // Filter activities within the period
      const periodActivities = this.activities.filter(
        a => a.timestamp >= startDate && a.timestamp <= endDate,
      );

      // Calculate user activity metrics
      const userActivity = this.calculateUserActivityMetrics(
        periodActivities,
        startDate,
        endDate,
      );

      // Calculate service creation metrics
      const serviceCreation = this.calculateServiceCreationMetrics(
        startDate,
        endDate,
      );

      // Calculate feature usage metrics
      const featureUsage = this.calculateFeatureUsageMetrics(periodActivities);

      // Calculate engagement metrics
      const engagement = this.calculateEngagementMetrics(
        periodActivities,
        startDate,
        endDate,
      );

      const metrics: AdoptionMetrics = {
        period: {
          start: startDate,
          end: endDate,
        },
        userActivity,
        serviceCreation,
        featureUsage,
        engagement,
        calculatedAt: new Date(),
      };

      const duration = Date.now() - startTime;

      this.logger.info('Adoption metrics calculated successfully', {
        duration,
        dau: userActivity.dailyActiveUsers,
        wau: userActivity.weeklyActiveUsers,
        servicesCreated: serviceCreation.servicesCreatedInPeriod,
      });

      return {
        success: true,
        metrics,
        errors: [],
        calculatedAt: new Date(),
        duration,
      };
    } catch (error) {
      this.logger.error('Failed to calculate adoption metrics', { error });
      return {
        success: false,
        errors: [String(error)],
        calculatedAt: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Calculate user activity metrics
   */
  private calculateUserActivityMetrics(
    activities: UserActivity[],
    startDate: Date,
    endDate: Date,
  ): AdoptionMetrics['userActivity'] {
    // Get unique users
    const uniqueUsers = new Set(activities.map(a => a.userId));
    const totalUsers = uniqueUsers.size;

    // Calculate DAU (last 24 hours from end date)
    const oneDayAgo = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
    const dailyActiveUsers = new Set(
      activities
        .filter(a => a.timestamp >= oneDayAgo && a.timestamp <= endDate)
        .map(a => a.userId),
    ).size;

    // Calculate WAU (last 7 days from end date)
    const oneWeekAgo = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weeklyActiveUsers = new Set(
      activities
        .filter(a => a.timestamp >= oneWeekAgo && a.timestamp <= endDate)
        .map(a => a.userId),
    ).size;

    // Calculate MAU (last 30 days from end date)
    const oneMonthAgo = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthlyActiveUsers = new Set(
      activities
        .filter(a => a.timestamp >= oneMonthAgo && a.timestamp <= endDate)
        .map(a => a.userId),
    ).size;

    // Calculate trend (compare with previous period)
    const periodDuration = endDate.getTime() - startDate.getTime();
    const previousPeriodStart = new Date(startDate.getTime() - periodDuration);
    const previousPeriodActivities = this.activities.filter(
      a => a.timestamp >= previousPeriodStart && a.timestamp < startDate,
    );
    const previousActiveUsers = new Set(previousPeriodActivities.map(a => a.userId)).size;

    let activeUserTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (totalUsers > previousActiveUsers * 1.1) {
      activeUserTrend = 'increasing';
    } else if (totalUsers < previousActiveUsers * 0.9) {
      activeUserTrend = 'decreasing';
    }

    return {
      dailyActiveUsers,
      weeklyActiveUsers,
      monthlyActiveUsers,
      totalUsers,
      activeUserTrend,
    };
  }

  /**
   * Calculate service creation metrics
   */
  private calculateServiceCreationMetrics(
    startDate: Date,
    endDate: Date,
  ): AdoptionMetrics['serviceCreation'] {
    // Filter service creations within the period
    const periodCreations = this.serviceCreations.filter(
      s => s.createdAt >= startDate && s.createdAt <= endDate,
    );

    const servicesCreatedInPeriod = periodCreations.length;
    const totalServices = this.serviceCreations.length;

    // Calculate creation rate (services per week)
    const periodDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const creationRate = (servicesCreatedInPeriod / periodDays) * 7;

    // Group by template
    const byTemplate: Record<string, number> = {};
    periodCreations.forEach(s => {
      byTemplate[s.templateName] = (byTemplate[s.templateName] || 0) + 1;
    });

    // Group by team
    const byTeam: Record<string, number> = {};
    periodCreations.forEach(s => {
      byTeam[s.team] = (byTeam[s.team] || 0) + 1;
    });

    // Calculate trend
    const periodDuration = endDate.getTime() - startDate.getTime();
    const previousPeriodStart = new Date(startDate.getTime() - periodDuration);
    const previousPeriodCreations = this.serviceCreations.filter(
      s => s.createdAt >= previousPeriodStart && s.createdAt < startDate,
    ).length;

    let creationTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (servicesCreatedInPeriod > previousPeriodCreations * 1.1) {
      creationTrend = 'increasing';
    } else if (servicesCreatedInPeriod < previousPeriodCreations * 0.9) {
      creationTrend = 'decreasing';
    }

    return {
      totalServices,
      servicesCreatedInPeriod,
      creationRate,
      creationTrend,
      byTemplate,
      byTeam,
    };
  }

  /**
   * Calculate feature usage metrics
   */
  private calculateFeatureUsageMetrics(
    activities: UserActivity[],
  ): AdoptionMetrics['featureUsage'] {
    // Group activities by feature
    const featureMap = new Map<string, { count: number; users: Set<string>; lastUsed: Date }>();

    activities.forEach(a => {
      if (!featureMap.has(a.feature)) {
        featureMap.set(a.feature, {
          count: 0,
          users: new Set(),
          lastUsed: a.timestamp,
        });
      }

      const featureData = featureMap.get(a.feature)!;
      featureData.count++;
      featureData.users.add(a.userId);
      if (a.timestamp > featureData.lastUsed) {
        featureData.lastUsed = a.timestamp;
      }
    });

    // Convert to FeatureUsage array
    const featureUsages: FeatureUsage[] = Array.from(featureMap.entries()).map(
      ([feature, data]) => ({
        feature,
        displayName: this.getFeatureDisplayName(feature),
        category: this.getFeatureCategory(feature),
        usageCount: data.count,
        uniqueUsers: data.users.size,
        lastUsed: data.lastUsed,
      }),
    );

    // Sort by usage count
    featureUsages.sort((a, b) => b.usageCount - a.usageCount);

    const topFeatures = featureUsages.slice(0, 10);
    const leastUsedFeatures = featureUsages.slice(-5).reverse();
    const totalFeatureUsage = featureUsages.reduce((sum, f) => sum + f.usageCount, 0);

    // Calculate feature adoption rate
    const totalUsers = new Set(activities.map(a => a.userId)).size;
    const featureAdoptionRate = totalUsers > 0
      ? (featureUsages.reduce((sum, f) => sum + f.uniqueUsers, 0) / (totalUsers * featureUsages.length)) * 100
      : 0;

    return {
      topFeatures,
      totalFeatureUsage,
      featureAdoptionRate,
      leastUsedFeatures,
    };
  }

  /**
   * Calculate engagement metrics
   */
  private calculateEngagementMetrics(
    activities: UserActivity[],
    startDate: Date,
    endDate: Date,
  ): AdoptionMetrics['engagement'] {
    const uniqueUsers = new Set(activities.map(a => a.userId));
    const totalUsers = uniqueUsers.size;

    if (totalUsers === 0) {
      return {
        averageSessionsPerUser: 0,
        averageActionsPerSession: 0,
        returnRate: 0,
        powerUsers: 0,
      };
    }

    // Calculate sessions (group activities by user and time gaps > 30 minutes)
    const sessionsByUser = new Map<string, number>();
    const actionsByUser = new Map<string, number>();

    uniqueUsers.forEach(userId => {
      const userActivities = activities
        .filter(a => a.userId === userId)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      let sessions = 1;
      for (let i = 1; i < userActivities.length; i++) {
        const timeDiff = userActivities[i].timestamp.getTime() - userActivities[i - 1].timestamp.getTime();
        if (timeDiff > 30 * 60 * 1000) { // 30 minutes
          sessions++;
        }
      }

      sessionsByUser.set(userId, sessions);
      actionsByUser.set(userId, userActivities.length);
    });

    const totalSessions = Array.from(sessionsByUser.values()).reduce((sum, s) => sum + s, 0);
    const totalActions = activities.length;

    const averageSessionsPerUser = totalSessions / totalUsers;
    const averageActionsPerSession = totalActions / totalSessions;

    // Calculate return rate (users who have activities on multiple days)
    const userDays = new Map<string, Set<string>>();
    activities.forEach(a => {
      const dateKey = a.timestamp.toISOString().split('T')[0];
      if (!userDays.has(a.userId)) {
        userDays.set(a.userId, new Set());
      }
      userDays.get(a.userId)!.add(dateKey);
    });

    const returningUsers = Array.from(userDays.values()).filter(days => days.size > 1).length;
    const returnRate = (returningUsers / totalUsers) * 100;

    // Calculate power users (> 10 actions per day on average)
    const periodDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const powerUsers = Array.from(actionsByUser.entries()).filter(
      ([_, actions]) => actions / periodDays > 10,
    ).length;

    return {
      averageSessionsPerUser,
      averageActionsPerSession,
      returnRate,
      powerUsers,
    };
  }

  /**
   * Get feature display name
   */
  private getFeatureDisplayName(feature: string): string {
    const displayNames: Record<string, string> = {
      catalog: 'Service Catalog',
      scaffolder: 'Project Templates',
      techdocs: 'Documentation',
      kubernetes: 'Kubernetes',
      cicd: 'CI/CD',
      observability: 'Observability',
      finops: 'FinOps',
      search: 'Search',
      settings: 'Settings',
    };

    return displayNames[feature] || feature;
  }

  /**
   * Get feature category
   */
  private getFeatureCategory(feature: string): FeatureUsage['category'] {
    const categories: Record<string, FeatureUsage['category']> = {
      catalog: 'catalog',
      scaffolder: 'scaffolder',
      techdocs: 'techdocs',
      kubernetes: 'kubernetes',
      cicd: 'cicd',
      observability: 'observability',
      finops: 'finops',
    };

    return categories[feature] || 'other';
  }

  /**
   * Anonymize user ID
   */
  private anonymizeUserId(userId: string): string {
    // Simple hash function for anonymization
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `user_${Math.abs(hash)}`;
  }

  /**
   * Start data cleanup task
   */
  private startDataCleanup(): void {
    // Run cleanup every 24 hours
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Clean up old data based on retention policy
   */
  private cleanupOldData(): void {
    const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);

    const beforeCount = this.activities.length;
    this.activities = this.activities.filter(a => a.timestamp >= cutoffDate);
    const afterCount = this.activities.length;

    if (beforeCount > afterCount) {
      this.logger.info('Cleaned up old activity data', {
        removed: beforeCount - afterCount,
        remaining: afterCount,
        cutoffDate: cutoffDate.toISOString(),
      });
    }

    // Clean up service creations
    const beforeServiceCount = this.serviceCreations.length;
    this.serviceCreations = this.serviceCreations.filter(s => s.createdAt >= cutoffDate);
    const afterServiceCount = this.serviceCreations.length;

    if (beforeServiceCount > afterServiceCount) {
      this.logger.info('Cleaned up old service creation data', {
        removed: beforeServiceCount - afterServiceCount,
        remaining: afterServiceCount,
      });
    }
  }

  /**
   * Get all activities (for testing or export)
   */
  getActivities(): UserActivity[] {
    return this.activities;
  }

  /**
   * Get all service creations (for testing or export)
   */
  getServiceCreations(): ServiceCreationEvent[] {
    return this.serviceCreations;
  }

  /**
   * Set activities (for testing or data import)
   */
  setActivities(activities: UserActivity[]): void {
    this.activities = activities;
  }

  /**
   * Set service creations (for testing or data import)
   */
  setServiceCreations(creations: ServiceCreationEvent[]): void {
    this.serviceCreations = creations;
  }
}
