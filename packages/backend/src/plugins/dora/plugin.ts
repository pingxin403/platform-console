/**
 * DORA Metrics Backend Plugin
 * 
 * Provides API endpoints for DORA metrics data collection and calculation
 */

import { Logger } from 'winston';
import express from 'express';
import { DORADataCollector } from './data-collector';
import { DORACollectorConfig, TimePeriod } from './types';
import { AdoptionTracker } from './adoption-tracker';
import { AdoptionAnalyticsConfig } from './adoption-types';
import { NPSTracker } from './nps-tracker';
import { NPSSurveyConfig, FeedbackCategory } from './nps-types';
import { BottleneckAnalyzer } from './bottleneck-analyzer';
import { BottleneckAnalysisConfig, WorkflowTiming } from './bottleneck-types';

export interface DORAPluginOptions {
  logger: Logger;
  config: DORACollectorConfig;
  adoptionConfig?: AdoptionAnalyticsConfig;
  npsConfig?: NPSSurveyConfig;
  bottleneckConfig?: BottleneckAnalysisConfig;
}

export class DORAPlugin {
  private readonly logger: Logger;
  private readonly collector: DORADataCollector;
  private readonly adoptionTracker?: AdoptionTracker;
  private readonly npsTracker?: NPSTracker;
  private readonly bottleneckAnalyzer?: BottleneckAnalyzer;
  private collectionInterval?: NodeJS.Timeout;

  constructor(options: DORAPluginOptions) {
    this.logger = options.logger;
    this.collector = new DORADataCollector(options.logger, options.config);

    // Initialize adoption tracker if config provided
    if (options.adoptionConfig) {
      this.adoptionTracker = new AdoptionTracker(options.logger, options.adoptionConfig);
    }

    // Initialize NPS tracker if config provided
    if (options.npsConfig) {
      this.npsTracker = new NPSTracker(options.logger, options.npsConfig);
    }

    // Initialize bottleneck analyzer if config provided
    if (options.bottleneckConfig) {
      this.bottleneckAnalyzer = new BottleneckAnalyzer(options.logger, options.bottleneckConfig);
    }

    // Start automatic collection if configured
    if (options.config.collection.intervalMinutes > 0) {
      this.startAutomaticCollection(options.config.collection.intervalMinutes);
    }
  }

  /**
   * Create Express router for DORA metrics API
   */
  createRouter(): express.Router {
    const router = express.Router();

    // Health check
    router.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Trigger manual data collection
    router.post('/collect', async (req, res) => {
      try {
        const { startDate, endDate } = req.body;
        
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        this.logger.info('Manual data collection triggered', {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        });

        const result = await this.collector.collectAllData(start, end);

        res.json({
          success: result.success,
          results: result.results,
          summary: {
            deployments: result.deployments.length,
            pullRequests: result.pullRequests.length,
            incidents: result.incidents.length,
          },
        });
      } catch (error) {
        this.logger.error('Manual collection failed', { error });
        res.status(500).json({
          error: 'Collection failed',
          message: String(error),
        });
      }
    });

    // Calculate metrics for a service
    router.post('/metrics/service/:serviceId', async (req, res) => {
      try {
        const { serviceId } = req.params;
        const { serviceName, period, startDate, endDate } = req.body;

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        const timePeriod: TimePeriod = period || 'weekly';

        this.logger.info('Calculating service metrics', {
          serviceId,
          period: timePeriod,
        });

        const result = await this.collector.calculateServiceMetrics(
          serviceId,
          serviceName || serviceId,
          timePeriod,
          start,
          end,
        );

        if (result.success) {
          res.json({
            success: true,
            metrics: result.metrics,
          });
        } else {
          res.status(500).json({
            success: false,
            errors: result.errors,
          });
        }
      } catch (error) {
        this.logger.error('Metrics calculation failed', { error });
        res.status(500).json({
          error: 'Calculation failed',
          message: String(error),
        });
      }
    });

    // Calculate metrics for all services
    router.post('/metrics/all', async (req, res) => {
      try {
        const { period, startDate, endDate } = req.body;

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        const timePeriod: TimePeriod = period || 'weekly';

        this.logger.info('Calculating metrics for all services', {
          period: timePeriod,
        });

        const results = await this.collector.calculateAllServiceMetrics(
          timePeriod,
          start,
          end,
        );

        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        res.json({
          success: failed.length === 0,
          total: results.length,
          successful: successful.length,
          failed: failed.length,
          metrics: successful.map(r => r.metrics),
          errors: failed.flatMap(r => r.errors),
        });
      } catch (error) {
        this.logger.error('Metrics calculation failed', { error });
        res.status(500).json({
          error: 'Calculation failed',
          message: String(error),
        });
      }
    });

    // Run full collection cycle
    router.post('/cycle', async (req, res) => {
      try {
        const { period } = req.body;
        const timePeriod: TimePeriod = period || 'weekly';

        this.logger.info('Running full collection cycle', { period: timePeriod });

        const result = await this.collector.runCollectionCycle(timePeriod);

        res.json({
          success: result.success,
          collection: {
            results: result.collectionResults,
            summary: {
              total: result.collectionResults.length,
              successful: result.collectionResults.filter(r => r.success).length,
            },
          },
          calculation: {
            results: result.calculationResults.map(r => ({
              entityId: r.entityId,
              success: r.success,
              metrics: r.metrics,
            })),
            summary: {
              total: result.calculationResults.length,
              successful: result.calculationResults.filter(r => r.success).length,
            },
          },
        });
      } catch (error) {
        this.logger.error('Collection cycle failed', { error });
        res.status(500).json({
          error: 'Cycle failed',
          message: String(error),
        });
      }
    });

    // Get collected data summary
    router.get('/data/summary', (req, res) => {
      const deployments = this.collector.getDeployments();
      const pullRequests = this.collector.getPullRequests();
      const incidents = this.collector.getIncidents();

      res.json({
        deployments: {
          total: deployments.length,
          byEnvironment: {
            production: deployments.filter(d => d.environment === 'production').length,
            staging: deployments.filter(d => d.environment === 'staging').length,
            development: deployments.filter(d => d.environment === 'development').length,
          },
          byStatus: {
            success: deployments.filter(d => d.status === 'success').length,
            failed: deployments.filter(d => d.status === 'failed').length,
            rollback: deployments.filter(d => d.status === 'rollback').length,
          },
        },
        pullRequests: {
          total: pullRequests.length,
          merged: pullRequests.filter(pr => pr.mergedAt !== null).length,
        },
        incidents: {
          total: incidents.length,
          resolved: incidents.filter(i => i.resolvedAt !== null).length,
          bySeverity: {
            critical: incidents.filter(i => i.severity === 'critical').length,
            high: incidents.filter(i => i.severity === 'high').length,
            medium: incidents.filter(i => i.severity === 'medium').length,
            low: incidents.filter(i => i.severity === 'low').length,
          },
        },
      });
    });

    // Adoption Analytics Endpoints

    // Track user activity
    router.post('/adoption/activity', async (req, res) => {
      if (!this.adoptionTracker) {
        res.status(503).json({
          error: 'Adoption tracking is not enabled',
        });
        return;
      }

      try {
        const { userId, userName, email, action, feature, metadata } = req.body;

        if (!userId || !action || !feature) {
          res.status(400).json({
            error: 'Missing required fields: userId, action, feature',
          });
          return;
        }

        const result = await this.adoptionTracker.trackActivity(
          userId,
          userName || 'Unknown',
          email || 'unknown@example.com',
          action,
          feature,
          metadata,
        );

        res.json(result);
      } catch (error) {
        this.logger.error('Failed to track activity', { error });
        res.status(500).json({
          error: 'Failed to track activity',
          message: String(error),
        });
      }
    });

    // Track service creation
    router.post('/adoption/service-creation', async (req, res) => {
      if (!this.adoptionTracker) {
        res.status(503).json({
          error: 'Adoption tracking is not enabled',
        });
        return;
      }

      try {
        const { serviceId, serviceName, templateId, templateName, createdBy, team } = req.body;

        if (!serviceId || !serviceName || !templateId || !createdBy || !team) {
          res.status(400).json({
            error: 'Missing required fields: serviceId, serviceName, templateId, createdBy, team',
          });
          return;
        }

        const result = await this.adoptionTracker.trackServiceCreation(
          serviceId,
          serviceName,
          templateId,
          templateName || templateId,
          createdBy,
          team,
        );

        res.json(result);
      } catch (error) {
        this.logger.error('Failed to track service creation', { error });
        res.status(500).json({
          error: 'Failed to track service creation',
          message: String(error),
        });
      }
    });

    // Get adoption metrics
    router.get('/adoption/metrics', async (req, res) => {
      if (!this.adoptionTracker) {
        res.status(503).json({
          error: 'Adoption tracking is not enabled',
        });
        return;
      }

      try {
        const { startDate, endDate } = req.query;

        const start = startDate
          ? new Date(startDate as string)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
        const end = endDate ? new Date(endDate as string) : new Date();

        this.logger.info('Calculating adoption metrics', {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        });

        const result = await this.adoptionTracker.calculateAdoptionMetrics(start, end);

        if (result.success) {
          res.json({
            success: true,
            metrics: result.metrics,
          });
        } else {
          res.status(500).json({
            success: false,
            errors: result.errors,
          });
        }
      } catch (error) {
        this.logger.error('Failed to calculate adoption metrics', { error });
        res.status(500).json({
          error: 'Failed to calculate adoption metrics',
          message: String(error),
        });
      }
    });

    // Get activity summary
    router.get('/adoption/activity/summary', (req, res) => {
      if (!this.adoptionTracker) {
        res.status(503).json({
          error: 'Adoption tracking is not enabled',
        });
        return;
      }

      try {
        const activities = this.adoptionTracker.getActivities();
        const serviceCreations = this.adoptionTracker.getServiceCreations();

        // Calculate summary statistics
        const uniqueUsers = new Set(activities.map(a => a.userId)).size;
        const uniqueFeatures = new Set(activities.map(a => a.feature)).size;

        // Get recent activities (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentActivities = activities.filter(a => a.timestamp >= oneDayAgo);

        res.json({
          total: {
            activities: activities.length,
            users: uniqueUsers,
            features: uniqueFeatures,
            serviceCreations: serviceCreations.length,
          },
          recent: {
            activities: recentActivities.length,
            users: new Set(recentActivities.map(a => a.userId)).size,
          },
          oldest: activities.length > 0 ? activities[0].timestamp : null,
          newest: activities.length > 0 ? activities[activities.length - 1].timestamp : null,
        });
      } catch (error) {
        this.logger.error('Failed to get activity summary', { error });
        res.status(500).json({
          error: 'Failed to get activity summary',
          message: String(error),
        });
      }
    });

    // NPS (Net Promoter Score) Endpoints

    // Submit NPS feedback
    router.post('/nps/feedback', async (req, res) => {
      if (!this.npsTracker) {
        res.status(503).json({
          error: 'NPS tracking is not enabled',
        });
        return;
      }

      try {
        const { userId, userName, email, score, comment, category } = req.body;

        if (!userId || !userName || !email || score === undefined) {
          res.status(400).json({
            error: 'Missing required fields: userId, userName, email, score',
          });
          return;
        }

        if (score < 0 || score > 10) {
          res.status(400).json({
            error: 'Score must be between 0 and 10',
          });
          return;
        }

        const result = await this.npsTracker.submitFeedback(
          userId,
          userName,
          email,
          score,
          comment,
          category as FeedbackCategory,
        );

        if (result.success) {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (error) {
        this.logger.error('Failed to submit NPS feedback', { error });
        res.status(500).json({
          error: 'Failed to submit NPS feedback',
          message: String(error),
        });
      }
    });

    // Get NPS analytics
    router.get('/nps/analytics', async (req, res) => {
      if (!this.npsTracker) {
        res.status(503).json({
          error: 'NPS tracking is not enabled',
        });
        return;
      }

      try {
        const { startDate, endDate } = req.query;

        const start = startDate
          ? new Date(startDate as string)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
        const end = endDate ? new Date(endDate as string) : new Date();

        this.logger.info('Calculating NPS analytics', {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        });

        const result = await this.npsTracker.calculateNPSAnalytics(start, end);

        if (result.success) {
          res.json({
            success: true,
            analytics: result.analytics,
          });
        } else {
          res.status(500).json({
            success: false,
            errors: result.errors,
          });
        }
      } catch (error) {
        this.logger.error('Failed to calculate NPS analytics', { error });
        res.status(500).json({
          error: 'Failed to calculate NPS analytics',
          message: String(error),
        });
      }
    });

    // Check survey eligibility
    router.get('/nps/eligibility/:userId', (req, res) => {
      if (!this.npsTracker) {
        res.status(503).json({
          error: 'NPS tracking is not enabled',
        });
        return;
      }

      try {
        const { userId } = req.params;

        if (!userId) {
          res.status(400).json({
            error: 'Missing required parameter: userId',
          });
          return;
        }

        const eligibility = this.npsTracker.checkSurveyEligibility(userId);
        res.json(eligibility);
      } catch (error) {
        this.logger.error('Failed to check survey eligibility', { error });
        res.status(500).json({
          error: 'Failed to check survey eligibility',
          message: String(error),
        });
      }
    });

    // Get feedback summary
    router.get('/nps/feedback/summary', (req, res) => {
      if (!this.npsTracker) {
        res.status(503).json({
          error: 'NPS tracking is not enabled',
        });
        return;
      }

      try {
        const feedback = this.npsTracker.getFeedback();

        // Calculate summary statistics
        const totalFeedback = feedback.length;
        const averageScore = totalFeedback > 0
          ? feedback.reduce((sum, f) => sum + f.score, 0) / totalFeedback
          : 0;

        const promoters = feedback.filter(f => f.score >= 9).length;
        const passives = feedback.filter(f => f.score >= 7 && f.score <= 8).length;
        const detractors = feedback.filter(f => f.score <= 6).length;

        const withComments = feedback.filter(f => f.comment).length;
        const categorized = feedback.filter(f => f.category).length;

        res.json({
          total: totalFeedback,
          averageScore: Math.round(averageScore * 10) / 10,
          distribution: {
            promoters,
            passives,
            detractors,
          },
          withComments,
          categorized,
          oldest: totalFeedback > 0 ? feedback[0].submittedAt : null,
          newest: totalFeedback > 0 ? feedback[totalFeedback - 1].submittedAt : null,
        });
      } catch (error) {
        this.logger.error('Failed to get feedback summary', { error });
        res.status(500).json({
          error: 'Failed to get feedback summary',
          message: String(error),
        });
      }
    });

    // Bottleneck Analysis Endpoints

    // Track workflow timing
    router.post('/bottleneck/timing', async (req, res) => {
      if (!this.bottleneckAnalyzer) {
        res.status(503).json({
          error: 'Bottleneck analysis is not enabled',
        });
        return;
      }

      try {
        const { stage, startTime, endTime, duration, userId, entityId, entityType, metadata } = req.body;

        if (!stage || !startTime || !endTime || !duration || !entityId || !entityType) {
          res.status(400).json({
            error: 'Missing required fields: stage, startTime, endTime, duration, entityId, entityType',
          });
          return;
        }

        const timing: WorkflowTiming = {
          stage,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          duration,
          userId,
          entityId,
          entityType,
          metadata,
        };

        await this.bottleneckAnalyzer.trackWorkflowTiming(timing);

        res.json({
          success: true,
          message: 'Workflow timing tracked successfully',
        });
      } catch (error) {
        this.logger.error('Failed to track workflow timing', { error });
        res.status(500).json({
          error: 'Failed to track workflow timing',
          message: String(error),
        });
      }
    });

    // Analyze bottlenecks
    router.get('/bottleneck/analyze', async (req, res) => {
      if (!this.bottleneckAnalyzer) {
        res.status(503).json({
          error: 'Bottleneck analysis is not enabled',
        });
        return;
      }

      try {
        const { startDate, endDate } = req.query;

        const start = startDate
          ? new Date(startDate as string)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
        const end = endDate ? new Date(endDate as string) : new Date();

        this.logger.info('Analyzing bottlenecks', {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        });

        const result = await this.bottleneckAnalyzer.analyzeBottlenecks(start, end);

        if (result.success) {
          res.json({
            success: true,
            bottlenecks: result.bottlenecks,
            frictionAreas: result.frictionAreas,
            summary: result.summary,
          });
        } else {
          res.status(500).json({
            success: false,
            errors: result.errors,
          });
        }
      } catch (error) {
        this.logger.error('Failed to analyze bottlenecks', { error });
        res.status(500).json({
          error: 'Failed to analyze bottlenecks',
          message: String(error),
        });
      }
    });

    // Get workflow timing summary
    router.get('/bottleneck/timing/summary', (req, res) => {
      if (!this.bottleneckAnalyzer) {
        res.status(503).json({
          error: 'Bottleneck analysis is not enabled',
        });
        return;
      }

      try {
        const timings = this.bottleneckAnalyzer.getWorkflowTimings();

        // Calculate summary statistics
        const totalTimings = timings.length;
        const uniqueStages = new Set(timings.map(t => t.stage)).size;
        const uniqueUsers = new Set(timings.filter(t => t.userId).map(t => t.userId!)).size;
        const uniqueEntities = new Set(timings.map(t => t.entityId)).size;

        // Calculate average duration by stage
        const durationByStage: Record<string, { count: number; total: number; average: number }> = {};
        timings.forEach(t => {
          if (!durationByStage[t.stage]) {
            durationByStage[t.stage] = { count: 0, total: 0, average: 0 };
          }
          durationByStage[t.stage].count++;
          durationByStage[t.stage].total += t.duration;
        });

        Object.keys(durationByStage).forEach(stage => {
          durationByStage[stage].average = durationByStage[stage].total / durationByStage[stage].count;
        });

        res.json({
          total: totalTimings,
          uniqueStages,
          uniqueUsers,
          uniqueEntities,
          durationByStage,
          oldest: totalTimings > 0 ? timings[0].startTime : null,
          newest: totalTimings > 0 ? timings[totalTimings - 1].endTime : null,
        });
      } catch (error) {
        this.logger.error('Failed to get timing summary', { error });
        res.status(500).json({
          error: 'Failed to get timing summary',
          message: String(error),
        });
      }
    });

    return router;
  }

  /**
   * Start automatic data collection
   */
  private startAutomaticCollection(intervalMinutes: number): void {
    this.logger.info('Starting automatic DORA data collection', {
      intervalMinutes,
    });

    // Run immediately
    this.collector.runCollectionCycle('weekly').catch(error => {
      this.logger.error('Initial collection cycle failed', { error });
    });

    // Schedule periodic collection
    this.collectionInterval = setInterval(
      () => {
        this.collector.runCollectionCycle('weekly').catch(error => {
          this.logger.error('Scheduled collection cycle failed', { error });
        });
      },
      intervalMinutes * 60 * 1000,
    );
  }

  /**
   * Stop automatic data collection
   */
  stopAutomaticCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
      this.logger.info('Stopped automatic DORA data collection');
    }
  }

  /**
   * Get the data collector instance
   */
  getCollector(): DORADataCollector {
    return this.collector;
  }

  /**
   * Get the adoption tracker instance
   */
  getAdoptionTracker(): AdoptionTracker | undefined {
    return this.adoptionTracker;
  }

  /**
   * Get the NPS tracker instance
   */
  getNPSTracker(): NPSTracker | undefined {
    return this.npsTracker;
  }

  /**
   * Get the bottleneck analyzer instance
   */
  getBottleneckAnalyzer(): BottleneckAnalyzer | undefined {
    return this.bottleneckAnalyzer;
  }
}

/**
 * Create DORA plugin instance
 */
export function createDORAPlugin(options: DORAPluginOptions): DORAPlugin {
  return new DORAPlugin(options);
}
