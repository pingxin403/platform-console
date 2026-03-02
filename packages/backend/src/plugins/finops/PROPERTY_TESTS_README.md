# FinOps Property-Based Tests

This document describes the property-based tests implemented for the FinOps module using fast-check.

## Overview

Property-based tests validate correctness properties defined in the design document by testing the system with hundreds of randomly generated inputs. This approach provides much broader test coverage than example-based unit tests.

## Test File

- **Location**: `packages/backend/src/plugins/finops/finops.property.test.ts`
- **Framework**: fast-check (v4.5.3)
- **Test Count**: 17 property tests across 5 test suites

## Properties Tested

### Property 11: Cost Data Completeness

**Validates: Requirements 5.1, 5.2, 5.5**

Tests that for any service, the system displays complete cost data including:
- Kubernetes cost breakdown (CPU, memory, storage)
- AWS resource costs (RDS, S3, other)
- Cost trends with percentage changes
- Cost efficiency metrics (cost per request, cost per user)

**Tests**:
1. Complete Kubernetes cost breakdown for any deployment spec (20 runs)
2. Complete AWS cost breakdown for any deployment spec (20 runs)
3. Cost efficiency metrics for any service (20 runs, 15s timeout)
4. Total cost equals sum of all components (20 runs)

### Property 12: Pre-Deployment Cost Gate

**Validates: Requirements 5.3**

Tests that for any deployment request, if the estimated cost exceeds the service's remaining budget, the system blocks the deployment and requires approval.

**Tests**:
1. Block deployment when estimated cost exceeds remaining budget (20 runs)
2. Require approval when projected total exceeds budget (20 runs)
3. Provide approval URL when deployment is blocked (20 runs)
4. Allow deployment when no budget is configured (15 runs)

### Property 13: Cost Anomaly Detection and Alerting

**Validates: Requirements 5.4**

Tests that for any detected cost anomaly, the system provides actionable recommendations and proper tracking.

**Tests**:
1. Provide actionable recommendations for any detected anomaly (10 runs, 30s timeout)
2. Assign severity level to any detected anomaly (10 runs, 30s timeout)
3. Track notification status for any detected anomaly (10 runs, 30s timeout)
4. Calculate deviation for any detected anomaly (10 runs, 30s timeout)
5. Categorize anomalies by type (10 runs, 30s timeout)
6. Allow anomalies to be resolved (10 runs, 30s timeout)
7. Provide unique IDs for all anomalies (10 runs, 30s timeout)

### Additional Properties

**Cost Estimation Consistency**:
- Tests that multiple cost estimations for the same deployment spec return consistent results (idempotency) (20 runs)

**Budget Validation Monotonicity**:
- Tests that for any service with a fixed budget, as current cost increases, the remaining budget decreases monotonically (15 runs)

## Custom Arbitraries

The tests use custom arbitraries to generate domain-specific test data:

- **deploymentSpecArbitrary**: Generates valid deployment specifications with realistic CPU, memory, storage, replicas, and environment values
- **serviceIdArbitrary**: Generates valid service IDs matching the pattern `^[a-z][a-z0-9-]{2,30}$`
- **budgetArbitrary**: Generates budget configurations with monthly budget (100-10000) and alert threshold (50-95%)

## Running the Tests

```bash
# Run all property-based tests
npm test -- finops.property.test.ts --watchAll=false

# Run specific test suite
npm test -- finops.property.test.ts -t "Property 11"

# Run with verbose output
npm test -- finops.property.test.ts --watchAll=false --verbose
```

## Performance Considerations

- **Cost Efficiency Tests**: Take ~15 seconds due to multiple API calls (OpenCost, Datadog)
- **Anomaly Detection Tests**: Take ~30 seconds due to historical data fetching and multiple period comparisons
- **Total Test Time**: ~2 minutes for all 17 property tests

The tests use graceful degradation and mock data fallbacks when external APIs are unavailable, ensuring tests can run in CI/CD environments without external dependencies.

## Test Configuration

- **Number of Runs**: Optimized for CI/CD performance
  - Standard properties: 20 runs
  - Complex properties (efficiency, anomalies): 10-15 runs
- **Timeouts**: 
  - Standard tests: 5 seconds (Jest default)
  - Efficiency tests: 15 seconds
  - Anomaly detection tests: 30 seconds

## Coverage

These property-based tests complement the existing unit tests by:
1. Testing with a much wider range of inputs (hundreds of random values)
2. Validating universal properties that must hold for all inputs
3. Catching edge cases that might be missed by example-based tests
4. Ensuring consistency and correctness across the entire input space

## Maintenance

When modifying the FinOps module:
1. Ensure all property tests still pass
2. Update property tests if correctness properties change
3. Add new property tests for new requirements
4. Keep numRuns balanced between coverage and performance

## References

- Design Document: `.kiro/specs/internal-developer-platform/design.md`
- Requirements: `.kiro/specs/internal-developer-platform/requirements.md`
- fast-check Documentation: https://fast-check.dev/
