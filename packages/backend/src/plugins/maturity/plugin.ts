/**
 * Service Maturity Scoring Backstage Plugin
 */

import { createBackendPlugin } from '@backstage/backend-plugin-api';
import { coreServices } from '@backstage/backend-plugin-api';
import { Router } from 'express';
import { ScoringEngine } from './scoring-engine';
import { SuggestionEngine } from './suggestion-engine';
import { ReadinessGate, ReadinessGateConfig, DEFAULT_READINESS_CONFIG } from './readiness-gate';
import { BenchmarkEngine, ServiceScore } from './benchmark-engine';
import { TrendTracker } from './trend-tracker';
import { InMemoryTrendStorage, TrendStorageInterface } from './trend-storage';
import { ScoringConfig, ServiceMetadata, MaturityDataPoint } from './types';

export const serviceMaturityPlugin = createBackendPlugin({
  pluginId: 'service-maturity',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        httpRouter: coreServices.httpRouter,
      },
      async init({ config, logger, httpRouter }) {
        // Load configuration
        const maturityConfig: ScoringConfig = {
          categoryWeights: {
            documentation: config.getOptionalNumber('maturity.categoryWeights.documentation') ?? 0.2,
            testing: config.getOptionalNumber('maturity.categoryWeights.testing') ?? 0.25,
            monitoring: config.getOptionalNumber('maturity.categoryWeights.monitoring') ?? 0.2,
            security: config.getOptionalNumber('maturity.categoryWeights.security') ?? 0.25,
            costEfficiency: config.getOptionalNumber('maturity.categoryWeights.costEfficiency') ?? 0.1,
          },
          productionReadinessThreshold: config.getOptionalNumber('maturity.productionReadinessThreshold') ?? 70,
          cacheTTL: config.getOptionalNumber('maturity.cacheTTL') ?? 3600, // 1 hour
          checks: {
            documentation: {
              readme: {
                weight: config.getOptionalNumber('maturity.checks.documentation.readme.weight') ?? 0.3,
                required: config.getOptionalBoolean('maturity.checks.documentation.readme.required') ?? true,
              },
              techDocs: {
                weight: config.getOptionalNumber('maturity.checks.documentation.techDocs.weight') ?? 0.3,
                required: config.getOptionalBoolean('maturity.checks.documentation.techDocs.required') ?? true,
              },
              apiDocs: {
                weight: config.getOptionalNumber('maturity.checks.documentation.apiDocs.weight') ?? 0.2,
                required: config.getOptionalBoolean('maturity.checks.documentation.apiDocs.required') ?? false,
              },
              runbook: {
                weight: config.getOptionalNumber('maturity.checks.documentation.runbook.weight') ?? 0.1,
                required: config.getOptionalBoolean('maturity.checks.documentation.runbook.required') ?? false,
              },
              freshness: {
                weight: config.getOptionalNumber('maturity.checks.documentation.freshness.weight') ?? 0.1,
                required: config.getOptionalBoolean('maturity.checks.documentation.freshness.required') ?? false,
                thresholdDays: config.getOptionalNumber('maturity.checks.documentation.freshness.thresholdDays') ?? 90,
              },
            },
            testing: {
              unitTests: {
                weight: config.getOptionalNumber('maturity.checks.testing.unitTests.weight') ?? 0.3,
                required: config.getOptionalBoolean('maturity.checks.testing.unitTests.required') ?? true,
              },
              integrationTests: {
                weight: config.getOptionalNumber('maturity.checks.testing.integrationTests.weight') ?? 0.2,
                required: config.getOptionalBoolean('maturity.checks.testing.integrationTests.required') ?? false,
              },
              coverage: {
                weight: config.getOptionalNumber('maturity.checks.testing.coverage.weight') ?? 0.3,
                required: config.getOptionalBoolean('maturity.checks.testing.coverage.required') ?? true,
                minimumPercent: config.getOptionalNumber('maturity.checks.testing.coverage.minimumPercent') ?? 80,
              },
              passing: {
                weight: config.getOptionalNumber('maturity.checks.testing.passing.weight') ?? 0.2,
                required: config.getOptionalBoolean('maturity.checks.testing.passing.required') ?? true,
              },
            },
            monitoring: {
              metrics: {
                weight: config.getOptionalNumber('maturity.checks.monitoring.metrics.weight') ?? 0.25,
                required: config.getOptionalBoolean('maturity.checks.monitoring.metrics.required') ?? true,
              },
              alerts: {
                weight: config.getOptionalNumber('maturity.checks.monitoring.alerts.weight') ?? 0.25,
                required: config.getOptionalBoolean('maturity.checks.monitoring.alerts.required') ?? true,
              },
              logging: {
                weight: config.getOptionalNumber('maturity.checks.monitoring.logging.weight') ?? 0.2,
                required: config.getOptionalBoolean('maturity.checks.monitoring.logging.required') ?? true,
              },
              dashboard: {
                weight: config.getOptionalNumber('maturity.checks.monitoring.dashboard.weight') ?? 0.15,
                required: config.getOptionalBoolean('maturity.checks.monitoring.dashboard.required') ?? false,
              },
              slos: {
                weight: config.getOptionalNumber('maturity.checks.monitoring.slos.weight') ?? 0.15,
                required: config.getOptionalBoolean('maturity.checks.monitoring.slos.required') ?? false,
              },
            },
            security: {
              scanning: {
                weight: config.getOptionalNumber('maturity.checks.security.scanning.weight') ?? 0.3,
                required: config.getOptionalBoolean('maturity.checks.security.scanning.required') ?? true,
              },
              vulnerabilities: {
                weight: config.getOptionalNumber('maturity.checks.security.vulnerabilities.weight') ?? 0.3,
                required: config.getOptionalBoolean('maturity.checks.security.vulnerabilities.required') ?? true,
                maxTotal: config.getOptionalNumber('maturity.checks.security.vulnerabilities.maxTotal') ?? 10,
                maxHighSeverity: config.getOptionalNumber('maturity.checks.security.vulnerabilities.maxHighSeverity') ?? 0,
              },
              dependencies: {
                weight: config.getOptionalNumber('maturity.checks.security.dependencies.weight') ?? 0.2,
                required: config.getOptionalBoolean('maturity.checks.security.dependencies.required') ?? false,
              },
              secrets: {
                weight: config.getOptionalNumber('maturity.checks.security.secrets.weight') ?? 0.2,
                required: config.getOptionalBoolean('maturity.checks.security.secrets.required') ?? true,
              },
            },
            costEfficiency: {
              budget: {
                weight: config.getOptionalNumber('maturity.checks.costEfficiency.budget.weight') ?? 0.4,
                required: config.getOptionalBoolean('maturity.checks.costEfficiency.budget.required') ?? true,
              },
              utilization: {
                weight: config.getOptionalNumber('maturity.checks.costEfficiency.utilization.weight') ?? 0.3,
                required: config.getOptionalBoolean('maturity.checks.costEfficiency.utilization.required') ?? false,
                minimumPercent: config.getOptionalNumber('maturity.checks.costEfficiency.utilization.minimumPercent') ?? 70,
              },
              trend: {
                weight: config.getOptionalNumber('maturity.checks.costEfficiency.trend.weight') ?? 0.2,
                required: config.getOptionalBoolean('maturity.checks.costEfficiency.trend.required') ?? false,
              },
              rightSizing: {
                weight: config.getOptionalNumber('maturity.checks.costEfficiency.rightSizing.weight') ?? 0.1,
                required: config.getOptionalBoolean('maturity.checks.costEfficiency.rightSizing.required') ?? false,
              },
            },
          },
        };

        // Load readiness gate configuration
        const readinessConfig: ReadinessGateConfig = {
          minimumScore: config.getOptionalNumber('maturity.readinessGate.minimumScore') ?? DEFAULT_READINESS_CONFIG.minimumScore,
          requiredChecks: config.getOptionalStringArray('maturity.readinessGate.requiredChecks') ?? DEFAULT_READINESS_CONFIG.requiredChecks,
          categoryMinimums: {
            documentation: config.getOptionalNumber('maturity.readinessGate.categoryMinimums.documentation'),
            testing: config.getOptionalNumber('maturity.readinessGate.categoryMinimums.testing'),
            monitoring: config.getOptionalNumber('maturity.readinessGate.categoryMinimums.monitoring'),
            security: config.getOptionalNumber('maturity.readinessGate.categoryMinimums.security') ?? DEFAULT_READINESS_CONFIG.categoryMinimums?.security,
            costEfficiency: config.getOptionalNumber('maturity.readinessGate.categoryMinimums.costEfficiency'),
          },
          requireApproval: config.getOptionalBoolean('maturity.readinessGate.requireApproval') ?? DEFAULT_READINESS_CONFIG.requireApproval,
          approvalUrlTemplate: config.getOptionalString('maturity.readinessGate.approvalUrlTemplate') ?? DEFAULT_READINESS_CONFIG.approvalUrlTemplate,
        };

        // Initialize scoring engine
        const engine = new ScoringEngine(maturityConfig, maturityConfig.cacheTTL);
        
        // Initialize suggestion engine
        const suggestionEngine = new SuggestionEngine();
        
        // Initialize readiness gate
        const readinessGate = new ReadinessGate(readinessConfig);
        
        // Initialize benchmark engine
        const benchmarkEngine = new BenchmarkEngine();
        
        // Initialize trend tracker
        const trendTracker = new TrendTracker();
        
        // Initialize trend storage (in-memory for now, should be PostgreSQL in production)
        const trendStorage: TrendStorageInterface = new InMemoryTrendStorage();

        logger.info('Service Maturity Scoring Engine initialized');
        logger.info(`Production Readiness Gate initialized (minimum score: ${readinessConfig.minimumScore})`);
        logger.info('Team Benchmarking and Trend Tracking initialized');

        // Create router
        const router = Router();

        /**
         * GET /maturity/:serviceId
         * Get maturity score for a service
         */
        router.get('/maturity/:serviceId', async (req, res) => {
          try {
            const { serviceId } = req.params;

            // In a real implementation, this would fetch metadata from:
            // - Backstage Catalog API
            // - GitHub API
            // - Datadog API
            // - Security scanning tools
            // - FinOps cost data
            // For now, we expect metadata in the request body or query params
            
            // This is a placeholder - in production, implement metadata collection
            const metadata: ServiceMetadata = req.body as ServiceMetadata;
            
            if (!metadata || !metadata.serviceId) {
              return res.status(400).json({
                error: 'Service metadata required in request body',
              });
            }

            const scorecard = await engine.calculateScorecard(serviceId, metadata);
            res.json(scorecard);
          } catch (error) {
            logger.error('Failed to calculate maturity score:', error);
            res.status(500).json({
              error: 'Failed to calculate maturity score',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * GET /maturity/:serviceId/details
         * Get detailed breakdown of maturity score
         */
        router.get('/maturity/:serviceId/details', async (req, res) => {
          try {
            const { serviceId } = req.params;
            const metadata: ServiceMetadata = req.body as ServiceMetadata;
            
            if (!metadata || !metadata.serviceId) {
              return res.status(400).json({
                error: 'Service metadata required in request body',
              });
            }

            const scorecard = await engine.calculateScorecard(serviceId, metadata);
            
            // Return detailed breakdown with all checks
            res.json({
              serviceId: scorecard.serviceId,
              overallScore: scorecard.overallScore,
              lastUpdated: scorecard.lastUpdated,
              categories: Object.entries(scorecard.categories).map(([name, category]) => ({
                name,
                score: category.score,
                weight: category.weight,
                status: category.status,
                checks: category.checks.map(check => ({
                  id: check.id,
                  name: check.name,
                  description: check.description,
                  status: check.status,
                  required: check.required,
                  value: check.value,
                  threshold: check.threshold,
                  weight: check.weight,
                })),
              })),
            });
          } catch (error) {
            logger.error('Failed to get maturity details:', error);
            res.status(500).json({
              error: 'Failed to get maturity details',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /maturity/:serviceId/recalculate
         * Force recalculation of maturity score (bypass cache)
         */
        router.post('/maturity/:serviceId/recalculate', async (req, res) => {
          try {
            const { serviceId } = req.params;
            const metadata: ServiceMetadata = req.body as ServiceMetadata;
            
            if (!metadata || !metadata.serviceId) {
              return res.status(400).json({
                error: 'Service metadata required in request body',
              });
            }

            const scorecard = await engine.recalculateScorecard(serviceId, metadata);
            res.json(scorecard);
          } catch (error) {
            logger.error('Failed to recalculate maturity score:', error);
            res.status(500).json({
              error: 'Failed to recalculate maturity score',
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
         * GET /maturity/:serviceId/suggestions
         * Get improvement suggestions for a service
         */
        router.get('/maturity/:serviceId/suggestions', async (req, res) => {
          try {
            const { serviceId } = req.params;
            const metadata: ServiceMetadata = req.body as ServiceMetadata;
            
            if (!metadata || !metadata.serviceId) {
              return res.status(400).json({
                error: 'Service metadata required in request body',
              });
            }

            // Calculate scorecard first
            const scorecard = await engine.calculateScorecard(serviceId, metadata);
            
            // Generate suggestions
            const suggestions = suggestionEngine.generateSuggestions(scorecard);
            
            res.json({
              serviceId,
              currentScore: scorecard.overallScore,
              suggestions,
              generatedAt: new Date(),
            });
          } catch (error) {
            logger.error('Failed to generate suggestions:', error);
            res.status(500).json({
              error: 'Failed to generate suggestions',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * GET /maturity/:serviceId/roadmap
         * Get improvement roadmap for a service
         */
        router.get('/maturity/:serviceId/roadmap', async (req, res) => {
          try {
            const { serviceId } = req.params;
            const metadata: ServiceMetadata = req.body as ServiceMetadata;
            
            if (!metadata || !metadata.serviceId) {
              return res.status(400).json({
                error: 'Service metadata required in request body',
              });
            }

            // Calculate scorecard first
            const scorecard = await engine.calculateScorecard(serviceId, metadata);
            
            // Generate roadmap
            const roadmap = suggestionEngine.generateRoadmap(scorecard);
            
            res.json(roadmap);
          } catch (error) {
            logger.error('Failed to generate roadmap:', error);
            res.status(500).json({
              error: 'Failed to generate roadmap',
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
            service: 'service-maturity',
            cache: engine.getCacheStats(),
          });
        });

        /**
         * GET /config
         * Get current scoring configuration
         */
        router.get('/config', async (_req, res) => {
          try {
            res.json(maturityConfig);
          } catch (error) {
            logger.error('Failed to get config:', error);
            res.status(500).json({
              error: 'Failed to get config',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /maturity/:serviceId/validate-readiness
         * Validate production readiness for a service
         */
        router.post('/maturity/:serviceId/validate-readiness', async (req, res) => {
          try {
            const { serviceId } = req.params;
            const metadata: ServiceMetadata = req.body as ServiceMetadata;
            
            if (!metadata || !metadata.serviceId) {
              return res.status(400).json({
                error: 'Service metadata required in request body',
              });
            }

            // Calculate scorecard first
            const scorecard = await engine.calculateScorecard(serviceId, metadata);
            
            // Validate production readiness
            const validation = readinessGate.validateProductionReadiness(scorecard);
            
            // Generate feedback
            const detailedFeedback = readinessGate.generateDetailedFeedback(validation);
            const summaryFeedback = readinessGate.generateSummaryFeedback(validation);
            
            res.json({
              serviceId,
              validation,
              feedback: {
                summary: summaryFeedback,
                detailed: detailedFeedback,
              },
              scorecard: {
                overallScore: scorecard.overallScore,
                lastUpdated: scorecard.lastUpdated,
              },
            });
          } catch (error) {
            logger.error('Failed to validate production readiness:', error);
            res.status(500).json({
              error: 'Failed to validate production readiness',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /maturity/:serviceId/request-approval
         * Request approval for production deployment
         */
        router.post('/maturity/:serviceId/request-approval', async (req, res) => {
          try {
            const { serviceId } = req.params;
            const metadata: ServiceMetadata = req.body as ServiceMetadata;
            
            if (!metadata || !metadata.serviceId) {
              return res.status(400).json({
                error: 'Service metadata required in request body',
              });
            }

            // Calculate scorecard
            const scorecard = await engine.calculateScorecard(serviceId, metadata);
            
            // Validate production readiness
            const validation = readinessGate.validateProductionReadiness(scorecard);
            
            // Check if already ready (no approval needed)
            if (validation.isReady) {
              return res.status(400).json({
                error: 'Service is already production ready',
                message: 'No approval required',
                validation,
              });
            }
            
            // Create approval request
            const approvalRequest = readinessGate.createApprovalRequest(serviceId, validation);
            
            // In a real implementation, this would:
            // 1. Create a GitHub issue or PR
            // 2. Send notification to platform team
            // 3. Store approval request in database
            // 4. Return approval tracking URL
            
            logger.info(`Approval request created for service ${serviceId}`, {
              currentScore: approvalRequest.currentScore,
              minimumScore: approvalRequest.minimumScore,
              blockerCount: approvalRequest.blockers.length,
            });
            
            res.json({
              approvalRequest,
              message: 'Approval request created successfully',
              nextSteps: [
                'Platform team has been notified',
                'Review the failing checks and blockers',
                'Provide justification for deploying with current maturity score',
                'Wait for approval decision',
              ],
            });
          } catch (error) {
            logger.error('Failed to create approval request:', error);
            res.status(500).json({
              error: 'Failed to create approval request',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * GET /readiness-gate/config
         * Get production readiness gate configuration
         */
        router.get('/readiness-gate/config', async (_req, res) => {
          try {
            const config = readinessGate.getConfig();
            res.json(config);
          } catch (error) {
            logger.error('Failed to get readiness gate config:', error);
            res.status(500).json({
              error: 'Failed to get readiness gate config',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * PUT /readiness-gate/config
         * Update production readiness gate configuration
         */
        router.put('/readiness-gate/config', async (req, res) => {
          try {
            const updates = req.body as Partial<ReadinessGateConfig>;
            
            // Validate updates
            if (updates.minimumScore !== undefined) {
              if (updates.minimumScore < 0 || updates.minimumScore > 100) {
                return res.status(400).json({
                  error: 'Invalid minimumScore',
                  message: 'minimumScore must be between 0 and 100',
                });
              }
            }
            
            readinessGate.updateConfig(updates);
            const newConfig = readinessGate.getConfig();
            
            logger.info('Readiness gate configuration updated', updates);
            
            res.json({
              message: 'Configuration updated successfully',
              config: newConfig,
            });
          } catch (error) {
            logger.error('Failed to update readiness gate config:', error);
            res.status(500).json({
              error: 'Failed to update readiness gate config',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * GET /benchmark/team/:teamId
         * Get team maturity benchmark
         */
        router.get('/benchmark/team/:teamId', async (req, res) => {
          try {
            const { teamId } = req.params;
            
            // Expect service scores in request body
            const { scorecards } = req.body as { scorecards: any[] };
            
            if (!scorecards || !Array.isArray(scorecards)) {
              return res.status(400).json({
                error: 'Service scorecards required in request body',
                message: 'Provide an array of service scorecards',
              });
            }

            const benchmark = benchmarkEngine.calculateTeamBenchmark(teamId, scorecards);
            
            res.json(benchmark);
          } catch (error) {
            logger.error('Failed to calculate team benchmark:', error);
            res.status(500).json({
              error: 'Failed to calculate team benchmark',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /benchmark/teams
         * Calculate benchmarks for all teams
         */
        router.post('/benchmark/teams', async (req, res) => {
          try {
            const { serviceScores } = req.body as { serviceScores: ServiceScore[] };
            
            if (!serviceScores || !Array.isArray(serviceScores)) {
              return res.status(400).json({
                error: 'Service scores required in request body',
                message: 'Provide an array of service scores with team information',
              });
            }

            const benchmarks = benchmarkEngine.calculateAllTeamBenchmarks(serviceScores);
            
            // Convert Map to object for JSON response
            const benchmarksObj: Record<string, any> = {};
            for (const [teamId, benchmark] of benchmarks.entries()) {
              benchmarksObj[teamId] = benchmark;
            }
            
            res.json({
              benchmarks: benchmarksObj,
              totalTeams: benchmarks.size,
            });
          } catch (error) {
            logger.error('Failed to calculate team benchmarks:', error);
            res.status(500).json({
              error: 'Failed to calculate team benchmarks',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /benchmark/rankings/teams
         * Generate team rankings
         */
        router.post('/benchmark/rankings/teams', async (req, res) => {
          try {
            const { serviceScores, previousRankings } = req.body as {
              serviceScores: ServiceScore[];
              previousRankings?: Record<string, number>;
            };
            
            if (!serviceScores || !Array.isArray(serviceScores)) {
              return res.status(400).json({
                error: 'Service scores required in request body',
              });
            }

            // Calculate benchmarks first
            const benchmarks = benchmarkEngine.calculateAllTeamBenchmarks(serviceScores);
            
            // Convert previousRankings to Map if provided
            const prevRankingsMap = previousRankings
              ? new Map(Object.entries(previousRankings).map(([k, v]) => [k, v]))
              : undefined;
            
            // Generate rankings
            const rankings = benchmarkEngine.generateTeamRankings(benchmarks, prevRankingsMap);
            
            res.json({
              rankings,
              totalTeams: rankings.length,
            });
          } catch (error) {
            logger.error('Failed to generate team rankings:', error);
            res.status(500).json({
              error: 'Failed to generate team rankings',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /benchmark/rankings/services
         * Generate service rankings across all teams
         */
        router.post('/benchmark/rankings/services', async (req, res) => {
          try {
            const { serviceScores } = req.body as { serviceScores: ServiceScore[] };
            
            if (!serviceScores || !Array.isArray(serviceScores)) {
              return res.status(400).json({
                error: 'Service scores required in request body',
              });
            }

            const rankings = benchmarkEngine.generateServiceRankings(serviceScores);
            
            res.json({
              rankings,
              totalServices: rankings.length,
            });
          } catch (error) {
            logger.error('Failed to generate service rankings:', error);
            res.status(500).json({
              error: 'Failed to generate service rankings',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /benchmark/compare/:teamId
         * Compare team against organization
         */
        router.post('/benchmark/compare/:teamId', async (req, res) => {
          try {
            const { teamId } = req.params;
            const { serviceScores } = req.body as { serviceScores: ServiceScore[] };
            
            if (!serviceScores || !Array.isArray(serviceScores)) {
              return res.status(400).json({
                error: 'Service scores required in request body',
              });
            }

            // Calculate all benchmarks
            const benchmarks = benchmarkEngine.calculateAllTeamBenchmarks(serviceScores);
            
            // Compare team to organization
            const comparison = benchmarkEngine.compareTeamToOrganization(teamId, benchmarks);
            
            res.json(comparison);
          } catch (error) {
            logger.error('Failed to compare team to organization:', error);
            res.status(500).json({
              error: 'Failed to compare team to organization',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * GET /benchmark/top-teams
         * Get top performing teams
         */
        router.post('/benchmark/top-teams', async (req, res) => {
          try {
            const { serviceScores, limit } = req.body as {
              serviceScores: ServiceScore[];
              limit?: number;
            };
            
            if (!serviceScores || !Array.isArray(serviceScores)) {
              return res.status(400).json({
                error: 'Service scores required in request body',
              });
            }

            const benchmarks = benchmarkEngine.calculateAllTeamBenchmarks(serviceScores);
            const topTeams = benchmarkEngine.getTopTeams(benchmarks, limit);
            
            res.json({
              topTeams,
              count: topTeams.length,
            });
          } catch (error) {
            logger.error('Failed to get top teams:', error);
            res.status(500).json({
              error: 'Failed to get top teams',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /benchmark/needs-improvement
         * Get teams needing improvement
         */
        router.post('/benchmark/needs-improvement', async (req, res) => {
          try {
            const { serviceScores, threshold, limit } = req.body as {
              serviceScores: ServiceScore[];
              threshold?: number;
              limit?: number;
            };
            
            if (!serviceScores || !Array.isArray(serviceScores)) {
              return res.status(400).json({
                error: 'Service scores required in request body',
              });
            }

            const benchmarks = benchmarkEngine.calculateAllTeamBenchmarks(serviceScores);
            const teams = benchmarkEngine.getTeamsNeedingImprovement(
              benchmarks,
              threshold,
              limit,
            );
            
            res.json({
              teams,
              count: teams.length,
            });
          } catch (error) {
            logger.error('Failed to get teams needing improvement:', error);
            res.status(500).json({
              error: 'Failed to get teams needing improvement',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /benchmark/organization-stats
         * Calculate organization-wide statistics
         */
        router.post('/benchmark/organization-stats', async (req, res) => {
          try {
            const { serviceScores } = req.body as { serviceScores: ServiceScore[] };
            
            if (!serviceScores || !Array.isArray(serviceScores)) {
              return res.status(400).json({
                error: 'Service scores required in request body',
              });
            }

            const benchmarks = benchmarkEngine.calculateAllTeamBenchmarks(serviceScores);
            const stats = benchmarkEngine.calculateOrganizationStats(benchmarks);
            
            res.json(stats);
          } catch (error) {
            logger.error('Failed to calculate organization stats:', error);
            res.status(500).json({
              error: 'Failed to calculate organization stats',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * GET /trend/:serviceId
         * Get maturity trend for a service
         */
        router.get('/trend/:serviceId', async (req, res) => {
          try {
            const { serviceId } = req.params;
            const { startDate, endDate } = req.query;

            let dataPoints: MaturityDataPoint[];
            
            if (startDate && endDate) {
              dataPoints = await trendStorage.getDataPointsInRange(
                serviceId,
                new Date(startDate as string),
                new Date(endDate as string),
              );
            } else {
              dataPoints = await trendStorage.getDataPoints(serviceId);
            }

            const trend = trendTracker.calculateTrend(dataPoints);
            
            res.json({
              serviceId,
              trend,
              dataPointCount: dataPoints.length,
            });
          } catch (error) {
            logger.error('Failed to get maturity trend:', error);
            res.status(500).json({
              error: 'Failed to get maturity trend',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /trend/:serviceId
         * Store a new trend data point
         */
        router.post('/trend/:serviceId', async (req, res) => {
          try {
            const { serviceId } = req.params;
            const { score, date } = req.body as { score: number; date?: string };

            if (score === undefined || score < 0 || score > 100) {
              return res.status(400).json({
                error: 'Invalid score',
                message: 'Score must be between 0 and 100',
              });
            }

            const dataPoint: MaturityDataPoint = {
              date: date ? new Date(date) : new Date(),
              score,
            };

            await trendStorage.storeDataPoint(serviceId, dataPoint);
            
            // Get updated trend
            const dataPoints = await trendStorage.getDataPoints(serviceId);
            const trend = trendTracker.calculateTrend(dataPoints);
            
            res.json({
              message: 'Data point stored successfully',
              serviceId,
              dataPoint,
              trend,
            });
          } catch (error) {
            logger.error('Failed to store trend data point:', error);
            res.status(500).json({
              error: 'Failed to store trend data point',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * GET /trend/:serviceId/analysis
         * Get detailed trend analysis with projections
         */
        router.get('/trend/:serviceId/analysis', async (req, res) => {
          try {
            const { serviceId } = req.params;

            const dataPoints = await trendStorage.getDataPoints(serviceId);
            const analysis = trendTracker.analyzeTrend(dataPoints);
            
            res.json({
              serviceId,
              analysis,
              dataPointCount: dataPoints.length,
            });
          } catch (error) {
            logger.error('Failed to analyze trend:', error);
            res.status(500).json({
              error: 'Failed to analyze trend',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * GET /trend/:serviceId/significant-changes
         * Detect significant changes in maturity score
         */
        router.get('/trend/:serviceId/significant-changes', async (req, res) => {
          try {
            const { serviceId } = req.params;
            const { threshold } = req.query;

            const dataPoints = await trendStorage.getDataPoints(serviceId);
            const changes = trendTracker.detectSignificantChanges(
              dataPoints,
              threshold ? parseFloat(threshold as string) : undefined,
            );
            
            res.json({
              serviceId,
              significantChanges: changes,
              count: changes.length,
            });
          } catch (error) {
            logger.error('Failed to detect significant changes:', error);
            res.status(500).json({
              error: 'Failed to detect significant changes',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * POST /trend/:serviceId/prune
         * Prune old trend data points
         */
        router.post('/trend/:serviceId/prune', async (req, res) => {
          try {
            const { serviceId } = req.params;
            const { maxAgeDays } = req.body as { maxAgeDays?: number };

            const removedCount = await trendStorage.pruneOldDataPoints(
              serviceId,
              maxAgeDays ?? 365,
            );
            
            res.json({
              message: 'Old data points pruned successfully',
              serviceId,
              removedCount,
            });
          } catch (error) {
            logger.error('Failed to prune trend data:', error);
            res.status(500).json({
              error: 'Failed to prune trend data',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * GET /trend/storage/stats
         * Get trend storage statistics
         */
        router.get('/trend/storage/stats', async (req, res) => {
          try {
            // This assumes InMemoryTrendStorage, adjust for PostgreSQL
            const stats = (trendStorage as any).getStats?.() || {
              message: 'Stats not available for this storage implementation',
            };
            
            res.json(stats);
          } catch (error) {
            logger.error('Failed to get storage stats:', error);
            res.status(500).json({
              error: 'Failed to get storage stats',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        /**
         * PUT /readiness-gate/config
         * Update production readiness gate configuration
         */
        router.put('/readiness-gate/config', async (req, res) => {
          try {
            const updates = req.body as Partial<ReadinessGateConfig>;
            
            // Validate updates
            if (updates.minimumScore !== undefined) {
              if (updates.minimumScore < 0 || updates.minimumScore > 100) {
                return res.status(400).json({
                  error: 'Invalid minimumScore',
                  message: 'minimumScore must be between 0 and 100',
                });
              }
            }
            
            readinessGate.updateConfig(updates);
            const newConfig = readinessGate.getConfig();
            
            logger.info('Readiness gate configuration updated', updates);
            
            res.json({
              message: 'Configuration updated successfully',
              config: newConfig,
            });
          } catch (error) {
            logger.error('Failed to update readiness gate config:', error);
            res.status(500).json({
              error: 'Failed to update readiness gate config',
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        // Register router
        httpRouter.use('/maturity', router);
        httpRouter.addAuthPolicy({
          path: '/maturity',
          allow: 'unauthenticated',
        });

        logger.info('Service Maturity Scoring API registered at /api/maturity');
      },
    });
  },
});

export default serviceMaturityPlugin;
