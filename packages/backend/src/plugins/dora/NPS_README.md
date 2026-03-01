# Developer NPS (Net Promoter Score) Collection and Analysis

## Overview

The NPS module provides comprehensive developer satisfaction tracking through Net Promoter Score surveys. It collects feedback, calculates NPS scores (-100 to 100), analyzes trends, identifies pain points, and provides actionable insights to improve the platform.

## Features

### 1. NPS Feedback Collection
- **Score Range**: 0-10 scale (standard NPS format)
- **Categories**: Promoters (9-10), Passives (7-8), Detractors (0-6)
- **Optional Comments**: Free-text feedback for qualitative insights
- **Category Classification**: Auto-categorize feedback by platform area
- **Sentiment Analysis**: Automatic sentiment detection (positive/neutral/negative)

### 2. Survey Eligibility Management
- **Recurring Surveys**: Configurable interval between surveys (default: 90 days)
- **Rate Limiting**: Maximum surveys per user per year (default: 4)
- **Eligibility Checks**: Prevent survey fatigue with smart scheduling

### 3. NPS Analytics
- **Overall NPS Score**: Calculated as % Promoters - % Detractors
- **Trend Analysis**: Track score changes over time with weekly data points
- **Category Breakdown**: NPS scores by platform area (deployment, cost, etc.)
- **Pain Point Identification**: Automatically identify recurring issues
- **Response Rate Tracking**: Monitor survey participation

### 4. Insights Generation
- **Top Feedback Themes**: Extract common positive and negative themes
- **Pain Points**: Identify high-severity issues affecting multiple users
- **Sentiment Distribution**: Track positive/neutral/negative feedback ratios
- **Actionable Recommendations**: Suggestions based on feedback patterns

## Configuration

### Backend Configuration

```typescript
const npsConfig: NPSSurveyConfig = {
  enabled: true,
  
  trigger: {
    daysAfterFirstUse: 7,           // Show survey after 7 days of platform use
    recurringIntervalDays: 90,       // Show survey every 90 days
    maxSurveysPerYear: 4,            // Maximum 4 surveys per user per year
  },
  
  content: {
    question: 'How likely are you to recommend this platform to a colleague?',
    followUpQuestion: 'What is the main reason for your score?',
    thankYouMessage: 'Thank you for your feedback!',
  },
  
  analysis: {
    minResponsesForTrend: 5,         // Minimum responses for trend analysis
    sentimentAnalysis: true,          // Enable sentiment analysis
    autoCategorize: true,             // Auto-categorize feedback
  },
  
  notifications: {
    notifyOnLowScore: true,           // Notify on low scores
    lowScoreThreshold: 6,             // Threshold for low score alerts
    channels: ['slack', 'email'],     // Notification channels
  },
};
```

### Initialize Plugin

```typescript
import { createDORAPlugin } from './plugins/dora';

const doraPlugin = createDORAPlugin({
  logger,
  config: doraConfig,
  adoptionConfig,
  npsConfig,  // Add NPS configuration
});
```

## API Endpoints

### Submit NPS Feedback

```http
POST /api/dora/nps/feedback
Content-Type: application/json

{
  "userId": "user:default/john.doe",
  "userName": "John Doe",
  "email": "john.doe@example.com",
  "score": 9,
  "comment": "Great platform, very easy to use!",
  "category": "ease_of_use"
}
```

**Response:**
```json
{
  "success": true,
  "feedbackId": "nps-1234567890-abc123",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Get NPS Analytics

```http
GET /api/dora/nps/analytics?startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "analytics": {
    "period": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-31T23:59:59Z"
    },
    "overall": {
      "score": 45,
      "responseCount": 50,
      "promoters": 25,
      "passives": 15,
      "detractors": 10,
      "promoterPercentage": 50.0,
      "passivePercentage": 30.0,
      "detractorPercentage": 20.0
    },
    "trend": {
      "current": { ... },
      "previous": { ... },
      "change": 10,
      "direction": "improving",
      "dataPoints": [ ... ]
    },
    "categoryBreakdown": [ ... ],
    "topFeedback": {
      "positive": [ ... ],
      "negative": [ ... ],
      "suggestions": [ ... ]
    },
    "painPoints": [ ... ],
    "responseRate": {
      "totalUsers": 100,
      "respondents": 50,
      "percentage": 50.0
    }
  }
}
```

### Check Survey Eligibility

```http
GET /api/dora/nps/eligibility/:userId
```

**Response:**
```json
{
  "eligible": true,
  "surveysCompletedThisYear": 2
}
```

Or if not eligible:
```json
{
  "eligible": false,
  "reason": "Please wait 45 more days before next survey",
  "nextEligibleDate": "2024-03-01T00:00:00Z",
  "surveysCompletedThisYear": 3
}
```

### Get Feedback Summary

```http
GET /api/dora/nps/feedback/summary
```

**Response:**
```json
{
  "total": 150,
  "averageScore": 7.8,
  "distribution": {
    "promoters": 75,
    "passives": 45,
    "detractors": 30
  },
  "withComments": 120,
  "categorized": 135,
  "oldest": "2023-12-01T00:00:00Z",
  "newest": "2024-01-31T23:59:59Z"
}
```

## React Components

### NPSSurveyCard

Display an NPS survey to collect developer feedback.

```tsx
import { NPSSurveyCard } from '@internal/plugin-dora';

<NPSSurveyCard
  autoShow={true}
  onSubmit={(score, comment, category) => {
    console.log('Feedback submitted:', { score, comment, category });
  }}
/>
```

**Props:**
- `autoShow` (boolean): Automatically check eligibility and show survey
- `onSubmit` (function): Callback when feedback is submitted

### NPSAnalyticsCard

Display comprehensive NPS analytics and insights.

```tsx
import { NPSAnalyticsCard } from '@internal/plugin-dora';

<NPSAnalyticsCard
  startDate={new Date('2024-01-01')}
  endDate={new Date('2024-01-31')}
/>
```

**Props:**
- `startDate` (Date): Start date for analytics period
- `endDate` (Date): End date for analytics period

## NPS Score Interpretation

### Score Ranges
- **50 to 100**: Excellent - Strong promoter base
- **0 to 49**: Good - More promoters than detractors
- **-1 to -100**: Needs Improvement - More detractors than promoters

### Industry Benchmarks
- **Elite**: NPS > 70
- **High**: NPS 50-70
- **Medium**: NPS 0-50
- **Low**: NPS < 0

## Feedback Categories

The system automatically categorizes feedback into these areas:

- **service_catalog**: Service discovery and catalog features
- **golden_paths**: Templates and scaffolding
- **deployment**: Deployment and GitOps features
- **observability**: Monitoring, logging, and error tracking
- **cost_management**: FinOps and cost optimization
- **documentation**: TechDocs and documentation
- **performance**: Platform speed and responsiveness
- **ease_of_use**: User experience and usability
- **support**: Help and support resources
- **other**: Uncategorized feedback

## Pain Point Detection

The system automatically identifies pain points based on:

1. **Frequency**: Number of users reporting the same issue
2. **Severity**: 
   - High: 5+ reports
   - Medium: 3-4 reports
   - Low: 2 reports
3. **Affected Users**: Number of unique users impacted
4. **Category**: Platform area affected

## Best Practices

### Survey Timing
- Show surveys after users have meaningful platform experience (7+ days)
- Avoid survey fatigue with 90-day intervals
- Limit to 4 surveys per user per year

### Feedback Analysis
- Review NPS analytics monthly
- Focus on pain points with high severity
- Track trend direction (improving/stable/declining)
- Act on detractor feedback promptly

### Response Management
- Acknowledge low scores (≤6) within 24 hours
- Follow up with detractors to understand issues
- Share positive feedback with the team
- Implement improvements based on suggestions

## Testing

Run the NPS tracker tests:

```bash
cd packages/backend
npm test -- nps-tracker.test.ts --no-watch
```

The test suite covers:
- Feedback submission and validation
- Survey eligibility checks
- NPS score calculation
- Trend analysis
- Pain point identification
- Sentiment analysis
- Auto-categorization

## Monitoring

### Key Metrics to Track
1. **NPS Score**: Overall satisfaction trend
2. **Response Rate**: Survey participation percentage
3. **Category Scores**: Identify weak areas
4. **Pain Points**: Track issue resolution
5. **Trend Direction**: Monitor improvement over time

### Alerts
- Low NPS scores (≤6) trigger notifications
- High-severity pain points alert platform team
- Declining trends trigger review meetings

## Future Enhancements

Potential improvements for future iterations:

1. **Advanced Sentiment Analysis**: ML-based sentiment detection
2. **Predictive Analytics**: Predict NPS trends
3. **Automated Follow-ups**: Trigger follow-up surveys for detractors
4. **Integration with Support**: Link feedback to support tickets
5. **Benchmarking**: Compare with industry standards
6. **A/B Testing**: Test platform changes impact on NPS

## References

- [Net Promoter Score Methodology](https://www.netpromoter.com/know/)
- [NPS Best Practices](https://www.qualtrics.com/experience-management/customer/net-promoter-score/)
- Design Document: `design.md` (Section 6: DORA Metrics and DevEx Analytics)
- Requirements: `requirements.md` (Requirement 6.3)
