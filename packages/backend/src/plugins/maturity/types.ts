/**
 * Service Maturity Scoring types and interfaces
 */

/**
 * Category types for maturity scoring
 */
export type CategoryType = 
  | 'documentation'
  | 'testing'
  | 'monitoring'
  | 'security'
  | 'costEfficiency';

/**
 * Check status
 */
export type CheckStatus = 'pass' | 'fail' | 'warning';

/**
 * Individual check within a category
 */
export interface Check {
  id: string;
  name: string;
  description: string;
  status: CheckStatus;
  required: boolean;
  value?: any;
  threshold?: any;
  weight: number; // Weight within the category (0-1)
}

/**
 * Category score with checks
 */
export interface CategoryScore {
  score: number; // 0-100
  weight: number; // Weight in overall score (0-1)
  checks: Check[];
  status: 'passing' | 'warning' | 'failing';
  maxScore: number; // Maximum possible score for this category
}

/**
 * Complete service scorecard
 */
export interface ServiceScorecard {
  serviceId: string;
  overallScore: number; // 0-100
  categories: {
    documentation: CategoryScore;
    testing: CategoryScore;
    monitoring: CategoryScore;
    security: CategoryScore;
    costEfficiency: CategoryScore;
  };
  lastUpdated: Date;
  expiresAt: Date;
  version: number;
}

/**
 * Improvement suggestion
 */
export interface Suggestion {
  id: string;
  category: CategoryType;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionItems: string[];
  estimatedEffort: string;
  impact: string;
}

/**
 * Improvement roadmap item
 */
export interface RoadmapItem {
  id: string;
  category: CategoryType;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  estimatedScoreImprovement: number;
  checksAffected: number;
  actionItems: string[];
  roadmapPhase: 'quick-wins' | 'critical-fixes' | 'long-term';
}

/**
 * Improvement roadmap
 */
export interface ImprovementRoadmap {
  serviceId: string;
  currentScore: number;
  potentialScore: number;
  totalImprovementPotential: number;
  quickWins: RoadmapItem[];
  criticalFixes: RoadmapItem[];
  longTermImprovements: RoadmapItem[];
  generatedAt: Date;
}

/**
 * Production readiness validation result
 */
export interface ReadinessValidation {
  isReady: boolean;
  minimumScore: number;
  currentScore: number;
  failingChecks: Check[];
  blockers: string[];
}

/**
 * Team benchmark data
 */
export interface TeamBenchmark {
  teamId: string;
  averageScore: number;
  serviceCount: number;
  distribution: Record<string, number>; // Score ranges
  topServices: Array<{ serviceId: string; score: number }>;
  bottomServices: Array<{ serviceId: string; score: number }>;
}

/**
 * Maturity trend data point
 */
export interface MaturityDataPoint {
  date: Date;
  score: number;
}

/**
 * Maturity trend
 */
export interface MaturityTrend {
  dataPoints: MaturityDataPoint[];
  improvement: number; // Percentage change
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Service metadata for scoring
 */
export interface ServiceMetadata {
  serviceId: string;
  name: string;
  owner: string;
  team: string;
  repositoryUrl: string;
  // Documentation metadata
  hasReadme: boolean;
  hasTechDocs: boolean;
  hasApiDocs: boolean;
  hasRunbook: boolean;
  documentationFreshness?: number; // days since last update
  // Testing metadata
  hasUnitTests: boolean;
  hasIntegrationTests: boolean;
  codeCoverage?: number; // percentage
  testsPassing: boolean;
  // Monitoring metadata
  hasMetrics: boolean;
  hasAlerts: boolean;
  hasLogging: boolean;
  hasDashboard: boolean;
  slosDefined: boolean;
  // Security metadata
  hasSecurityScanning: boolean;
  vulnerabilityCount?: number;
  highSeverityVulnerabilities?: number;
  dependenciesUpToDate: boolean;
  secretsScanned: boolean;
  // Cost efficiency metadata
  withinBudget: boolean;
  resourceUtilization?: number; // percentage
  costTrend?: 'improving' | 'stable' | 'worsening';
  hasRightSizing: boolean;
}

/**
 * Scoring configuration
 */
export interface ScoringConfig {
  // Category weights (must sum to 1.0)
  categoryWeights: {
    documentation: number;
    testing: number;
    monitoring: number;
    security: number;
    costEfficiency: number;
  };
  // Minimum score for production readiness
  productionReadinessThreshold: number;
  // Cache TTL in seconds
  cacheTTL: number;
  // Check configurations
  checks: {
    documentation: DocumentationChecks;
    testing: TestingChecks;
    monitoring: MonitoringChecks;
    security: SecurityChecks;
    costEfficiency: CostEfficiencyChecks;
  };
}

/**
 * Documentation checks configuration
 */
export interface DocumentationChecks {
  readme: {
    weight: number;
    required: boolean;
  };
  techDocs: {
    weight: number;
    required: boolean;
  };
  apiDocs: {
    weight: number;
    required: boolean;
  };
  runbook: {
    weight: number;
    required: boolean;
  };
  freshness: {
    weight: number;
    required: boolean;
    thresholdDays: number; // Max days since last update
  };
}

/**
 * Testing checks configuration
 */
export interface TestingChecks {
  unitTests: {
    weight: number;
    required: boolean;
  };
  integrationTests: {
    weight: number;
    required: boolean;
  };
  coverage: {
    weight: number;
    required: boolean;
    minimumPercent: number;
  };
  passing: {
    weight: number;
    required: boolean;
  };
}

/**
 * Monitoring checks configuration
 */
export interface MonitoringChecks {
  metrics: {
    weight: number;
    required: boolean;
  };
  alerts: {
    weight: number;
    required: boolean;
  };
  logging: {
    weight: number;
    required: boolean;
  };
  dashboard: {
    weight: number;
    required: boolean;
  };
  slos: {
    weight: number;
    required: boolean;
  };
}

/**
 * Security checks configuration
 */
export interface SecurityChecks {
  scanning: {
    weight: number;
    required: boolean;
  };
  vulnerabilities: {
    weight: number;
    required: boolean;
    maxTotal: number;
    maxHighSeverity: number;
  };
  dependencies: {
    weight: number;
    required: boolean;
  };
  secrets: {
    weight: number;
    required: boolean;
  };
}

/**
 * Cost efficiency checks configuration
 */
export interface CostEfficiencyChecks {
  budget: {
    weight: number;
    required: boolean;
  };
  utilization: {
    weight: number;
    required: boolean;
    minimumPercent: number;
  };
  trend: {
    weight: number;
    required: boolean;
  };
  rightSizing: {
    weight: number;
    required: boolean;
  };
}
