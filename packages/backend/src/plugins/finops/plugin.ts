/**
 * FinOps Cost Estimation Backstage Plugin
 */

import { createBackendPlugin } from '@backstage/backend-plugin-api';
import { coreServices } from '@backstage/backend-plugin-api';
import { Router } from 'express';
import { CostEstimationEngine } from './cost-estimation-engine';
import { BudgetManager } from './budget-manager';
import { AnomalyDetector } from './anomaly-detector';
import { AlertEngine } from './alert-engine';
import { AnomalyScheduler } from './anomaly-scheduler';
import { CostEfficiencyCalculator } from './cost-efficiency';
import { CostEstimationConfig, AnomalyDetectionConfig, AlertConfig } from './types';

export const finopsCostEstimationPlugin = createBackendPlugin({
  pluginId: 'finops-cost-estimation',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        httpRouter: coreServices.httpRouter,
      },
      async init({ config, logger, httpRouter }) {
        // Load configuration
        const finopsConfig: CostEstimationConfig = {
          opencost: {
            baseUrl: config.getString('opencost.baseUrl'),
          },
          aws: {
            enabled: config.getOptionalBoolean('opencost.aws.enabled') ?? false,
            region: config.getOptionalString('opencost.aws.costExplorer.region') ?? 'us-east-1',
          },
          cache: {
            ttl: 900, // 15 minutes
          },
          pricing: {
            kubernetes: {
              // Default pricing (can be overridden in config)
              cpuPerCorePerHour: config.getOptionalNumber('finops.pricing.kubernetes.cpuPerCorePerHour') ?? 0.031,
              memoryPerGBPerHour: config.getOptionalNumber('finops.pricing.kubernetes.memoryPerGBPerHour') ?? 0.004,
              storagePerGBPerMonth: config.getOptionalNumber('finops.pricing.kubernetes.storagePerGBPerMonth') ?? 0.10,
            },
            aws: {
              rds: {
                perInstancePerHour: config.getOptionalNumber('finops.pricing.aws.rds.perInstancePerHour') ?? 0.50,
              },
              s3: {
                perGBPerMonth: config.getOptionalNumber('finops.pricing.aws.s3.perGBPerMonth') ?? 0.023,
              },
            },
          },
        };

        // Initialize cost estimation engine
        const engine = new CostEstimationEngine(finopsConfig);

        // Initialize budget manager
        const budgetManager = new BudgetManager({
          approvalWorkflow: {
            enabled: config.getOptionalBoolean('finops.approvalWorkflow.enabled') ?? true,
            githubOrg: config.getOptionalString('finops.approvalWorkflow.githubOrg'),
            githubRepo: config.getOptionalString('finops.approvalWorkflow.githubRepo'),
          },
        });

        // Initialize anomaly detection
        const anomalyConfig: AnomalyDetectionConfig = {
          thresholds: {
            spike: config.getOptionalNumber('finops.anomaly.thresholds.spike') ?? 50,
            sustainedIncrease: config.getOptionalNumber('finops.anomaly.thresholds.sustainedIncrease') ?? 30,
            unusualPattern: config.getOptionalNumber('finops.anomaly.thresholds.unusualPattern') ?? 2,
          },
          lookbackPeriod: config.getOptionalNumber('finops.anomaly.lookbackPeriod') ?? 7,
          checkInterval: config.getOptionalNumber('finops.anomaly.checkInterval') ?? 60,
        };

        const alertConfig: AlertConfig = {
          slack: {
            enabled: config.getOptionalBoolean('finops.alerts.slack.enabled') ?? false,
            webhookUrl: config.getOptionalString('finops.alerts.slack.webhookUrl') ?? '',
            channel: config.getOptionalString('finops.alerts.slack.channel'),
          },
          email: {
            enabled: config.getOptionalBoolean('finops.alerts.email.enabled') ?? false,
            smtpHost: config.getOptionalString('finops.alerts.email.smtpHost') ?? '',
            smtpPort: config.getOptionalNumber('finops.alerts.email.smtpPort') ?? 587,
            from: config.getOptionalString('finops.alerts.email.from') ?? '',
            to: config.getOptionalStringArray('finops.alerts.email.to') ?? [],
          },
        };

        const anomalyDetector = new AnomalyDetector(anomalyConfig, engine);
        const alertEngine = new AlertEngine(alertConfig);

        // Initialize cost efficiency calculator
        const costEfficiencyCalculator = new CostEfficiencyCalculator(engine, {
          opencost: finopsConfig.opencost,
          monitoring: {
            datadogApiKey: config.getOptionalString('datadog.apiKey'),
            datadogAppKey: config.getOptionalString('datadog.appKey'),
            datadogSite: config.getOptionalString('datadog.site') ?? 'datadoghq.com',
          },
          cache: {
            ttl: 900, // 15 minutes
          },
        });

        // Initialize scheduler
        const schedulerConfig = {
          intervalMinutes: anomalyConfig.checkInterval,
          services: config.getOptionalStringArray('finops.anomaly.services') ?? [],
          enabled: config.getOptionalBoolean('finops.anomaly.enabled') ?? false,
        };

        const scheduler = new AnomalyScheduler(
          schedulerConfig,
          anomalyDetector,
          alertEngine,
        );

        // Start scheduler if enabled
        scheduler.start();

        logger.info('FinOps Cost Estimation Engine and Budget Manager initialized');

        // Create router
        const router = Router();

        /**
         * POST /estimate
         * Estimate cost based on deployment specification
         */
        router.post('/estimate', async (req, res) => {
          try {
            const spec = req.body;

            // Validate request
            if (!spec.cpu || !spec.memory || !spec.replicas) {
              return res.status(400).json({
                error: 'Missing required fields: cpu, memory, replicas',
              });
            }

            const estimate = await engine.estimateDeploymentCost(spec);
            res.json(estimate);
          } catch (error) {
            logger.error('Failed to estimate deployment cost:', error);
            res.status(500).json({
              error: 'Failed to estimate deployment cost',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * GET /historical/:serviceName
         * Get historical cost data for a service
         */
        router.get('/historical/:serviceName', async (req, res) => {
          try {
            const { serviceName } = req.params;
            const { timeRange = '7d' } = req.query;

            const historicalData = await engine.getHistoricalCost(
              serviceName,
              timeRange as string,
            );
            res.json(historicalData);
          } catch (error) {
            logger.error('Failed to get historical cost data:', error);
            res.status(500).json({
              error: 'Failed to get historical cost data',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * GET /cache/stats
         * Get cache statistics (for debugging)
         */
        router.get('/cache/stats', async (req, res) => {
          try {
            const stats = engine.getCacheStats();
            res.json(stats);
          } catch (error) {
            logger.error('Failed to get cache stats:', error);
            res.status(500).json({
              error: 'Failed to get cache stats',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /cache/clear
         * Clear cache (for debugging/testing)
         */
        router.post('/cache/clear', async (req, res) => {
          try {
            await engine.clearCache();
            res.json({ message: 'Cache cleared successfully' });
          } catch (error) {
            logger.error('Failed to clear cache:', error);
            res.status(500).json({
              error: 'Failed to clear cache',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * GET /health
         * Health check endpoint
         */
        router.get('/health', async (_req, res) => {
          res.json({
            status: 'ok',
            service: 'finops-cost-estimation',
            cache: engine.getCacheStats(),
          });
        });

        /**
         * Budget Management Endpoints
         */

        /**
         * POST /budgets
         * Create a new budget for a service
         */
        router.post('/budgets', async (req, res) => {
          try {
            const { serviceId, monthlyBudget, alertThreshold } = req.body;
            const userId = req.header('x-user-id') || 'system';

            // Validate request
            if (!serviceId || !monthlyBudget) {
              return res.status(400).json({
                error: 'Missing required fields: serviceId, monthlyBudget',
              });
            }

            const budget = await budgetManager.createBudget(
              { serviceId, monthlyBudget, alertThreshold },
              userId,
            );
            res.status(201).json(budget);
          } catch (error) {
            logger.error('Failed to create budget:', error);
            res.status(500).json({
              error: 'Failed to create budget',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * GET /budgets/:serviceId
         * Get budget for a service
         */
        router.get('/budgets/:serviceId', async (req, res) => {
          try {
            const { serviceId } = req.params;
            const budget = await budgetManager.getBudget(serviceId);

            if (!budget) {
              return res.status(404).json({
                error: 'Budget not found',
                message: `No budget found for service: ${serviceId}`,
              });
            }

            res.json(budget);
          } catch (error) {
            logger.error('Failed to get budget:', error);
            res.status(500).json({
              error: 'Failed to get budget',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * PUT /budgets/:serviceId
         * Update budget for a service
         */
        router.put('/budgets/:serviceId', async (req, res) => {
          try {
            const { serviceId } = req.params;
            const { monthlyBudget, alertThreshold } = req.body;
            const userId = req.header('x-user-id') || 'system';

            const budget = await budgetManager.updateBudget(
              serviceId,
              { monthlyBudget, alertThreshold },
              userId,
            );
            res.json(budget);
          } catch (error) {
            logger.error('Failed to update budget:', error);
            res.status(500).json({
              error: 'Failed to update budget',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * DELETE /budgets/:serviceId
         * Delete budget for a service
         */
        router.delete('/budgets/:serviceId', async (req, res) => {
          try {
            const { serviceId } = req.params;
            await budgetManager.deleteBudget(serviceId);
            res.status(204).send();
          } catch (error) {
            logger.error('Failed to delete budget:', error);
            res.status(500).json({
              error: 'Failed to delete budget',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * GET /budgets
         * List all budgets
         */
        router.get('/budgets', async (_req, res) => {
          try {
            const budgets = await budgetManager.listBudgets();
            res.json(budgets);
          } catch (error) {
            logger.error('Failed to list budgets:', error);
            res.status(500).json({
              error: 'Failed to list budgets',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /validate
         * Validate deployment cost against budget
         */
        router.post('/validate', async (req, res) => {
          try {
            const { serviceId, spec, currentMonthlyCost = 0 } = req.body;

            // Validate request
            if (!serviceId || !spec) {
              return res.status(400).json({
                error: 'Missing required fields: serviceId, spec',
              });
            }

            if (!spec.cpu || !spec.memory || !spec.replicas) {
              return res.status(400).json({
                error: 'Invalid spec: missing cpu, memory, or replicas',
              });
            }

            // Estimate cost
            const costEstimate = await engine.estimateDeploymentCost(spec);

            // Validate budget
            const validation = await budgetManager.validateBudget(
              serviceId,
              costEstimate,
              currentMonthlyCost,
            );

            res.json({
              ...validation,
              costEstimate,
            });
          } catch (error) {
            logger.error('Failed to validate budget:', error);
            res.status(500).json({
              error: 'Failed to validate budget',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * Anomaly Detection Endpoints
         */

        /**
         * GET /anomalies/:serviceId
         * Get all anomalies for a service
         */
        router.get('/anomalies/:serviceId', async (req, res) => {
          try {
            const { serviceId } = req.params;
            const { unresolved } = req.query;

            const anomalies = unresolved === 'true'
              ? await anomalyDetector.getUnresolvedAnomalies(serviceId)
              : await anomalyDetector.getAnomalies(serviceId);

            res.json(anomalies);
          } catch (error) {
            logger.error('Failed to get anomalies:', error);
            res.status(500).json({
              error: 'Failed to get anomalies',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /anomalies/detect/:serviceId
         * Manually trigger anomaly detection for a service
         */
        router.post('/anomalies/detect/:serviceId', async (req, res) => {
          try {
            const { serviceId } = req.params;
            const anomalies = await anomalyDetector.detectAnomalies(serviceId);

            // Send alerts for detected anomalies
            for (const anomaly of anomalies) {
              if (!anomaly.notificationSent) {
                await alertEngine.sendAlert(anomaly, serviceId);
                await anomalyDetector.markNotificationSent(anomaly.id);
              }
            }

            res.json({
              detected: anomalies.length,
              anomalies,
            });
          } catch (error) {
            logger.error('Failed to detect anomalies:', error);
            res.status(500).json({
              error: 'Failed to detect anomalies',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /anomalies/:anomalyId/resolve
         * Mark an anomaly as resolved
         */
        router.post('/anomalies/:anomalyId/resolve', async (req, res) => {
          try {
            const { anomalyId } = req.params;
            await anomalyDetector.resolveAnomaly(anomalyId);
            res.json({ message: 'Anomaly resolved successfully' });
          } catch (error) {
            logger.error('Failed to resolve anomaly:', error);
            res.status(500).json({
              error: 'Failed to resolve anomaly',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * GET /anomalies/scheduler/status
         * Get scheduler status
         */
        router.get('/anomalies/scheduler/status', async (_req, res) => {
          try {
            const status = scheduler.getStatus();
            res.json(status);
          } catch (error) {
            logger.error('Failed to get scheduler status:', error);
            res.status(500).json({
              error: 'Failed to get scheduler status',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /anomalies/scheduler/run
         * Manually trigger scheduler run
         */
        router.post('/anomalies/scheduler/run', async (req, res) => {
          try {
            const { serviceId } = req.body;
            const anomalies = await scheduler.runManual(serviceId);
            res.json({
              detected: anomalies.length,
              anomalies,
            });
          } catch (error) {
            logger.error('Failed to run scheduler:', error);
            res.status(500).json({
              error: 'Failed to run scheduler',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /anomalies/scheduler/services
         * Update services list for monitoring
         */
        router.post('/anomalies/scheduler/services', async (req, res) => {
          try {
            const { services } = req.body;

            if (!Array.isArray(services)) {
              return res.status(400).json({
                error: 'Invalid request: services must be an array',
              });
            }

            scheduler.updateServices(services);
            res.json({
              message: 'Services list updated successfully',
              count: services.length,
            });
          } catch (error) {
            logger.error('Failed to update services:', error);
            res.status(500).json({
              error: 'Failed to update services',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * Cost Efficiency Metrics Endpoints
         */

        /**
         * GET /efficiency/:serviceId
         * Get cost efficiency metrics for a service
         */
        router.get('/efficiency/:serviceId', async (req, res) => {
          try {
            const { serviceId } = req.params;
            const { timeRange = '30d' } = req.query;

            const metrics = await costEfficiencyCalculator.calculateEfficiencyMetrics(
              serviceId,
              timeRange as string,
            );
            res.json(metrics);
          } catch (error) {
            logger.error('Failed to calculate efficiency metrics:', error);
            res.status(500).json({
              error: 'Failed to calculate efficiency metrics',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /alerts/test
         * Test alert configuration
         */
        router.post('/alerts/test', async (_req, res) => {
          try {
            const results = await alertEngine.testAlert();
            res.json(results);
          } catch (error) {
            logger.error('Failed to test alerts:', error);
            res.status(500).json({
              error: 'Failed to test alerts',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        // Register router
        httpRouter.use('/finops', router);
        httpRouter.addAuthPolicy({
          path: '/finops',
          allow: 'unauthenticated',
        });

        logger.info('FinOps Cost Estimation API registered at /api/finops');
      },
    });
  },
});

export default finopsCostEstimationPlugin;
