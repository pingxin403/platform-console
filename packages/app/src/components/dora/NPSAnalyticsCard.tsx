/**
 * NPS Analytics Card Component
 * 
 * Displays NPS analytics including score, trends, category breakdown,
 * and pain points identified from developer feedback.
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Grid,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Paper,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { makeStyles } from '@material-ui/core/styles';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import TrendingDownIcon from '@material-ui/icons/TrendingDown';
import TrendingFlatIcon from '@material-ui/icons/TrendingFlat';
import ThumbUpIcon from '@material-ui/icons/ThumbUp';
import ThumbDownIcon from '@material-ui/icons/ThumbDown';
import WarningIcon from '@material-ui/icons/Warning';
import { useApi, configApiRef } from '@backstage/core-plugin-api';

const useStyles = makeStyles(theme => ({
  card: {
    marginBottom: theme.spacing(2),
  },
  npsScore: {
    fontSize: '64px',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: theme.spacing(1),
  },
  npsScorePositive: {
    color: theme.palette.success.main,
  },
  npsScoreNeutral: {
    color: theme.palette.warning.main,
  },
  npsScoreNegative: {
    color: theme.palette.error.main,
  },
  trendIcon: {
    verticalAlign: 'middle',
    marginLeft: theme.spacing(1),
  },
  categoryCard: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  painPointCard: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1),
    borderLeft: `4px solid ${theme.palette.error.main}`,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginTop: theme.spacing(1),
  },
  sectionTitle: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
  },
  feedbackList: {
    maxHeight: 300,
    overflow: 'auto',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
}));

interface NPSAnalyticsCardProps {
  startDate?: Date;
  endDate?: Date;
}

export const NPSAnalyticsCard: React.FC<NPSAnalyticsCardProps> = ({
  startDate,
  endDate,
}) => {
  const classes = useStyles();
  const configApi = useApi(configApiRef);

  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = configApi.getString('backend.baseUrl');

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate || new Date();

      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });

      const response = await fetch(`${backendUrl}/api/dora/nps/analytics?${params}`);
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.analytics);
      } else {
        setError(data.errors?.join(', ') || 'Failed to load NPS analytics');
      }
    } catch (err) {
      console.error('Failed to fetch NPS analytics:', err);
      setError('Failed to load NPS analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getNPSScoreClass = (score: number) => {
    if (score >= 50) return classes.npsScorePositive;
    if (score >= 0) return classes.npsScoreNeutral;
    return classes.npsScoreNegative;
  };

  const getTrendIcon = (direction: string) => {
    if (direction === 'improving') {
      return <TrendingUpIcon className={classes.trendIcon} style={{ color: '#4caf50' }} />;
    }
    if (direction === 'declining') {
      return <TrendingDownIcon className={classes.trendIcon} style={{ color: '#f44336' }} />;
    }
    return <TrendingFlatIcon className={classes.trendIcon} style={{ color: '#ff9800' }} />;
  };

  const getSeverityColor = (severity: string): 'default' | 'primary' | 'secondary' => {
    switch (severity) {
      case 'high':
        return 'secondary';
      case 'medium':
        return 'primary';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Card className={classes.card}>
        <CardContent>
          <Box className={classes.loading}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={classes.card}>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card className={classes.card}>
        <CardContent>
          <Alert severity="info">No NPS data available for the selected period.</Alert>
        </CardContent>
      </Card>
    );
  }

  const { overall, trend, categoryBreakdown, topFeedback, painPoints, responseRate } = analytics;

  return (
    <Card className={classes.card}>
      <CardHeader
        title="Developer NPS Analytics"
        subheader={`${new Date(analytics.period.start).toLocaleDateString()} - ${new Date(
          analytics.period.end,
        ).toLocaleDateString()}`}
      />
      <CardContent>
        {/* Overall NPS Score */}
        <Box textAlign="center" mb={4}>
          <Typography variant="h6" color="textSecondary">
            Net Promoter Score
          </Typography>
          <Typography className={`${classes.npsScore} ${getNPSScoreClass(overall.score)}`}>
            {overall.score}
          </Typography>
          <Box display="flex" justifyContent="center" alignItems="center">
            <Typography variant="body1" color="textSecondary">
              {trend.direction.charAt(0).toUpperCase() + trend.direction.slice(1)}
            </Typography>
            {getTrendIcon(trend.direction)}
            {trend.previous && (
              <Typography variant="body2" color="textSecondary" style={{ marginLeft: 8 }}>
                ({trend.change > 0 ? '+' : ''}
                {trend.change} from previous period)
              </Typography>
            )}
          </Box>
        </Box>

        {/* Distribution */}
        <Grid container spacing={3} style={{ marginBottom: 24 }}>
          <Grid item xs={4}>
            <Box textAlign="center">
              <ThumbUpIcon style={{ color: '#4caf50', fontSize: 32 }} />
              <Typography variant="h6">{overall.promoters}</Typography>
              <Typography variant="body2" color="textSecondary">
                Promoters ({overall.promoterPercentage}%)
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box textAlign="center">
              <Typography variant="h6" style={{ color: '#ff9800', fontSize: 32 }}>
                😐
              </Typography>
              <Typography variant="h6">{overall.passives}</Typography>
              <Typography variant="body2" color="textSecondary">
                Passives ({overall.passivePercentage}%)
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box textAlign="center">
              <ThumbDownIcon style={{ color: '#f44336', fontSize: 32 }} />
              <Typography variant="h6">{overall.detractors}</Typography>
              <Typography variant="body2" color="textSecondary">
                Detractors ({overall.detractorPercentage}%)
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Divider />

        {/* Response Rate */}
        <Box mt={3} mb={3}>
          <Typography variant="subtitle1" gutterBottom>
            Response Rate
          </Typography>
          <Box display="flex" alignItems="center">
            <Box flexGrow={1} mr={2}>
              <LinearProgress
                variant="determinate"
                value={responseRate.percentage}
                className={classes.progressBar}
              />
            </Box>
            <Typography variant="body2" color="textSecondary">
              {responseRate.respondents} / {responseRate.totalUsers} ({responseRate.percentage}%)
            </Typography>
          </Box>
        </Box>

        <Divider />

        {/* Category Breakdown */}
        {categoryBreakdown && categoryBreakdown.length > 0 && (
          <>
            <Typography variant="h6" className={classes.sectionTitle}>
              Category Breakdown
            </Typography>
            <Grid container spacing={2}>
              {categoryBreakdown.map((cat: any) => (
                <Grid item xs={12} md={6} key={cat.category}>
                  <Paper className={classes.categoryCard}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="subtitle1">
                        {cat.category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </Typography>
                      <Chip
                        label={`NPS: ${cat.npsScore}`}
                        color={cat.npsScore >= 0 ? 'primary' : 'secondary'}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Avg Score: {cat.averageScore} | Responses: {cat.count}
                    </Typography>
                    {cat.topIssues && cat.topIssues.length > 0 && (
                      <Typography variant="caption" color="textSecondary">
                        Top issue: {cat.topIssues[0]}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </>
        )}

        {/* Pain Points */}
        {painPoints && painPoints.length > 0 && (
          <>
            <Typography variant="h6" className={classes.sectionTitle}>
              <WarningIcon style={{ verticalAlign: 'middle', marginRight: 8 }} />
              Identified Pain Points
            </Typography>
            {painPoints.slice(0, 5).map((pain: any) => (
              <Paper key={pain.id} className={classes.painPointCard}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2">{pain.description}</Typography>
                  <Chip label={pain.severity} color={getSeverityColor(pain.severity)} size="small" />
                </Box>
                <Typography variant="body2" color="textSecondary">
                  Frequency: {pain.frequency} reports | Affected users: {pain.affectedUsers}
                </Typography>
                {pain.examples && pain.examples.length > 0 && (
                  <Typography variant="caption" color="textSecondary" style={{ marginTop: 8, display: 'block' }}>
                    Example: "{pain.examples[0]}"
                  </Typography>
                )}
              </Paper>
            ))}
          </>
        )}

        {/* Top Feedback */}
        {topFeedback && (
          <>
            <Typography variant="h6" className={classes.sectionTitle}>
              Top Feedback Themes
            </Typography>
            <Grid container spacing={2}>
              {topFeedback.positive && topFeedback.positive.length > 0 && (
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom style={{ color: '#4caf50' }}>
                    👍 Positive
                  </Typography>
                  <List dense className={classes.feedbackList}>
                    {topFeedback.positive.slice(0, 5).map((feedback: string, index: number) => (
                      <ListItem key={index}>
                        <ListItemText primary={feedback} />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              )}
              {topFeedback.negative && topFeedback.negative.length > 0 && (
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom style={{ color: '#f44336' }}>
                    👎 Negative
                  </Typography>
                  <List dense className={classes.feedbackList}>
                    {topFeedback.negative.slice(0, 5).map((feedback: string, index: number) => (
                      <ListItem key={index}>
                        <ListItemText primary={feedback} />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              )}
            </Grid>
          </>
        )}
      </CardContent>
    </Card>
  );
};
