/**
 * Cost Estimation Engine
 * 
 * Provides cost estimation capabilities for Kubernetes and AWS resources
 * Integrates with OpenCost API for historical data
 * Implements caching with 15-minute TTL
 */

import {
  DeploymentSpec,
  KubernetesCost,
  AWSCost,
  CostEstimate,
  HistoricalCostData,
  CostEstimationConfig,
} from './types';
import { parseCPU, parseMemory, parseStorage, hoursPerMonth, generateCacheKey } from './utils';
import { CostEstimationCache } from './cache';

export class CostEstimationEngine {
  private cache: CostEstimationCache;
  private config: CostEstimationConfig;

  constructor(config: CostEstimationConfig) {
    this.config = config;
    this.cache = new CostEstimationCache(config.cache?.ttl || 900); // 15 minutes default
  }

  /**
   * Estimate monthly cost based on deployment specification
   */
  async estimateDeploymentCost(
    spec: DeploymentSpec,
  ): Promise<CostEstimate> {
    const cacheKey = generateCacheKey('estimate', 'deployment', spec);
    
    // Check cache first
    const cached = await this.cache.get<CostEstimate>(cacheKey);
    if (cached) {
      return cached;
    }

    // Calculate Kubernetes costs
    const kubernetesCost = this.calculateKubernetesCost(spec);

    // Calculate AWS costs (simplified estimation)
    const awsCost = this.config.aws?.enabled
      ? this.estimateAWSCost(spec)
      : { rds: 0, s3: 0, other: 0, total: 0 };

    const estimate: CostEstimate = {
      estimatedMonthlyCost: kubernetesCost.total + awsCost.total,
      breakdown: {
        kubernetes: kubernetesCost,
        aws: awsCost,
      },
      confidence: 0.85, // 85% confidence for estimation
      currency: 'USD',
    };

    // Cache the result
    await this.cache.set(cacheKey, estimate);

    return estimate;
  }

  /**
   * Calculate Kubernetes cost based on deployment spec
   */
  private calculateKubernetesCost(spec: DeploymentSpec): KubernetesCost {
    const cpuCores = parseCPU(spec.cpu);
    const memoryGB = parseMemory(spec.memory);
    const storageGB = spec.storage ? parseStorage(spec.storage) : 0;
    const replicas = spec.replicas || 1;

    const pricing = this.config.pricing.kubernetes;

    // Calculate hourly costs
    const cpuCostPerHour = cpuCores * pricing.cpuPerCorePerHour * replicas;
    const memoryCostPerHour = memoryGB * pricing.memoryPerGBPerHour * replicas;

    // Calculate monthly costs
    const hours = hoursPerMonth();
    const cpuCostMonthly = cpuCostPerHour * hours;
    const memoryCostMonthly = memoryCostPerHour * hours;
    const storageCostMonthly = storageGB * pricing.storagePerGBPerMonth * replicas;

    return {
      cpu: Math.round(cpuCostMonthly * 100) / 100,
      memory: Math.round(memoryCostMonthly * 100) / 100,
      storage: Math.round(storageCostMonthly * 100) / 100,
      total: Math.round((cpuCostMonthly + memoryCostMonthly + storageCostMonthly) * 100) / 100,
    };
  }

  /**
   * Estimate AWS costs (simplified)
   * In production, this should integrate with AWS Cost Explorer API
   */
  private estimateAWSCost(spec: DeploymentSpec): AWSCost {
    const pricing = this.config.pricing.aws;
    
    // Simplified estimation based on environment
    // In production, this would query AWS Cost Explorer or use more sophisticated logic
    const environment = spec.environment || 'development';
    
    let rdsCost = 0;
    let s3Cost = 0;
    let otherCost = 0;

    // Estimate RDS cost based on environment
    if (environment === 'production') {
      // Assume production uses RDS
      rdsCost = pricing.rds.perInstancePerHour * hoursPerMonth();
    } else if (environment === 'staging') {
      // Staging might use smaller RDS instance
      rdsCost = pricing.rds.perInstancePerHour * hoursPerMonth() * 0.5;
    }

    // Estimate S3 cost (assume 100GB for production, 50GB for staging, 10GB for dev)
    const storageGB = environment === 'production' ? 100 : environment === 'staging' ? 50 : 10;
    s3Cost = storageGB * pricing.s3.perGBPerMonth;

    // Other AWS costs (CloudFront, etc.) - simplified
    otherCost = environment === 'production' ? 50 : environment === 'staging' ? 20 : 5;

    return {
      rds: Math.round(rdsCost * 100) / 100,
      s3: Math.round(s3Cost * 100) / 100,
      other: Math.round(otherCost * 100) / 100,
      total: Math.round((rdsCost + s3Cost + otherCost) * 100) / 100,
    };
  }

  /**
   * Get historical cost data from OpenCost API
   */
  async getHistoricalCost(
    serviceName: string,
    timeRange: string = '7d',
  ): Promise<HistoricalCostData> {
    const cacheKey = generateCacheKey('historical', serviceName, { timeRange });
    
    // Check cache first
    const cached = await this.cache.get<HistoricalCostData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Fetch from OpenCost API
      const data = await this.fetchOpenCostData(serviceName, timeRange);
      
      // Cache the result
      await this.cache.set(cacheKey, data);
      
      return data;
    } catch (error) {
      throw new Error(`Failed to fetch historical cost data: ${error}`);
    }
  }

  /**
   * Fetch cost data from OpenCost API
   */
  private async fetchOpenCostData(
    serviceName: string,
    timeRange: string,
  ): Promise<HistoricalCostData> {
    const baseUrl = this.config.opencost.baseUrl;
    const url = `${baseUrl}/allocation?window=${timeRange}&aggregate=namespace&filter=namespace:${serviceName}`;

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`OpenCost API returned ${response.status}: ${response.statusText}`);
      }

      const rawData = await response.json();
      
      // Parse OpenCost response
      return this.parseOpenCostResponse(serviceName, rawData, timeRange);
    } catch (error) {
      // If OpenCost is not available, return mock data for development
      console.warn(`OpenCost API unavailable, using mock data: ${error}`);
      return this.getMockHistoricalData(serviceName, timeRange);
    }
  }

  /**
   * Parse OpenCost API response
   */
  private parseOpenCostResponse(
    serviceName: string,
    rawData: any,
    timeRange: string,
  ): HistoricalCostData {
    // OpenCost response structure varies, this is a simplified parser
    const data = rawData.data?.[0] || rawData[serviceName] || {};
    
    const cpuCost = data.cpuCost || 0;
    const memoryCost = data.ramCost || data.memoryCost || 0;
    const storageCost = data.pvCost || data.storageCost || 0;
    const totalCost = data.totalCost || cpuCost + memoryCost + storageCost;

    const now = new Date();
    const daysAgo = parseInt(timeRange.replace('d', ''), 10) || 7;
    const start = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    return {
      serviceName,
      timeRange: {
        start: start.toISOString(),
        end: now.toISOString(),
      },
      costs: {
        kubernetes: {
          cpu: Math.round(cpuCost * 100) / 100,
          memory: Math.round(memoryCost * 100) / 100,
          storage: Math.round(storageCost * 100) / 100,
          total: Math.round(totalCost * 100) / 100,
        },
      },
      totalCost: Math.round(totalCost * 100) / 100,
    };
  }

  /**
   * Get mock historical data for development/testing
   */
  private getMockHistoricalData(
    serviceName: string,
    timeRange: string,
  ): HistoricalCostData {
    const now = new Date();
    const daysAgo = parseInt(timeRange.replace('d', ''), 10) || 7;
    const start = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    // Generate mock data based on service name hash for consistency
    const hash = serviceName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const baseCost = (hash % 500) + 100; // $100-$600 base cost

    const cpuCost = baseCost * 0.4;
    const memoryCost = baseCost * 0.35;
    const storageCost = baseCost * 0.25;

    return {
      serviceName,
      timeRange: {
        start: start.toISOString(),
        end: now.toISOString(),
      },
      costs: {
        kubernetes: {
          cpu: Math.round(cpuCost * 100) / 100,
          memory: Math.round(memoryCost * 100) / 100,
          storage: Math.round(storageCost * 100) / 100,
          total: Math.round(baseCost * 100) / 100,
        },
      },
      totalCost: Math.round(baseCost * 100) / 100,
    };
  }

  /**
   * Clear cache (useful for testing)
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return this.cache.getStats();
  }
}
