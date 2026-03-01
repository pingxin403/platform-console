# DORA Metrics Plugin

This plugin extends the `@devoteam-nl/open-dora-backstage-plugin` with custom data collection from multiple sources to calculate DORA (DevOps Research and Assessment) metrics, platform adoption analytics, developer NPS tracking, and bottleneck identification.

## Features

- **Multi-Source Data Collection**:
  - Argo CD: Deployment frequency and change failure rate
  - GitHub: Lead time for changes (PR metrics)
  - Jira/PagerDuty: Mean time to recovery (incident data)

- **DORA Metrics Calculation**:
  - Deployment Frequency
  - Lead Time for Changes
  - Change Failure Rate
  - Mean Time to Recovery (MTTR)

- **Performance Level Classification**:
  - Elite, High, Medium, Low performers based on industry benchmarks

- **Platform Adoption Analytics** (Task 19.2):
  - Daily/Weekly/Monthly Active Users (DAU/WAU/MAU)
  - Service creation rate and trends
  - Feature usage patterns
  - User engagement metrics

- **Developer NPS Tracking** (Task 19.3):
  - Net Promoter Score calculation
  - Feedback collection and categorization
  - Sentiment analysis
  - Trend tracking

- **Bottleneck Identification** (Task 19.4):
  - Workflow time analysis
  - High friction area detection
  - Impact quantification (affected users, average delay)
  - Actionable recommendations

- **Automatic Data Collection**:
  - Configurable collection intervals
  - Background processing
  - Error handling and retry logic

## Documentation

- [Platform Adoption Analytics](./adoption-tracker.ts) - Track platform usage and adoption metrics
- [Developer NPS Tracking](./NPS_README.md) - Collect and analyze developer satisfaction
- [Bottleneck Identification](./BOTTLENECK_README.md) - Identify and quantify workflow friction points

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DORA Data Collector                       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Argo CD    │  │   GitHub     │  │   Incident   │     │
│  │  Collector   │  │  Collector   │  │  Collector   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   ┌────────▼────────┐                       │
│                   │     Metrics     │                       │
│                   │   Calculator    │                       │
│                   └────────┬────────┘                       │
│                            │                                 │
│                   ┌────────▼────────┐                       │
│                   │  DORA Metrics   │                       │
│                   │   (Storage)     │                       │
│                   └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    DevEx Analytics                           │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Adoption   │  │     NPS      │  │  Bottleneck  │     │
│  │   Tracker    │  │   Tracker    │  │   Analyzer   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  - User activity    - Feedback       - Workflow timing      │
│  - Service creation - Satisfaction   - Friction detection   │
│  - Feature usage    - Trends         - Recommendations      │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

The plugin is configured through `app-config.yaml`:

```yaml
dora:
  # Argo CD configuration
  argocd:
    enabled: true
    apiUrl: ${ARGOCD_API_URL}
    token: ${ARGOCD_TOKEN}
    namespaces:
      - production
      - staging

  # GitHub configuration
  github:
    enabled: true
    token: ${GITHUB_TOKEN}
    organizations:
      - ${GITHUB_ORG}

  # Incident system configuration
  incidents:
    jira:
      enabled: ${JIRA_INTEGRATION_ENABLED:-false}
      serverUrl: ${JIRA_SERVER_URL}
      username: ${JIRA_USERNAME}
      apiToken: ${JIRA_API_TOKEN}
      projectKeys:
        - ${JIRA_PROJECT_KEYS}
    
    pagerduty:
      enabled: ${PAGERDUTY_INTEGRATION_ENABLED:-false}
      token: ${PAGERDUTY_API_TOKEN}
      serviceIds:
        - ${PAGERDUTY_SERVICE_IDS}

  # Collection settings
  collection:
    intervalMinutes: 60  # Collect data every hour
    lookbackDays: 30     # Look back 30 days for historical data
    batchSize: 100       # Process 100 records at a time

  # Performance level thresholds
  thresholds:
    deploymentFrequency:
      elite: 1.0    # >= 1 deployment per day
      high: 0.14    # >= 1 deployment per week
      medium: 0.03  # >= 1 deployment per month
    
    leadTime:
      elite: 24     # <= 24 hours
      high: 168     # <= 1 week
      medium: 720   # <= 1 month
    
    changeFailureRate:
      elite: 15     # <= 15%
      high: 20      # <= 20%
      medium: 30    # <= 30%
    
    mttr:
      elite: 1      # <= 1 hour
      high: 24      # <= 1 day
      medium: 168   # <= 1 week
```

## API Endpoints

### Health Check
```
GET /api/dora/health
```

### Manual Data Collection
```
POST /api/dora/collect
Body: {
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z"
}
```

### Calculate Service Metrics
```
POST /api/dora/metrics/service/:serviceId
Body: {
  "serviceName": "my-service",
  "period": "weekly",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z"
}
```

### Calculate All Service Metrics
```
POST /api/dora/metrics/all
Body: {
  "period": "weekly",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z"
}
```

### Run Full Collection Cycle
```
POST /api/dora/cycle
Body: {
  "period": "weekly"
}
```

### Get Data Summary
```
GET /api/dora/data/summary
```

## Usage

### Backend Integration

```typescript
import { createDORAPlugin } from './plugins/dora';
import { createLogger } from 'winston';

// Create logger
const logger = createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

// Create plugin
const doraPlugin = createDORAPlugin({
  logger,
  config: {
    argocd: {
      enabled: true,
      apiUrl: process.env.ARGOCD_API_URL!,
      token: process.env.ARGOCD_TOKEN!,
    },
    github: {
      enabled: true,
      token: process.env.GITHUB_TOKEN!,
      organizations: [process.env.GITHUB_ORG!],
    },
    incidents: {
      jira: {
        enabled: false,
      },
      pagerduty: {
        enabled: false,
      },
    },
    collection: {
      intervalMinutes: 60,
      lookbackDays: 30,
      batchSize: 100,
    },
    thresholds: {
      deploymentFrequency: { elite: 1.0, high: 0.14, medium: 0.03 },
      leadTime: { elite: 24, high: 168, medium: 720 },
      changeFailureRate: { elite: 15, high: 20, medium: 30 },
      mttr: { elite: 1, high: 24, medium: 168 },
    },
  },
});

// Register router
app.use('/api/dora', doraPlugin.createRouter());
```

## Data Models

### Deployment Data
```typescript
interface DeploymentData {
  serviceId: string;
  serviceName: string;
  environment: 'development' | 'staging' | 'production';
  deploymentId: string;
  revision: string;
  deployedAt: Date;
  status: 'success' | 'failed' | 'rollback';
  triggeredBy: string;
  duration: number;
}
```

### Pull Request Data
```typescript
interface PullRequestData {
  serviceId: string;
  serviceName: string;
  prNumber: number;
  title: string;
  createdAt: Date;
  mergedAt: Date | null;
  firstCommitAt: Date;
  author: string;
  linesAdded: number;
  linesDeleted: number;
  filesChanged: number;
  reviewers: string[];
  approvedAt: Date | null;
}
```

### Incident Data
```typescript
interface IncidentData {
  serviceId: string;
  serviceName: string;
  incidentId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  createdAt: Date;
  resolvedAt: Date | null;
  detectedAt: Date;
  acknowledgedAt: Date | null;
  relatedDeploymentId?: string;
  rootCause?: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'closed';
}
```

### DORA Metrics
```typescript
interface DORAMetrics {
  entityId: string;
  entityType: 'service' | 'team';
  entityName: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  
  deploymentFrequency: {
    value: number;
    unit: 'per_day' | 'per_week' | 'per_month';
    level: 'elite' | 'high' | 'medium' | 'low';
    rawData: { ... };
  };
  
  leadTimeForChanges: {
    value: number;
    unit: 'hours' | 'days';
    level: 'elite' | 'high' | 'medium' | 'low';
    rawData: { ... };
  };
  
  changeFailureRate: {
    value: number;
    level: 'elite' | 'high' | 'medium' | 'low';
    rawData: { ... };
  };
  
  meanTimeToRecovery: {
    value: number;
    unit: 'hours' | 'days';
    level: 'elite' | 'high' | 'medium' | 'low';
    rawData: { ... };
  };
  
  trend: 'improving' | 'stable' | 'declining';
  calculatedAt: Date;
  dataCompleteness: {
    deployments: boolean;
    pullRequests: boolean;
    incidents: boolean;
  };
}
```

## Error Handling

The plugin implements comprehensive error handling:

- **Retry Logic**: Failed API calls are retried with exponential backoff
- **Partial Success**: If one data source fails, others continue
- **Graceful Degradation**: Metrics are calculated with available data
- **Error Logging**: All errors are logged with context for debugging

## Performance Considerations

- **Batch Processing**: Data is collected in batches to avoid overwhelming APIs
- **Rate Limiting**: Respects API rate limits with appropriate delays
- **Caching**: Results are cached to reduce redundant calculations
- **Async Processing**: Long-running operations are processed asynchronously

## Testing

See the test files for examples:
- `argocd-collector.test.ts`
- `github-collector.test.ts`
- `incident-collector.test.ts`
- `metrics-calculator.test.ts`
- `data-collector.test.ts`

## Requirements

Validates: Requirements 6.1 - DORA Metrics and DevEx Analytics

## Related Documentation

- [DORA Metrics Overview](https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance)
- [OpenDORA Plugin](https://github.com/devoteam-nl/open-dora-backstage-plugin)
- [Backstage Plugin Development](https://backstage.io/docs/plugins/)


## Platform Adoption Analytics

In addition to DORA metrics, this plugin provides platform adoption analytics to track user activity, service creation, and feature usage.

### Features

- **User Activity Tracking**:
  - Daily Active Users (DAU)
  - Weekly Active Users (WAU)
  - Monthly Active Users (MAU)
  - User engagement metrics

- **Service Creation Tracking**:
  - Services created per period
  - Creation rate (services per week)
  - Breakdown by template and team
  - Creation trends

- **Feature Usage Analytics**:
  - Top features by usage count
  - Unique users per feature
  - Feature adoption rate
  - Least used features

- **Engagement Metrics**:
  - Average sessions per user
  - Average actions per session
  - Return rate
  - Power users identification

### Adoption Analytics Configuration

```yaml
dora:
  adoption:
    enabled: true
    retentionDays: 90  # Keep data for 90 days
    aggregation:
      dailySummaries: true
      weeklySummaries: true
    trackedFeatures:
      - catalog
      - scaffolder
      - techdocs
      - kubernetes
      - cicd
      - observability
      - finops
    privacy:
      anonymizeUsers: false
      excludedUsers:
        - admin
        - system
```

### Adoption Analytics API Endpoints

#### Track User Activity
```
POST /api/dora/adoption/activity
Body: {
  "userId": "user123",
  "userName": "John Doe",
  "email": "john@example.com",
  "action": "view_service",
  "feature": "catalog",
  "metadata": {
    "serviceId": "my-service"
  }
}
```

#### Track Service Creation
```
POST /api/dora/adoption/service-creation
Body: {
  "serviceId": "my-service",
  "serviceName": "My Service",
  "templateId": "go-service",
  "templateName": "Go Service",
  "createdBy": "user123",
  "team": "platform-team"
}
```

#### Get Adoption Metrics
```
GET /api/dora/adoption/metrics?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z
```

Response:
```json
{
  "success": true,
  "metrics": {
    "period": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-31T23:59:59Z"
    },
    "userActivity": {
      "dailyActiveUsers": 25,
      "weeklyActiveUsers": 45,
      "monthlyActiveUsers": 50,
      "totalUsers": 50,
      "activeUserTrend": "increasing"
    },
    "serviceCreation": {
      "totalServices": 120,
      "servicesCreatedInPeriod": 15,
      "creationRate": 3.75,
      "creationTrend": "stable",
      "byTemplate": {
        "Go Service": 8,
        "React App": 5,
        "Java Service": 2
      },
      "byTeam": {
        "platform-team": 7,
        "backend-team": 5,
        "frontend-team": 3
      }
    },
    "featureUsage": {
      "topFeatures": [
        {
          "feature": "catalog",
          "displayName": "Service Catalog",
          "usageCount": 1250,
          "uniqueUsers": 45
        },
        {
          "feature": "scaffolder",
          "displayName": "Project Templates",
          "usageCount": 320,
          "uniqueUsers": 30
        }
      ],
      "totalFeatureUsage": 2500,
      "featureAdoptionRate": 85.5
    },
    "engagement": {
      "averageSessionsPerUser": 4.2,
      "averageActionsPerSession": 8.5,
      "returnRate": 78.5,
      "powerUsers": 12
    }
  }
}
```

#### Get Activity Summary
```
GET /api/dora/adoption/activity/summary
```

### Frontend Integration

Use the `AdoptionMetricsCard` component to display adoption metrics:

```typescript
import { AdoptionMetricsCard } from '@internal/plugin-dora';

// In your component
<AdoptionMetricsCard 
  apiUrl="/api/dora/adoption/metrics"
  period={30}  // Last 30 days
/>
```

### Adoption Data Models

#### User Activity
```typescript
interface UserActivity {
  userId: string;
  userName: string;
  email: string;
  timestamp: Date;
  action: string;
  feature: string;
  metadata?: Record<string, any>;
}
```

#### Service Creation Event
```typescript
interface ServiceCreationEvent {
  serviceId: string;
  serviceName: string;
  templateId: string;
  templateName: string;
  createdBy: string;
  createdAt: Date;
  team: string;
}
```

#### Adoption Metrics
```typescript
interface AdoptionMetrics {
  period: {
    start: Date;
    end: Date;
  };
  userActivity: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    totalUsers: number;
    activeUserTrend: 'increasing' | 'stable' | 'decreasing';
  };
  serviceCreation: {
    totalServices: number;
    servicesCreatedInPeriod: number;
    creationRate: number;
    creationTrend: 'increasing' | 'stable' | 'decreasing';
    byTemplate: Record<string, number>;
    byTeam: Record<string, number>;
  };
  featureUsage: {
    topFeatures: FeatureUsage[];
    totalFeatureUsage: number;
    featureAdoptionRate: number;
    leastUsedFeatures: FeatureUsage[];
  };
  engagement: {
    averageSessionsPerUser: number;
    averageActionsPerSession: number;
    returnRate: number;
    powerUsers: number;
  };
  calculatedAt: Date;
}
```

### Privacy Considerations

The adoption analytics system includes privacy features:

- **User Anonymization**: Optionally anonymize user IDs and personal information
- **Excluded Users**: Exclude specific users (e.g., admins, test accounts) from tracking
- **Data Retention**: Automatically clean up old data based on retention policy
- **Aggregated Metrics**: All metrics are aggregated and don't expose individual user behavior

### Testing

See `adoption-tracker.test.ts` for comprehensive test examples.

### Requirements

Validates: Requirements 6.2 - Platform Adoption Rate Analysis


## Developer NPS (Net Promoter Score)

The plugin includes comprehensive NPS tracking to measure developer satisfaction and identify improvement areas.

### Features

- **NPS Feedback Collection**: 0-10 scale surveys with optional comments
- **Score Calculation**: Automatic NPS calculation (-100 to 100)
- **Trend Analysis**: Track score changes over time
- **Category Breakdown**: NPS by platform area (deployment, cost, etc.)
- **Pain Point Identification**: Automatically identify recurring issues
- **Sentiment Analysis**: Detect positive/neutral/negative feedback
- **Survey Eligibility**: Smart scheduling to prevent survey fatigue

### NPS Configuration

```yaml
dora:
  nps:
    enabled: true
    trigger:
      daysAfterFirstUse: 7
      recurringIntervalDays: 90
      maxSurveysPerYear: 4
    content:
      question: "How likely are you to recommend this platform to a colleague?"
      followUpQuestion: "What is the main reason for your score?"
      thankYouMessage: "Thank you for your feedback!"
    analysis:
      minResponsesForTrend: 5
      sentimentAnalysis: true
      autoCategorize: true
    notifications:
      notifyOnLowScore: true
      lowScoreThreshold: 6
      channels:
        - slack
        - email
```

### NPS API Endpoints

#### Submit NPS Feedback
```
POST /api/dora/nps/feedback
Body: {
  "userId": "user:default/john.doe",
  "userName": "John Doe",
  "email": "john.doe@example.com",
  "score": 9,
  "comment": "Great platform!",
  "category": "ease_of_use"
}
```

#### Get NPS Analytics
```
GET /api/dora/nps/analytics?startDate=2024-01-01&endDate=2024-01-31
```

#### Check Survey Eligibility
```
GET /api/dora/nps/eligibility/:userId
```

#### Get Feedback Summary
```
GET /api/dora/nps/feedback/summary
```

### Frontend Components

#### NPSSurveyCard
Display an NPS survey to collect developer feedback:

```typescript
import { NPSSurveyCard } from '@internal/plugin-dora';

<NPSSurveyCard
  autoShow={true}
  onSubmit={(score, comment, category) => {
    console.log('Feedback submitted:', { score, comment, category });
  }}
/>
```

#### NPSAnalyticsCard
Display comprehensive NPS analytics:

```typescript
import { NPSAnalyticsCard } from '@internal/plugin-dora';

<NPSAnalyticsCard
  startDate={new Date('2024-01-01')}
  endDate={new Date('2024-01-31')}
/>
```

### NPS Score Interpretation

- **50 to 100**: Excellent - Strong promoter base
- **0 to 49**: Good - More promoters than detractors
- **-1 to -100**: Needs Improvement - More detractors than promoters

### Detailed Documentation

See [NPS_README.md](./NPS_README.md) for comprehensive NPS documentation including:
- Detailed configuration options
- API endpoint specifications
- React component usage
- Pain point detection algorithm
- Best practices and monitoring

### Testing

See `nps-tracker.test.ts` for comprehensive test examples covering:
- Feedback submission and validation
- Survey eligibility checks
- NPS score calculation
- Trend analysis
- Pain point identification
- Sentiment analysis
- Auto-categorization

### Requirements

Validates: Requirements 6.3 - Developer NPS Collection and Analysis
