# DORA Metrics Property-Based Tests

This document describes the property-based tests for the DORA Metrics and DevEx Analysis module.

## Overview

Property-based tests validate correctness properties across a wide range of inputs using the `fast-check` library. These tests complement unit tests by verifying universal properties that should hold for all valid inputs.

## Test Coverage

### Property 14: DORA Metrics Completeness (**Validates: Requirements 6.1**)

**Property**: For any team or service, the system SHALL track and display all four DORA metrics (deployment frequency, lead time for changes, change failure rate, time to restore service) with their respective performance levels.

**Tests**:
- Verifies all four DORA metrics are present in the response
- Validates metric structure (value, unit, level, rawData)
- Ensures performance levels are correctly assigned ('elite', 'high', 'medium', 'low')
- Tracks data completeness for all sources (deployments, pull requests, incidents)

**Test File**: `dora.property.test.ts` - Lines 271-395

### Property 15: Platform Adoption Tracking (**Validates: Requirements 6.2**)

**Property**: For any time range, the system SHALL display platform adoption metrics including daily active users, service creation rate, and feature usage patterns.

**Tests**:
- Validates daily/weekly/monthly active user metrics
- Verifies service creation rate calculation
- Ensures feature usage patterns are tracked correctly
- Validates engagement metrics (sessions per user, return rate, power users)

**Test File**: `dora.property.test.ts` - Lines 397-650

### Property 16: NPS Collection and Trend Analysis (**Validates: Requirements 6.3**)

**Property**: For any submitted NPS feedback, the system SHALL calculate the overall NPS score (-100 to 100), categorize respondents (promoters, passives, detractors), and display feedback trends over time.

**Tests**:
- Verifies NPS score is within valid range (-100 to 100)
- Validates respondent categorization (promoters: 9-10, passives: 7-8, detractors: 0-6)
- Ensures feedback trends are tracked over time
- Validates category breakdown and sentiment analysis

**Test File**: `dora.property.test.ts` - Lines 652-900

### Property 17: Bottleneck Identification (**Validates: Requirements 6.4**)

**Property**: For any identified workflow bottleneck, the system SHALL quantify its impact (affected users, average delay) and provide recommendations.

**Tests**:
- Validates impact quantification (affected users, entities, time wasted)
- Ensures recommendations are provided for each bottleneck
- Verifies severity level assignment
- Validates workflow stage identification
- Ensures analysis summary is complete

**Test File**: `dora.property.test.ts` - Lines 902-1150

## Additional Properties

### DORA Metrics Consistency

**Property**: For any service with the same data, multiple metric calculations should return consistent results (idempotency).

**Test File**: `dora.property.test.ts` - Lines 1152-1220

### NPS Score Calculation Correctness

**Property**: For any set of NPS feedback, the calculated NPS score should match the formula: (% promoters - % detractors).

**Test File**: `dora.property.test.ts` - Lines 1222-1280

## Test Configuration

- **Test Framework**: Jest with fast-check
- **Runs per Property**: 15-20 iterations
- **Test Data**: Generated using custom arbitraries for domain-specific types
- **Timeout**: Extended for property-based tests (15-30 seconds)

## Running the Tests

```bash
# Run all DORA property tests
npm test -- dora.property.test.ts --no-watch

# Run with verbose output
npm test -- dora.property.test.ts --no-watch --verbose

# Run specific test suite
npm test -- dora.property.test.ts --no-watch -t "Property 14"
```

## Known Issues and Notes

1. **Change Failure Rate**: Can exceed 100% when there are more incidents than deployments. This is expected behavior.

2. **MTTR Rounding**: Very small MTTR values (< 1 minute) may round to slightly negative values due to floating-point precision. Tests allow for -0.1 tolerance.

3. **Method Signatures**: Some tests require updating to match the actual implementation method signatures:
   - `trackActivity()` takes individual parameters, not an object
   - `submitFeedback()` takes individual parameters, not an object
   - `trackWorkflowTiming()` takes individual parameters, not an object

4. **Data Completeness**: Tests verify that the system tracks which data sources have data available, allowing for graceful degradation when some sources are unavailable.

## Future Improvements

1. Add property tests for team-level DORA metrics aggregation
2. Add tests for historical trend analysis
3. Add tests for anomaly detection in metrics
4. Add tests for metric comparison across teams/services
5. Implement shrinking strategies for better counterexample reporting

## References

- [fast-check Documentation](https://github.com/dubzzz/fast-check)
- [Property-Based Testing Guide](https://hypothesis.works/articles/what-is-property-based-testing/)
- [DORA Metrics Specification](https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance)
