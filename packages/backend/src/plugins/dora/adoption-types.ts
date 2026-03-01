/**
 * Type definitions for platform adoption analytics
 * 
 * This module defines types for tracking platform usage, user activity,
 * and feature adoption metrics.
 */

/**
 * User activity data
 */
export interface UserActivity {
  userId: string;
  userName: string;
  email: string;
  timestamp: Date;
  action: string;
  feature: string;
  metadata?: Record<string, any>;
}

/**
 * Service creation event
 */
export interface ServiceCreationEvent {
  serviceId: string;
  serviceName: string;
  templateId: string;
  templateName: string;
  createdBy: string;
  createdAt: Date;
  team: string;
}

/**
 * Feature usage statistics
 */
export interface FeatureUsage {
  feature: string;
  displayName: string;
  category: 'catalog' | 'scaffolder' | 'techdocs' | 'kubernetes' | 'cicd' | 'observability' | 'finops' | 'other';
  usageCount: number;
  uniqueUsers: number;
  lastUsed: Date;
}

/**
 * Platform adoption metrics
 */
export interface AdoptionMetrics {
  period: {
    start: Date;
    end: Date;
  };
  
  // User activity metrics
  userActivity: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    totalUsers: number;
    activeUserTrend: 'increasing' | 'stable' | 'decreasing';
  };
  
  // Service creation metrics
  serviceCreation: {
    totalServices: number;
    servicesCreatedInPeriod: number;
    creationRate: number; // services per week
    creationTrend: 'increasing' | 'stable' | 'decreasing';
    byTemplate: Record<string, number>;
    byTeam: Record<string, number>;
  };
  
  // Feature usage metrics
  featureUsage: {
    topFeatures: FeatureUsage[];
    totalFeatureUsage: number;
    featureAdoptionRate: number; // percentage of users using each feature
    leastUsedFeatures: FeatureUsage[];
  };
  
  // Engagement metrics
  engagement: {
    averageSessionsPerUser: number;
    averageActionsPerSession: number;
    returnRate: number; // percentage of users who return
    powerUsers: number; // users with > 10 actions per day
  };
  
  // Metadata
  calculatedAt: Date;
}

/**
 * Daily active users summary
 */
export interface DailyActiveUsersSummary {
  date: Date;
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
  actions: number;
}

/**
 * Weekly active users summary
 */
export interface WeeklyActiveUsersSummary {
  weekStart: Date;
  weekEnd: Date;
  activeUsers: number;
  newUsers: number;
  averageDailyActiveUsers: number;
  totalActions: number;
}

/**
 * Adoption analytics configuration
 */
export interface AdoptionAnalyticsConfig {
  // Enable/disable tracking
  enabled: boolean;
  
  // Data retention (in days)
  retentionDays: number;
  
  // Aggregation settings
  aggregation: {
    // Calculate daily summaries
    dailySummaries: boolean;
    // Calculate weekly summaries
    weeklySummaries: boolean;
  };
  
  // Feature categories to track
  trackedFeatures: string[];
  
  // Privacy settings
  privacy: {
    // Anonymize user data
    anonymizeUsers: boolean;
    // Exclude specific users (e.g., admins, test accounts)
    excludedUsers: string[];
  };
}

/**
 * Activity tracking result
 */
export interface ActivityTrackingResult {
  success: boolean;
  activityId?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Adoption metrics calculation result
 */
export interface AdoptionCalculationResult {
  success: boolean;
  metrics?: AdoptionMetrics;
  errors: string[];
  calculatedAt: Date;
  duration: number; // in milliseconds
}
