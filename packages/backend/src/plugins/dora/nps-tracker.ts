/**
 * Developer NPS Tracker
 * 
 * Collects and analyzes developer Net Promoter Score (NPS) feedback
 * to measure platform satisfaction and identify improvement areas.
 */

import { Logger } from 'winston';
import {
  NPSFeedback,
  NPSData,
  NPSAnalytics,
  NPSSurveyConfig,
  NPSSubmissionResult,
  NPSCalculationResult,
  NPSTrend,
  CategoryBreakdown,
  PainPoint,
  FeedbackCategory,
  NPSCategory,
  Sentiment,
  SurveyEligibility,
  NPSTrendPoint,
} from './nps-types';

export class NPSTracker {
  private readonly logger: Logger;
  private readonly config: NPSSurveyConfig;
  private feedbackData: NPSFeedback[] = [];
  private userSurveyHistory: Map<string, Date[]> = new Map();

  constructor(logger: Logger, config: NPSSurveyConfig) {
    this.logger = logger;
    this.config = config;
  }

  /**
   * Submit NPS feedback
   */
  async submitFeedback(
    userId: string,
    userName: string,
    email: string,
    score: number,
    comment?: string,
    category?: FeedbackCategory,
  ): Promise<NPSSubmissionResult> {
    const startTime = Date.now();

    try {
      // Validate score
      if (score < 0 || score > 10) {
        return {
          success: false,
          error: 'Score must be between 0 and 10',
          timestamp: new Date(),
        };
      }

      // Check eligibility
      const eligibility = this.checkSurveyEligibility(userId);
      if (!eligibility.eligible) {
        return {
          success: false,
          error: eligibility.reason,
          timestamp: new Date(),
        };
      }

      // Analyze sentiment if comment provided
      const sentiment = comment ? this.analyzeSentiment(comment, score) : undefined;

      // Auto-categorize if enabled and no category provided
      const finalCategory =
        category || (this.config.analysis.autoCategorize && comment
          ? this.categorizeFeedback(comment)
          : undefined);

      // Create feedback entry
      const feedback: NPSFeedback = {
        id: this.generateFeedbackId(),
        userId,
        userName,
        email,
        score,
        comment,
        category: finalCategory,
        sentiment,
        submittedAt: new Date(),
      };

      // Store feedback
      this.feedbackData.push(feedback);

      // Update user survey history
      const history = this.userSurveyHistory.get(userId) || [];
      history.push(new Date());
      this.userSurveyHistory.set(userId, history);

      this.logger.info('NPS feedback submitted', {
        userId,
        score,
        category: finalCategory,
        sentiment,
        duration: Date.now() - startTime,
      });

      // Check if notification needed
      if (this.config.notifications.notifyOnLowScore && score <= this.config.notifications.lowScoreThreshold) {
        this.logger.warn('Low NPS score received', {
          userId,
          userName,
          score,
          comment,
        });
        // TODO: Implement notification logic (Slack, Email)
      }

      return {
        success: true,
        feedbackId: feedback.id,
        timestamp: feedback.submittedAt,
      };
    } catch (error) {
      this.logger.error('Failed to submit NPS feedback', { error, userId });
      return {
        success: false,
        error: String(error),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Calculate NPS analytics for a time period
   */
  async calculateNPSAnalytics(startDate: Date, endDate: Date): Promise<NPSCalculationResult> {
    const startTime = Date.now();

    try {
      // Filter feedback for the period
      const periodFeedback = this.feedbackData.filter(
        f => f.submittedAt >= startDate && f.submittedAt <= endDate,
      );

      if (periodFeedback.length === 0) {
        return {
          success: false,
          errors: ['No feedback data available for the specified period'],
          calculatedAt: new Date(),
          duration: Date.now() - startTime,
        };
      }

      // Calculate overall NPS
      const overall = this.calculateNPSData(periodFeedback);

      // Calculate trend
      const trend = this.calculateTrend(startDate, endDate, overall);

      // Calculate category breakdown
      const categoryBreakdown = this.calculateCategoryBreakdown(periodFeedback);

      // Extract top feedback themes
      const topFeedback = this.extractTopFeedback(periodFeedback);

      // Identify pain points
      const painPoints = this.identifyPainPoints(periodFeedback);

      // Calculate response rate
      const responseRate = this.calculateResponseRate(periodFeedback);

      const analytics: NPSAnalytics = {
        period: {
          start: startDate,
          end: endDate,
        },
        overall,
        trend,
        categoryBreakdown,
        topFeedback,
        painPoints,
        responseRate,
        calculatedAt: new Date(),
      };

      this.logger.info('NPS analytics calculated', {
        period: { start: startDate, end: endDate },
        npsScore: overall.score,
        responseCount: overall.responseCount,
        duration: Date.now() - startTime,
      });

      return {
        success: true,
        analytics,
        errors: [],
        calculatedAt: new Date(),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error('Failed to calculate NPS analytics', { error });
      return {
        success: false,
        errors: [String(error)],
        calculatedAt: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if user is eligible for survey
   */
  checkSurveyEligibility(userId: string): SurveyEligibility {
    if (!this.config.enabled) {
      return {
        eligible: false,
        reason: 'NPS surveys are currently disabled',
        surveysCompletedThisYear: 0,
      };
    }

    const history = this.userSurveyHistory.get(userId) || [];
    
    // Check surveys completed this year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const surveysThisYear = history.filter(date => date >= oneYearAgo).length;

    if (surveysThisYear >= this.config.trigger.maxSurveysPerYear) {
      const oldestSurvey = history.filter(date => date >= oneYearAgo).sort((a, b) => a.getTime() - b.getTime())[0];
      const nextEligibleDate = new Date(oldestSurvey);
      nextEligibleDate.setFullYear(nextEligibleDate.getFullYear() + 1);

      return {
        eligible: false,
        reason: `Maximum surveys per year (${this.config.trigger.maxSurveysPerYear}) reached`,
        nextEligibleDate,
        surveysCompletedThisYear: surveysThisYear,
      };
    }

    // Check recurring interval
    if (history.length > 0) {
      const lastSurvey = history[history.length - 1];
      const daysSinceLastSurvey = Math.floor(
        (Date.now() - lastSurvey.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysSinceLastSurvey < this.config.trigger.recurringIntervalDays) {
        const nextEligibleDate = new Date(lastSurvey);
        nextEligibleDate.setDate(nextEligibleDate.getDate() + this.config.trigger.recurringIntervalDays);

        return {
          eligible: false,
          reason: `Please wait ${this.config.trigger.recurringIntervalDays - daysSinceLastSurvey} more days before next survey`,
          nextEligibleDate,
          surveysCompletedThisYear: surveysThisYear,
        };
      }
    }

    return {
      eligible: true,
      surveysCompletedThisYear: surveysThisYear,
    };
  }

  /**
   * Calculate NPS data from feedback
   */
  private calculateNPSData(feedback: NPSFeedback[]): NPSData {
    const promoters = feedback.filter(f => f.score >= 9).length;
    const passives = feedback.filter(f => f.score >= 7 && f.score <= 8).length;
    const detractors = feedback.filter(f => f.score <= 6).length;
    const total = feedback.length;

    const promoterPercentage = (promoters / total) * 100;
    const passivePercentage = (passives / total) * 100;
    const detractorPercentage = (detractors / total) * 100;

    // NPS = % Promoters - % Detractors
    const score = Math.round(promoterPercentage - detractorPercentage);

    return {
      score,
      responseCount: total,
      promoters,
      passives,
      detractors,
      promoterPercentage: Math.round(promoterPercentage * 10) / 10,
      passivePercentage: Math.round(passivePercentage * 10) / 10,
      detractorPercentage: Math.round(detractorPercentage * 10) / 10,
    };
  }

  /**
   * Calculate NPS trend
   */
  private calculateTrend(startDate: Date, endDate: Date, current: NPSData): NPSTrend {
    // Calculate previous period
    const periodDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const previousStart = new Date(startDate);
    previousStart.setDate(previousStart.getDate() - periodDays);
    const previousEnd = new Date(startDate);

    const previousFeedback = this.feedbackData.filter(
      f => f.submittedAt >= previousStart && f.submittedAt < previousEnd,
    );

    const previous = previousFeedback.length > 0 ? this.calculateNPSData(previousFeedback) : undefined;

    // Calculate change
    const change = previous ? current.score - previous.score : 0;
    const direction: 'improving' | 'stable' | 'declining' =
      change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable';

    // Generate data points (weekly)
    const dataPoints: NPSTrendPoint[] = [];
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    let currentWeekStart = new Date(startDate);

    while (currentWeekStart < endDate) {
      const weekEnd = new Date(Math.min(currentWeekStart.getTime() + weekMs, endDate.getTime()));
      const weekFeedback = this.feedbackData.filter(
        f => f.submittedAt >= currentWeekStart && f.submittedAt < weekEnd,
      );

      if (weekFeedback.length > 0) {
        const weekData = this.calculateNPSData(weekFeedback);
        dataPoints.push({
          date: new Date(currentWeekStart),
          score: weekData.score,
          responseCount: weekData.responseCount,
          promoters: weekData.promoters,
          passives: weekData.passives,
          detractors: weekData.detractors,
        });
      }

      currentWeekStart = weekEnd;
    }

    return {
      current,
      previous,
      change,
      direction,
      dataPoints,
    };
  }

  /**
   * Calculate category breakdown
   */
  private calculateCategoryBreakdown(feedback: NPSFeedback[]): CategoryBreakdown[] {
    const categories = new Map<FeedbackCategory, NPSFeedback[]>();

    // Group feedback by category
    feedback.forEach(f => {
      if (f.category) {
        const categoryFeedback = categories.get(f.category) || [];
        categoryFeedback.push(f);
        categories.set(f.category, categoryFeedback);
      }
    });

    // Calculate breakdown for each category
    const breakdown: CategoryBreakdown[] = [];
    categories.forEach((categoryFeedback, category) => {
      const averageScore = categoryFeedback.reduce((sum, f) => sum + f.score, 0) / categoryFeedback.length;
      const npsData = this.calculateNPSData(categoryFeedback);
      
      // Extract top issues from comments
      const comments = categoryFeedback.filter(f => f.comment).map(f => f.comment!);
      const topIssues = this.extractKeyPhrases(comments).slice(0, 5);

      // Calculate sentiment distribution
      const sentimentCounts = {
        positive: categoryFeedback.filter(f => f.sentiment === 'positive').length,
        neutral: categoryFeedback.filter(f => f.sentiment === 'neutral').length,
        negative: categoryFeedback.filter(f => f.sentiment === 'negative').length,
      };

      breakdown.push({
        category,
        averageScore: Math.round(averageScore * 10) / 10,
        count: categoryFeedback.length,
        npsScore: npsData.score,
        topIssues,
        sentiment: sentimentCounts,
      });
    });

    // Sort by count (most feedback first)
    return breakdown.sort((a, b) => b.count - a.count);
  }

  /**
   * Extract top feedback themes
   */
  private extractTopFeedback(feedback: NPSFeedback[]): {
    positive: string[];
    negative: string[];
    suggestions: string[];
  } {
    const positive = feedback.filter(f => f.sentiment === 'positive' && f.comment).map(f => f.comment!);
    const negative = feedback.filter(f => f.sentiment === 'negative' && f.comment).map(f => f.comment!);
    
    // Extract suggestions (comments containing "should", "could", "would like", etc.)
    const suggestions = feedback
      .filter(f => f.comment && /should|could|would like|suggest|recommend|wish/i.test(f.comment))
      .map(f => f.comment!);

    return {
      positive: this.extractKeyPhrases(positive).slice(0, 10),
      negative: this.extractKeyPhrases(negative).slice(0, 10),
      suggestions: this.extractKeyPhrases(suggestions).slice(0, 10),
    };
  }

  /**
   * Identify pain points from feedback
   */
  private identifyPainPoints(feedback: NPSFeedback[]): PainPoint[] {
    // Group negative feedback by category
    const negativeFeedback = feedback.filter(f => f.score <= 6 && f.comment);
    const painPointMap = new Map<string, NPSFeedback[]>();

    negativeFeedback.forEach(f => {
      const key = f.category || 'other';
      const existing = painPointMap.get(key) || [];
      existing.push(f);
      painPointMap.set(key, existing);
    });

    // Create pain points
    const painPoints: PainPoint[] = [];
    painPointMap.forEach((feedbackList, category) => {
      if (feedbackList.length >= 2) { // Minimum 2 reports to be considered a pain point
        const comments = feedbackList.map(f => f.comment!);
        const keyPhrases = this.extractKeyPhrases(comments);
        
        painPoints.push({
          id: this.generatePainPointId(),
          description: keyPhrases[0] || `Issues with ${category}`,
          category: category as FeedbackCategory,
          frequency: feedbackList.length,
          severity: feedbackList.length >= 5 ? 'high' : feedbackList.length >= 3 ? 'medium' : 'low',
          affectedUsers: new Set(feedbackList.map(f => f.userId)).size,
          examples: comments.slice(0, 3),
          firstReported: feedbackList.sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())[0].submittedAt,
          lastReported: feedbackList.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0].submittedAt,
        });
      }
    });

    // Sort by severity and frequency
    return painPoints.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      return severityDiff !== 0 ? severityDiff : b.frequency - a.frequency;
    });
  }

  /**
   * Calculate response rate
   */
  private calculateResponseRate(feedback: NPSFeedback[]): {
    totalUsers: number;
    respondents: number;
    percentage: number;
  } {
    // Get unique users who submitted feedback
    const respondents = new Set(feedback.map(f => f.userId)).size;
    
    // Estimate total users (this would ideally come from user management system)
    // For now, use the number of unique users in survey history
    const totalUsers = this.userSurveyHistory.size || respondents;

    const percentage = totalUsers > 0 ? (respondents / totalUsers) * 100 : 0;

    return {
      totalUsers,
      respondents,
      percentage: Math.round(percentage * 10) / 10,
    };
  }

  /**
   * Analyze sentiment from comment and score
   */
  private analyzeSentiment(comment: string, score: number): Sentiment {
    if (!this.config.analysis.sentimentAnalysis) {
      // Simple sentiment based on score
      return score >= 9 ? 'positive' : score <= 6 ? 'negative' : 'neutral';
    }

    // Simple keyword-based sentiment analysis
    const positiveKeywords = ['great', 'excellent', 'love', 'amazing', 'helpful', 'easy', 'fast', 'good', 'best'];
    const negativeKeywords = ['bad', 'slow', 'difficult', 'confusing', 'frustrating', 'poor', 'hate', 'worst', 'broken'];

    const lowerComment = comment.toLowerCase();
    const positiveCount = positiveKeywords.filter(word => lowerComment.includes(word)).length;
    const negativeCount = negativeKeywords.filter(word => lowerComment.includes(word)).length;

    if (positiveCount > negativeCount) {
      return 'positive';
    } else if (negativeCount > positiveCount) {
      return 'negative';
    } else {
      // Use score as tiebreaker
      return score >= 9 ? 'positive' : score <= 6 ? 'negative' : 'neutral';
    }
  }

  /**
   * Categorize feedback based on comment content
   */
  private categorizeFeedback(comment: string): FeedbackCategory {
    const lowerComment = comment.toLowerCase();

    const categoryKeywords: Record<FeedbackCategory, string[]> = {
      service_catalog: ['catalog', 'service', 'discovery', 'find'],
      golden_paths: ['template', 'scaffolder', 'create', 'generate', 'golden path'],
      deployment: ['deploy', 'deployment', 'argocd', 'release', 'rollout'],
      observability: ['monitoring', 'logs', 'metrics', 'datadog', 'sentry', 'observability'],
      cost_management: ['cost', 'budget', 'expense', 'finops', 'opencost'],
      documentation: ['docs', 'documentation', 'readme', 'guide', 'tutorial'],
      performance: ['slow', 'fast', 'performance', 'speed', 'latency'],
      ease_of_use: ['easy', 'difficult', 'simple', 'complex', 'intuitive', 'confusing'],
      support: ['support', 'help', 'assistance', 'question'],
      other: [],
    };

    // Count keyword matches for each category
    const categoryScores = new Map<FeedbackCategory, number>();
    Object.entries(categoryKeywords).forEach(([category, keywords]) => {
      const score = keywords.filter(keyword => lowerComment.includes(keyword)).length;
      if (score > 0) {
        categoryScores.set(category as FeedbackCategory, score);
      }
    });

    // Return category with highest score
    if (categoryScores.size > 0) {
      const sortedCategories = Array.from(categoryScores.entries()).sort((a, b) => b[1] - a[1]);
      return sortedCategories[0][0];
    }

    return 'other';
  }

  /**
   * Extract key phrases from comments
   */
  private extractKeyPhrases(comments: string[]): string[] {
    if (comments.length === 0) return [];

    // Simple phrase extraction: find common words/phrases
    const phrases = new Map<string, number>();

    comments.forEach(comment => {
      // Split into sentences
      const sentences = comment.split(/[.!?]+/).filter(s => s.trim().length > 10);
      sentences.forEach(sentence => {
        const trimmed = sentence.trim();
        if (trimmed.length > 0) {
          phrases.set(trimmed, (phrases.get(trimmed) || 0) + 1);
        }
      });
    });

    // Sort by frequency and return top phrases
    return Array.from(phrases.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([phrase]) => phrase);
  }

  /**
   * Generate unique feedback ID
   */
  private generateFeedbackId(): string {
    return `nps-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique pain point ID
   */
  private generatePainPointId(): string {
    return `pain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all feedback data
   */
  getFeedback(): NPSFeedback[] {
    return [...this.feedbackData];
  }

  /**
   * Get user survey history
   */
  getUserSurveyHistory(userId: string): Date[] {
    return this.userSurveyHistory.get(userId) || [];
  }

  /**
   * Clear all data (for testing)
   */
  clearData(): void {
    this.feedbackData = [];
    this.userSurveyHistory.clear();
  }
}
