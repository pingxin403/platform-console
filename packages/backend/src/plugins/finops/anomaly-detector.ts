/**
 * Cost Anomaly Detector
 * 
 * Implements threshold-based anomaly detection for cost monitoring
 * Detects spikes, sustained increases, and unusual patterns
 */

import {
  CostAnomaly,
  AnomalyType,
  AnomalySeverity,
  AnomalyDetectionConfig,
  HistoricalCostData,
} from './types';
import { CostEstimationEngine } from './cost-estimation-engine';

export class AnomalyDetector {
  private config: AnomalyDetectionConfig;
  private costEngine: CostEstimationEngine;
  private anomalies: Map<string, CostAnomaly[]>;

  constructor(
    config: AnomalyDetectionConfig,
    costEngine: CostEstimationEngine,
  ) {
    this.config = config;
    this.costEngine = costEngine;
    this.anomalies = new Map();
  }

  /**
   * Detect anomalies for a service
   */
  async detectAnomalies(serviceId: string): Promise<CostAnomaly[]> {
    try {
      // Get historical cost data
      const historicalData = await this.costEngine.getHistoricalCost(
        serviceId,
        `${this.config.lookbackPeriod}d`,
      );

      const detectedAnomalies: CostAnomaly[] = [];

      // Check for spike (sudden increase)
      const spikeAnomaly = await this.detectSpike(serviceId, historicalData);
      if (spikeAnomaly) {
        detectedAnomalies.push(spikeAnomaly);
      }

      // Check for sustained increase (gradual increase over time)
      const sustainedAnomaly = await this.detectSustainedIncrease(
        serviceId,
        historicalData,
      );
      if (sustainedAnomaly) {
        detectedAnomalies.push(sustainedAnomaly);
      }

      // Check for unusual pattern (statistical outlier)
      const patternAnomaly = await this.detectUnusualPattern(
        serviceId,
        historicalData,
      );
      if (patternAnomaly) {
        detectedAnomalies.push(patternAnomaly);
      }

      // Store detected anomalies
      if (detectedAnomalies.length > 0) {
        const existing = this.anomalies.get(serviceId) || [];
        this.anomalies.set(serviceId, [...existing, ...detectedAnomalies]);
      }

      return detectedAnomalies;
    } catch (error) {
      console.error(`Failed to detect anomalies for ${serviceId}:`, error);
      return [];
    }
  }

  /**
   * Detect cost spike (sudden increase)
   */
  private async detectSpike(
    serviceId: string,
    historicalData: HistoricalCostData,
  ): Promise<CostAnomaly | null> {
    const currentCost = historicalData.totalCost;
    
    // Get previous period cost (compare with same period length ago)
    const previousPeriodData = await this.getPreviousPeriodCost(
      serviceId,
      this.config.lookbackPeriod,
    );
    
    if (!previousPeriodData) {
      return null; // Not enough data
    }

    const previousCost = previousPeriodData.totalCost;
    const percentageIncrease = ((currentCost - previousCost) / previousCost) * 100;

    // Check if increase exceeds spike threshold
    if (percentageIncrease >= this.config.thresholds.spike) {
      const severity = this.calculateSeverity(percentageIncrease, 'spike');
      const recommendations = this.generateRecommendations('spike', {
        currentCost,
        previousCost,
        percentageIncrease,
      });

      return {
        id: this.generateAnomalyId(),
        serviceId,
        detectedAt: new Date(),
        anomalyType: 'spike',
        severity,
        currentCost,
        expectedCost: previousCost,
        deviation: percentageIncrease,
        recommendations,
        notificationSent: false,
      };
    }

    return null;
  }

  /**
   * Detect sustained cost increase (gradual increase over time)
   */
  private async detectSustainedIncrease(
    serviceId: string,
    historicalData: HistoricalCostData,
  ): Promise<CostAnomaly | null> {
    // Get cost data for multiple periods to detect trend
    const periods = 3; // Check last 3 periods
    const costHistory: number[] = [];

    for (let i = 0; i < periods; i++) {
      const periodData = await this.getPreviousPeriodCost(
        serviceId,
        this.config.lookbackPeriod * (i + 1),
      );
      if (periodData) {
        costHistory.unshift(periodData.totalCost);
      }
    }

    // Add current cost
    costHistory.push(historicalData.totalCost);

    // Need at least 3 data points to detect trend
    if (costHistory.length < 3) {
      return null;
    }

    // Calculate trend (simple linear regression)
    const trend = this.calculateTrend(costHistory);
    
    // Check if trend shows sustained increase
    const oldestCost = costHistory[0];
    const currentCost = costHistory[costHistory.length - 1];
    const percentageIncrease = ((currentCost - oldestCost) / oldestCost) * 100;

    if (
      trend > 0 &&
      percentageIncrease >= this.config.thresholds.sustainedIncrease
    ) {
      const severity = this.calculateSeverity(
        percentageIncrease,
        'sustained_increase',
      );
      const recommendations = this.generateRecommendations('sustained_increase', {
        currentCost,
        oldestCost,
        percentageIncrease,
        trend,
      });

      return {
        id: this.generateAnomalyId(),
        serviceId,
        detectedAt: new Date(),
        anomalyType: 'sustained_increase',
        severity,
        currentCost,
        expectedCost: oldestCost,
        deviation: percentageIncrease,
        recommendations,
        notificationSent: false,
      };
    }

    return null;
  }

  /**
   * Detect unusual pattern (statistical outlier)
   */
  private async detectUnusualPattern(
    serviceId: string,
    historicalData: HistoricalCostData,
  ): Promise<CostAnomaly | null> {
    // Get historical costs for statistical analysis
    const periods = 7; // Use last 7 periods for baseline
    const costHistory: number[] = [];

    for (let i = 1; i <= periods; i++) {
      const periodData = await this.getPreviousPeriodCost(
        serviceId,
        this.config.lookbackPeriod * i,
      );
      if (periodData) {
        costHistory.push(periodData.totalCost);
      }
    }

    // Need at least 5 data points for statistical analysis
    if (costHistory.length < 5) {
      return null;
    }

    // Calculate mean and standard deviation
    const mean = costHistory.reduce((sum, cost) => sum + cost, 0) / costHistory.length;
    const variance =
      costHistory.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) /
      costHistory.length;
    const stdDev = Math.sqrt(variance);

    const currentCost = historicalData.totalCost;
    const zScore = (currentCost - mean) / stdDev;

    // Check if current cost is an outlier (beyond threshold standard deviations)
    if (Math.abs(zScore) >= this.config.thresholds.unusualPattern) {
      const percentageDeviation = ((currentCost - mean) / mean) * 100;
      const severity = this.calculateSeverity(
        Math.abs(percentageDeviation),
        'unusual_pattern',
      );
      const recommendations = this.generateRecommendations('unusual_pattern', {
        currentCost,
        mean,
        stdDev,
        zScore,
      });

      return {
        id: this.generateAnomalyId(),
        serviceId,
        detectedAt: new Date(),
        anomalyType: 'unusual_pattern',
        severity,
        currentCost,
        expectedCost: mean,
        deviation: Math.abs(percentageDeviation),
        recommendations,
        notificationSent: false,
      };
    }

    return null;
  }

  /**
   * Get cost data for a previous period
   */
  private async getPreviousPeriodCost(
    serviceId: string,
    daysAgo: number,
  ): Promise<HistoricalCostData | null> {
    try {
      // In production, this would query historical data from a time series database
      // For MVP, we use the cost engine's historical data API
      return await this.costEngine.getHistoricalCost(serviceId, `${daysAgo}d`);
    } catch (error) {
      console.warn(`Failed to get previous period cost for ${serviceId}:`, error);
      return null;
    }
  }

  /**
   * Calculate trend using simple linear regression
   */
  private calculateTrend(values: number[]): number {
    const n = values.length;
    const xSum = (n * (n - 1)) / 2; // Sum of indices 0, 1, 2, ...
    const ySum = values.reduce((sum, val) => sum + val, 0);
    const xySum = values.reduce((sum, val, idx) => sum + val * idx, 0);
    const xSquaredSum = (n * (n - 1) * (2 * n - 1)) / 6;

    // Calculate slope (trend)
    const slope = (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum * xSum);
    return slope;
  }

  /**
   * Calculate severity based on deviation and anomaly type
   */
  private calculateSeverity(
    deviation: number,
    anomalyType: AnomalyType,
  ): AnomalySeverity {
    // Severity thresholds (percentage)
    const thresholds = {
      spike: { high: 100, medium: 50 },
      sustained_increase: { high: 50, medium: 30 },
      unusual_pattern: { high: 75, medium: 40 },
    };

    const typeThresholds = thresholds[anomalyType];

    if (deviation >= typeThresholds.high) {
      return 'high';
    } else if (deviation >= typeThresholds.medium) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Generate actionable recommendations based on anomaly type
   */
  private generateRecommendations(
    anomalyType: AnomalyType,
    context: any,
  ): string[] {
    const recommendations: string[] = [];

    switch (anomalyType) {
      case 'spike':
        recommendations.push(
          'Review recent deployments or configuration changes',
          'Check for unexpected traffic spikes or resource usage',
          'Verify autoscaling settings are configured correctly',
          'Consider implementing resource limits and quotas',
        );
        if (context.percentageIncrease > 100) {
          recommendations.push(
            'URGENT: Cost has more than doubled - immediate investigation required',
          );
        }
        break;

      case 'sustained_increase':
        recommendations.push(
          'Analyze resource utilization trends over time',
          'Review application growth and scaling patterns',
          'Consider implementing cost optimization strategies',
          'Evaluate if current resource allocation matches actual needs',
          'Schedule a cost review meeting with the team',
        );
        break;

      case 'unusual_pattern':
        recommendations.push(
          'Investigate for anomalous behavior or misconfigurations',
          'Check for failed jobs or stuck processes consuming resources',
          'Review recent code changes that might affect resource usage',
          'Verify monitoring and alerting systems are functioning correctly',
          'Consider implementing automated cost anomaly detection',
        );
        break;
    }

    return recommendations;
  }

  /**
   * Get all anomalies for a service
   */
  async getAnomalies(serviceId: string): Promise<CostAnomaly[]> {
    return this.anomalies.get(serviceId) || [];
  }

  /**
   * Get unresolved anomalies for a service
   */
  async getUnresolvedAnomalies(serviceId: string): Promise<CostAnomaly[]> {
    const anomalies = await this.getAnomalies(serviceId);
    return anomalies.filter(a => !a.resolvedAt);
  }

  /**
   * Mark anomaly as resolved
   */
  async resolveAnomaly(anomalyId: string): Promise<void> {
    for (const [serviceId, anomalies] of this.anomalies.entries()) {
      const anomaly = anomalies.find(a => a.id === anomalyId);
      if (anomaly) {
        anomaly.resolvedAt = new Date();
        this.anomalies.set(serviceId, anomalies);
        return;
      }
    }
    throw new Error(`Anomaly ${anomalyId} not found`);
  }

  /**
   * Mark anomaly notification as sent
   */
  async markNotificationSent(anomalyId: string): Promise<void> {
    for (const [serviceId, anomalies] of this.anomalies.entries()) {
      const anomaly = anomalies.find(a => a.id === anomalyId);
      if (anomaly) {
        anomaly.notificationSent = true;
        this.anomalies.set(serviceId, anomalies);
        return;
      }
    }
    throw new Error(`Anomaly ${anomalyId} not found`);
  }

  /**
   * Generate unique anomaly ID
   */
  private generateAnomalyId(): string {
    return `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
