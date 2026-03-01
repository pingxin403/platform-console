/**
 * Platform Adoption Metrics Card Component
 * 
 * Displays platform adoption metrics including DAU, WAU, service creation rate,
 * and feature usage statistics.
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Grid,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import TrendingDownIcon from '@material-ui/icons/TrendingDown';
import TrendingFlatIcon from '@material-ui/icons/TrendingFlat';
import PeopleIcon from '@material-ui/icons/People';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import TouchAppIcon from '@material-ui/icons/TouchApp';

const useStyles = makeStyles(theme => ({
  card: {
    marginBottom: theme.spacing(2),
  },
  metricBox: {
    padding: theme.spacing(2),
    textAlign: 'center',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.default,
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
  trendChip: {
    marginTop: theme.spacing(1),
  },
  sectionTitle: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
    fontWeight: 600,
  },
  featureTable: {
    marginTop: theme.spacing(2),
  },
  iconBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(1),
  },
}));

interface AdoptionMetrics {
  period: {
    start: string;
    end: string;
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
    topFeatures: Array<{
      feature: string;
      displayName: string;
      usageCount: number;
      uniqueUsers: number;
    }>;
    totalFeatureUsage: number;
    featureAdoptionRate: number;
  };
  engagement: {
    averageSessionsPerUser: number;
    averageActionsPerSession: number;
    returnRate: number;
    powerUsers: number;
  };
}

interface AdoptionMetricsCardProps {
  apiUrl?: string;
  period?: number; // days
}

export const AdoptionMetricsCard: React.FC<AdoptionMetricsCardProps> = ({
  apiUrl = '/api/dora/adoption/metrics',
  period = 30,
}) => {
  const classes = useStyles();
  const [metrics, setMetrics] = useState<AdoptionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);

        const endDate = new Date();
        const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

        const response = await fetch(
          `${apiUrl}?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch adoption metrics: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
          setMetrics(data.metrics);
        } else {
          throw new Error(data.errors?.join(', ') || 'Failed to fetch metrics');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [apiUrl, period]);

  const getTrendIcon = (trend: 'increasing' | 'stable' | 'decreasing') => {
    switch (trend) {
      case 'increasing':
        return <TrendingUpIcon style={{ color: '#4caf50' }} />;
      case 'decreasing':
        return <TrendingDownIcon style={{ color: '#f44336' }} />;
      default:
        return <TrendingFlatIcon style={{ color: '#ff9800' }} />;
    }
  };

  const getTrendColor = (trend: 'increasing' | 'stable' | 'decreasing') => {
    switch (trend) {
      case 'increasing':
        return 'primary';
      case 'decreasing':
        return 'secondary';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Card className={classes.card}>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
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

  if (!metrics) {
    return (
      <Card className={classes.card}>
        <CardContent>
          <Alert severity="info">No adoption metrics available</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={classes.card}>
      <CardHeader
        title="Platform Adoption Metrics"
        subheader={`Period: ${new Date(metrics.period.start).toLocaleDateString()} - ${new Date(metrics.period.end).toLocaleDateString()}`}
      />
      <CardContent>
        {/* User Activity Metrics */}
        <Typography variant="h6" className={classes.sectionTitle}>
          User Activity
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Box className={classes.metricBox}>
              <Box className={classes.iconBox}>
                <PeopleIcon color="primary" />
              </Box>
              <Typography className={classes.metricValue}>
                {metrics.userActivity.dailyActiveUsers}
              </Typography>
              <Typography className={classes.metricLabel}>Daily Active Users</Typography>
              <Chip
                icon={getTrendIcon(metrics.userActivity.activeUserTrend)}
                label={metrics.userActivity.activeUserTrend}
                size="small"
                color={getTrendColor(metrics.userActivity.activeUserTrend) as any}
                className={classes.trendChip}
              />
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box className={classes.metricBox}>
              <Box className={classes.iconBox}>
                <PeopleIcon color="primary" />
              </Box>
              <Typography className={classes.metricValue}>
                {metrics.userActivity.weeklyActiveUsers}
              </Typography>
              <Typography className={classes.metricLabel}>Weekly Active Users</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box className={classes.metricBox}>
              <Box className={classes.iconBox}>
                <PeopleIcon color="primary" />
              </Box>
              <Typography className={classes.metricValue}>
                {metrics.userActivity.monthlyActiveUsers}
              </Typography>
              <Typography className={classes.metricLabel}>Monthly Active Users</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box className={classes.metricBox}>
              <Box className={classes.iconBox}>
                <PeopleIcon color="primary" />
              </Box>
              <Typography className={classes.metricValue}>
                {metrics.userActivity.totalUsers}
              </Typography>
              <Typography className={classes.metricLabel}>Total Users</Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Service Creation Metrics */}
        <Typography variant="h6" className={classes.sectionTitle}>
          Service Creation
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={4}>
            <Box className={classes.metricBox}>
              <Box className={classes.iconBox}>
                <AddCircleIcon color="primary" />
              </Box>
              <Typography className={classes.metricValue}>
                {metrics.serviceCreation.servicesCreatedInPeriod}
              </Typography>
              <Typography className={classes.metricLabel}>Services Created</Typography>
              <Chip
                icon={getTrendIcon(metrics.serviceCreation.creationTrend)}
                label={metrics.serviceCreation.creationTrend}
                size="small"
                color={getTrendColor(metrics.serviceCreation.creationTrend) as any}
                className={classes.trendChip}
              />
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Box className={classes.metricBox}>
              <Box className={classes.iconBox}>
                <AddCircleIcon color="primary" />
              </Box>
              <Typography className={classes.metricValue}>
                {metrics.serviceCreation.creationRate.toFixed(1)}
              </Typography>
              <Typography className={classes.metricLabel}>Services per Week</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Box className={classes.metricBox}>
              <Box className={classes.iconBox}>
                <AddCircleIcon color="primary" />
              </Box>
              <Typography className={classes.metricValue}>
                {metrics.serviceCreation.totalServices}
              </Typography>
              <Typography className={classes.metricLabel}>Total Services</Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Engagement Metrics */}
        <Typography variant="h6" className={classes.sectionTitle}>
          User Engagement
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Box className={classes.metricBox}>
              <Box className={classes.iconBox}>
                <TouchAppIcon color="primary" />
              </Box>
              <Typography className={classes.metricValue}>
                {metrics.engagement.averageSessionsPerUser.toFixed(1)}
              </Typography>
              <Typography className={classes.metricLabel}>Avg Sessions/User</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box className={classes.metricBox}>
              <Box className={classes.iconBox}>
                <TouchAppIcon color="primary" />
              </Box>
              <Typography className={classes.metricValue}>
                {metrics.engagement.averageActionsPerSession.toFixed(1)}
              </Typography>
              <Typography className={classes.metricLabel}>Avg Actions/Session</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box className={classes.metricBox}>
              <Box className={classes.iconBox}>
                <TouchAppIcon color="primary" />
              </Box>
              <Typography className={classes.metricValue}>
                {metrics.engagement.returnRate.toFixed(1)}%
              </Typography>
              <Typography className={classes.metricLabel}>Return Rate</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box className={classes.metricBox}>
              <Box className={classes.iconBox}>
                <TouchAppIcon color="primary" />
              </Box>
              <Typography className={classes.metricValue}>
                {metrics.engagement.powerUsers}
              </Typography>
              <Typography className={classes.metricLabel}>Power Users</Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Top Features */}
        <Typography variant="h6" className={classes.sectionTitle}>
          Top Features
        </Typography>
        <TableContainer component={Paper} className={classes.featureTable}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Feature</TableCell>
                <TableCell align="right">Usage Count</TableCell>
                <TableCell align="right">Unique Users</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {metrics.featureUsage.topFeatures.slice(0, 5).map(feature => (
                <TableRow key={feature.feature}>
                  <TableCell>{feature.displayName}</TableCell>
                  <TableCell align="right">{feature.usageCount}</TableCell>
                  <TableCell align="right">{feature.uniqueUsers}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Services by Template */}
        {Object.keys(metrics.serviceCreation.byTemplate).length > 0 && (
          <>
            <Typography variant="h6" className={classes.sectionTitle}>
              Services by Template
            </Typography>
            <TableContainer component={Paper} className={classes.featureTable}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Template</TableCell>
                    <TableCell align="right">Services Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(metrics.serviceCreation.byTemplate)
                    .sort(([, a], [, b]) => b - a)
                    .map(([template, count]) => (
                      <TableRow key={template}>
                        <TableCell>{template}</TableCell>
                        <TableCell align="right">{count}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
};
