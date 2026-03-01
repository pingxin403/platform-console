/**
 * FinOps types and interfaces for cost estimation
 */

export interface DeploymentSpec {
  cpu: string; // e.g., "2" or "2000m"
  memory: string; // e.g., "4Gi" or "4096Mi"
  storage?: string; // e.g., "10Gi"
  replicas: number;
  environment?: 'development' | 'staging' | 'production';
}

export interface KubernetesCost {
  cpu: number;
  memory: number;
  storage: number;
  total: number;
}

export interface AWSCost {
  rds: number;
  s3: number;
  other: number;
  total: number;
}

export interface CostEstimate {
  estimatedMonthlyCost: number;
  breakdown: {
    kubernetes: KubernetesCost;
    aws: AWSCost;
  };
  confidence: number; // 0-1
  currency: string;
}

export interface HistoricalCostData {
  serviceName: string;
  timeRange: {
    start: string;
    end: string;
  };
  costs: {
    kubernetes: KubernetesCost;
    aws?: AWSCost;
  };
  totalCost: number;
}

export interface CostEstimationConfig {
  opencost: {
    baseUrl: string;
  };
  aws?: {
    enabled: boolean;
    region: string;
  };
  cache?: {
    ttl: number; // seconds
  };
  pricing: {
    kubernetes: {
      cpuPerCorePerHour: number; // USD
      memoryPerGBPerHour: number; // USD
      storagePerGBPerMonth: number; // USD
    };
    aws: {
      rds: {
        perInstancePerHour: number; // USD
      };
      s3: {
        perGBPerMonth: number; // USD
      };
    };
  };
}

/**
 * Budget management types
 */
export interface ServiceBudget {
  id: string;
  serviceId: string;
  monthlyBudget: number;
  currency: string;
  alertThreshold: number; // percentage (e.g., 80 for 80%)
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface BudgetValidation {
  isValid: boolean;
  currentBudget: number;
  estimatedCost: number;
  remainingBudget: number;
  requiresApproval: boolean;
  approvalUrl?: string;
  message?: string;
}

export interface BudgetCreateRequest {
  serviceId: string;
  monthlyBudget: number;
  alertThreshold?: number;
}

export interface BudgetUpdateRequest {
  monthlyBudget?: number;
  alertThreshold?: number;
}

/**
 * Cost anomaly detection types
 */
export type AnomalyType = 'spike' | 'sustained_increase' | 'unusual_pattern';
export type AnomalySeverity = 'low' | 'medium' | 'high';

export interface CostAnomaly {
  id: string;
  serviceId: string;
  detectedAt: Date;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  currentCost: number;
  expectedCost: number;
  deviation: number; // percentage
  recommendations: string[];
  notificationSent: boolean;
  resolvedAt?: Date;
}

export interface AnomalyDetectionConfig {
  thresholds: {
    spike: number; // percentage increase for spike detection (e.g., 50 = 50% increase)
    sustainedIncrease: number; // percentage increase over time (e.g., 30 = 30% increase)
    unusualPattern: number; // standard deviations from mean (e.g., 2 = 2 std devs)
  };
  lookbackPeriod: number; // days to look back for historical data
  checkInterval: number; // minutes between checks
}

export interface AlertConfig {
  slack?: {
    enabled: boolean;
    webhookUrl: string;
    channel?: string;
  };
  email?: {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    from: string;
    to: string[];
  };
}

export interface AlertNotification {
  anomaly: CostAnomaly;
  serviceName: string;
  timestamp: Date;
  channels: ('slack' | 'email')[];
  success: boolean;
  error?: string;
}

/**
 * Cost efficiency metrics types
 */
export interface CostEfficiencyMetrics {
  serviceId: string;
  period: {
    start: string;
    end: string;
  };
  costPerRequest: number | null;
  costPerUser: number | null;
  resourceUtilization: {
    cpu: number; // percentage
    memory: number; // percentage
    storage: number; // percentage
    overall: number; // percentage
  };
  costTrend: {
    current: number;
    previous: number;
    changePercent: number;
    direction: 'increasing' | 'decreasing' | 'stable';
  };
  recommendations: string[];
  calculatedAt: string;
}

export interface RequestVolumeData {
  serviceId: string;
  totalRequests: number;
  period: {
    start: string;
    end: string;
  };
}

export interface UserVolumeData {
  serviceId: string;
  activeUsers: number;
  period: {
    start: string;
    end: string;
  };
}

export interface ResourceUtilizationData {
  serviceId: string;
  cpu: {
    requested: number; // cores
    used: number; // cores
    utilization: number; // percentage
  };
  memory: {
    requested: number; // GB
    used: number; // GB
    utilization: number; // percentage
  };
  storage: {
    allocated: number; // GB
    used: number; // GB
    utilization: number; // percentage
  };
}
