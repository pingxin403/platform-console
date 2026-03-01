# Service Maturity Scoring Plugin

This Backstage backend plugin provides service maturity scoring across 5 key categories to help teams assess and improve their service quality.

## Features

- **5 Category Scoring**: Documentation, Testing, Monitoring, Security, Cost Efficiency
- **Configurable Weights**: Customize category and check weights based on your organization's priorities
- **Caching**: 1-hour TTL cache to reduce computation overhead
- **Production Readiness Gates**: Enforce minimum maturity scores for production deployments
- **Detailed Breakdown**: Get granular insights into which checks are passing or failing
- **Improvement Suggestions**: Generate actionable recommendations based on failed checks
- **Improvement Roadmap**: Prioritized roadmap with quick wins, critical fixes, and long-term improvements
- **Team Benchmarking**: Compare maturity scores across teams and identify top performers
- **Trend Tracking**: Track maturity score changes over time with velocity and projections
- **Service Rankings**: Rank services and teams by maturity score
- **Organization Statistics**: Get aggregate metrics across all teams and services

For detailed documentation on benchmarking and trend tracking, see [BENCHMARKING.md](./BENCHMARKING.md).

## Categories

### 1. Documentation (Default Weight: 20%)
- README exists
- TechDocs available
- API documentation
- Operational runbook
- Documentation freshness (< 90 days)

### 2. Testing (Default Weight: 25%)
- Unit tests exist
- Integration tests exist
- Code coverage >= 80%
- All tests passing

### 3. Monitoring (Default Weight: 20%)
- Metrics instrumentation
- Alerts configured
- Structured logging
- Monitoring dashboard
- SLOs defined

### 4. Security (Default Weight: 25%)
- Security scanning enabled
- Vulnerability count within limits
- Dependencies up-to-date
- Secrets scanning enabled

### 5. Cost Efficiency (Default Weight: 10%)
- Within allocated budget
- Resource utilization >= 70%
- Cost trend stable or improving
- Resources right-sized

## API Endpoints

### GET /api/maturity/maturity/:serviceId
Get maturity score for a service.

**Request Body:**
```json
{
  "serviceId": "my-service",
  "name": "My Service",
  "owner": "team-a",
  "team": "team-a",
  "repositoryUrl": "https://github.com/org/my-service",
  "hasReadme": true,
  "hasTechDocs": true,
  "hasApiDocs": true,
  "hasRunbook": false,
  "documentationFreshness": 30,
  "hasUnitTests": true,
  "hasIntegrationTests": true,
  "codeCoverage": 85,
  "testsPassing": true,
  "hasMetrics": true,
  "hasAlerts": true,
  "hasLogging": true,
  "hasDashboard": true,
  "slosDefined": false,
  "hasSecurityScanning": true,
  "vulnerabilityCount": 5,
  "highSeverityVulnerabilities": 0,
  "dependenciesUpToDate": true,
  "secretsScanned": true,
  "withinBudget": true,
  "resourceUtilization": 75,
  "costTrend": "stable",
  "hasRightSizing": true
}
```

**Response:**
```json
{
  "serviceId": "my-service",
  "overallScore": 87.5,
  "categories": {
    "documentation": {
      "score": 90,
      "weight": 0.2,
      "status": "passing",
      "checks": [...]
    },
    "testing": {
      "score": 95,
      "weight": 0.25,
      "status": "passing",
      "checks": [...]
    },
    "monitoring": {
      "score": 85,
      "weight": 0.2,
      "status": "passing",
      "checks": [...]
    },
    "security": {
      "score": 90,
      "weight": 0.25,
      "status": "passing",
      "checks": [...]
    },
    "costEfficiency": {
      "score": 80,
      "weight": 0.1,
      "status": "passing",
      "checks": [...]
    }
  },
  "lastUpdated": "2024-01-15T10:30:00Z",
  "expiresAt": "2024-01-15T11:30:00Z",
  "version": 1
}
```

### GET /api/maturity/maturity/:serviceId/details
Get detailed breakdown with all checks.

### POST /api/maturity/maturity/:serviceId/recalculate
Force recalculation (bypass cache).

### GET /api/maturity/health
Health check endpoint.

### GET /api/maturity/config
Get current scoring configuration.

### GET /api/maturity/cache/stats
Get cache statistics (debugging).

### POST /api/maturity/cache/clear
Clear cache (debugging/testing).

### GET /api/maturity/maturity/:serviceId/suggestions
Get improvement suggestions for a service.

**Request Body:** Same as GET /maturity/:serviceId

**Response:**
```json
{
  "serviceId": "my-service",
  "currentScore": 65,
  "suggestions": [
    {
      "id": "suggestion-test-unit",
      "category": "testing",
      "priority": "high",
      "title": "Add unit tests",
      "description": "Implement unit tests to verify individual components and functions",
      "actionItems": [
        "Set up testing framework (Jest, pytest, etc.)",
        "Write unit tests for core business logic",
        "Test edge cases and error conditions",
        "Configure test coverage reporting",
        "Add tests to CI/CD pipeline"
      ],
      "estimatedEffort": "8-16 hours",
      "impact": "+3 points to overall score"
    }
  ],
  "generatedAt": "2024-01-15T10:30:00Z"
}
```

### GET /api/maturity/maturity/:serviceId/roadmap
Get improvement roadmap for a service.

**Request Body:** Same as GET /maturity/:serviceId

**Response:**
```json
{
  "serviceId": "my-service",
  "currentScore": 65,
  "potentialScore": 85,
  "totalImprovementPotential": 20,
  "quickWins": [
    {
      "id": "suggestion-doc-freshness",
      "category": "documentation",
      "title": "Update outdated documentation",
      "description": "Review and update documentation to reflect current state",
      "priority": "medium",
      "effort": "low",
      "impact": "medium",
      "estimatedScoreImprovement": 2,
      "checksAffected": 1,
      "actionItems": [...],
      "roadmapPhase": "quick-wins"
    }
  ],
  "criticalFixes": [
    {
      "id": "suggestion-sec-scanning",
      "category": "security",
      "title": "Enable security scanning",
      "description": "Configure automated security scanning",
      "priority": "high",
      "effort": "low",
      "impact": "high",
      "estimatedScoreImprovement": 5,
      "checksAffected": 1,
      "actionItems": [...],
      "roadmapPhase": "critical-fixes"
    }
  ],
  "longTermImprovements": [
    {
      "id": "suggestion-test-unit",
      "category": "testing",
      "title": "Add unit tests",
      "description": "Implement comprehensive unit tests",
      "priority": "high",
      "effort": "high",
      "impact": "high",
      "estimatedScoreImprovement": 8,
      "checksAffected": 1,
      "actionItems": [...],
      "roadmapPhase": "long-term"
    }
  ],
  "generatedAt": "2024-01-15T10:30:00Z"
}
```

### POST /api/maturity/maturity/:serviceId/validate-readiness
Validate production readiness for a service (pre-deployment gate).

**Request Body:** Same as GET /maturity/:serviceId

**Response:**
```json
{
  "serviceId": "my-service",
  "validation": {
    "isReady": false,
    "minimumScore": 70,
    "currentScore": 65,
    "failingChecks": [
      {
        "id": "test-unit",
        "name": "Unit tests exist",
        "description": "Service has unit tests",
        "status": "fail",
        "required": true,
        "value": false,
        "weight": 0.3
      }
    ],
    "blockers": [
      "Overall maturity score (65.0) is below minimum required (70)",
      "Required check failed: Unit tests exist - Service has unit tests"
    ]
  },
  "feedback": {
    "summary": "❌ Not production ready (score: 65.0/70) - 2 blocker(s), 1 failing check(s)",
    "detailed": "❌ Production Readiness Gate: FAILED\n\nYour service does not meet the minimum requirements for production deployment.\n\n📊 Overall Score:\n   Current: 65.0/100\n   Required: 70/100\n   Gap: 5.0 points\n\n🚫 Blockers:\n   1. Overall maturity score (65.0) is below minimum required (70)\n   2. Required check failed: Unit tests exist - Service has unit tests\n\n❗ Failing Required Checks:\n   • Unit tests exist\n     Service has unit tests\n     Current: false\n\n📋 Next Steps:\n   1. Review the failing checks above\n   2. Address the blockers to improve your maturity score\n   3. Run the maturity check again after making improvements\n   4. If urgent, request approval to deploy with current score\n\n⚠️  Approval Required:\n   This deployment requires approval from a platform administrator.\n   Please create an approval request with justification for deploying\n   a service that does not meet production readiness requirements."
  },
  "scorecard": {
    "overallScore": 65,
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

### POST /api/maturity/maturity/:serviceId/request-approval
Request approval for production deployment when readiness gate fails.

**Request Body:** Same as GET /maturity/:serviceId

**Response:**
```json
{
  "approvalRequest": {
    "serviceId": "my-service",
    "currentScore": 65,
    "minimumScore": 70,
    "failingChecks": [...],
    "blockers": [...],
    "approvalUrl": "/approval/request?service=my-service&score=65.0&required=70",
    "requestedAt": "2024-01-15T10:30:00Z"
  },
  "message": "Approval request created successfully",
  "nextSteps": [
    "Platform team has been notified",
    "Review the failing checks and blockers",
    "Provide justification for deploying with current maturity score",
    "Wait for approval decision"
  ]
}
```

### GET /api/maturity/readiness-gate/config
Get production readiness gate configuration.

**Response:**
```json
{
  "minimumScore": 70,
  "requiredChecks": [
    "doc-readme",
    "doc-techdocs",
    "test-unit",
    "test-passing",
    "mon-metrics",
    "mon-alerts",
    "mon-logging",
    "sec-scanning",
    "sec-secrets",
    "cost-budget"
  ],
  "categoryMinimums": {
    "security": 80,
    "testing": 70
  },
  "requireApproval": true,
  "approvalUrlTemplate": "/approval/request?service={serviceId}&score={currentScore}&required={minimumScore}"
}
```

### PUT /api/maturity/readiness-gate/config
Update production readiness gate configuration.

**Request Body:**
```json
{
  "minimumScore": 75,
  "categoryMinimums": {
    "security": 85
  }
}
```

**Response:**
```json
{
  "message": "Configuration updated successfully",
  "config": {
    "minimumScore": 75,
    "requiredChecks": [...],
    "categoryMinimums": {
      "security": 85,
      "testing": 70
    },
    "requireApproval": true,
    "approvalUrlTemplate": "..."
  }
}
```

## Configuration

Add to your `app-config.yaml`:

```yaml
maturity:
  # Category weights (must sum to 1.0)
  categoryWeights:
    documentation: 0.2
    testing: 0.25
    monitoring: 0.2
    security: 0.25
    costEfficiency: 0.1
  
  # Minimum score for production readiness
  productionReadinessThreshold: 70
  
  # Cache TTL in seconds (default: 3600 = 1 hour)
  cacheTTL: 3600
  
  # Production Readiness Gate Configuration
  readinessGate:
    # Minimum overall score required for production deployment
    minimumScore: 70
    
    # Required checks that must pass (by check ID)
    requiredChecks:
      - doc-readme
      - doc-techdocs
      - test-unit
      - test-passing
      - mon-metrics
      - mon-alerts
      - mon-logging
      - sec-scanning
      - sec-secrets
      - cost-budget
    
    # Category-specific minimum scores
    categoryMinimums:
      security: 80  # Security must be at least 80
      testing: 70   # Testing must be at least 70
    
    # Whether to require approval for deployments that don't meet requirements
    requireApproval: true
    
    # Approval workflow URL template
    approvalUrlTemplate: "/approval/request?service={serviceId}&score={currentScore}&required={minimumScore}"
  
  # Check configurations
  checks:
    documentation:
      readme:
        weight: 0.3
        required: true
      techDocs:
        weight: 0.3
        required: true
      apiDocs:
        weight: 0.2
        required: false
      runbook:
        weight: 0.1
        required: false
      freshness:
        weight: 0.1
        required: false
        thresholdDays: 90
    
    testing:
      unitTests:
        weight: 0.3
        required: true
      integrationTests:
        weight: 0.2
        required: false
      coverage:
        weight: 0.3
        required: true
        minimumPercent: 80
      passing:
        weight: 0.2
        required: true
    
    monitoring:
      metrics:
        weight: 0.25
        required: true
      alerts:
        weight: 0.25
        required: true
      logging:
        weight: 0.2
        required: true
      dashboard:
        weight: 0.15
        required: false
      slos:
        weight: 0.15
        required: false
    
    security:
      scanning:
        weight: 0.3
        required: true
      vulnerabilities:
        weight: 0.3
        required: true
        maxTotal: 10
        maxHighSeverity: 0
      dependencies:
        weight: 0.2
        required: false
      secrets:
        weight: 0.2
        required: true
    
    costEfficiency:
      budget:
        weight: 0.4
        required: true
      utilization:
        weight: 0.3
        required: false
        minimumPercent: 70
      trend:
        weight: 0.2
        required: false
      rightSizing:
        weight: 0.1
        required: false
```

## Usage

### In Backend

```typescript
import serviceMaturityPlugin from './plugins/maturity';

// In your backend index.ts
backend.add(serviceMaturityPlugin);
```

### Programmatic Usage

```typescript
import { ScoringEngine } from './plugins/maturity';

const engine = new ScoringEngine(config, 3600);

const scorecard = await engine.calculateScorecard(serviceId, metadata);
console.log(`Overall score: ${scorecard.overallScore}`);
```

## Scoring Logic

### Check Scoring
- **Pass**: 100 points
- **Warning**: 50 points
- **Fail**: 0 points

### Category Scoring
Category score = Weighted average of check scores

### Overall Scoring
Overall score = Weighted average of category scores

### Category Status
- **Passing**: Score >= 80 and no failed required checks
- **Warning**: Score >= 60 and no failed required checks
- **Failing**: Score < 60 or has failed required checks

## Production Readiness

A service is considered production-ready when:
1. Overall score >= `productionReadinessThreshold` (default: 70)
2. All required checks are passing

## Production Readiness Gate

The Production Readiness Gate validates that services meet minimum maturity requirements before deployment to production. This helps ensure quality, security, and reliability standards.

### How It Works

1. **Pre-Deployment Validation**: Before deploying to production, call the `/validate-readiness` endpoint
2. **Gate Evaluation**: The gate checks:
   - Overall maturity score meets minimum threshold
   - All required checks are passing
   - Category-specific minimums are met (if configured)
3. **Pass/Fail Decision**:
   - **Pass**: Service can be deployed to production
   - **Fail**: Deployment is blocked, detailed feedback is provided
4. **Approval Workflow**: If deployment is urgent, request approval to bypass the gate

### Configuration

The readiness gate is highly configurable:

- **minimumScore**: Overall score threshold (default: 70)
- **requiredChecks**: List of check IDs that must pass
- **categoryMinimums**: Minimum scores for specific categories
- **requireApproval**: Whether to require approval for failed gates
- **approvalUrlTemplate**: URL template for approval requests

### Validation Response

The validation response includes:

- **isReady**: Boolean indicating if service is production-ready
- **currentScore**: Service's current maturity score
- **minimumScore**: Required minimum score
- **failingChecks**: List of required checks that are failing
- **blockers**: Human-readable list of issues blocking deployment
- **feedback**: Detailed and summary feedback messages

### Detailed Feedback

When a gate fails, detailed feedback includes:

- Overall score comparison (current vs required)
- List of all blockers
- Details of failing required checks
- Next steps to improve maturity
- Approval process information

### Integration with CI/CD

Example GitHub Actions workflow:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  validate-readiness:
    runs-on: ubuntu-latest
    steps:
      - name: Check Production Readiness
        run: |
          response=$(curl -X POST \
            -H "Content-Type: application/json" \
            -d @service-metadata.json \
            https://backstage.example.com/api/maturity/maturity/my-service/validate-readiness)
          
          isReady=$(echo $response | jq -r '.validation.isReady')
          
          if [ "$isReady" != "true" ]; then
            echo "❌ Production Readiness Gate Failed"
            echo $response | jq -r '.feedback.detailed'
            exit 1
          fi
          
          echo "✅ Production Readiness Gate Passed"
  
  deploy:
    needs: validate-readiness
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        run: |
          # Your deployment steps here
```

### Approval Workflow

When a service doesn't meet readiness requirements but deployment is urgent:

1. Call `/request-approval` endpoint
2. Provide justification for deploying with current maturity score
3. Platform team reviews the request
4. If approved, deployment can proceed with override

Example approval request:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d @service-metadata.json \
  https://backstage.example.com/api/maturity/maturity/my-service/request-approval
```

### Best Practices

1. **Set Realistic Thresholds**: Start with lower thresholds (60-70) and gradually increase
2. **Focus on Required Checks**: Mark critical checks as required (security, testing, monitoring)
3. **Category Minimums**: Set higher minimums for security (80+) and testing (70+)
4. **Approval Process**: Have a clear approval process for exceptions
5. **Continuous Improvement**: Track maturity scores over time and celebrate improvements
6. **Early Validation**: Run readiness checks in staging environments first

## Caching

- Default TTL: 1 hour (3600 seconds)
- Cache key format: `scorecard:{serviceId}`
- Automatic cleanup every 10 minutes
- Can be bypassed with `/recalculate` endpoint

## Improvement Suggestions

The suggestion engine analyzes failed and warning checks to generate actionable improvement recommendations.

### Suggestion Generation

For each failed or warning check, the engine:
1. Looks up the corresponding suggestion template
2. Calculates impact based on:
   - Check importance (required vs optional)
   - Check weight within category
   - Category weight in overall score
   - Current overall score
3. Determines priority (high/medium/low) based on:
   - Whether the check is required
   - Calculated impact score
   - Overall service maturity
4. Provides specific action items and estimated effort

### Priority Levels

- **High Priority**: Required checks that are failing, or high-impact improvements
- **Medium Priority**: Required checks with warnings, or medium-impact improvements
- **Low Priority**: Optional checks or low-impact improvements

### Improvement Roadmap

The roadmap categorizes suggestions into three phases:

1. **Quick Wins**: Low effort, high/medium impact improvements
   - Can be completed in < 4 hours
   - Provide immediate score improvements
   - Good for building momentum

2. **Critical Fixes**: High priority required checks
   - Must be addressed for production readiness
   - May require more effort but are essential
   - Often security or reliability related

3. **Long-Term Improvements**: High effort or lower priority items
   - Require > 8 hours of work
   - Important but not blocking
   - Can be planned for future sprints

### Impact Assessment

Each suggestion includes:
- **Estimated Score Improvement**: Points added to overall score
- **Checks Affected**: Number of checks that will pass
- **Effort Level**: Low (< 4h), Medium (4-8h), High (> 8h)
- **Impact Level**: Based on score improvement potential

### Example Usage

```typescript
import { SuggestionEngine } from './plugins/maturity';

const suggestionEngine = new SuggestionEngine();

// Generate suggestions
const suggestions = suggestionEngine.generateSuggestions(scorecard);
console.log(`Found ${suggestions.length} improvement opportunities`);

// Generate roadmap
const roadmap = suggestionEngine.generateRoadmap(scorecard);
console.log(`Quick wins: ${roadmap.quickWins.length}`);
console.log(`Critical fixes: ${roadmap.criticalFixes.length}`);
console.log(`Potential score: ${roadmap.potentialScore}`);
```

## Future Enhancements

1. **Metadata Collection**: Automatic collection from Backstage Catalog, GitHub, Datadog, etc.
2. **Trend Tracking**: Store historical scores to track improvement over time
3. **Team Benchmarking**: Compare scores across teams
4. **Production Gates**: Integrate with deployment pipelines to enforce readiness
5. **Notifications**: Alert teams when scores drop below thresholds
6. **AI-Powered Suggestions**: Use ML to provide more personalized recommendations

## Testing

Run unit tests:
```bash
npm test -- scoring-engine.test.ts
npm test -- suggestion-engine.test.ts
```

## License

Apache-2.0
