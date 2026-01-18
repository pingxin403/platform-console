/**
 * Property-based test for cost benchmarking and freshness
 * Feature: internal-developer-platform, Property 14: Cost benchmarking and freshness
 * Validates: Requirements 6.3, 6.5
 */

import * as fc from 'fast-check';

// Cost benchmarking and freshness interfaces to test
interface ServiceBenchmark {
  serviceName: string;
  category: string;
  costPerCpu: number;
  costPerMemory: number;
  efficiency: number;
  percentile: number;
}

interface CostDataFreshness {
  serviceName: string;
  lastUpdated: Date;
  dataAge: number; // in hours
  isFresh: boolean;
  breakdown: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
  };
}

interface CostBenchmarkingService {
  benchmarkSimilarServices(serviceName: string): Promise<ServiceBenchmark[]>;
  getCostDataFreshness(serviceName: string): Promise<CostDataFreshness>;
  updateCostData(serviceName: string): Promise<void>;
  isDailyUpdateComplete(): Promise<boolean>;
}

// Mock implementation of cost benchmarking service for testing
class MockCostBenchmarkingService implements CostBenchmarkingService {
  private benchmarkData: Map<string, ServiceBenchmark[]> = new Map();
  private freshnessData: Map<string, CostDataFreshness> = new Map();
  private lastDailyUpdate: Date = new Date();

  setBenchmarkData(serviceName: string, benchmarks: ServiceBenchmark[]): void {
    this.benchmarkData.set(serviceName, benchmarks);
  }

  setFreshnessData(serviceName: string, freshness: CostDataFreshness): void {
    this.freshnessData.set(serviceName, freshness);
  }

  async benchmarkSimilarServices(
    serviceName: string,
  ): Promise<ServiceBenchmark[]> {
    const benchmarks = this.benchmarkData.get(serviceName) || [];

    // Sort by efficiency and calculate percentiles
    const sortedBenchmarks = [...benchmarks].sort(
      (a, b) => a.efficiency - b.efficiency,
    );

    return sortedBenchmarks.map((benchmark, index) => ({
      ...benchmark,
      percentile: (index / (sortedBenchmarks.length - 1)) * 100,
    }));
  }

  async getCostDataFreshness(serviceName: string): Promise<CostDataFreshness> {
    const freshness = this.freshnessData.get(serviceName);
    if (!freshness) {
      throw new Error(`No freshness data found for service: ${serviceName}`);
    }

    // Validate that lastUpdated is a valid date
    if (isNaN(freshness.lastUpdated.getTime())) {
      throw new Error(`Invalid lastUpdated date for service: ${serviceName}`);
    }

    // Calculate data age in hours
    const now = new Date();
    const ageInHours =
      (now.getTime() - freshness.lastUpdated.getTime()) / (1000 * 60 * 60);

    // Data is fresh if updated within 24 hours
    const isFresh = ageInHours <= 24;

    return {
      ...freshness,
      dataAge: Math.max(0, ageInHours), // Ensure non-negative age
      isFresh,
    };
  }

  async updateCostData(serviceName: string): Promise<void> {
    const existingFreshness = this.freshnessData.get(serviceName);
    if (existingFreshness) {
      const now = new Date();
      existingFreshness.lastUpdated = now;
      existingFreshness.dataAge = 0;
      existingFreshness.isFresh = true;
    }
  }

  async isDailyUpdateComplete(): Promise<boolean> {
    const now = new Date();
    const timeSinceLastUpdate = now.getTime() - this.lastDailyUpdate.getTime();
    const hoursSinceUpdate = timeSinceLastUpdate / (1000 * 60 * 60);

    // Daily update is complete if it happened within the last 24 hours
    return hoursSinceUpdate <= 24;
  }

  setLastDailyUpdate(date: Date): void {
    this.lastDailyUpdate = date;
  }
}

// Property-based test generators
const serviceNameArbitrary = fc.stringMatching(/^[a-z][a-z0-9-]*[a-z0-9]$/);

const serviceCategoryArbitrary = fc.constantFrom(
  'microservice',
  'api',
  'frontend',
  'database',
  'worker',
  'cache',
  'queue',
);

const positiveNumberArbitrary = fc.float({
  min: Math.fround(0.01),
  max: Math.fround(1000),
  noNaN: true,
});

const benchmarkArbitrary = fc.record({
  serviceName: serviceNameArbitrary,
  category: serviceCategoryArbitrary,
  costPerCpu: positiveNumberArbitrary,
  costPerMemory: positiveNumberArbitrary,
  efficiency: positiveNumberArbitrary,
  percentile: fc.float({ min: 0, max: 100, noNaN: true }),
});

const costBreakdownArbitrary = fc.record({
  cpu: positiveNumberArbitrary,
  memory: positiveNumberArbitrary,
  storage: positiveNumberArbitrary,
  network: positiveNumberArbitrary,
});

const freshnessDataArbitrary = fc.record({
  serviceName: serviceNameArbitrary,
  lastUpdated: fc
    .date({ min: new Date('2024-01-01'), max: new Date() })
    .filter(d => !isNaN(d.getTime())),
  dataAge: fc.float({ min: 0, max: 168, noNaN: true }), // 0 to 168 hours (1 week)
  isFresh: fc.boolean(),
  breakdown: costBreakdownArbitrary,
});

const benchmarkListArbitrary = fc
  .array(benchmarkArbitrary, { minLength: 2, maxLength: 10 })
  .map(benchmarks => {
    // Ensure unique service names within the same benchmark set
    const uniqueBenchmarks: ServiceBenchmark[] = [];
    const seenNames = new Set<string>();

    for (const benchmark of benchmarks) {
      if (!seenNames.has(benchmark.serviceName)) {
        seenNames.add(benchmark.serviceName);
        uniqueBenchmarks.push(benchmark);
      }
    }

    return uniqueBenchmarks.length >= 2
      ? uniqueBenchmarks
      : [benchmarks[0], benchmarks[1]];
  });

describe('Cost Benchmarking and Freshness', () => {
  let costBenchmarkingService: MockCostBenchmarkingService;

  beforeEach(() => {
    costBenchmarkingService = new MockCostBenchmarkingService();
  });

  /**
   * Property 14: Cost benchmarking and freshness
   * For any service comparison, the Developer_Portal should provide cost benchmarking across similar service types,
   * and cost data should be updated daily with complete breakdowns (CPU, memory, storage)
   * Validates: Requirements 6.3, 6.5
   */
  it('should provide cost benchmarking across similar service types', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceNameArbitrary,
        benchmarkListArbitrary,
        async (targetService, benchmarks) => {
          // Create a fresh service instance for each property test run
          const freshService = new MockCostBenchmarkingService();

          // Ensure the target service is included in benchmarks
          const targetBenchmark = benchmarks[0];
          targetBenchmark.serviceName = targetService;

          // Act: Set up benchmark data
          freshService.setBenchmarkData(targetService, benchmarks);

          const benchmarkResults = await freshService.benchmarkSimilarServices(
            targetService,
          );

          // Assert: All benchmark results should be present
          expect(benchmarkResults.length).toBe(benchmarks.length);

          // Assert: Target service should be included in results
          const targetResult = benchmarkResults.find(
            b => b.serviceName === targetService,
          );
          expect(targetResult).toBeDefined();

          // Assert: All benchmarks should have valid percentile values
          for (const benchmark of benchmarkResults) {
            expect(benchmark.percentile).toBeGreaterThanOrEqual(0);
            expect(benchmark.percentile).toBeLessThanOrEqual(100);
            expect(Number.isFinite(benchmark.percentile)).toBe(true);

            // Assert: Cost metrics should be positive
            expect(benchmark.costPerCpu).toBeGreaterThan(0);
            expect(benchmark.costPerMemory).toBeGreaterThan(0);
            expect(benchmark.efficiency).toBeGreaterThan(0);

            // Assert: Service should have a valid category
            expect(benchmark.category).toBeDefined();
            expect(typeof benchmark.category).toBe('string');
            expect(benchmark.category.length).toBeGreaterThan(0);
          }

          // Assert: Percentiles should be properly distributed
          const percentiles = benchmarkResults
            .map(b => b.percentile)
            .sort((a, b) => a - b);
          expect(percentiles[0]).toBe(0); // Lowest percentile should be 0
          expect(percentiles[percentiles.length - 1]).toBe(100); // Highest percentile should be 100

          // Assert: Benchmarks should be sorted by efficiency (ascending)
          const efficiencies = benchmarkResults.map(b => b.efficiency);
          for (let i = 1; i < efficiencies.length; i++) {
            expect(efficiencies[i]).toBeGreaterThanOrEqual(efficiencies[i - 1]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should ensure cost data is updated daily with complete breakdowns', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(freshnessDataArbitrary, { minLength: 1, maxLength: 10 }),
        async freshnessDataList => {
          // Create a fresh service instance for each property test run
          const freshService = new MockCostBenchmarkingService();

          // Act: Set up freshness data for all services
          for (const freshnessData of freshnessDataList) {
            freshService.setFreshnessData(
              freshnessData.serviceName,
              freshnessData,
            );
          }

          // Test freshness for each service
          for (const expectedFreshness of freshnessDataList) {
            const actualFreshness = await freshService.getCostDataFreshness(
              expectedFreshness.serviceName,
            );

            // Assert: Freshness data should be complete
            expect(actualFreshness.serviceName).toBe(
              expectedFreshness.serviceName,
            );
            expect(actualFreshness.lastUpdated).toBeInstanceOf(Date);
            expect(actualFreshness.dataAge).toBeGreaterThanOrEqual(0);
            expect(typeof actualFreshness.isFresh).toBe('boolean');

            // Assert: Complete cost breakdown should be present
            expect(actualFreshness.breakdown).toBeDefined();
            expect(actualFreshness.breakdown.cpu).toBeGreaterThan(0);
            expect(actualFreshness.breakdown.memory).toBeGreaterThan(0);
            expect(actualFreshness.breakdown.storage).toBeGreaterThan(0);
            expect(actualFreshness.breakdown.network).toBeGreaterThan(0);

            // Assert: Data age calculation should be accurate
            const now = new Date();
            const expectedAge = Math.max(
              0,
              (now.getTime() - actualFreshness.lastUpdated.getTime()) /
                (1000 * 60 * 60),
            );
            expect(
              Math.abs(actualFreshness.dataAge - expectedAge),
            ).toBeLessThan(0.1); // Within 6 minutes tolerance

            // Assert: Freshness flag should be consistent with age
            const shouldBeFresh = actualFreshness.dataAge <= 24;
            expect(actualFreshness.isFresh).toBe(shouldBeFresh);

            // Assert: All breakdown components should be finite numbers
            expect(Number.isFinite(actualFreshness.breakdown.cpu)).toBe(true);
            expect(Number.isFinite(actualFreshness.breakdown.memory)).toBe(
              true,
            );
            expect(Number.isFinite(actualFreshness.breakdown.storage)).toBe(
              true,
            );
            expect(Number.isFinite(actualFreshness.breakdown.network)).toBe(
              true,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should handle daily update completion tracking', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .date({ min: new Date('2024-01-01'), max: new Date() })
          .filter(d => !isNaN(d.getTime())),
        async lastUpdateDate => {
          // Create a fresh service instance for each property test run
          const freshService = new MockCostBenchmarkingService();

          // Act: Set the last daily update time
          freshService.setLastDailyUpdate(lastUpdateDate);

          const isUpdateComplete = await freshService.isDailyUpdateComplete();

          // Assert: Update completion should be based on time since last update
          const now = new Date();
          const hoursSinceUpdate =
            (now.getTime() - lastUpdateDate.getTime()) / (1000 * 60 * 60);
          const expectedCompletion = hoursSinceUpdate <= 24;

          expect(typeof isUpdateComplete).toBe('boolean');
          expect(isUpdateComplete).toBe(expectedCompletion);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should update cost data and maintain freshness', async () => {
    await fc.assert(
      fc.asyncProperty(freshnessDataArbitrary, async initialFreshness => {
        // Create a fresh service instance for each property test run
        const freshService = new MockCostBenchmarkingService();

        // Create stale data (older than 24 hours)
        const staleData = {
          ...initialFreshness,
          lastUpdated: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          isFresh: false,
        };

        // Act: Set up stale data and then update it
        freshService.setFreshnessData(staleData.serviceName, staleData);

        // Verify data is initially stale
        const beforeUpdate = await freshService.getCostDataFreshness(
          staleData.serviceName,
        );
        expect(beforeUpdate.isFresh).toBe(false);
        expect(beforeUpdate.dataAge).toBeGreaterThan(24);

        // Update the cost data
        await freshService.updateCostData(staleData.serviceName);

        // Verify data is now fresh
        const afterUpdate = await freshService.getCostDataFreshness(
          staleData.serviceName,
        );
        expect(afterUpdate.isFresh).toBe(true);
        expect(afterUpdate.dataAge).toBeLessThanOrEqual(1); // Should be very recent

        // Assert: Last updated timestamp should be recent
        const now = new Date();
        const timeDiff = now.getTime() - afterUpdate.lastUpdated.getTime();
        expect(timeDiff).toBeLessThan(1000); // Within 1 second
      }),
      { numRuns: 100 },
    );
  });

  it('should maintain benchmark consistency across similar service categories', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceCategoryArbitrary,
        benchmarkListArbitrary,
        async (category, benchmarks) => {
          // Create a fresh service instance for each property test run
          const freshService = new MockCostBenchmarkingService();

          // Ensure all benchmarks are in the same category
          const sameCategoryBenchmarks = benchmarks.map(b => ({
            ...b,
            category,
          }));
          const targetService = sameCategoryBenchmarks[0].serviceName;

          // Act: Set up benchmark data
          freshService.setBenchmarkData(targetService, sameCategoryBenchmarks);

          const benchmarkResults = await freshService.benchmarkSimilarServices(
            targetService,
          );

          // Assert: All results should be in the same category
          for (const benchmark of benchmarkResults) {
            expect(benchmark.category).toBe(category);
          }

          // Assert: Efficiency-based ranking should be consistent
          const sortedByEfficiency = [...benchmarkResults].sort(
            (a, b) => a.efficiency - b.efficiency,
          );
          const sortedByPercentile = [...benchmarkResults].sort(
            (a, b) => a.percentile - b.percentile,
          );

          // Services with lower efficiency should have lower percentiles
          for (let i = 0; i < sortedByEfficiency.length; i++) {
            expect(sortedByEfficiency[i].serviceName).toBe(
              sortedByPercentile[i].serviceName,
            );
          }

          // Assert: No duplicate percentiles (unless there are ties in efficiency)
          const percentiles = benchmarkResults.map(b => b.percentile);
          const uniquePercentiles = new Set(percentiles);

          // If all efficiencies are different, all percentiles should be different
          const efficiencies = benchmarkResults.map(b => b.efficiency);
          const uniqueEfficiencies = new Set(efficiencies);

          if (uniqueEfficiencies.size === efficiencies.length) {
            expect(uniquePercentiles.size).toBe(percentiles.length);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
