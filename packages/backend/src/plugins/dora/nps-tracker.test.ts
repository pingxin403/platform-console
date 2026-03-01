/**
 * Tests for NPS Tracker
 */

import { Logger } from 'winston';
import { NPSTracker } from './nps-tracker';
import { NPSSurveyConfig, FeedbackCategory } from './nps-types';

// Mock logger
const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as any;

describe('NPSTracker', () => {
  let tracker: NPSTracker;
  let config: NPSSurveyConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      trigger: {
        daysAfterFirstUse: 7,
        recurringIntervalDays: 90,
        maxSurveysPerYear: 4,
      },
      content: {
        question: 'How likely are you to recommend this platform?',
        followUpQuestion: 'What is the main reason for your score?',
        thankYouMessage: 'Thank you for your feedback!',
      },
      analysis: {
        minResponsesForTrend: 5,
        sentimentAnalysis: true,
        autoCategorize: true,
      },
      notifications: {
        notifyOnLowScore: true,
        lowScoreThreshold: 6,
        channels: ['slack', 'email'],
      },
    };

    tracker = new NPSTracker(mockLogger, config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('submitFeedback', () => {
    it('should successfully submit valid feedback', async () => {
      const result = await tracker.submitFeedback(
        'user-1',
        'John Doe',
        'john@example.com',
        9,
        'Great platform!',
        'ease_of_use',
      );

      expect(result.success).toBe(true);
      expect(result.feedbackId).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should reject feedback with invalid score', async () => {
      const result = await tracker.submitFeedback(
        'user-1',
        'John Doe',
        'john@example.com',
        11, // Invalid score
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('between 0 and 10');
    });

    it('should auto-categorize feedback when enabled', async () => {
      const result = await tracker.submitFeedback(
        'user-1',
        'John Doe',
        'john@example.com',
        8,
        'The deployment process is very smooth',
      );

      expect(result.success).toBe(true);

      const feedback = tracker.getFeedback();
      expect(feedback[0].category).toBe('deployment');
    });

    it('should analyze sentiment from comment', async () => {
      const result = await tracker.submitFeedback(
        'user-1',
        'John Doe',
        'john@example.com',
        9,
        'This is an excellent platform, very easy to use!',
      );

      expect(result.success).toBe(true);

      const feedback = tracker.getFeedback();
      expect(feedback[0].sentiment).toBe('positive');
    });

    it('should log warning for low scores', async () => {
      await tracker.submitFeedback(
        'user-1',
        'John Doe',
        'john@example.com',
        3,
        'Very difficult to use',
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Low NPS score received',
        expect.objectContaining({
          userId: 'user-1',
          score: 3,
        }),
      );
    });

    it('should track user survey history', async () => {
      await tracker.submitFeedback('user-1', 'John Doe', 'john@example.com', 8);

      const history = tracker.getUserSurveyHistory('user-1');
      expect(history).toHaveLength(1);
      expect(history[0]).toBeInstanceOf(Date);
    });
  });

  describe('checkSurveyEligibility', () => {
    it('should allow eligible users', () => {
      const eligibility = tracker.checkSurveyEligibility('new-user');

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.surveysCompletedThisYear).toBe(0);
    });

    it('should reject when surveys disabled', () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledTracker = new NPSTracker(mockLogger, disabledConfig);

      const eligibility = disabledTracker.checkSurveyEligibility('user-1');

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toContain('disabled');
    });

    it('should reject when max surveys per year reached', async () => {
      // Submit 4 surveys (max) with sufficient time between them
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() - 365); // Start a year ago

      for (let i = 0; i < 4; i++) {
        // Mock the submission dates to be 91 days apart (more than recurring interval)
        await tracker.submitFeedback('user-1', 'John Doe', 'john@example.com', 8);
        
        // Manually adjust the survey history to simulate time passing
        const history = tracker.getUserSurveyHistory('user-1');
        if (history.length > 0) {
          const adjustedDate = new Date(baseDate);
          adjustedDate.setDate(adjustedDate.getDate() + (i * 91));
          history[history.length - 1] = adjustedDate;
        }
      }

      const eligibility = tracker.checkSurveyEligibility('user-1');

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toContain('Maximum surveys per year');
      expect(eligibility.surveysCompletedThisYear).toBe(4);
      expect(eligibility.nextEligibleDate).toBeDefined();
    });

    it('should reject when recurring interval not met', async () => {
      await tracker.submitFeedback('user-1', 'John Doe', 'john@example.com', 8);

      const eligibility = tracker.checkSurveyEligibility('user-1');

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toContain('wait');
      expect(eligibility.nextEligibleDate).toBeDefined();
    });
  });

  describe('calculateNPSAnalytics', () => {
    beforeEach(async () => {
      // Submit diverse feedback
      await tracker.submitFeedback('user-1', 'User 1', 'user1@example.com', 10, 'Excellent!', 'ease_of_use');
      await tracker.submitFeedback('user-2', 'User 2', 'user2@example.com', 9, 'Great platform', 'deployment');
      await tracker.submitFeedback('user-3', 'User 3', 'user3@example.com', 8, 'Good overall', 'service_catalog');
      await tracker.submitFeedback('user-4', 'User 4', 'user4@example.com', 7, 'Okay', 'documentation');
      await tracker.submitFeedback('user-5', 'User 5', 'user5@example.com', 5, 'Needs improvement', 'performance');
      await tracker.submitFeedback('user-6', 'User 6', 'user6@example.com', 3, 'Very slow', 'performance');
    });

    it('should calculate NPS score correctly', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const result = await tracker.calculateNPSAnalytics(startDate, endDate);

      expect(result.success).toBe(true);
      expect(result.analytics).toBeDefined();

      const { overall } = result.analytics!;
      expect(overall.responseCount).toBe(6);
      expect(overall.promoters).toBe(2); // scores 9-10
      expect(overall.passives).toBe(2); // scores 7-8
      expect(overall.detractors).toBe(2); // scores 0-6

      // NPS = (2/6 * 100) - (2/6 * 100) = 33.3 - 33.3 = 0
      expect(overall.score).toBe(0);
    });

    it('should calculate category breakdown', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const result = await tracker.calculateNPSAnalytics(startDate, endDate);

      expect(result.success).toBe(true);
      expect(result.analytics!.categoryBreakdown).toBeDefined();
      expect(result.analytics!.categoryBreakdown.length).toBeGreaterThan(0);

      // Check performance category (2 responses)
      const perfCategory = result.analytics!.categoryBreakdown.find(
        (c: any) => c.category === 'performance',
      );
      expect(perfCategory).toBeDefined();
      expect(perfCategory.count).toBe(2);
    });

    it('should identify pain points', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const result = await tracker.calculateNPSAnalytics(startDate, endDate);

      expect(result.success).toBe(true);
      expect(result.analytics!.painPoints).toBeDefined();

      // Should identify performance as a pain point (2 negative responses)
      const painPoints = result.analytics!.painPoints;
      const perfPainPoint = painPoints.find((p: any) => p.category === 'performance');
      expect(perfPainPoint).toBeDefined();
      expect(perfPainPoint.frequency).toBe(2);
    });

    it('should extract top feedback themes', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const result = await tracker.calculateNPSAnalytics(startDate, endDate);

      expect(result.success).toBe(true);
      expect(result.analytics!.topFeedback).toBeDefined();
      expect(result.analytics!.topFeedback.positive).toBeDefined();
      expect(result.analytics!.topFeedback.negative).toBeDefined();
    });

    it('should calculate response rate', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const result = await tracker.calculateNPSAnalytics(startDate, endDate);

      expect(result.success).toBe(true);
      expect(result.analytics!.responseRate).toBeDefined();
      expect(result.analytics!.responseRate.respondents).toBe(6);
      expect(result.analytics!.responseRate.totalUsers).toBeGreaterThanOrEqual(6);
    });

    it('should calculate trend', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const result = await tracker.calculateNPSAnalytics(startDate, endDate);

      expect(result.success).toBe(true);
      expect(result.analytics!.trend).toBeDefined();
      expect(result.analytics!.trend.current).toBeDefined();
      expect(result.analytics!.trend.direction).toMatch(/improving|stable|declining/);
    });

    it('should return error when no feedback available', async () => {
      tracker.clearData();

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const result = await tracker.calculateNPSAnalytics(startDate, endDate);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No feedback data available for the specified period');
    });
  });

  describe('NPS score calculation', () => {
    it('should calculate positive NPS for mostly promoters', async () => {
      // 7 promoters, 2 passives, 1 detractor
      for (let i = 0; i < 7; i++) {
        await tracker.submitFeedback(`user-${i}`, `User ${i}`, `user${i}@example.com`, 9);
      }
      for (let i = 7; i < 9; i++) {
        await tracker.submitFeedback(`user-${i}`, `User ${i}`, `user${i}@example.com`, 7);
      }
      await tracker.submitFeedback('user-9', 'User 9', 'user9@example.com', 5);

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const result = await tracker.calculateNPSAnalytics(startDate, endDate);

      expect(result.success).toBe(true);
      // NPS = (7/10 * 100) - (1/10 * 100) = 70 - 10 = 60
      expect(result.analytics!.overall.score).toBe(60);
    });

    it('should calculate negative NPS for mostly detractors', async () => {
      // 2 promoters, 1 passive, 7 detractors
      for (let i = 0; i < 2; i++) {
        await tracker.submitFeedback(`user-${i}`, `User ${i}`, `user${i}@example.com`, 9);
      }
      await tracker.submitFeedback('user-2', 'User 2', 'user2@example.com', 7);
      for (let i = 3; i < 10; i++) {
        await tracker.submitFeedback(`user-${i}`, `User ${i}`, `user${i}@example.com`, 5);
      }

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const result = await tracker.calculateNPSAnalytics(startDate, endDate);

      expect(result.success).toBe(true);
      // NPS = (2/10 * 100) - (7/10 * 100) = 20 - 70 = -50
      expect(result.analytics!.overall.score).toBe(-50);
    });
  });

  describe('sentiment analysis', () => {
    it('should detect positive sentiment', async () => {
      await tracker.submitFeedback(
        'user-1',
        'User 1',
        'user1@example.com',
        9,
        'This is an excellent and amazing platform!',
      );

      const feedback = tracker.getFeedback();
      expect(feedback[0].sentiment).toBe('positive');
    });

    it('should detect negative sentiment', async () => {
      await tracker.submitFeedback(
        'user-1',
        'User 1',
        'user1@example.com',
        3,
        'This is a bad and frustrating experience',
      );

      const feedback = tracker.getFeedback();
      expect(feedback[0].sentiment).toBe('negative');
    });

    it('should detect neutral sentiment', async () => {
      await tracker.submitFeedback(
        'user-1',
        'User 1',
        'user1@example.com',
        7,
        'It works as expected',
      );

      const feedback = tracker.getFeedback();
      expect(feedback[0].sentiment).toBe('neutral');
    });
  });

  describe('auto-categorization', () => {
    it('should categorize deployment-related feedback', async () => {
      await tracker.submitFeedback(
        'user-1',
        'User 1',
        'user1@example.com',
        8,
        'The deployment process with ArgoCD is smooth',
      );

      const feedback = tracker.getFeedback();
      expect(feedback[0].category).toBe('deployment');
    });

    it('should categorize cost-related feedback', async () => {
      await tracker.submitFeedback(
        'user-1',
        'User 1',
        'user1@example.com',
        7,
        'The cost management features are helpful',
      );

      const feedback = tracker.getFeedback();
      expect(feedback[0].category).toBe('cost_management');
    });

    it('should categorize observability-related feedback', async () => {
      await tracker.submitFeedback(
        'user-1',
        'User 1',
        'user1@example.com',
        9,
        'Datadog monitoring integration is excellent',
      );

      const feedback = tracker.getFeedback();
      expect(feedback[0].category).toBe('observability');
    });

    it('should default to "other" for uncategorizable feedback', async () => {
      await tracker.submitFeedback(
        'user-1',
        'User 1',
        'user1@example.com',
        8,
        'Random comment',
      );

      const feedback = tracker.getFeedback();
      expect(feedback[0].category).toBe('other');
    });
  });
});
