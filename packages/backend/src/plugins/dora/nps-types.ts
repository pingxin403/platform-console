/**
 * Type definitions for Developer NPS (Net Promoter Score) collection and analysis
 * 
 * This module defines types for collecting developer feedback, calculating NPS scores,
 * and analyzing satisfaction trends.
 */

/**
 * NPS score categories based on 0-10 rating
 */
export type NPSCategory = 'promoter' | 'passive' | 'detractor';

/**
 * Sentiment analysis result
 */
export type Sentiment = 'positive' | 'neutral' | 'negative';

/**
 * Feedback category for classification
 */
export type FeedbackCategory =
  | 'service_catalog'
  | 'golden_paths'
  | 'deployment'
  | 'observability'
  | 'cost_management'
  | 'documentation'
  | 'performance'
  | 'ease_of_use'
  | 'support'
  | 'other';

/**
 * NPS feedback submission
 */
export interface NPSFeedback {
  id: string;
  userId: string;
  userName: string;
  email: string;
  score: number; // 0-10
  comment?: string;
  category?: FeedbackCategory;
  sentiment?: Sentiment;
  submittedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * NPS score data
 */
export interface NPSData {
  score: number; // -100 to 100
  responseCount: number;
  promoters: number; // score 9-10
  passives: number; // score 7-8
  detractors: number; // score 0-6
  promoterPercentage: number;
  passivePercentage: number;
  detractorPercentage: number;
}

/**
 * NPS trend data point
 */
export interface NPSTrendPoint {
  date: Date;
  score: number;
  responseCount: number;
  promoters: number;
  passives: number;
  detractors: number;
}

/**
 * NPS trend analysis
 */
export interface NPSTrend {
  current: NPSData;
  previous?: NPSData;
  change: number;
  direction: 'improving' | 'stable' | 'declining';
  dataPoints: NPSTrendPoint[];
}

/**
 * Category breakdown for NPS analysis
 */
export interface CategoryBreakdown {
  category: FeedbackCategory;
  averageScore: number;
  count: number;
  npsScore: number;
  topIssues: string[];
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

/**
 * Pain point identified from feedback
 */
export interface PainPoint {
  id: string;
  description: string;
  category: FeedbackCategory;
  frequency: number;
  severity: 'high' | 'medium' | 'low';
  affectedUsers: number;
  examples: string[];
  firstReported: Date;
  lastReported: Date;
}

/**
 * Complete NPS analytics
 */
export interface NPSAnalytics {
  period: {
    start: Date;
    end: Date;
  };
  
  // Overall NPS data
  overall: NPSData;
  
  // Trend analysis
  trend: NPSTrend;
  
  // Category breakdown
  categoryBreakdown: CategoryBreakdown[];
  
  // Top feedback themes
  topFeedback: {
    positive: string[];
    negative: string[];
    suggestions: string[];
  };
  
  // Pain points
  painPoints: PainPoint[];
  
  // Response rate
  responseRate: {
    totalUsers: number;
    respondents: number;
    percentage: number;
  };
  
  // Metadata
  calculatedAt: Date;
}

/**
 * NPS survey configuration
 */
export interface NPSSurveyConfig {
  // Enable/disable NPS surveys
  enabled: boolean;
  
  // Survey trigger settings
  trigger: {
    // Trigger after X days of platform usage
    daysAfterFirstUse: number;
    // Trigger every X days for recurring surveys
    recurringIntervalDays: number;
    // Maximum surveys per user per year
    maxSurveysPerYear: number;
  };
  
  // Survey content
  content: {
    // Survey question
    question: string;
    // Follow-up question for comment
    followUpQuestion: string;
    // Thank you message
    thankYouMessage: string;
  };
  
  // Analysis settings
  analysis: {
    // Minimum responses for trend analysis
    minResponsesForTrend: number;
    // Sentiment analysis enabled
    sentimentAnalysis: boolean;
    // Auto-categorize feedback
    autoCategorize: boolean;
  };
  
  // Notification settings
  notifications: {
    // Notify on low NPS score
    notifyOnLowScore: boolean;
    // Threshold for low score notification
    lowScoreThreshold: number;
    // Notification channels (slack, email)
    channels: string[];
  };
}

/**
 * NPS feedback submission result
 */
export interface NPSSubmissionResult {
  success: boolean;
  feedbackId?: string;
  error?: string;
  timestamp: Date;
}

/**
 * NPS calculation result
 */
export interface NPSCalculationResult {
  success: boolean;
  analytics?: NPSAnalytics;
  errors: string[];
  calculatedAt: Date;
  duration: number; // in milliseconds
}

/**
 * Survey eligibility check result
 */
export interface SurveyEligibility {
  eligible: boolean;
  reason?: string;
  nextEligibleDate?: Date;
  surveysCompletedThisYear: number;
}
