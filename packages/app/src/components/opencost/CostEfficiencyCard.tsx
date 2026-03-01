/**
 * Cost Efficiency Card Component
 * 
 * Displays cost efficiency metrics including:
 * - Cost per request
 * - Cost per user
 * - Resource utilization
 * - Cost trends
 * - Optimization recommendations
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  LinearProgress,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import TrendingDownIcon from '@material-ui/icons/TrendingDown';
import TrendingFlatIcon from '@material-ui/icons/TrendingFlat';
import { useApi, configApiRef } from '@backstage/core-plugin-api';

const useStyles = makeStyles(theme => ({
  card: {
    marginBottom: theme.spacing(2),
  },
  metricBox: {
    padding: theme.spacing(2),
    textAlign: 'center',
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
  },
  metricValue: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: theme.palette.primary.main,
  },
  metricLabel: {
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
  trendIcon: {
    verticalAlign: 'middle',
    marginLeft: theme.spacing(0.5),
  },
  trendUp: {
    color: theme.palette.error.main,
  },
  trendDown: {
    color: theme.palette.success.main,
  },
  trendFlat: {
    color: theme.palette.text.secondary,
  },
  utilizationBar: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  utilizationLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(0.5),
  },
  recommendationItem: {
    backgroundColor: theme.palette.background.default,
    marginBottom: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
}));

interface CostEfficiencyMetrics {
  serviceId: string;
  period: {
    start: string;
    end: string;
  };
  costPerRequest: number | null;
  costPerUser: number | null;
  resourceUtilization: {
    cpu: number;
    memory: number;
    storage: number;
    overall: number;
  };
  costTrend: {
    current: number;
    previous: number;
    changePercent: number;
    direction: 'increasing' | 'decreasing' | 'stable';
  };
  recommendations: string[];
  calculatedAt: string;
}

interface CostEfficiencyCardProps {
  serviceId: string;
  timeRange?: string;
}

export const CostEfficiencyCard: React.FC<CostEfficiencyCardProps> = ({
  serviceId,
  timeRange = '30d',
}) => {
  const classes = useStyles();
  const configApi = useApi(configApiRef);
  const [metrics, setMetrics] = useState<CostEfficiencyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);

        const backendUrl = configApi.getString('backend.baseUrl');
        const response = await fetch(
          `${backendUrl}/api/finops/efficiency/${serviceId}?timeRange=${timeRange}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch cost efficiency metrics: ${response.statusText}`);
        }

        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [serviceId, timeRange, configApi]);

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'increasing':
        return <TrendingUpIcon className={`${classes.trendIcon} ${classes.trendUp}`} />;
      case 'decreasing':
        return <TrendingDownIcon className={`${classes.trendIcon} ${classes.trendDown}`} />;
      default:
        return <TrendingFlatIcon className={`${classes.trendIcon} ${classes.trendFlat}`} />;
    }
  };

  const getUtilizationColor = (utilization: number): 'primary' | 'secondary' => {
    if (utilization < 40 || utilization > 85) {
      return 'secondary'; // Warning color
    }
    return 'primary'; // Good color
  };

  if (loading) {
    return (
      <Card className={classes.card}>
        <CardHeader title="Cost Efficiency Metrics" />
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
        <CardHeader title="Cost Efficiency Metrics" />
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <Card className={classes.card}>
      <CardHeader
        title="Cost Efficiency Metrics"
        subheader={`Period: ${new Date(metrics.period.start).toLocaleDateString()} - ${new Date(metrics.period.end).toLocaleDateString()}`}
      />
      <CardContent>
        <Grid container spacing={3}>
          {/* Cost Metrics */}
          <Grid item xs={12} md={6}>
            <Box className={classes.metricBox}>
              <Typography className={classes.metricValue}>
                {metrics.costPerRequest !== null
                  ? `$${metrics.costPerRequest.toFixed(4)}`
                  : 'N/A'}
              </Typography>
              <Typography className={classes.metricLabel}>Cost per Request</Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box className={classes.metricBox}>
              <Typography className={classes.metricValue}>
                {metrics.costPerUser !== null
                  ? `$${metrics.costPerUser.toFixed(2)}`
                  : 'N/A'}
              </Typography>
              <Typography className={classes.metricLabel}>Cost per User</Typography>
            </Box>
          </Grid>

          {/* Cost Trend */}
          <Grid item xs={12}>
            <Box className={classes.metricBox}>
              <Typography variant="h6" gutterBottom>
                Cost Trend
                {getTrendIcon(metrics.costTrend.direction)}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Current
                  </Typography>
                  <Typography variant="h6">${metrics.costTrend.current.toFixed(2)}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Previous
                  </Typography>
                  <Typography variant="h6">${metrics.costTrend.previous.toFixed(2)}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Change
                  </Typography>
                  <Typography variant="h6">
                    {metrics.costTrend.changePercent > 0 ? '+' : ''}
                    {metrics.costTrend.changePercent.toFixed(1)}%
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Grid>

          {/* Resource Utilization */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Resource Utilization
            </Typography>

            {/* CPU */}
            <Box className={classes.utilizationBar}>
              <Box className={classes.utilizationLabel}>
                <Typography variant="body2">CPU</Typography>
                <Typography variant="body2">{metrics.resourceUtilization.cpu}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={metrics.resourceUtilization.cpu}
                color={getUtilizationColor(metrics.resourceUtilization.cpu)}
              />
            </Box>

            {/* Memory */}
            <Box className={classes.utilizationBar}>
              <Box className={classes.utilizationLabel}>
                <Typography variant="body2">Memory</Typography>
                <Typography variant="body2">{metrics.resourceUtilization.memory}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={metrics.resourceUtilization.memory}
                color={getUtilizationColor(metrics.resourceUtilization.memory)}
              />
            </Box>

            {/* Storage */}
            <Box className={classes.utilizationBar}>
              <Box className={classes.utilizationLabel}>
                <Typography variant="body2">Storage</Typography>
                <Typography variant="body2">{metrics.resourceUtilization.storage}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={metrics.resourceUtilization.storage}
                color={getUtilizationColor(metrics.resourceUtilization.storage)}
              />
            </Box>

            {/* Overall */}
            <Box className={classes.utilizationBar}>
              <Box className={classes.utilizationLabel}>
                <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                  Overall
                </Typography>
                <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                  {metrics.resourceUtilization.overall.toFixed(0)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={metrics.resourceUtilization.overall}
                color={getUtilizationColor(metrics.resourceUtilization.overall)}
              />
            </Box>
          </Grid>

          {/* Recommendations */}
          {metrics.recommendations.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Optimization Recommendations
              </Typography>
              <List>
                {metrics.recommendations.map((recommendation, index) => (
                  <ListItem key={index} className={classes.recommendationItem}>
                    <ListItemText
                      primary={recommendation}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Grid>
          )}

          {/* Metadata */}
          <Grid item xs={12}>
            <Typography variant="caption" color="textSecondary">
              Last updated: {new Date(metrics.calculatedAt).toLocaleString()}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
