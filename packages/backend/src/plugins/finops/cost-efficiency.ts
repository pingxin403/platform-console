/**
 * Cost Efficiency Metrics Calculator
 * 
 * Calculates cost efficiency metrics including:
 * - Cost per request
 * - Cost per user
 * - Resource utilization rate
 * - Cost trends and recommendations
 */

import { CostEstimationEngine } from './cost-estimation-engine';
import { CostEstimationCache } from './cache';
import { generateCacheKey } from './utils';

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

export interface CostEfficiencyConfig {
  opencost: {
    baseUrl: string;
  };
  monitoring?: {
    datadogApiKey?: string;
    datadogAppKey?: string;
    datadogSite?: string;
  };
  cache?: {
    ttl: number; // seconds
  };
}

export class CostEfficiencyCalculator {
  private costEngine: CostEstimationEngine;
  private cache: CostEstimationCache;
  private config: CostEfficiencyConfig;

  constructor(
    costEngine: CostEstimationEngine,
    config: CostEfficiencyConfig,
  ) {
    this.costEngine = costEngine;
    this.config = config;
    this.cache = new CostEstimationCache(config.cache?.ttl || 900); // 15 minutes default
  }

  /**
   * Calculate comprehensive cost efficiency metrics
   */
  async calculateEfficiencyMetrics(
    serviceId: string,
    timeRange: string = '30d',
  ): Promise<CostEfficiencyMetrics> {
    const cacheKey = generateCacheKey('efficiency', serviceId, { timeRange });
    
    // Check cache first
    const cached = await this.cache.get<CostEfficiencyMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get historical cost data
    const historicalCost = await this.costEngine.getHistoricalCost(serviceId, timeRange);
    
    // Get request volume data
    const requestData = await this.getRequestVolumeData(serviceId, timeRange);
    
    // Get user volume data
    const userData = await this.getUserVolumeData(serviceId, timeRange);
    
    // Get resource utilization data
    const utilizationData = await this.getResourceUtilization(serviceId);

    // Calculate cost per request
    const costPerRequest = requestData.totalRequests > 0
      ? historicalCost.totalCost / requestData.totalRequests
      : null;

    // Calculate cost per user
    const costPerUser = userData.activeUsers > 0
      ? historicalCost.totalCost / userData.activeUsers
      : null;

    // Calculate cost trend
    const costTrend = await this.calculateCostTrend(serviceId, timeRange);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      utilizationData,
      costTrend,
      costPerRequest,
      costPerUser,
    );

    const metrics: CostEfficiencyMetrics = {
      serviceId,
      period: historicalCost.timeRange,
      costPerRequest,
      costPerUser,
      resourceUtilization: {
        cpu: utilizationData.cpu.utilization,
        memory: utilizationData.memory.utilization,
        storage: utilizationData.storage.utilization,
        overall: (
          utilizationData.cpu.utilization +
          utilizationData.memory.utilization +
          utilizationData.storage.utilization
        ) / 3,
      },
      costTrend,
      recommendations,
      calculatedAt: new Date().toISOString(),
    };

    // Cache the result
    await this.cache.set(cacheKey, metrics);

    return metrics;
  }

  /**
   * Get request volume data from monitoring system (Datadog)
   */
  private async getRequestVolumeData(
    serviceId: string,
    timeRange: string,
  ): Promise<RequestVolumeData> {
    const cacheKey = generateCacheKey('requests', serviceId, { timeRange });
    
    // Check cache first
    const cached = await this.cache.get<RequestVolumeData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Try to fetch from Datadog API
      if (this.config.monitoring?.datadogApiKey) {
        const data = await this.fetchDatadogRequestMetrics(serviceId, timeRange);
        await this.cache.set(cacheKey, data);
        return data;
      }
    } catch (error) {
      console.warn(`Failed to fetch request volume from Datadog: ${error}`);
    }

    // Return mock data if Datadog is not available
    return this.getMockRequestVolumeData(serviceId, timeRange);
  }

  /**
   * Fetch request metrics from Datadog
   */
  private async fetchDatadogRequestMetrics(
    serviceId: string,
    timeRange: string,
  ): Promise<RequestVolumeData> {
    const { datadogApiKey, datadogAppKey, datadogSite = 'datadoghq.com' } = this.config.monitoring!;
    
    // Calculate time range
    const now = Math.floor(Date.now() / 1000);
    const daysAgo = parseInt(timeRange.replace('d', ''), 10) || 30;
    const from = now - (daysAgo * 24 * 60 * 60);

    // Query Datadog for request count
    const query = `sum:trace.http.request.hits{service:${serviceId}}.as_count()`;
    const url = `https://api.${datadogSite}/api/v1/query?query=${encodeURIComponent(query)}&from=${from}&to=${now}`;

    const response = await fetch(url, {
      headers: {
        'DD-API-KEY': datadogApiKey,
        'DD-APPLICATION-KEY': datadogAppKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Datadog API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Parse response and sum up request counts
    const totalRequests = data.series?.[0]?.pointlist?.reduce(
      (sum: number, point: [number, number]) => sum + point[1],
      0,
    ) || 0;

    return {
      serviceId,
      totalRequests: Math.round(totalRequests),
      period: {
        start: new Date(from * 1000).toISOString(),
        end: new Date(now * 1000).toISOString(),
      },
    };
  }

  /**
   * Get mock request volume data for development/testing
   */
  private getMockRequestVolumeData(
    serviceId: string,
    timeRange: string,
  ): RequestVolumeData {
    const now = new Date();
    const daysAgo = parseInt(timeRange.replace('d', ''), 10) || 30;
    const start = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    // Generate mock data based on service name hash for consistency
    const hash = serviceId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const dailyRequests = (hash % 50000) + 10000; // 10k-60k requests per day
    const totalRequests = dailyRequests * daysAgo;

    return {
      serviceId,
      totalRequests,
      period: {
        start: start.toISOString(),
        end: now.toISOString(),
      },
    };
  }

  /**
   * Get user volume data from analytics system
   */
  private async getUserVolumeData(
    serviceId: string,
    timeRange: string,
  ): Promise<UserVolumeData> {
    const cacheKey = generateCacheKey('users', serviceId, { timeRange });
    
    // Check cache first
    const cached = await this.cache.get<UserVolumeData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Try to fetch from Datadog or analytics system
      if (this.config.monitoring?.datadogApiKey) {
        const data = await this.fetchDatadogUserMetrics(serviceId, timeRange);
        await this.cache.set(cacheKey, data);
        return data;
      }
    } catch (error) {
      console.warn(`Failed to fetch user volume from analytics: ${error}`);
    }

    // Return mock data if analytics is not available
    return this.getMockUserVolumeData(serviceId, timeRange);
  }

  /**
   * Fetch user metrics from Datadog
   */
  private async fetchDatadogUserMetrics(
    serviceId: string,
    timeRange: string,
  ): Promise<UserVolumeData> {
    const { datadogApiKey, datadogAppKey, datadogSite = 'datadoghq.com' } = this.config.monitoring!;
    
    // Calculate time range
    const now = Math.floor(Date.now() / 1000);
    const daysAgo = parseInt(timeRange.replace('d', ''), 10) || 30;
    const from = now - (daysAgo * 24 * 60 * 60);

    // Query Datadog for unique users (using custom metric or RUM data)
    const query = `sum:custom.active_users{service:${serviceId}}`;
    const url = `https://api.${datadogSite}/api/v1/query?query=${encodeURIComponent(query)}&from=${from}&to=${now}`;

    const response = await fetch(url, {
      headers: {
        'DD-API-KEY': datadogApiKey,
        'DD-APPLICATION-KEY': datadogAppKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Datadog API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Get the latest active user count
    const activeUsers = data.series?.[0]?.pointlist?.[data.series[0].pointlist.length - 1]?.[1] || 0;

    return {
      serviceId,
      activeUsers: Math.round(activeUsers),
      period: {
        start: new Date(from * 1000).toISOString(),
        end: new Date(now * 1000).toISOString(),
      },
    };
  }

  /**
   * Get mock user volume data for development/testing
   */
  private getMockUserVolumeData(
    serviceId: string,
    timeRange: string,
  ): UserVolumeData {
    const now = new Date();
    const daysAgo = parseInt(timeRange.replace('d', ''), 10) || 30;
    const start = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    // Generate mock data based on service name hash for consistency
    const hash = serviceId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const activeUsers = (hash % 5000) + 500; // 500-5500 active users

    return {
      serviceId,
      activeUsers,
      period: {
        start: start.toISOString(),
        end: now.toISOString(),
      },
    };
  }

  /**
   * Get resource utilization data from OpenCost/Kubernetes
   */
  private async getResourceUtilization(
    serviceId: string,
  ): Promise<ResourceUtilizationData> {
    const cacheKey = generateCacheKey('utilization', serviceId);
    
    // Check cache first
    const cached = await this.cache.get<ResourceUtilizationData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Fetch from OpenCost API
      const data = await this.fetchOpenCostUtilization(serviceId);
      await this.cache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.warn(`Failed to fetch resource utilization from OpenCost: ${error}`);
      return this.getMockResourceUtilization(serviceId);
    }
  }

  /**
   * Fetch resource utilization from OpenCost
   */
  private async fetchOpenCostUtilization(
    serviceId: string,
  ): Promise<ResourceUtilizationData> {
    const baseUrl = this.config.opencost.baseUrl;
    const url = `${baseUrl}/allocation?window=1d&aggregate=namespace&filter=namespace:${serviceId}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`OpenCost API returned ${response.status}: ${response.statusText}`);
    }

    const rawData = await response.json();
    const data = rawData.data?.[0] || rawData[serviceId] || {};

    // Parse utilization data
    const cpuRequested = data.cpuCoreRequestAverage || 2;
    const cpuUsed = data.cpuCoreUsageAverage || cpuRequested * 0.65;
    const memoryRequested = data.ramByteRequestAverage ? data.ramByteRequestAverage / (1024 ** 3) : 4;
    const memoryUsed = data.ramByteUsageAverage ? data.ramByteUsageAverage / (1024 ** 3) : memoryRequested * 0.70;
    const storageAllocated = data.pvBytes ? data.pvBytes / (1024 ** 3) : 10;
    const storageUsed = storageAllocated * 0.60; // Assume 60% usage if not provided

    return {
      serviceId,
      cpu: {
        requested: Math.round(cpuRequested * 100) / 100,
        used: Math.round(cpuUsed * 100) / 100,
        utilization: Math.round((cpuUsed / cpuRequested) * 100),
      },
      memory: {
        requested: Math.round(memoryRequested * 100) / 100,
        used: Math.round(memoryUsed * 100) / 100,
        utilization: Math.round((memoryUsed / memoryRequested) * 100),
      },
      storage: {
        allocated: Math.round(storageAllocated * 100) / 100,
        used: Math.round(storageUsed * 100) / 100,
        utilization: Math.round((storageUsed / storageAllocated) * 100),
      },
    };
  }

  /**
   * Get mock resource utilization data for development/testing
   */
  private getMockResourceUtilization(
    serviceId: string,
  ): ResourceUtilizationData {
    // Generate mock data based on service name hash for consistency
    const hash = serviceId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    const cpuRequested = 2 + (hash % 4); // 2-6 cores
    const cpuUtilization = 50 + (hash % 40); // 50-90%
    const cpuUsed = (cpuRequested * cpuUtilization) / 100;

    const memoryRequested = 4 + (hash % 8); // 4-12 GB
    const memoryUtilization = 55 + (hash % 35); // 55-90%
    const memoryUsed = (memoryRequested * memoryUtilization) / 100;

    const storageAllocated = 10 + (hash % 40); // 10-50 GB
    const storageUtilization = 40 + (hash % 50); // 40-90%
    const storageUsed = (storageAllocated * storageUtilization) / 100;

    return {
      serviceId,
      cpu: {
        requested: Math.round(cpuRequested * 100) / 100,
        used: Math.round(cpuUsed * 100) / 100,
        utilization: Math.round(cpuUtilization),
      },
      memory: {
        requested: Math.round(memoryRequested * 100) / 100,
        used: Math.round(memoryUsed * 100) / 100,
        utilization: Math.round(memoryUtilization),
      },
      storage: {
        allocated: Math.round(storageAllocated * 100) / 100,
        used: Math.round(storageUsed * 100) / 100,
        utilization: Math.round(storageUtilization),
      },
    };
  }

  /**
   * Calculate cost trend by comparing current and previous periods
   */
  private async calculateCostTrend(
    serviceId: string,
    timeRange: string,
  ): Promise<CostEfficiencyMetrics['costTrend']> {
    const daysAgo = parseInt(timeRange.replace('d', ''), 10) || 30;
    
    // Get current period cost
    const currentCost = await this.costEngine.getHistoricalCost(serviceId, timeRange);
    
    // Get previous period cost (same duration, but shifted back)
    const previousTimeRange = `${daysAgo * 2}d`;
    const previousCost = await this.costEngine.getHistoricalCost(serviceId, previousTimeRange);
    
    // Calculate the cost for the previous period (subtract current from total)
    const previousPeriodCost = previousCost.totalCost - currentCost.totalCost;
    
    // Calculate change percentage
    const changePercent = previousPeriodCost > 0
      ? ((currentCost.totalCost - previousPeriodCost) / previousPeriodCost) * 100
      : 0;

    // Determine direction
    let direction: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(changePercent) < 5) {
      direction = 'stable';
    } else if (changePercent > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    return {
      current: Math.round(currentCost.totalCost * 100) / 100,
      previous: Math.round(previousPeriodCost * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      direction,
    };
  }

  /**
   * Generate cost optimization recommendations
   */
  private generateRecommendations(
    utilization: ResourceUtilizationData,
    costTrend: CostEfficiencyMetrics['costTrend'],
    costPerRequest: number | null,
    costPerUser: number | null,
  ): string[] {
    const recommendations: string[] = [];

    // CPU utilization recommendations
    if (utilization.cpu.utilization < 40) {
      recommendations.push(
        `CPU utilization is low (${utilization.cpu.utilization}%). Consider reducing CPU requests from ${utilization.cpu.requested} to ${Math.ceil(utilization.cpu.used * 1.2)} cores to save costs.`,
      );
    } else if (utilization.cpu.utilization > 85) {
      recommendations.push(
        `CPU utilization is high (${utilization.cpu.utilization}%). Consider increasing CPU requests to prevent performance issues.`,
      );
    }

    // Memory utilization recommendations
    if (utilization.memory.utilization < 40) {
      recommendations.push(
        `Memory utilization is low (${utilization.memory.utilization}%). Consider reducing memory requests from ${utilization.memory.requested}GB to ${Math.ceil(utilization.memory.used * 1.2)}GB to save costs.`,
      );
    } else if (utilization.memory.utilization > 85) {
      recommendations.push(
        `Memory utilization is high (${utilization.memory.utilization}%). Consider increasing memory requests to prevent OOM errors.`,
      );
    }

    // Storage utilization recommendations
    if (utilization.storage.utilization < 30) {
      recommendations.push(
        `Storage utilization is low (${utilization.storage.utilization}%). Consider reducing storage allocation from ${utilization.storage.allocated}GB to ${Math.ceil(utilization.storage.used * 1.5)}GB.`,
      );
    } else if (utilization.storage.utilization > 80) {
      recommendations.push(
        `Storage utilization is high (${utilization.storage.utilization}%). Consider increasing storage allocation to prevent disk full errors.`,
      );
    }

    // Cost trend recommendations
    if (costTrend.direction === 'increasing' && costTrend.changePercent > 20) {
      recommendations.push(
        `Cost has increased by ${costTrend.changePercent.toFixed(1)}% compared to the previous period. Review recent changes and consider optimization.`,
      );
    }

    // Cost per request recommendations
    if (costPerRequest !== null && costPerRequest > 0.001) {
      recommendations.push(
        `Cost per request is $${costPerRequest.toFixed(4)}. Consider implementing caching or optimizing database queries to reduce costs.`,
      );
    }

    // Cost per user recommendations
    if (costPerUser !== null && costPerUser > 10) {
      recommendations.push(
        `Cost per user is $${costPerUser.toFixed(2)}. Consider implementing multi-tenancy optimizations or resource sharing.`,
      );
    }

    // Overall efficiency recommendation
    const overallUtilization = (
      utilization.cpu.utilization +
      utilization.memory.utilization +
      utilization.storage.utilization
    ) / 3;

    if (overallUtilization < 50) {
      recommendations.push(
        `Overall resource utilization is ${overallUtilization.toFixed(0)}%. Consider right-sizing resources to improve cost efficiency.`,
      );
    }

    return recommendations;
  }

  /**
   * Clear cache (useful for testing)
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }
}
