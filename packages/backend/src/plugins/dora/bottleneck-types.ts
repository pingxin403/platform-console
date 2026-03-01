/**
 * Type definitions for bottleneck identification and quantification
 * 
 * This module defines types for identifying workflow friction points,
 * quantifying their impact, and generating recommendations.
 */

/**
 * Workflow stage in the development lifecycle
 */
export type WorkflowStage =
  | 'code_review'
  | 'ci_build'
  | 'deployment'
  | 'incident_response'
  | 'service_creation'
  | 'documentation'
  | 'approval';

/**
 * Bottleneck severity level
 */
export type BottleneckSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Workflow timing data
 */
export interface WorkflowTiming {
  stage: WorkflowStage;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  userId?: string;
  entityId: string; // PR, deployment, service, etc.
  entityType: string;
  metadata?: Record<string, any>;
}

/**
 * High friction area detection result
 */
export interface FrictionArea {
  stage: WorkflowStage;
  averageDuration: number; // in minutes
  medianDuration: number; // in minutes
  p95Duration: number; // in minutes
  occurrences: number;
  affectedEntities: string[];
  trend: 'worsening' | 'stable' | 'improving';
}

/**
 * Bottleneck identification result
 */
export interface Bottleneck {
  id: string;
  area: string;
  stage: WorkflowStage;
  description: string;
  severity: BottleneckSeverity;
  
  // Impact quantification
  impact: {
    affectedUsers: number;
    affectedEntities: number;
    averageDelay: number; // in minutes
    totalTimeWasted: number; // in hours
    frequency: number; // occurrences per week
  };
  
  // Root cause analysis
  rootCause?: string;
  contributingFactors: string[];
  
  // Recommendations
  recommendations: {
    action: string;
    priority: 'high' | 'medium' | 'low';
    estimatedImpact: string;
    estimatedEffort: string;
  }[];
  
  // Metadata
  detectedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
}

/**
 * Bottleneck analysis configuration
 */
export interface BottleneckAnalysisConfig {
  // Enable/disable bottleneck detection
  enabled: boolean;
  
  // Thresholds for bottleneck detection
  thresholds: {
    // Minimum duration to consider as a bottleneck (in minutes)
    minDuration: {
      code_review: number;
      ci_build: number;
      deployment: number;
      incident_response: number;
      service_creation: number;
      documentation: number;
      approval: number;
    };
    
    // Minimum occurrences to consider as a pattern
    minOccurrences: number;
    
    // Minimum affected users to consider as significant
    minAffectedUsers: number;
  };
  
  // Analysis settings
  analysis: {
    // Look back period (in days)
    lookbackDays: number;
    
    // Minimum data points required for analysis
    minDataPoints: number;
    
    // Percentile for outlier detection
    outlierPercentile: number; // e.g., 95 for p95
  };
}

/**
 * Workflow analysis result
 */
export interface WorkflowAnalysisResult {
  success: boolean;
  bottlenecks: Bottleneck[];
  frictionAreas: FrictionArea[];
  summary: {
    totalBottlenecks: number;
    criticalBottlenecks: number;
    totalTimeWasted: number; // in hours
    affectedUsers: number;
    mostProblematicStage: WorkflowStage;
  };
  errors: string[];
  analyzedAt: Date;
  duration: number; // in milliseconds
}

/**
 * Recommendation action type
 */
export type RecommendationAction =
  | 'automate_process'
  | 'increase_resources'
  | 'improve_documentation'
  | 'add_monitoring'
  | 'optimize_configuration'
  | 'training_required'
  | 'process_change'
  | 'tool_upgrade';

/**
 * Recommendation template
 */
export interface RecommendationTemplate {
  action: RecommendationAction;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedImpact: string;
  estimatedEffort: string;
}
