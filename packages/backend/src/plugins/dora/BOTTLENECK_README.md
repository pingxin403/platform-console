# Bottleneck Identification and Quantification

## Overview

The bottleneck identification system analyzes workflow timing data to identify friction points in the development lifecycle, quantify their impact, and generate actionable recommendations.

## Features

- **Workflow Time Analysis**: Track duration of key workflow stages (code review, CI build, deployment, incident response, etc.)
- **Friction Area Detection**: Identify stages that consistently take longer than expected
- **Impact Quantification**: Calculate affected users, average delay, total time wasted, and frequency
- **Trend Analysis**: Detect whether bottlenecks are worsening, stable, or improving over time
- **Actionable Recommendations**: Generate prioritized recommendations with estimated impact and effort

## Workflow Stages

The system tracks the following workflow stages:

- **code_review**: Pull request review process
- **ci_build**: Continuous integration build and test execution
- **deployment**: Deployment to production or staging environments
- **incident_response**: Time to detect, acknowledge, and resolve incidents
- **service_creation**: Time to create new services using scaffolder templates
- **documentation**: Time to create or update documentation
- **approval**: Time for approval processes (budget, security, etc.)

## Configuration

```typescript
const bottleneckConfig: BottleneckAnalysisConfig = {
  enabled: true,
  
  thresholds: {
    // Minimum duration to consider as a bottleneck (in minutes)
    minDuration: {
      code_review: 240,        // 4 hours
      ci_build: 30,            // 30 minutes
      deployment: 60,          // 1 hour
      incident_response: 60,   // 1 hour
      service_creation: 360,   // 6 hours
      documentation: 120,      // 2 hours
      approval: 480,           // 8 hours
    },
    
    // Minimum occurrences to consider as a pattern
    minOccurrences: 5,
    
    // Minimum affected users to consider as significant
    minAffectedUsers: 2,
  },
  
  analysis: {
    // Look back period (in days)
    lookbackDays: 30,
    
    // Minimum data points required for analysis
    minDataPoints: 10,
    
    // Percentile for outlier detection
    outlierPercentile: 95,
  },
};
```

## API Endpoints

### Track Workflow Timing

Track the duration of a workflow stage.

**POST** `/api/dora/bottleneck/timing`

```json
{
  "stage": "code_review",
  "startTime": "2024-01-15T10:00:00Z",
  "endTime": "2024-01-15T15:30:00Z",
  "duration": 330,
  "userId": "user123",
  "entityId": "pr-456",
  "entityType": "pull_request",
  "metadata": {
    "repository": "my-service",
    "prNumber": 456
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Workflow timing tracked successfully"
}
```

### Analyze Bottlenecks

Analyze workflow data to identify bottlenecks.

**GET** `/api/dora/bottleneck/analyze?startDate=2024-01-01&endDate=2024-01-31`

**Response:**

```json
{
  "success": true,
  "bottlenecks": [
    {
      "id": "bottleneck-code_review-1705320000000-0",
      "area": "Code Review",
      "stage": "code_review",
      "description": "Code Review is taking significantly longer than expected...",
      "severity": "high",
      "impact": {
        "affectedUsers": 8,
        "affectedEntities": 45,
        "averageDelay": 360,
        "totalTimeWasted": 270,
        "frequency": 15.5
      },
      "contributingFactors": [
        "High variability in duration suggests inconsistent process or resource availability",
        "Code reviews taking more than a day may indicate lack of reviewers or complex changes"
      ],
      "recommendations": [
        {
          "action": "Implement automated code review tools (linters, static analysis) to reduce manual review time",
          "priority": "high",
          "estimatedImpact": "Reduce review time by 30-40%",
          "estimatedEffort": "1-2 weeks"
        },
        {
          "action": "Set and enforce SLAs for code reviews (e.g., 4 hours for small PRs, 1 day for large PRs)",
          "priority": "medium",
          "estimatedImpact": "Reduce average review time by 20-30%",
          "estimatedEffort": "1 week"
        }
      ],
      "detectedAt": "2024-01-31T10:00:00Z",
      "period": {
        "start": "2024-01-01T00:00:00Z",
        "end": "2024-01-31T23:59:59Z"
      }
    }
  ],
  "frictionAreas": [
    {
      "stage": "code_review",
      "averageDuration": 360,
      "medianDuration": 300,
      "p95Duration": 600,
      "occurrences": 45,
      "affectedEntities": ["pr-123", "pr-456", ...],
      "trend": "worsening"
    }
  ],
  "summary": {
    "totalBottlenecks": 3,
    "criticalBottlenecks": 1,
    "totalTimeWasted": 450,
    "affectedUsers": 12,
    "mostProblematicStage": "code_review"
  }
}
```

### Get Workflow Timing Summary

Get summary statistics of tracked workflow timings.

**GET** `/api/dora/bottleneck/timing/summary`

**Response:**

```json
{
  "total": 150,
  "uniqueStages": 5,
  "uniqueUsers": 12,
  "uniqueEntities": 145,
  "durationByStage": {
    "code_review": {
      "count": 45,
      "total": 16200,
      "average": 360
    },
    "ci_build": {
      "count": 60,
      "total": 1800,
      "average": 30
    },
    "deployment": {
      "count": 45,
      "total": 3600,
      "average": 80
    }
  },
  "oldest": "2024-01-01T10:00:00Z",
  "newest": "2024-01-31T18:30:00Z"
}
```

## Usage Example

### 1. Track Workflow Timings

Integrate workflow timing tracking into your development processes:

```typescript
// Track code review duration
const prCreatedAt = new Date('2024-01-15T10:00:00Z');
const prMergedAt = new Date('2024-01-15T15:30:00Z');
const duration = (prMergedAt.getTime() - prCreatedAt.getTime()) / (1000 * 60); // minutes

await fetch('/api/dora/bottleneck/timing', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    stage: 'code_review',
    startTime: prCreatedAt.toISOString(),
    endTime: prMergedAt.toISOString(),
    duration,
    userId: 'user123',
    entityId: `pr-${prNumber}`,
    entityType: 'pull_request',
    metadata: {
      repository: 'my-service',
      prNumber,
    },
  }),
});

// Track CI build duration
await fetch('/api/dora/bottleneck/timing', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    stage: 'ci_build',
    startTime: buildStartTime.toISOString(),
    endTime: buildEndTime.toISOString(),
    duration: buildDurationMinutes,
    entityId: `build-${buildId}`,
    entityType: 'ci_build',
  }),
});

// Track deployment duration
await fetch('/api/dora/bottleneck/timing', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    stage: 'deployment',
    startTime: deploymentStartTime.toISOString(),
    endTime: deploymentEndTime.toISOString(),
    duration: deploymentDurationMinutes,
    userId: deployedBy,
    entityId: `deploy-${deploymentId}`,
    entityType: 'deployment',
  }),
});
```

### 2. Analyze Bottlenecks

Periodically analyze workflow data to identify bottlenecks:

```typescript
// Analyze last 30 days
const endDate = new Date();
const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

const response = await fetch(
  `/api/dora/bottleneck/analyze?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
);

const result = await response.json();

if (result.success) {
  console.log(`Found ${result.summary.totalBottlenecks} bottlenecks`);
  console.log(`Most problematic stage: ${result.summary.mostProblematicStage}`);
  console.log(`Total time wasted: ${result.summary.totalTimeWasted} hours`);
  
  // Display bottlenecks
  result.bottlenecks.forEach(bottleneck => {
    console.log(`\n${bottleneck.area} (${bottleneck.severity})`);
    console.log(`  Impact: ${bottleneck.impact.affectedUsers} users, ${bottleneck.impact.averageDelay} min delay`);
    console.log(`  Recommendations:`);
    bottleneck.recommendations.forEach(rec => {
      console.log(`    - ${rec.action} (${rec.priority})`);
      console.log(`      Impact: ${rec.estimatedImpact}, Effort: ${rec.estimatedEffort}`);
    });
  });
}
```

## Severity Levels

Bottlenecks are classified into four severity levels:

- **Critical**: p95 duration > 3x threshold AND (affects > 10 users OR wastes > 100 hours)
- **High**: p95 duration > 2x threshold AND affects > 5 users
- **Medium**: p95 duration > 1.5x threshold OR affects > 3 users
- **Low**: Below medium thresholds but still exceeds baseline

## Recommendations

The system generates stage-specific recommendations:

### Code Review
- Automate code review checks (linters, static analysis)
- Implement review SLAs
- Train more reviewers

### CI Build
- Optimize CI pipeline (parallelize tests, cache dependencies)
- Increase CI resources
- Implement test selection

### Deployment
- Automate deployment process
- Optimize rollout strategy (blue-green, canary)
- Add deployment monitoring

### Incident Response
- Create runbooks
- Improve monitoring and alerting
- Incident response training

### Service Creation
- Improve scaffolder templates
- Improve onboarding documentation

### Documentation
- Automate documentation generation
- Provide documentation templates

### Approval
- Implement approval SLAs
- Automate low-risk approvals

## Integration with DORA Metrics

Bottleneck identification complements DORA metrics by:

1. **Explaining DORA Metric Trends**: When lead time increases, bottleneck analysis identifies which stage is causing the delay
2. **Prioritizing Improvements**: Quantified impact helps prioritize which bottlenecks to address first
3. **Measuring Improvement**: Track bottleneck trends over time to validate improvement initiatives

## Best Practices

1. **Consistent Tracking**: Track all workflow stages consistently to get accurate analysis
2. **Regular Analysis**: Run bottleneck analysis weekly or monthly to catch trends early
3. **Act on Recommendations**: Prioritize and implement recommendations based on severity and impact
4. **Monitor Trends**: Track whether bottlenecks are improving after implementing recommendations
5. **Adjust Thresholds**: Tune thresholds based on your team's performance goals

## Limitations

- **Data Quality**: Analysis quality depends on consistent and accurate workflow timing data
- **Minimum Data**: Requires at least 10 data points per stage for meaningful analysis
- **Threshold Sensitivity**: Results depend on configured thresholds; adjust based on your context
- **Root Cause**: System identifies symptoms; root cause analysis may require manual investigation

## Future Enhancements

- Machine learning-based anomaly detection
- Predictive bottleneck identification
- Automated remediation suggestions
- Integration with incident management systems
- Real-time bottleneck alerts
