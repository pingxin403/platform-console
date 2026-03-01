# FinOps Cost Estimation and Budget Management

This module provides cost estimation, budget management, and pre-deployment cost gating capabilities for Kubernetes and AWS resources, integrating with OpenCost API for historical data and implementing caching with 15-minute TTL.

## Features

- **Kubernetes Cost Estimation**: Calculate monthly costs based on CPU, memory, and storage requirements
- **AWS Cost Estimation**: Estimate costs for RDS, S3, and other AWS services
- **Budget Management**: CRUD operations for service budgets with alert thresholds
- **Pre-Deployment Cost Gating**: Validate deployments against budgets before deployment
- **Approval Workflow**: Automatic approval request generation for budget overruns
- **Historical Cost Data**: Fetch historical cost data from OpenCost API
- **Caching**: 15-minute TTL cache to reduce API calls and improve performance
- **Backstage Scaffolder Actions**: Custom actions for cost validation in templates
- **Flexible Pricing**: Configurable pricing for different resource types

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│   FinOps Cost Estimation & Budget Management Plugin     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Cost Estimation Engine                            │ │
│  │                                                    │ │
│  │  - estimateDeploymentCost()                       │ │
│  │  - getHistoricalCost()                            │ │
│  │  - calculateKubernetesCost()                      │ │
│  │  - estimateAWSCost()                              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Budget Manager                                    │ │
│  │                                                    │ │
│  │  - createBudget()                                 │ │
│  │  - getBudget()                                    │ │
│  │  - updateBudget()                                 │ │
│  │  - deleteBudget()                                 │ │
│  │  - validateBudget()                               │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Scaffolder Actions                                │ │
│  │                                                    │ │
│  │  - finops:validate-cost                           │ │
│  │  - finops:manage-budget                           │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Cache Layer (15-min TTL)                         │ │
│  │                                                    │ │
│  │  - In-memory cache                                │ │
│  │  - Automatic cleanup                              │ │
│  │  - Cache statistics                               │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
           │
           ├─────────────────┬──────────────────┐
           │                 │                  │
           ▼                 ▼                  ▼
    ┌─────────────┐   ┌──────────────┐  ┌──────────────┐
    │  OpenCost   │   │  AWS Cost    │  │  GitHub      │
    │  API        │   │  Explorer    │  │  Issues API  │
    └─────────────┘   └──────────────┘  └──────────────┘
```

## API Endpoints

### POST /api/finops/estimate

Estimate monthly cost based on deployment specification.

**Request Body:**
```json
{
  "cpu": "2",
  "memory": "4Gi",
  "storage": "10Gi",
  "replicas": 3,
  "environment": "production"
}
```

**Response:**
```json
{
  "estimatedMonthlyCost": 450.50,
  "breakdown": {
    "kubernetes": {
      "cpu": 135.78,
      "memory": 87.60,
      "storage": 30.00,
      "total": 253.38
    },
    "aws": {
      "rds": 365.00,
      "s3": 2.30,
      "other": 50.00,
      "total": 417.30
    }
  },
  "confidence": 0.85,
  "currency": "USD"
}
```

### GET /api/finops/historical/:serviceName

Get historical cost data for a service.

**Query Parameters:**
- `timeRange` (optional): Time range for historical data (default: "7d")
  - Supported values: "1d", "7d", "30d", "90d"

**Response:**
```json
{
  "serviceName": "my-service",
  "timeRange": {
    "start": "2024-01-01T00:00:00.000Z",
    "end": "2024-01-08T00:00:00.000Z"
  },
  "costs": {
    "kubernetes": {
      "cpu": 120.50,
      "memory": 80.30,
      "storage": 25.00,
      "total": 225.80
    }
  },
  "totalCost": 225.80
}
```

### GET /api/finops/cache/stats

Get cache statistics (for debugging).

**Response:**
```json
{
  "size": 5,
  "keys": [
    "finops:estimate:deployment:{...}",
    "finops:historical:my-service:{...}"
  ]
}
```

### POST /api/finops/cache/clear

Clear cache (for debugging/testing).

**Response:**
```json
{
  "message": "Cache cleared successfully"
}
```

### GET /api/finops/health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "finops-cost-estimation",
  "cache": {
    "size": 5,
    "keys": [...]
  }
}
```

## Budget Management API

### POST /api/finops/budgets

Create a new budget for a service.

**Request Body:**
```json
{
  "serviceId": "my-service",
  "monthlyBudget": 1000.00,
  "alertThreshold": 80
}
```

**Response:**
```json
{
  "id": "budget_1234567890_abc123",
  "serviceId": "my-service",
  "monthlyBudget": 1000.00,
  "currency": "USD",
  "alertThreshold": 80,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "createdBy": "user@example.com",
  "updatedBy": "user@example.com"
}
```

### GET /api/finops/budgets/:serviceId

Get budget for a service.

**Response:**
```json
{
  "id": "budget_1234567890_abc123",
  "serviceId": "my-service",
  "monthlyBudget": 1000.00,
  "currency": "USD",
  "alertThreshold": 80,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "createdBy": "user@example.com",
  "updatedBy": "user@example.com"
}
```

### PUT /api/finops/budgets/:serviceId

Update budget for a service.

**Request Body:**
```json
{
  "monthlyBudget": 1500.00,
  "alertThreshold": 85
}
```

**Response:**
```json
{
  "id": "budget_1234567890_abc123",
  "serviceId": "my-service",
  "monthlyBudget": 1500.00,
  "currency": "USD",
  "alertThreshold": 85,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-02T00:00:00.000Z",
  "createdBy": "user@example.com",
  "updatedBy": "user@example.com"
}
```

### DELETE /api/finops/budgets/:serviceId

Delete budget for a service.

**Response:** 204 No Content

### GET /api/finops/budgets

List all budgets.

**Response:**
```json
[
  {
    "id": "budget_1234567890_abc123",
    "serviceId": "my-service",
    "monthlyBudget": 1000.00,
    "currency": "USD",
    "alertThreshold": 80,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "createdBy": "user@example.com",
    "updatedBy": "user@example.com"
  }
]
```

### POST /api/finops/validate

Validate deployment cost against budget (Pre-Deployment Cost Gate).

**Request Body:**
```json
{
  "serviceId": "my-service",
  "spec": {
    "cpu": "2",
    "memory": "4Gi",
    "storage": "10Gi",
    "replicas": 3,
    "environment": "production"
  },
  "currentMonthlyCost": 500.00
}
```

**Response:**
```json
{
  "isValid": false,
  "currentBudget": 1000.00,
  "estimatedCost": 450.50,
  "remainingBudget": 500.00,
  "requiresApproval": true,
  "approvalUrl": "https://github.com/your-org/approvals/issues/new?title=...",
  "message": "Estimated cost ($450.50) exceeds remaining budget ($500.00). Approval required.",
  "costEstimate": {
    "estimatedMonthlyCost": 450.50,
    "breakdown": {
      "kubernetes": {
        "cpu": 135.78,
        "memory": 87.60,
        "storage": 30.00,
        "total": 253.38
      },
      "aws": {
        "rds": 365.00,
        "s3": 2.30,
        "other": 50.00,
        "total": 417.30
      }
    },
    "confidence": 0.85,
    "currency": "USD"
  }
}
```

## Configuration

Add the following configuration to `app-config.yaml`:

```yaml
# FinOps Cost Estimation and Budget Management configuration
finops:
  # Pricing configuration for cost estimation
  pricing:
    # Kubernetes resource pricing (USD)
    kubernetes:
      # CPU cost per core per hour
      cpuPerCorePerHour: 0.031
      # Memory cost per GB per hour
      memoryPerGBPerHour: 0.004
      # Storage cost per GB per month
      storagePerGBPerMonth: 0.10
    # AWS resource pricing (USD)
    aws:
      # RDS pricing
      rds:
        # Cost per instance per hour (db.t3.medium equivalent)
        perInstancePerHour: 0.50
      # S3 pricing
      s3:
        # Cost per GB per month (Standard storage)
        perGBPerMonth: 0.023
  # Cache configuration
  cache:
    # Cache TTL in seconds (15 minutes)
    ttl: 900
  # Approval workflow configuration
  approvalWorkflow:
    # Enable approval workflow for budget overruns
    enabled: true
    # GitHub organization for approval issues
    githubOrg: your-org
    # GitHub repository for approval issues
    githubRepo: approvals

# OpenCost configuration (required)
opencost:
  baseUrl: http://localhost:7007/api/proxy/opencost
  aws:
    enabled: true
    costExplorer:
      enabled: true
      region: us-east-1
```

## Backstage Scaffolder Actions

### finops:validate-cost

Validates deployment cost against service budget. Use this action in your Backstage templates to implement pre-deployment cost gating.

**Example Usage in Template:**

```yaml
steps:
  - id: validate-cost
    name: Validate Deployment Cost
    action: finops:validate-cost
    input:
      serviceId: ${{ parameters.name }}
      cpu: ${{ parameters.cpu }}
      memory: ${{ parameters.memory }}
      storage: ${{ parameters.storage }}
      replicas: ${{ parameters.replicas }}
      environment: ${{ parameters.environment }}
      failOnBudgetExceeded: true
```

**Input Parameters:**
- `serviceId` (required): Service ID to validate
- `cpu` (required): CPU request (e.g., "2" or "2000m")
- `memory` (required): Memory request (e.g., "4Gi")
- `storage` (optional): Storage request (e.g., "10Gi")
- `replicas` (required): Number of replicas
- `environment` (optional): Deployment environment (development/staging/production)
- `failOnBudgetExceeded` (optional): Whether to fail if budget is exceeded (default: true)

**Output:**
- `isValid`: Whether deployment is within budget
- `estimatedCost`: Estimated monthly cost in USD
- `remainingBudget`: Remaining budget in USD
- `requiresApproval`: Whether approval is required
- `approvalUrl`: URL to request approval (if applicable)
- `message`: Validation message

### finops:manage-budget

Manages service budgets (CRUD operations). Use this action to create, update, or delete budgets from templates.

**Example Usage in Template:**

```yaml
steps:
  - id: create-budget
    name: Create Service Budget
    action: finops:manage-budget
    input:
      action: create
      serviceId: ${{ parameters.name }}
      monthlyBudget: 1000
      alertThreshold: 80
      userId: ${{ user.entity.metadata.name }}
```

**Input Parameters:**
- `action` (required): Budget action (create/update/delete/get)
- `serviceId` (required): Service ID
- `monthlyBudget` (optional): Monthly budget in USD (required for create)
- `alertThreshold` (optional): Alert threshold percentage (0-100)
- `userId` (optional): User performing the action

**Output:**
- `budget`: Service budget object

## Usage Examples

### Estimate Deployment Cost

```typescript
import { CostEstimationEngine } from './plugins/finops';

const engine = new CostEstimationEngine(config);

const spec = {
  cpu: '2',
  memory: '4Gi',
  storage: '10Gi',
  replicas: 3,
  environment: 'production',
};

const estimate = await engine.estimateDeploymentCost(spec);
console.log(`Estimated monthly cost: $${estimate.estimatedMonthlyCost}`);
```

### Get Historical Cost Data

```typescript
const historicalData = await engine.getHistoricalCost('my-service', '30d');
console.log(`Total cost for last 30 days: $${historicalData.totalCost}`);
```

## Resource Format Support

### CPU
- Cores: `"2"`, `"2.5"`, `"0.5"`
- Millicores: `"2000m"`, `"500m"`, `"1500m"`

### Memory
- Gibibytes: `"4Gi"`, `"2.5Gi"`
- Gigabytes: `"4G"`, `"2.5G"`
- Mebibytes: `"4096Mi"`, `"2048Mi"`
- Megabytes: `"4096M"`, `"2048M"`

### Storage
- Same formats as memory

## Caching Strategy

The cost estimation engine implements a 15-minute TTL cache to:
- Reduce load on OpenCost API
- Improve response times
- Minimize cost calculation overhead

Cache keys are generated based on:
- Operation type (estimate/historical)
- Resource identifier (deployment spec/service name)
- Query parameters (time range, etc.)

## Testing

Run tests:
```bash
npm test -- packages/backend/src/plugins/finops
```

## Future Enhancements

1. **Redis Integration**: Replace in-memory cache with Redis for distributed caching
2. **AWS Cost Explorer Integration**: Real-time AWS cost data instead of estimates
3. **Cost Optimization Recommendations**: ML-based recommendations for cost reduction
4. **Cost Anomaly Detection**: Automated detection of cost spikes and anomalies
5. **Multi-Cloud Support**: Extend to GCP, Azure, and other cloud providers
6. **Historical Trend Analysis**: Advanced analytics and forecasting

## References

- [OpenCost Documentation](https://www.opencost.io/docs/)
- [AWS Cost Explorer API](https://docs.aws.amazon.com/cost-management/latest/APIReference/Welcome.html)
- [Kubernetes Resource Units](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)

### Create and Manage Budgets

```typescript
import { BudgetManager } from './plugins/finops';

const budgetManager = new BudgetManager({
  approvalWorkflow: {
    enabled: true,
    githubOrg: 'your-org',
    githubRepo: 'approvals',
  },
});

// Create a budget
const budget = await budgetManager.createBudget(
  {
    serviceId: 'my-service',
    monthlyBudget: 1000,
    alertThreshold: 80,
  },
  'user@example.com'
);

// Get a budget
const existingBudget = await budgetManager.getBudget('my-service');

// Update a budget
const updatedBudget = await budgetManager.updateBudget(
  'my-service',
  { monthlyBudget: 1500 },
  'user@example.com'
);

// Delete a budget
await budgetManager.deleteBudget('my-service');
```

### Validate Budget Before Deployment

```typescript
// Estimate cost
const costEstimate = await engine.estimateDeploymentCost(spec);

// Validate against budget
const validation = await budgetManager.validateBudget(
  'my-service',
  costEstimate,
  500 // current monthly cost
);

if (!validation.isValid) {
  console.error(`Deployment blocked: ${validation.message}`);
  if (validation.approvalUrl) {
    console.log(`Request approval at: ${validation.approvalUrl}`);
  }
} else {
  console.log(`Deployment approved: ${validation.message}`);
}
```

### Register Scaffolder Actions

```typescript
import { createCostGateAction, createBudgetManagementAction } from './plugins/finops';

// In your backend index.ts
const costGateAction = createCostGateAction({
  costEngine: engine,
  budgetManager: budgetManager,
});

const budgetManagementAction = createBudgetManagementAction({
  costEngine: engine,
  budgetManager: budgetManager,
});

// Register actions with Backstage
env.registerInit({
  deps: {
    scaffolder: scaffolderActionsExtensionPoint,
  },
  async init({ scaffolder }) {
    scaffolder.addActions(costGateAction, budgetManagementAction);
  },
});
```


## Cost Anomaly Detection and Alerting

The FinOps plugin includes automated cost anomaly detection and alerting capabilities to help identify and respond to unexpected cost changes.

### Features

- **Threshold-Based Detection**: Simple, reliable anomaly detection without ML complexity
- **Multiple Anomaly Types**:
  - **Spike**: Sudden cost increases (>50% by default)
  - **Sustained Increase**: Gradual cost increases over time (>30% by default)
  - **Unusual Pattern**: Statistical outliers (>2 standard deviations by default)
- **Automated Alerting**: Slack and Email notifications
- **Actionable Recommendations**: Context-specific suggestions for each anomaly type
- **Hourly Monitoring**: Scheduled anomaly detection runs
- **Anomaly History**: Track and resolve anomalies over time

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│   Cost Anomaly Detection & Alerting System              │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Anomaly Detector                                  │ │
│  │                                                    │ │
│  │  - detectSpike()                                  │ │
│  │  - detectSustainedIncrease()                      │ │
│  │  - detectUnusualPattern()                         │ │
│  │  - getAnomalies()                                 │ │
│  │  - resolveAnomaly()                               │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Alert Engine                                      │ │
│  │                                                    │ │
│  │  - sendSlackNotification()                        │ │
│  │  - sendEmailNotification()                        │ │
│  │  - testAlert()                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Anomaly Scheduler                                 │ │
│  │                                                    │ │
│  │  - start() / stop()                               │ │
│  │  - runDetection()                                 │ │
│  │  - updateServices()                               │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
           │
           ├─────────────────┬──────────────────┐
           │                 │                  │
           ▼                 ▼                  ▼
    ┌─────────────┐   ┌──────────────┐  ┌──────────────┐
    │  Cost       │   │  Slack       │  │  Email       │
    │  Engine     │   │  Webhook     │  │  SMTP        │
    └─────────────┘   └──────────────┘  └──────────────┘
```

### Configuration

Add the following configuration to `app-config.yaml`:

```yaml
finops:
  # Anomaly detection configuration
  anomaly:
    # Enable anomaly detection
    enabled: true
    # Services to monitor (list of service IDs)
    services:
      - my-service
      - another-service
    # Detection thresholds
    thresholds:
      # Spike detection: percentage increase (default: 50%)
      spike: 50
      # Sustained increase: percentage increase over time (default: 30%)
      sustainedIncrease: 30
      # Unusual pattern: standard deviations from mean (default: 2)
      unusualPattern: 2
    # Lookback period in days (default: 7)
    lookbackPeriod: 7
    # Check interval in minutes (default: 60)
    checkInterval: 60
  
  # Alert configuration
  alerts:
    # Slack notifications
    slack:
      enabled: true
      webhookUrl: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
      channel: '#finops-alerts'
    # Email notifications
    email:
      enabled: false
      smtpHost: smtp.example.com
      smtpPort: 587
      from: finops@example.com
      to:
        - team@example.com
        - manager@example.com
```

### Anomaly Detection API

#### GET /api/finops/anomalies/:serviceId

Get all anomalies for a service.

**Query Parameters:**
- `unresolved` (optional): Filter to only unresolved anomalies (true/false)

**Response:**
```json
[
  {
    "id": "anomaly_1234567890_abc123",
    "serviceId": "my-service",
    "detectedAt": "2024-01-15T10:30:00.000Z",
    "anomalyType": "spike",
    "severity": "high",
    "currentCost": 500.00,
    "expectedCost": 250.00,
    "deviation": 100.0,
    "recommendations": [
      "Review recent deployments or configuration changes",
      "Check for unexpected traffic spikes or resource usage",
      "Verify autoscaling settings are configured correctly",
      "Consider implementing resource limits and quotas",
      "URGENT: Cost has more than doubled - immediate investigation required"
    ],
    "notificationSent": true,
    "resolvedAt": null
  }
]
```

#### POST /api/finops/anomalies/detect/:serviceId

Manually trigger anomaly detection for a service.

**Response:**
```json
{
  "detected": 2,
  "anomalies": [
    {
      "id": "anomaly_1234567890_abc123",
      "serviceId": "my-service",
      "detectedAt": "2024-01-15T10:30:00.000Z",
      "anomalyType": "spike",
      "severity": "high",
      "currentCost": 500.00,
      "expectedCost": 250.00,
      "deviation": 100.0,
      "recommendations": [...],
      "notificationSent": true
    }
  ]
}
```

#### POST /api/finops/anomalies/:anomalyId/resolve

Mark an anomaly as resolved.

**Response:**
```json
{
  "message": "Anomaly resolved successfully"
}
```

#### GET /api/finops/anomalies/scheduler/status

Get scheduler status.

**Response:**
```json
{
  "running": true,
  "intervalMinutes": 60,
  "servicesCount": 5,
  "enabled": true
}
```

#### POST /api/finops/anomalies/scheduler/run

Manually trigger scheduler run.

**Request Body (optional):**
```json
{
  "serviceId": "my-service"
}
```

**Response:**
```json
{
  "detected": 3,
  "anomalies": [...]
}
```

#### POST /api/finops/anomalies/scheduler/services

Update services list for monitoring.

**Request Body:**
```json
{
  "services": ["service-1", "service-2", "service-3"]
}
```

**Response:**
```json
{
  "message": "Services list updated successfully",
  "count": 3
}
```

#### POST /api/finops/alerts/test

Test alert configuration.

**Response:**
```json
{
  "slack": true,
  "email": false
}
```

### Anomaly Types and Detection Logic

#### 1. Spike Detection

Detects sudden cost increases by comparing current cost with the previous period.

**Threshold**: 50% increase by default

**Example**: Cost jumps from $100 to $200 in one period

**Recommendations**:
- Review recent deployments or configuration changes
- Check for unexpected traffic spikes or resource usage
- Verify autoscaling settings are configured correctly
- Consider implementing resource limits and quotas

#### 2. Sustained Increase Detection

Detects gradual cost increases over multiple periods using trend analysis.

**Threshold**: 30% increase over time by default

**Example**: Cost increases from $100 → $120 → $140 → $160 over 4 periods

**Recommendations**:
- Analyze resource utilization trends over time
- Review application growth and scaling patterns
- Consider implementing cost optimization strategies
- Evaluate if current resource allocation matches actual needs
- Schedule a cost review meeting with the team

#### 3. Unusual Pattern Detection

Detects statistical outliers using mean and standard deviation analysis.

**Threshold**: 2 standard deviations from mean by default

**Example**: Cost is consistently $100±$5, then suddenly jumps to $200

**Recommendations**:
- Investigate for anomalous behavior or misconfigurations
- Check for failed jobs or stuck processes consuming resources
- Review recent code changes that might affect resource usage
- Verify monitoring and alerting systems are functioning correctly
- Consider implementing automated cost anomaly detection

### Severity Levels

Anomalies are classified into three severity levels based on deviation:

- **High**: >100% for spikes, >50% for sustained increases, >75% for unusual patterns
- **Medium**: >50% for spikes, >30% for sustained increases, >40% for unusual patterns
- **Low**: Below medium thresholds but above detection thresholds

### Alert Notifications

#### Slack Notification Format

```
🚨 Cost Spike Detected

Service: my-service
Severity: HIGH
Current Cost: $500.00
Expected Cost: $250.00
Deviation: 100.0%
Detected At: 2024-01-15T10:30:00.000Z

Recommended Actions:
1. Review recent deployments or configuration changes
2. Check for unexpected traffic spikes or resource usage
3. Verify autoscaling settings are configured correctly
4. Consider implementing resource limits and quotas
5. URGENT: Cost has more than doubled - immediate investigation required
```

#### Email Notification Format

```
Subject: [HIGH] Cost Spike - my-service

Cost Anomaly Detected

Service: my-service
Anomaly Type: Cost Spike
Severity: HIGH

Cost Details:
- Current Cost: $500.00
- Expected Cost: $250.00
- Deviation: 100.0%

Detected At: 2024-01-15T10:30:00.000Z

Recommended Actions:
1. Review recent deployments or configuration changes
2. Check for unexpected traffic spikes or resource usage
3. Verify autoscaling settings are configured correctly
4. Consider implementing resource limits and quotas
5. URGENT: Cost has more than doubled - immediate investigation required

---
This is an automated alert from the FinOps Cost Monitoring system.
Please review the cost anomaly and take appropriate action.
```

### Usage Examples

#### Programmatic Usage

```typescript
import { AnomalyDetector, AlertEngine, AnomalyScheduler } from './plugins/finops';

// Initialize components
const anomalyDetector = new AnomalyDetector(anomalyConfig, costEngine);
const alertEngine = new AlertEngine(alertConfig);
const scheduler = new AnomalyScheduler(schedulerConfig, anomalyDetector, alertEngine);

// Start automated monitoring
scheduler.start();

// Manually detect anomalies
const anomalies = await anomalyDetector.detectAnomalies('my-service');

// Send alerts
for (const anomaly of anomalies) {
  await alertEngine.sendAlert(anomaly, 'my-service');
}

// Get unresolved anomalies
const unresolved = await anomalyDetector.getUnresolvedAnomalies('my-service');

// Resolve an anomaly
await anomalyDetector.resolveAnomaly(anomaly.id);

// Stop monitoring
scheduler.stop();
```

#### API Usage

```bash
# Get all anomalies for a service
curl http://localhost:7007/api/finops/anomalies/my-service

# Get only unresolved anomalies
curl http://localhost:7007/api/finops/anomalies/my-service?unresolved=true

# Manually trigger detection
curl -X POST http://localhost:7007/api/finops/anomalies/detect/my-service

# Resolve an anomaly
curl -X POST http://localhost:7007/api/finops/anomalies/anomaly_123/resolve

# Get scheduler status
curl http://localhost:7007/api/finops/anomalies/scheduler/status

# Manually run scheduler
curl -X POST http://localhost:7007/api/finops/anomalies/scheduler/run \
  -H "Content-Type: application/json" \
  -d '{"serviceId": "my-service"}'

# Update monitored services
curl -X POST http://localhost:7007/api/finops/anomalies/scheduler/services \
  -H "Content-Type: application/json" \
  -d '{"services": ["service-1", "service-2"]}'

# Test alert configuration
curl -X POST http://localhost:7007/api/finops/alerts/test
```

### Best Practices

1. **Configure Appropriate Thresholds**: Adjust thresholds based on your cost patterns and tolerance
2. **Monitor Multiple Services**: Add all critical services to the monitoring list
3. **Test Alerts**: Use the test endpoint to verify Slack/Email configuration
4. **Review Regularly**: Check anomaly history and adjust thresholds as needed
5. **Act on Recommendations**: Follow the actionable recommendations provided
6. **Resolve Anomalies**: Mark anomalies as resolved after investigation
7. **Tune Detection**: Adjust lookback period and check interval based on your needs

### Troubleshooting

#### No Anomalies Detected

- Check if services are configured in `finops.anomaly.services`
- Verify historical cost data is available
- Adjust thresholds if they're too high
- Check scheduler status with `/api/finops/anomalies/scheduler/status`

#### Alerts Not Sent

- Verify Slack webhook URL is correct
- Test alert configuration with `/api/finops/alerts/test`
- Check email SMTP settings
- Review logs for error messages

#### Too Many False Positives

- Increase detection thresholds
- Adjust lookback period for more stable baseline
- Consider excluding volatile services from monitoring

#### Scheduler Not Running

- Check `finops.anomaly.enabled` is set to `true`
- Verify services list is not empty
- Review logs for startup errors

### Future Enhancements

1. **Machine Learning Models**: Advanced anomaly detection using ML
2. **Cost Forecasting**: Predict future costs based on trends
3. **Automatic Remediation**: Auto-scaling or resource optimization
4. **Custom Alert Rules**: User-defined anomaly detection rules
5. **Integration with Incident Management**: Create incidents automatically
6. **Cost Attribution**: Link anomalies to specific deployments or changes

## Cost Efficiency Metrics

The FinOps plugin provides comprehensive cost efficiency metrics to help optimize resource utilization and reduce costs.

### Features

- **Cost per Request**: Calculate cost efficiency based on request volume
- **Cost per User**: Calculate cost efficiency based on active user count
- **Resource Utilization Analysis**: Track CPU, memory, and storage utilization
- **Cost Trend Analysis**: Compare current and previous period costs
- **Optimization Recommendations**: Actionable suggestions for cost reduction
- **Integration with Monitoring**: Fetch request and user data from Datadog
- **Caching**: 15-minute TTL cache for performance

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│   Cost Efficiency Calculator                            │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  calculateEfficiencyMetrics()                      │ │
│  │                                                    │ │
│  │  - getRequestVolumeData()                         │ │
│  │  - getUserVolumeData()                            │ │
│  │  - getResourceUtilization()                       │ │
│  │  - calculateCostTrend()                           │ │
│  │  - generateRecommendations()                      │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
           │
           ├─────────────────┬──────────────────┬──────────────────┐
           │                 │                  │                  │
           ▼                 ▼                  ▼                  ▼
    ┌─────────────┐   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  Cost       │   │  Datadog     │  │  OpenCost    │  │  Analytics   │
    │  Engine     │   │  API         │  │  API         │  │  System      │
    └─────────────┘   └──────────────┘  └──────────────┘  └──────────────┘
```

### Configuration

Add the following configuration to `app-config.yaml`:

```yaml
# Datadog configuration (for request and user metrics)
datadog:
  apiKey: ${DATADOG_API_KEY}
  appKey: ${DATADOG_APP_KEY}
  site: datadoghq.com  # or datadoghq.eu, us3.datadoghq.com, etc.
```

### Cost Efficiency API

#### GET /api/finops/efficiency/:serviceId

Get comprehensive cost efficiency metrics for a service.

**Query Parameters:**
- `timeRange` (optional): Time range for analysis (default: "30d")
  - Supported values: "7d", "30d", "90d"

**Response:**
```json
{
  "serviceId": "my-service",
  "period": {
    "start": "2024-01-01T00:00:00.000Z",
    "end": "2024-01-31T00:00:00.000Z"
  },
  "costPerRequest": 0.0012,
  "costPerUser": 15.50,
  "resourceUtilization": {
    "cpu": 65,
    "memory": 72,
    "storage": 58,
    "overall": 65
  },
  "costTrend": {
    "current": 450.50,
    "previous": 420.00,
    "changePercent": 7.26,
    "direction": "increasing"
  },
  "recommendations": [
    "CPU utilization is 65%. Resources are well-optimized.",
    "Memory utilization is 72%. Resources are well-optimized.",
    "Storage utilization is low (58%). Consider reducing storage allocation from 50GB to 35GB.",
    "Cost has increased by 7.3% compared to the previous period. Review recent changes and consider optimization."
  ],
  "calculatedAt": "2024-01-31T12:00:00.000Z"
}
```

### Metrics Explained

#### Cost per Request

Calculated by dividing total cost by total request volume over the period.

**Formula**: `Total Cost / Total Requests`

**Example**: $450.50 / 375,000 requests = $0.0012 per request

**Use Cases**:
- Compare cost efficiency across services
- Track cost efficiency improvements over time
- Identify services with high per-request costs
- Justify infrastructure investments

#### Cost per User

Calculated by dividing total cost by active user count over the period.

**Formula**: `Total Cost / Active Users`

**Example**: $450.50 / 2,500 users = $18.02 per user

**Use Cases**:
- Calculate customer acquisition cost (CAC)
- Determine pricing strategies
- Compare multi-tenant efficiency
- Track user growth vs. cost growth

#### Resource Utilization

Percentage of requested resources actually being used.

**Metrics**:
- **CPU Utilization**: Used CPU / Requested CPU × 100%
- **Memory Utilization**: Used Memory / Requested Memory × 100%
- **Storage Utilization**: Used Storage / Allocated Storage × 100%
- **Overall Utilization**: Average of CPU, Memory, and Storage

**Optimal Range**: 60-80% utilization
- **< 40%**: Over-provisioned, wasting money
- **40-60%**: Room for optimization
- **60-80%**: Well-optimized
- **> 85%**: Risk of performance issues

#### Cost Trend

Compares current period cost with previous period to identify trends.

**Directions**:
- **Increasing**: Cost increased by > 5%
- **Decreasing**: Cost decreased by > 5%
- **Stable**: Cost changed by < 5%

**Use Cases**:
- Identify cost growth patterns
- Detect unexpected cost increases
- Track cost optimization efforts
- Plan budget adjustments

### Optimization Recommendations

The system generates context-specific recommendations based on:

1. **Low CPU Utilization (< 40%)**:
   - Reduce CPU requests to save costs
   - Suggests specific reduction amounts

2. **High CPU Utilization (> 85%)**:
   - Increase CPU requests to prevent performance issues
   - Warns about potential bottlenecks

3. **Low Memory Utilization (< 40%)**:
   - Reduce memory requests to save costs
   - Suggests specific reduction amounts

4. **High Memory Utilization (> 85%)**:
   - Increase memory requests to prevent OOM errors
   - Warns about potential crashes

5. **Low Storage Utilization (< 30%)**:
   - Reduce storage allocation to save costs
   - Suggests specific reduction amounts

6. **High Storage Utilization (> 80%)**:
   - Increase storage allocation to prevent disk full errors
   - Warns about potential data loss

7. **Increasing Cost Trend (> 20%)**:
   - Review recent changes
   - Consider optimization strategies

8. **High Cost per Request (> $0.001)**:
   - Implement caching
   - Optimize database queries

9. **High Cost per User (> $10)**:
   - Implement multi-tenancy optimizations
   - Consider resource sharing

10. **Low Overall Utilization (< 50%)**:
    - Right-size resources
    - Improve cost efficiency

### Data Sources

#### Request Volume Data

**Primary Source**: Datadog APM
- Metric: `trace.http.request.hits`
- Aggregation: Sum over time period
- Filter: By service name

**Fallback**: Mock data for development/testing

#### User Volume Data

**Primary Source**: Datadog Custom Metrics or RUM
- Metric: `custom.active_users`
- Aggregation: Latest value
- Filter: By service name

**Fallback**: Mock data for development/testing

#### Resource Utilization Data

**Primary Source**: OpenCost API
- Metrics: CPU, Memory, Storage usage and requests
- Aggregation: Average over 24 hours
- Filter: By namespace (service name)

**Fallback**: Mock data for development/testing

### Frontend Integration

#### React Component

Use the `CostEfficiencyCard` component to display metrics in your Backstage UI:

```typescript
import { CostEfficiencyCard } from '@internal/plugin-opencost';

// In your EntityPage.tsx
<EntityLayout.Route path="/cost-efficiency" title="Cost Efficiency">
  <CostEfficiencyCard serviceId={entity.metadata.name} timeRange="30d" />
</EntityLayout.Route>
```

**Component Features**:
- Loading state with spinner
- Error handling with user-friendly messages
- Responsive design for mobile and desktop
- Color-coded utilization bars
- Trend indicators (up/down/flat)
- Expandable recommendations list
- Auto-refresh every 15 minutes (via cache)

### Usage Examples

#### Programmatic Usage

```typescript
import { CostEfficiencyCalculator } from './plugins/finops';

// Initialize calculator
const calculator = new CostEfficiencyCalculator(costEngine, {
  opencost: {
    baseUrl: 'http://localhost:9003',
  },
  monitoring: {
    datadogApiKey: process.env.DATADOG_API_KEY,
    datadogAppKey: process.env.DATADOG_APP_KEY,
    datadogSite: 'datadoghq.com',
  },
  cache: {
    ttl: 900, // 15 minutes
  },
});

// Calculate efficiency metrics
const metrics = await calculator.calculateEfficiencyMetrics('my-service', '30d');

console.log(`Cost per request: $${metrics.costPerRequest?.toFixed(4)}`);
console.log(`Cost per user: $${metrics.costPerUser?.toFixed(2)}`);
console.log(`Overall utilization: ${metrics.resourceUtilization.overall}%`);
console.log(`Cost trend: ${metrics.costTrend.direction} (${metrics.costTrend.changePercent}%)`);

// Print recommendations
metrics.recommendations.forEach((rec, i) => {
  console.log(`${i + 1}. ${rec}`);
});
```

#### API Usage

```bash
# Get cost efficiency metrics for a service
curl http://localhost:7007/api/finops/efficiency/my-service

# Get metrics for a specific time range
curl http://localhost:7007/api/finops/efficiency/my-service?timeRange=7d

# Get metrics for 90 days
curl http://localhost:7007/api/finops/efficiency/my-service?timeRange=90d
```

### Best Practices

1. **Monitor Regularly**: Check efficiency metrics weekly or monthly
2. **Act on Recommendations**: Implement suggested optimizations
3. **Track Trends**: Monitor cost trends to catch issues early
4. **Right-Size Resources**: Aim for 60-80% utilization
5. **Optimize High-Cost Services**: Focus on services with high per-request or per-user costs
6. **Integrate with CI/CD**: Add efficiency checks to deployment pipelines
7. **Set Efficiency Goals**: Define target metrics for your organization
8. **Review Quarterly**: Conduct quarterly cost efficiency reviews

### Troubleshooting

#### Null Cost per Request

- Verify request volume data is available in Datadog
- Check Datadog API credentials
- Ensure service name matches Datadog service tag
- Review Datadog metric query: `trace.http.request.hits{service:SERVICE_NAME}`

#### Null Cost per User

- Verify user volume data is available
- Check custom metric configuration: `custom.active_users{service:SERVICE_NAME}`
- Consider implementing user tracking if not available
- Use alternative metrics (e.g., sessions, transactions)

#### Inaccurate Utilization Data

- Verify OpenCost is properly configured
- Check namespace naming matches service ID
- Ensure OpenCost has access to Kubernetes metrics
- Review OpenCost API response format

#### No Recommendations

- Check if utilization is in optimal range (60-80%)
- Verify cost trend is stable (< 5% change)
- Ensure all metrics are calculated successfully
- Review recommendation generation logic

### Performance Considerations

1. **Caching**: All metrics are cached for 15 minutes
2. **Async Processing**: Long-running calculations are non-blocking
3. **Fallback Data**: Mock data ensures UI always renders
4. **Error Handling**: Graceful degradation when data sources are unavailable
5. **Batch Requests**: Multiple services can be queried efficiently

### Future Enhancements

1. **ML-Based Recommendations**: Use machine learning for smarter suggestions
2. **Cost Forecasting**: Predict future costs based on trends
3. **Benchmark Comparisons**: Compare against industry standards
4. **Custom Metrics**: Support for custom cost efficiency metrics
5. **Automated Optimization**: Auto-apply safe optimizations
6. **Multi-Cloud Support**: Extend to GCP, Azure, and other providers
7. **Cost Allocation**: Break down costs by team, project, or feature
8. **ROI Tracking**: Track return on investment for optimizations
