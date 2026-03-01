# Team Maturity Benchmarking and Trend Tracking

This document describes the team maturity benchmarking and trend tracking capabilities of the Service Maturity Scoring plugin.

## Overview

The benchmarking and trend tracking features enable:

1. **Cross-team maturity comparison** - Compare maturity scores across teams
2. **Team and service rankings** - Identify top performers and teams needing improvement
3. **Maturity trend tracking** - Track score changes over time
4. **Trend analysis** - Analyze velocity, projections, and significant changes
5. **Organization-wide statistics** - Get aggregate metrics across all teams

## Features

### 1. Team Benchmarking

Calculate and compare maturity scores across teams.

#### Calculate Team Benchmark

```bash
GET /api/maturity/benchmark/team/:teamId
```

**Request Body:**
```json
{
  "scorecards": [
    {
      "serviceId": "service-1",
      "overallScore": 85,
      "categories": { ... },
      "lastUpdated": "2024-01-15T10:00:00Z",
      "expiresAt": "2024-01-15T11:00:00Z",
      "version": 1
    }
  ]
}
```

**Response:**
```json
{
  "teamId": "team-1",
  "averageScore": 85.5,
  "serviceCount": 5,
  "distribution": {
    "0-20": 0,
    "20-40": 0,
    "40-60": 1,
    "60-80": 2,
    "80-100": 2
  },
  "topServices": [
    { "serviceId": "service-1", "score": 95 },
    { "serviceId": "service-2", "score": 90 }
  ],
  "bottomServices": [
    { "serviceId": "service-5", "score": 65 }
  ]
}
```

#### Calculate All Team Benchmarks

```bash
POST /api/maturity/benchmark/teams
```

**Request Body:**
```json
{
  "serviceScores": [
    {
      "serviceId": "service-1",
      "serviceName": "API Gateway",
      "score": 85,
      "team": "team-1"
    },
    {
      "serviceId": "service-2",
      "serviceName": "Auth Service",
      "score": 90,
      "team": "team-1"
    }
  ]
}
```

**Response:**
```json
{
  "benchmarks": {
    "team-1": {
      "teamId": "team-1",
      "averageScore": 87.5,
      "serviceCount": 2,
      "distribution": { ... },
      "topServices": [ ... ],
      "bottomServices": [ ... ]
    }
  },
  "totalTeams": 1
}
```

### 2. Team Rankings

Generate rankings of teams based on maturity scores.

#### Generate Team Rankings

```bash
POST /api/maturity/benchmark/rankings/teams
```

**Request Body:**
```json
{
  "serviceScores": [ ... ],
  "previousRankings": {
    "team-1": 2,
    "team-2": 1
  }
}
```

**Response:**
```json
{
  "rankings": [
    {
      "rank": 1,
      "teamId": "team-2",
      "averageScore": 92.5,
      "serviceCount": 3,
      "change": 0
    },
    {
      "rank": 2,
      "teamId": "team-1",
      "averageScore": 87.5,
      "serviceCount": 2,
      "change": 0
    }
  ],
  "totalTeams": 2
}
```

The `change` field shows rank improvement (+) or decline (-) from previous period.

### 3. Service Rankings

Generate rankings of services across all teams.

```bash
POST /api/maturity/benchmark/rankings/services
```

**Response:**
```json
{
  "rankings": [
    {
      "rank": 1,
      "serviceId": "service-1",
      "serviceName": "API Gateway",
      "score": 95,
      "team": "team-1"
    }
  ],
  "totalServices": 10
}
```

### 4. Team Comparison

Compare a team against organization average.

```bash
POST /api/maturity/benchmark/compare/:teamId
```

**Response:**
```json
{
  "teamId": "team-1",
  "averageScore": 87.5,
  "percentile": 75.5,
  "aboveAverage": true,
  "gap": 12.5,
  "organizationAverage": 75.0
}
```

### 5. Top Teams and Teams Needing Improvement

#### Get Top Performing Teams

```bash
POST /api/maturity/benchmark/top-teams
```

**Request Body:**
```json
{
  "serviceScores": [ ... ],
  "limit": 5
}
```

#### Get Teams Needing Improvement

```bash
POST /api/maturity/benchmark/needs-improvement
```

**Request Body:**
```json
{
  "serviceScores": [ ... ],
  "threshold": 60,
  "limit": 5
}
```

### 6. Organization Statistics

Get aggregate statistics across all teams.

```bash
POST /api/maturity/benchmark/organization-stats
```

**Response:**
```json
{
  "totalTeams": 10,
  "totalServices": 45,
  "averageScore": 75.5,
  "medianScore": 78.0,
  "highestScore": 95.0,
  "lowestScore": 45.0,
  "standardDeviation": 12.3
}
```

## Trend Tracking

Track maturity score changes over time for services.

### Store Trend Data Point

```bash
POST /api/maturity/trend/:serviceId
```

**Request Body:**
```json
{
  "score": 85.5,
  "date": "2024-01-15T10:00:00Z"
}
```

If `date` is omitted, current timestamp is used.

**Response:**
```json
{
  "message": "Data point stored successfully",
  "serviceId": "service-1",
  "dataPoint": {
    "date": "2024-01-15T10:00:00Z",
    "score": 85.5
  },
  "trend": {
    "dataPoints": [ ... ],
    "improvement": 15.5,
    "trend": "improving"
  }
}
```

### Get Trend Data

```bash
GET /api/maturity/trend/:serviceId
```

**Query Parameters:**
- `startDate` (optional): Filter start date (ISO 8601)
- `endDate` (optional): Filter end date (ISO 8601)

**Response:**
```json
{
  "serviceId": "service-1",
  "trend": {
    "dataPoints": [
      { "date": "2024-01-01T00:00:00Z", "score": 70 },
      { "date": "2024-01-15T00:00:00Z", "score": 85.5 }
    ],
    "improvement": 22.14,
    "trend": "improving"
  },
  "dataPointCount": 2
}
```

### Trend Analysis

Get detailed trend analysis with velocity and projections.

```bash
GET /api/maturity/trend/:serviceId/analysis
```

**Response:**
```json
{
  "serviceId": "service-1",
  "analysis": {
    "trend": "improving",
    "improvement": 22.14,
    "velocity": 1.11,
    "projectedScore30Days": 95.0,
    "projectedScore90Days": 100.0
  },
  "dataPointCount": 2
}
```

**Fields:**
- `velocity`: Points per day (positive = improving, negative = declining)
- `projectedScore30Days`: Projected score in 30 days (linear projection)
- `projectedScore90Days`: Projected score in 90 days (linear projection)

### Detect Significant Changes

Identify significant score changes (anomalies).

```bash
GET /api/maturity/trend/:serviceId/significant-changes?threshold=10
```

**Response:**
```json
{
  "serviceId": "service-1",
  "significantChanges": [
    {
      "date": "2024-01-15T00:00:00Z",
      "previousScore": 70,
      "newScore": 85.5,
      "change": 15.5,
      "changePercent": 22.14
    }
  ],
  "count": 1
}
```

Default threshold is 10% change.

### Prune Old Data

Remove old trend data points to manage storage.

```bash
POST /api/maturity/trend/:serviceId/prune
```

**Request Body:**
```json
{
  "maxAgeDays": 365
}
```

**Response:**
```json
{
  "message": "Old data points pruned successfully",
  "serviceId": "service-1",
  "removedCount": 5
}
```

### Storage Statistics

Get trend storage statistics.

```bash
GET /api/maturity/trend/storage/stats
```

**Response:**
```json
{
  "totalServices": 45,
  "totalDataPoints": 1250,
  "averagePointsPerService": 27.78
}
```

## Usage Examples

### Example 1: Monthly Team Performance Review

```typescript
// 1. Calculate benchmarks for all teams
const response = await fetch('/api/maturity/benchmark/teams', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serviceScores: [
      { serviceId: 's1', serviceName: 'API', score: 85, team: 'team-1' },
      { serviceId: 's2', serviceName: 'Auth', score: 90, team: 'team-1' },
      { serviceId: 's3', serviceName: 'DB', score: 70, team: 'team-2' },
    ],
  }),
});

const { benchmarks } = await response.json();

// 2. Generate rankings
const rankingsResponse = await fetch('/api/maturity/benchmark/rankings/teams', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serviceScores: [ ... ],
    previousRankings: { 'team-1': 2, 'team-2': 1 },
  }),
});

const { rankings } = await rankingsResponse.json();

// 3. Identify teams needing improvement
const improvementResponse = await fetch('/api/maturity/benchmark/needs-improvement', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serviceScores: [ ... ],
    threshold: 70,
    limit: 5,
  }),
});

const { teams } = await improvementResponse.json();
```

### Example 2: Track Service Maturity Over Time

```typescript
// 1. Store weekly maturity scores
const serviceId = 'service-1';
const scores = [
  { date: '2024-01-01', score: 70 },
  { date: '2024-01-08', score: 72 },
  { date: '2024-01-15', score: 75 },
  { date: '2024-01-22', score: 80 },
];

for (const { date, score } of scores) {
  await fetch(`/api/maturity/trend/${serviceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score, date }),
  });
}

// 2. Get trend analysis
const analysisResponse = await fetch(`/api/maturity/trend/${serviceId}/analysis`);
const { analysis } = await analysisResponse.json();

console.log(`Velocity: ${analysis.velocity} points/day`);
console.log(`Projected score in 30 days: ${analysis.projectedScore30Days}`);

// 3. Detect significant changes
const changesResponse = await fetch(
  `/api/maturity/trend/${serviceId}/significant-changes?threshold=10`
);
const { significantChanges } = await changesResponse.json();

if (significantChanges.length > 0) {
  console.log('Significant improvements detected!');
}
```

### Example 3: Organization-Wide Dashboard

```typescript
// 1. Get organization statistics
const statsResponse = await fetch('/api/maturity/benchmark/organization-stats', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ serviceScores: [ ... ] }),
});

const stats = await statsResponse.json();

// 2. Get top 5 teams
const topTeamsResponse = await fetch('/api/maturity/benchmark/top-teams', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ serviceScores: [ ... ], limit: 5 }),
});

const { topTeams } = await topTeamsResponse.json();

// 3. Compare specific team to organization
const teamId = 'team-1';
const comparisonResponse = await fetch(`/api/maturity/benchmark/compare/${teamId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ serviceScores: [ ... ] }),
});

const comparison = await comparisonResponse.json();

console.log(`Team ${teamId} is at ${comparison.percentile}th percentile`);
console.log(`Gap from org average: ${comparison.gap} points`);
```

## Data Storage

### In-Memory Storage (Default)

By default, trend data is stored in memory using `InMemoryTrendStorage`. This is suitable for:
- Development and testing
- Small deployments with few services
- Temporary trend tracking

**Limitations:**
- Data is lost on server restart
- Not suitable for production with many services
- No persistence across deployments

### PostgreSQL Storage (Production)

For production deployments, implement `PostgresTrendStorage` with actual database queries.

**Database Schema:**

```sql
CREATE TABLE maturity_trends (
  id SERIAL PRIMARY KEY,
  service_id VARCHAR(255) NOT NULL,
  date TIMESTAMP NOT NULL,
  score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(service_id, date)
);

CREATE INDEX idx_maturity_trends_service_id ON maturity_trends(service_id);
CREATE INDEX idx_maturity_trends_date ON maturity_trends(date);
```

## Best Practices

### 1. Regular Data Collection

- Store maturity scores daily or weekly
- Use consistent time intervals for accurate trend analysis
- Automate score collection with scheduled jobs

### 2. Data Retention

- Prune old data points regularly (e.g., keep 1 year of history)
- Archive historical data before pruning if needed
- Balance storage costs with trend analysis needs

### 3. Benchmarking Frequency

- Calculate team benchmarks monthly or quarterly
- Track rank changes to identify improving/declining teams
- Use benchmarks for team performance reviews

### 4. Trend Analysis

- Monitor velocity to predict future scores
- Investigate significant changes (>10% in short period)
- Use projections for capacity planning

### 5. Organization Metrics

- Track organization-wide statistics over time
- Set improvement goals based on current averages
- Celebrate teams that exceed organization average

## Integration with Frontend

### React Component Example

```typescript
import React, { useEffect, useState } from 'react';

export const TeamBenchmarkCard = ({ teamId }: { teamId: string }) => {
  const [benchmark, setBenchmark] = useState(null);
  const [comparison, setComparison] = useState(null);

  useEffect(() => {
    // Fetch team benchmark
    fetch(`/api/maturity/benchmark/team/${teamId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scorecards: [ ... ] }),
    })
      .then(res => res.json())
      .then(setBenchmark);

    // Fetch comparison to organization
    fetch(`/api/maturity/benchmark/compare/${teamId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceScores: [ ... ] }),
    })
      .then(res => res.json())
      .then(setComparison);
  }, [teamId]);

  if (!benchmark || !comparison) return <div>Loading...</div>;

  return (
    <div>
      <h2>Team {teamId} Maturity</h2>
      <p>Average Score: {benchmark.averageScore}</p>
      <p>Services: {benchmark.serviceCount}</p>
      <p>Percentile: {comparison.percentile}th</p>
      <p>
        {comparison.aboveAverage ? '✅' : '⚠️'} 
        {comparison.gap > 0 ? '+' : ''}{comparison.gap} points from org average
      </p>
    </div>
  );
};
```

## Troubleshooting

### Issue: Trend data not persisting

**Solution:** Check if using `InMemoryTrendStorage`. For production, implement `PostgresTrendStorage` with database persistence.

### Issue: Inaccurate trend projections

**Solution:** Ensure sufficient data points (at least 5-10) for accurate velocity calculation. Linear projections work best with consistent improvement patterns.

### Issue: Benchmarks showing unexpected results

**Solution:** Verify service scores are up-to-date and team assignments are correct. Check for outliers that may skew averages.

## Future Enhancements

- **Automated trend alerts**: Notify teams when scores decline significantly
- **Benchmark goals**: Set team-specific maturity goals and track progress
- **Historical comparisons**: Compare current period to same period last year
- **Predictive analytics**: Use ML models for more accurate projections
- **Team insights**: Identify common patterns in high-performing teams
