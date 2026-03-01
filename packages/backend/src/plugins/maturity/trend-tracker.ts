/**
 * Maturity Trend Tracking Engine
 * Tracks maturity score changes over time
 */

import {
  MaturityTrend,
  MaturityDataPoint,
  ServiceScorecard,
} from './types';

export interface TrendAnalysis {
  trend: 'improving' | 'stable' | 'declining';
  improvement: number; // Percentage change
  velocity: number; // Points per day
  projectedScore30Days?: number; // Projected score in 30 days
  projectedScore90Days?: number; // Projected score in 90 days
}

export interface TeamTrendSummary {
  teamId: string;
  currentScore: number;
  previousScore: number;
  trend: 'improving' | 'stable' | 'declining';
  improvement: number;
  servicesImproving: number;
  servicesStable: number;
  servicesDeclining: number;
}

export class TrendTracker {
  /**
   * Calculate maturity trend from historical data points
   */
  calculateTrend(dataPoints: MaturityDataPoint[]): MaturityTrend {
    if (dataPoints.length === 0) {
      return {
        dataPoints: [],
        improvement: 0,
        trend: 'stable',
      };
    }

    // Sort by date (oldest first)
    const sorted = [...dataPoints].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    // Calculate improvement (percentage change from first to last)
    const firstScore = sorted[0].score;
    const lastScore = sorted[sorted.length - 1].score;
    const improvement = firstScore > 0 
      ? ((lastScore - firstScore) / firstScore) * 100 
      : 0;

    // Determine trend
    let trend: 'improving' | 'stable' | 'declining';
    if (improvement > 5) {
      trend = 'improving';
    } else if (improvement < -5) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    return {
      dataPoints: sorted,
      improvement: Math.round(improvement * 100) / 100,
      trend,
    };
  }

  /**
   * Analyze trend with velocity and projections
   */
  analyzeTrend(dataPoints: MaturityDataPoint[]): TrendAnalysis {
    if (dataPoints.length < 2) {
      return {
        trend: 'stable',
        improvement: 0,
        velocity: 0,
      };
    }

    // Sort by date
    const sorted = [...dataPoints].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    // Calculate improvement
    const firstScore = sorted[0].score;
    const lastScore = sorted[sorted.length - 1].score;
    const improvement = firstScore > 0 
      ? ((lastScore - firstScore) / firstScore) * 100 
      : 0;

    // Calculate velocity (points per day)
    const firstDate = sorted[0].date.getTime();
    const lastDate = sorted[sorted.length - 1].date.getTime();
    const daysDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
    const velocity = daysDiff > 0 ? (lastScore - firstScore) / daysDiff : 0;

    // Determine trend
    let trend: 'improving' | 'stable' | 'declining';
    if (improvement > 5) {
      trend = 'improving';
    } else if (improvement < -5) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    // Project future scores (simple linear projection)
    const projectedScore30Days = Math.min(100, Math.max(0, lastScore + velocity * 30));
    const projectedScore90Days = Math.min(100, Math.max(0, lastScore + velocity * 90));

    return {
      trend,
      improvement: Math.round(improvement * 100) / 100,
      velocity: Math.round(velocity * 1000) / 1000,
      projectedScore30Days: Math.round(projectedScore30Days * 100) / 100,
      projectedScore90Days: Math.round(projectedScore90Days * 100) / 100,
    };
  }

  /**
   * Add new data point to trend
   */
  addDataPoint(
    existingPoints: MaturityDataPoint[],
    newScore: number,
    date: Date = new Date(),
  ): MaturityDataPoint[] {
    const newPoint: MaturityDataPoint = {
      date,
      score: newScore,
    };

    return [...existingPoints, newPoint];
  }

  /**
   * Get data points within a time range
   */
  getDataPointsInRange(
    dataPoints: MaturityDataPoint[],
    startDate: Date,
    endDate: Date,
  ): MaturityDataPoint[] {
    return dataPoints.filter(
      point =>
        point.date.getTime() >= startDate.getTime() &&
        point.date.getTime() <= endDate.getTime(),
    );
  }

  /**
   * Calculate team trend summary
   */
  calculateTeamTrendSummary(
    teamId: string,
    serviceTrends: Map<string, MaturityTrend>,
    currentBenchmark: { averageScore: number },
    previousBenchmark?: { averageScore: number },
  ): TeamTrendSummary {
    // Count services by trend
    let servicesImproving = 0;
    let servicesStable = 0;
    let servicesDeclining = 0;

    for (const trend of serviceTrends.values()) {
      if (trend.trend === 'improving') servicesImproving++;
      else if (trend.trend === 'stable') servicesStable++;
      else servicesDeclining++;
    }

    // Calculate team-level improvement
    const currentScore = currentBenchmark.averageScore;
    const previousScore = previousBenchmark?.averageScore ?? currentScore;
    const improvement = previousScore > 0 
      ? ((currentScore - previousScore) / previousScore) * 100 
      : 0;

    // Determine team trend
    let trend: 'improving' | 'stable' | 'declining';
    if (improvement > 5) {
      trend = 'improving';
    } else if (improvement < -5) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    return {
      teamId,
      currentScore,
      previousScore,
      trend,
      improvement: Math.round(improvement * 100) / 100,
      servicesImproving,
      servicesStable,
      servicesDeclining,
    };
  }

  /**
   * Detect significant changes (anomalies)
   */
  detectSignificantChanges(
    dataPoints: MaturityDataPoint[],
    threshold: number = 10, // Percentage change threshold
  ): Array<{
    date: Date;
    previousScore: number;
    newScore: number;
    change: number;
    changePercent: number;
  }> {
    if (dataPoints.length < 2) {
      return [];
    }

    const sorted = [...dataPoints].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    const significantChanges: Array<{
      date: Date;
      previousScore: number;
      newScore: number;
      change: number;
      changePercent: number;
    }> = [];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const change = curr.score - prev.score;
      const changePercent = prev.score > 0 ? (change / prev.score) * 100 : 0;

      if (Math.abs(changePercent) >= threshold) {
        significantChanges.push({
          date: curr.date,
          previousScore: prev.score,
          newScore: curr.score,
          change: Math.round(change * 100) / 100,
          changePercent: Math.round(changePercent * 100) / 100,
        });
      }
    }

    return significantChanges;
  }

  /**
   * Calculate moving average
   */
  calculateMovingAverage(
    dataPoints: MaturityDataPoint[],
    windowSize: number = 7, // 7-day moving average
  ): MaturityDataPoint[] {
    if (dataPoints.length < windowSize) {
      return dataPoints;
    }

    const sorted = [...dataPoints].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    const movingAverage: MaturityDataPoint[] = [];

    for (let i = windowSize - 1; i < sorted.length; i++) {
      const window = sorted.slice(i - windowSize + 1, i + 1);
      const avgScore = window.reduce((sum, p) => sum + p.score, 0) / windowSize;

      movingAverage.push({
        date: sorted[i].date,
        score: Math.round(avgScore * 100) / 100,
      });
    }

    return movingAverage;
  }

  /**
   * Compare trends between two time periods
   */
  comparePeriods(
    dataPoints: MaturityDataPoint[],
    period1Start: Date,
    period1End: Date,
    period2Start: Date,
    period2End: Date,
  ): {
    period1Average: number;
    period2Average: number;
    change: number;
    changePercent: number;
    trend: 'improving' | 'stable' | 'declining';
  } {
    const period1Points = this.getDataPointsInRange(dataPoints, period1Start, period1End);
    const period2Points = this.getDataPointsInRange(dataPoints, period2Start, period2End);

    const period1Average =
      period1Points.length > 0
        ? period1Points.reduce((sum, p) => sum + p.score, 0) / period1Points.length
        : 0;

    const period2Average =
      period2Points.length > 0
        ? period2Points.reduce((sum, p) => sum + p.score, 0) / period2Points.length
        : 0;

    const change = period2Average - period1Average;
    const changePercent = period1Average > 0 ? (change / period1Average) * 100 : 0;

    let trend: 'improving' | 'stable' | 'declining';
    if (changePercent > 5) {
      trend = 'improving';
    } else if (changePercent < -5) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    return {
      period1Average: Math.round(period1Average * 100) / 100,
      period2Average: Math.round(period2Average * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      trend,
    };
  }

  /**
   * Get latest score from data points
   */
  getLatestScore(dataPoints: MaturityDataPoint[]): number | null {
    if (dataPoints.length === 0) {
      return null;
    }

    const sorted = [...dataPoints].sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );

    return sorted[0].score;
  }

  /**
   * Prune old data points (keep only recent history)
   */
  pruneOldDataPoints(
    dataPoints: MaturityDataPoint[],
    maxAgeDays: number = 365, // Keep 1 year of history
  ): MaturityDataPoint[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    return dataPoints.filter(point => point.date.getTime() >= cutoffDate.getTime());
  }
}
