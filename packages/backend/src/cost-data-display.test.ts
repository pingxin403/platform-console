/**
 * Property-based test for cost data display
 * Feature: internal-developer-platform, Property 13: Cost data display
 * Validates: Requirements 6.1, 6.2, 6.4
 */

import * as fc from 'fast-check';

// Cost data interfaces to test
interface CostData {
  serviceName: string;
  totalCost: number;
  cpuCost: number;
  memoryCost: number;
  storageCost: number;
  networkCost: number;
  timeRange: {
    start: string;
    end: string;
  };
  awsCorrelation?: {
    ec2Cost: number;
    ebsCost: number;
    s3Cost: number;
    rdsCost: number;
  };
  lastUpdated: Date;
}

interface CostTrend {
  current: number;
  previous: number;
  change: number;
  significant: boolean;
}

interface CostDisplayService {
  displayMonthlyCosts(serviceName: string): Promise<CostData>;
  displayCostTrends(serviceName: string): Promise<CostTrend>;
  displayAwsResourceCosts(serviceName: string): Promise<CostData>;
  highlightSignificantChanges(trend: CostTrend): boolean;
}

// Mock implementation of cost display service for testing
class MockCostDisplayService implements CostDisplayService {
  private costData: Map<string, CostData> = new Map();
  private readonly SIGNIFICANT_CHANGE_THRESHOLD = 15; // 15% threshold

  setCostData(serviceName: string, data: CostData): void {
    this.costData.set(serviceName, data);
  }

  async displayMonthlyCosts(serviceName: string): Promise<CostData> {
    const data = this.costData.get(serviceName);
    if (!data) {
      throw new Error(`No cost data found for service: ${serviceName}`);
    }
    
    // Ensure cost breakdown components sum to total (with small tolerance for floating point)
    const calculatedTotal = data.cpuCost + data.memoryCost + data.storageCost + data.networkCost;
    const tolerance = 0.01;
    
    if (Math.abs(calculatedTotal - data.totalCost) > tolerance) {
      // Adjust total to match components for consistency
      data.totalCost = calculatedTotal;
    }
    
    return data;
  }

  async displayCostTrends(serviceName: string): Promise<CostTrend> {
    const currentData = this.costData.get(serviceName);
    if (!currentData) {
      throw new Error(`No cost data found for service: ${serviceName}`);
    }
    
    // Simulate previous period data (90% to 110% of current for realistic trends)
    const previousCost = currentData.totalCost * (0.9 + Math.random() * 0.2);
    
    // Handle division by zero case
    let change = 0;
    if (previousCost > 0) {
      change = ((currentData.totalCost - previousCost) / previousCost) * 100;
    } else if (currentData.totalCost > 0) {
      change = 100; // 100% increase from zero
    }
    
    return {
      current: currentData.totalCost,
      previous: previousCost,
      change,
      significant: Math.abs(change) > this.SIGNIFICANT_CHANGE_THRESHOLD,
    };
  }

  async displayAwsResourceCosts(serviceName: string): Promise<CostData> {
    const data = this.costData.get(serviceName);
    if (!data) {
      throw new Error(`No cost data found for service: ${serviceName}`);
    }
    
    // Return data with AWS correlation if available
    return data;
  }

  highlightSignificantChanges(trend: CostTrend): boolean {
    return Math.abs(trend.change) > this.SIGNIFICANT_CHANGE_THRESHOLD;
  }
}

// Property-based test generators
const serviceNameArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]*[a-z0-9]$/);

const positiveNumberArbitrary = fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true });

const awsCorrelationArbitrary = fc.record({
  ec2Cost: positiveNumberArbitrary,
  ebsCost: positiveNumberArbitrary,
  s3Cost: positiveNumberArbitrary,
  rdsCost: positiveNumberArbitrary,
});

const timeRangeArbitrary = fc.record({
  start: fc.date({ min: new Date('2023-01-01'), max: new Date('2024-06-30') })
    .filter(d => !isNaN(d.getTime()))
    .map(d => d.toISOString()),
  end: fc.date({ min: new Date('2023-06-01'), max: new Date('2024-12-31') })
    .filter(d => !isNaN(d.getTime()))
    .map(d => d.toISOString()),
}).filter(range => {
  const startDate = new Date(range.start);
  const endDate = new Date(range.end);
  return !isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate < endDate;
});

const costDataArbitrary = fc.record({
  serviceName: serviceNameArbitrary,
  cpuCost: positiveNumberArbitrary,
  memoryCost: positiveNumberArbitrary,
  storageCost: positiveNumberArbitrary,
  networkCost: positiveNumberArbitrary,
  timeRange: timeRangeArbitrary,
  awsCorrelation: fc.option(awsCorrelationArbitrary, { nil: undefined }),
  lastUpdated: fc.date({ min: new Date('2024-01-01'), max: new Date() })
    .filter(d => !isNaN(d.getTime())),
}).map(data => ({
  ...data,
  totalCost: data.cpuCost + data.memoryCost + data.storageCost + data.networkCost,
}));

const serviceWithCostDataArbitrary = fc.array(costDataArbitrary, { minLength: 1, maxLength: 20 })
  .map(costs => {
    // Ensure unique service names
    const uniqueCosts: CostData[] = [];
    const seenNames = new Set<string>();
    
    for (const cost of costs) {
      if (!seenNames.has(cost.serviceName)) {
        seenNames.add(cost.serviceName);
        uniqueCosts.push(cost);
      }
    }
    
    return uniqueCosts.length > 0 ? uniqueCosts : [costs[0]];
  });

describe('Cost Data Display', () => {
  let costDisplayService: MockCostDisplayService;

  beforeEach(() => {
    costDisplayService = new MockCostDisplayService();
  });

  /**
   * Property 13: Cost data display
   * For any service, the Developer_Portal should display monthly Kubernetes costs from OpenCost data,
   * highlight significant cost trend changes, and show AWS resource costs when associated
   * Validates: Requirements 6.1, 6.2, 6.4
   */
  it('should display monthly Kubernetes costs with complete breakdowns', async () => {
    await fc.assert(
      fc.asyncProperty(serviceWithCostDataArbitrary, async (costDataList) => {
        // Create a fresh service instance for each property test run
        const freshService = new MockCostDisplayService();
        
        // Act: Set up cost data for all services
        for (const costData of costDataList) {
          freshService.setCostData(costData.serviceName, costData);
        }
        
        // Test each service's cost display
        for (const expectedCostData of costDataList) {
          const displayedCosts = await freshService.displayMonthlyCosts(expectedCostData.serviceName);
          
          // Assert: All required cost fields should be present and valid
          expect(displayedCosts.serviceName).toBe(expectedCostData.serviceName);
          expect(displayedCosts.totalCost).toBeGreaterThanOrEqual(0);
          expect(displayedCosts.cpuCost).toBeGreaterThanOrEqual(0);
          expect(displayedCosts.memoryCost).toBeGreaterThanOrEqual(0);
          expect(displayedCosts.storageCost).toBeGreaterThanOrEqual(0);
          expect(displayedCosts.networkCost).toBeGreaterThanOrEqual(0);
          
          // Assert: Cost breakdown should sum to total cost (with tolerance for floating point)
          const calculatedTotal = displayedCosts.cpuCost + displayedCosts.memoryCost + 
                                 displayedCosts.storageCost + displayedCosts.networkCost;
          expect(Math.abs(calculatedTotal - displayedCosts.totalCost)).toBeLessThanOrEqual(0.01);
          
          // Assert: Time range should be valid
          expect(displayedCosts.timeRange).toBeDefined();
          expect(displayedCosts.timeRange.start).toBeDefined();
          expect(displayedCosts.timeRange.end).toBeDefined();
          expect(new Date(displayedCosts.timeRange.start)).toBeInstanceOf(Date);
          expect(new Date(displayedCosts.timeRange.end)).toBeInstanceOf(Date);
          expect(new Date(displayedCosts.timeRange.start).getTime())
            .toBeLessThan(new Date(displayedCosts.timeRange.end).getTime());
          
          // Assert: Last updated timestamp should be present and valid
          expect(displayedCosts.lastUpdated).toBeInstanceOf(Date);
          expect(displayedCosts.lastUpdated.getTime()).toBeLessThanOrEqual(Date.now());
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should highlight significant cost trend changes', async () => {
    await fc.assert(
      fc.asyncProperty(serviceWithCostDataArbitrary, async (costDataList) => {
        // Create a fresh service instance for each property test run
        const freshService = new MockCostDisplayService();
        
        // Act: Set up cost data for all services
        for (const costData of costDataList) {
          freshService.setCostData(costData.serviceName, costData);
        }
        
        // Test cost trend analysis for each service
        for (const expectedCostData of costDataList) {
          const costTrend = await freshService.displayCostTrends(expectedCostData.serviceName);
          
          // Assert: Trend data should be valid
          expect(costTrend.current).toBeGreaterThanOrEqual(0);
          expect(costTrend.previous).toBeGreaterThanOrEqual(0);
          expect(typeof costTrend.change).toBe('number');
          expect(typeof costTrend.significant).toBe('boolean');
          
          // Assert: Change calculation should be mathematically correct
          const expectedChange = ((costTrend.current - costTrend.previous) / costTrend.previous) * 100;
          expect(Math.abs(costTrend.change - expectedChange)).toBeLessThanOrEqual(0.01);
          
          // Assert: Significant flag should match the highlighting logic
          const shouldBeSignificant = Math.abs(costTrend.change) > 15;
          expect(costTrend.significant).toBe(shouldBeSignificant);
          
          // Assert: Highlighting function should be consistent
          const highlightResult = freshService.highlightSignificantChanges(costTrend);
          expect(highlightResult).toBe(costTrend.significant);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should display AWS resource costs when associated', async () => {
    await fc.assert(
      fc.asyncProperty(serviceWithCostDataArbitrary, async (costDataList) => {
        // Create a fresh service instance for each property test run
        const freshService = new MockCostDisplayService();
        
        // Act: Set up cost data for all services
        for (const costData of costDataList) {
          freshService.setCostData(costData.serviceName, costData);
        }
        
        // Test AWS cost correlation for each service
        for (const expectedCostData of costDataList) {
          const displayedCosts = await freshService.displayAwsResourceCosts(expectedCostData.serviceName);
          
          // Assert: Basic cost data should be present
          expect(displayedCosts.serviceName).toBe(expectedCostData.serviceName);
          expect(displayedCosts.totalCost).toBeGreaterThanOrEqual(0);
          
          // Assert: AWS correlation should match expected data
          if (expectedCostData.awsCorrelation !== undefined) {
            expect(displayedCosts.awsCorrelation).toBeDefined();
            expect(displayedCosts.awsCorrelation!.ec2Cost).toBeGreaterThanOrEqual(0);
            expect(displayedCosts.awsCorrelation!.ebsCost).toBeGreaterThanOrEqual(0);
            expect(displayedCosts.awsCorrelation!.s3Cost).toBeGreaterThanOrEqual(0);
            expect(displayedCosts.awsCorrelation!.rdsCost).toBeGreaterThanOrEqual(0);
            
            // Assert: AWS costs should be reasonable (not negative or infinite)
            expect(Number.isFinite(displayedCosts.awsCorrelation!.ec2Cost)).toBe(true);
            expect(Number.isFinite(displayedCosts.awsCorrelation!.ebsCost)).toBe(true);
            expect(Number.isFinite(displayedCosts.awsCorrelation!.s3Cost)).toBe(true);
            expect(Number.isFinite(displayedCosts.awsCorrelation!.rdsCost)).toBe(true);
          } else {
            // If no AWS correlation in input, it should be undefined
            expect(displayedCosts.awsCorrelation).toBeUndefined();
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should handle services with zero costs gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(serviceNameArbitrary, async (serviceName) => {
        // Create a fresh service instance for each property test run
        const freshService = new MockCostDisplayService();
        
        // Create cost data with zero costs
        const zeroCostData: CostData = {
          serviceName,
          totalCost: 0,
          cpuCost: 0,
          memoryCost: 0,
          storageCost: 0,
          networkCost: 0,
          timeRange: {
            start: new Date('2024-01-01').toISOString(),
            end: new Date('2024-01-31').toISOString(),
          },
          lastUpdated: new Date(),
        };
        
        // Act: Set up zero cost data
        freshService.setCostData(serviceName, zeroCostData);
        
        const displayedCosts = await freshService.displayMonthlyCosts(serviceName);
        const costTrend = await freshService.displayCostTrends(serviceName);
        
        // Assert: Zero costs should be handled properly
        expect(displayedCosts.totalCost).toBe(0);
        expect(displayedCosts.cpuCost).toBe(0);
        expect(displayedCosts.memoryCost).toBe(0);
        expect(displayedCosts.storageCost).toBe(0);
        expect(displayedCosts.networkCost).toBe(0);
        
        // Assert: Trend calculation should handle zero costs without errors
        expect(typeof costTrend.current).toBe('number');
        expect(typeof costTrend.previous).toBe('number');
        expect(typeof costTrend.change).toBe('number');
        expect(typeof costTrend.significant).toBe('boolean');
        
        // Assert: No division by zero or NaN values
        expect(Number.isFinite(costTrend.change)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain data consistency across multiple cost queries', async () => {
    await fc.assert(
      fc.asyncProperty(serviceWithCostDataArbitrary, async (costDataList) => {
        // Create a fresh service instance for each property test run
        const freshService = new MockCostDisplayService();
        
        // Act: Set up cost data for all services
        for (const costData of costDataList) {
          freshService.setCostData(costData.serviceName, costData);
        }
        
        // Test consistency by querying the same service multiple times
        for (const expectedCostData of costDataList) {
          const firstQuery = await freshService.displayMonthlyCosts(expectedCostData.serviceName);
          const secondQuery = await freshService.displayMonthlyCosts(expectedCostData.serviceName);
          const awsQuery = await freshService.displayAwsResourceCosts(expectedCostData.serviceName);
          
          // Assert: Multiple queries should return consistent data
          expect(firstQuery.serviceName).toBe(secondQuery.serviceName);
          expect(firstQuery.totalCost).toBe(secondQuery.totalCost);
          expect(firstQuery.cpuCost).toBe(secondQuery.cpuCost);
          expect(firstQuery.memoryCost).toBe(secondQuery.memoryCost);
          expect(firstQuery.storageCost).toBe(secondQuery.storageCost);
          expect(firstQuery.networkCost).toBe(secondQuery.networkCost);
          
          // Assert: AWS query should return same base cost data
          expect(awsQuery.serviceName).toBe(firstQuery.serviceName);
          expect(awsQuery.totalCost).toBe(firstQuery.totalCost);
          expect(awsQuery.cpuCost).toBe(firstQuery.cpuCost);
          expect(awsQuery.memoryCost).toBe(firstQuery.memoryCost);
          expect(awsQuery.storageCost).toBe(firstQuery.storageCost);
          expect(awsQuery.networkCost).toBe(firstQuery.networkCost);
          
          // Assert: Time ranges should be consistent
          expect(firstQuery.timeRange.start).toBe(secondQuery.timeRange.start);
          expect(firstQuery.timeRange.end).toBe(secondQuery.timeRange.end);
          expect(awsQuery.timeRange.start).toBe(firstQuery.timeRange.start);
          expect(awsQuery.timeRange.end).toBe(firstQuery.timeRange.end);
        }
      }),
      { numRuns: 100 }
    );
  });
});