/**
 * Maturity Trend Storage
 * Handles persistence of maturity trend data
 */

import { MaturityDataPoint } from './types';

export interface TrendStorageInterface {
  /**
   * Store a new data point for a service
   */
  storeDataPoint(serviceId: string, dataPoint: MaturityDataPoint): Promise<void>;

  /**
   * Get all data points for a service
   */
  getDataPoints(serviceId: string): Promise<MaturityDataPoint[]>;

  /**
   * Get data points within a time range
   */
  getDataPointsInRange(
    serviceId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MaturityDataPoint[]>;

  /**
   * Delete old data points
   */
  pruneOldDataPoints(serviceId: string, maxAgeDays: number): Promise<number>;

  /**
   * Get all services with trend data
   */
  getAllServicesWithTrends(): Promise<string[]>;

  /**
   * Clear all trend data for a service
   */
  clearServiceTrends(serviceId: string): Promise<void>;
}

/**
 * In-memory implementation of trend storage
 * In production, this should be replaced with a database implementation
 */
export class InMemoryTrendStorage implements TrendStorageInterface {
  private storage: Map<string, MaturityDataPoint[]>;

  constructor() {
    this.storage = new Map();
  }

  async storeDataPoint(serviceId: string, dataPoint: MaturityDataPoint): Promise<void> {
    const existing = this.storage.get(serviceId) || [];
    
    // Check if a data point already exists for this date
    const existingIndex = existing.findIndex(
      p => p.date.getTime() === dataPoint.date.getTime(),
    );

    if (existingIndex >= 0) {
      // Update existing data point
      existing[existingIndex] = dataPoint;
    } else {
      // Add new data point
      existing.push(dataPoint);
    }

    // Sort by date
    existing.sort((a, b) => a.date.getTime() - b.date.getTime());

    this.storage.set(serviceId, existing);
  }

  async getDataPoints(serviceId: string): Promise<MaturityDataPoint[]> {
    return this.storage.get(serviceId) || [];
  }

  async getDataPointsInRange(
    serviceId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MaturityDataPoint[]> {
    const allPoints = this.storage.get(serviceId) || [];
    
    return allPoints.filter(
      point =>
        point.date.getTime() >= startDate.getTime() &&
        point.date.getTime() <= endDate.getTime(),
    );
  }

  async pruneOldDataPoints(serviceId: string, maxAgeDays: number): Promise<number> {
    const allPoints = this.storage.get(serviceId) || [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    const filtered = allPoints.filter(
      point => point.date.getTime() >= cutoffDate.getTime(),
    );

    const removedCount = allPoints.length - filtered.length;
    
    if (filtered.length > 0) {
      this.storage.set(serviceId, filtered);
    } else {
      this.storage.delete(serviceId);
    }

    return removedCount;
  }

  async getAllServicesWithTrends(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  async clearServiceTrends(serviceId: string): Promise<void> {
    this.storage.delete(serviceId);
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    totalServices: number;
    totalDataPoints: number;
    averagePointsPerService: number;
  } {
    const totalServices = this.storage.size;
    let totalDataPoints = 0;

    for (const points of this.storage.values()) {
      totalDataPoints += points.length;
    }

    const averagePointsPerService =
      totalServices > 0 ? totalDataPoints / totalServices : 0;

    return {
      totalServices,
      totalDataPoints,
      averagePointsPerService: Math.round(averagePointsPerService * 100) / 100,
    };
  }

  /**
   * Clear all data (for testing)
   */
  clearAll(): void {
    this.storage.clear();
  }
}

/**
 * PostgreSQL implementation of trend storage
 * This is a placeholder for production implementation
 */
export class PostgresTrendStorage implements TrendStorageInterface {
  // In production, this would use a database connection
  // For now, delegate to in-memory storage
  private inMemory: InMemoryTrendStorage;

  constructor() {
    this.inMemory = new InMemoryTrendStorage();
  }

  async storeDataPoint(serviceId: string, dataPoint: MaturityDataPoint): Promise<void> {
    // TODO: Implement PostgreSQL storage
    // Example SQL:
    // INSERT INTO maturity_trends (service_id, date, score)
    // VALUES ($1, $2, $3)
    // ON CONFLICT (service_id, date) DO UPDATE SET score = $3
    
    return this.inMemory.storeDataPoint(serviceId, dataPoint);
  }

  async getDataPoints(serviceId: string): Promise<MaturityDataPoint[]> {
    // TODO: Implement PostgreSQL retrieval
    // Example SQL:
    // SELECT date, score FROM maturity_trends
    // WHERE service_id = $1
    // ORDER BY date ASC
    
    return this.inMemory.getDataPoints(serviceId);
  }

  async getDataPointsInRange(
    serviceId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<MaturityDataPoint[]> {
    // TODO: Implement PostgreSQL range query
    // Example SQL:
    // SELECT date, score FROM maturity_trends
    // WHERE service_id = $1 AND date >= $2 AND date <= $3
    // ORDER BY date ASC
    
    return this.inMemory.getDataPointsInRange(serviceId, startDate, endDate);
  }

  async pruneOldDataPoints(serviceId: string, maxAgeDays: number): Promise<number> {
    // TODO: Implement PostgreSQL pruning
    // Example SQL:
    // DELETE FROM maturity_trends
    // WHERE service_id = $1 AND date < NOW() - INTERVAL '$2 days'
    // RETURNING COUNT(*)
    
    return this.inMemory.pruneOldDataPoints(serviceId, maxAgeDays);
  }

  async getAllServicesWithTrends(): Promise<string[]> {
    // TODO: Implement PostgreSQL query
    // Example SQL:
    // SELECT DISTINCT service_id FROM maturity_trends
    
    return this.inMemory.getAllServicesWithTrends();
  }

  async clearServiceTrends(serviceId: string): Promise<void> {
    // TODO: Implement PostgreSQL deletion
    // Example SQL:
    // DELETE FROM maturity_trends WHERE service_id = $1
    
    return this.inMemory.clearServiceTrends(serviceId);
  }
}
