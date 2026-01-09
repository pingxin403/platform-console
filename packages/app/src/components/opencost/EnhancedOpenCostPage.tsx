/**
 * Enhanced OpenCost Page with AWS cost correlation and benchmarking
 * 
 * This component extends the basic OpenCost functionality with:
 * - AWS cost data integration and correlation
 * - Cost benchmarking across similar services
 * - Cost trend analysis with significant change highlighting
 * - Daily cost data updates with complete breakdowns
 */

import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Assessment as AssessmentIcon,
  CloudQueue as CloudIcon,
} from '@material-ui/icons';
import {
  Page,
  Header,
  Content,
  HeaderLabel,
  SupportButton,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { OpenCostPage as BaseOpenCostPage } from '@backstage-community/plugin-opencost';

interface CostData {
  serviceName: string;
  totalCost: number;
  cpuCost: number;
  memoryCost: number;
  storageCost: number;
  networkCost: number;
  timeRange: {
    start: string;
    end: string;
  };
  awsCorrelation?: {
    ec2Cost: number;
    ebsCost: number;
    s3Cost: number;
    rdsCost: number;
  };
}

interface BenchmarkData {
  serviceName: string;
  category: string;
  costPerCpu: number;
  costPerMemory: number;
  efficiency: number;
  percentile: number;
}

interface CostTrend {
  current: number;
  previous: number;
  change: number;
  significant: boolean;
}

const CostBreakdownCard: React.FC<{ costData: CostData }> = ({ costData }) => {
  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Cost Breakdown - {costData.serviceName}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="primary">
                {formatCurrency(costData.totalCost)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total Cost
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center">
              <Typography variant="h5">
                {formatCurrency(costData.cpuCost)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                CPU Cost
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center">
              <Typography variant="h5">
                {formatCurrency(costData.memoryCost)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Memory Cost
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center">
              <Typography variant="h5">
                {formatCurrency(costData.storageCost)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Storage Cost
              </Typography>
            </Box>
          </Grid>
        </Grid>
        
        {costData.awsCorrelation && (
          <Box mt={3}>
            <Typography variant="h6" gutterBottom>
              <CloudIcon style={{ verticalAlign: 'middle', marginRight: 8 }} />
              AWS Cost Correlation
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Box textAlign="center">
                  <Typography variant="h6">
                    {formatCurrency(costData.awsCorrelation.ec2Cost)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    EC2
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box textAlign="center">
                  <Typography variant="h6">
                    {formatCurrency(costData.awsCorrelation.ebsCost)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    EBS
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box textAlign="center">
                  <Typography variant="h6">
                    {formatCurrency(costData.awsCorrelation.s3Cost)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    S3
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box textAlign="center">
                  <Typography variant="h6">
                    {formatCurrency(costData.awsCorrelation.rdsCost)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    RDS
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const CostTrendCard: React.FC<{ trend: CostTrend; serviceName: string }> = ({ trend, serviceName }) => {
  const isIncrease = trend.change > 0;
  const TrendIcon = isIncrease ? TrendingUpIcon : TrendingDownIcon;
  const trendColor = isIncrease ? 'error' : 'success';

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Cost Trend Analysis - {serviceName}
        </Typography>
        <Box display="flex" alignItems="center" mb={2}>
          <TrendIcon color={trendColor} style={{ marginRight: 8 }} />
          <Typography variant="h4" color={trendColor}>
            {trend.change > 0 ? '+' : ''}{trend.change.toFixed(1)}%
          </Typography>
          {trend.significant && (
            <Chip
              label="Significant Change"
              color="secondary"
              size="small"
              style={{ marginLeft: 16 }}
            />
          )}
        </Box>
        <Typography variant="body2" color="textSecondary">
          Current: ${trend.current.toFixed(2)} | Previous: ${trend.previous.toFixed(2)}
        </Typography>
        {trend.significant && (
          <Alert severity="warning" style={{ marginTop: 16 }}>
            Cost change exceeds 15% threshold. Review resource usage and optimization opportunities.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

const BenchmarkTable: React.FC<{ benchmarks: BenchmarkData[]; serviceName: string }> = ({ 
  benchmarks, 
  serviceName 
}) => {
  const currentService = benchmarks.find(b => b.serviceName === serviceName);
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          <AssessmentIcon style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Cost Benchmarking - Similar Services
        </Typography>
        {currentService && (
          <Box mb={2}>
            <Alert severity="info">
              Your service is in the {currentService.percentile.toFixed(0)}th percentile for cost efficiency
            </Alert>
          </Box>
        )}
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Service</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Cost/CPU</TableCell>
                <TableCell align="right">Cost/Memory</TableCell>
                <TableCell align="right">Efficiency</TableCell>
                <TableCell align="right">Percentile</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {benchmarks.map((benchmark) => (
                <TableRow 
                  key={benchmark.serviceName}
                  style={{ 
                    backgroundColor: benchmark.serviceName === serviceName ? '#f5f5f5' : 'inherit' 
                  }}
                >
                  <TableCell>
                    {benchmark.serviceName}
                    {benchmark.serviceName === serviceName && (
                      <Chip label="You" size="small" color="primary" style={{ marginLeft: 8 }} />
                    )}
                  </TableCell>
                  <TableCell>{benchmark.category}</TableCell>
                  <TableCell align="right">${benchmark.costPerCpu.toFixed(2)}</TableCell>
                  <TableCell align="right">${benchmark.costPerMemory.toFixed(4)}</TableCell>
                  <TableCell align="right">{benchmark.efficiency.toFixed(2)}</TableCell>
                  <TableCell align="right">{benchmark.percentile.toFixed(0)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

export const EnhancedOpenCostPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [costData, setCostData] = useState<CostData | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkData[]>([]);
  const [trend, setTrend] = useState<CostTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  // Mock service name - in real implementation, this would come from route params or context
  const serviceName = 'user-service';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch enhanced cost data
        const costResponse = await fetch(`${backendUrl}/api/opencost-enhanced/costs/${serviceName}`);
        if (!costResponse.ok) {
          throw new Error('Failed to fetch cost data');
        }
        const costData = await costResponse.json();
        setCostData(costData);

        // Fetch benchmark data
        const benchmarkResponse = await fetch(`${backendUrl}/api/opencost-enhanced/benchmark/${serviceName}`);
        if (!benchmarkResponse.ok) {
          throw new Error('Failed to fetch benchmark data');
        }
        const benchmarkData = await benchmarkResponse.json();
        setBenchmarks(benchmarkData);

        // Fetch trend data
        const trendResponse = await fetch(`${backendUrl}/api/opencost-enhanced/trends/${serviceName}`);
        if (!trendResponse.ok) {
          throw new Error('Failed to fetch trend data');
        }
        const trendData = await trendResponse.json();
        setTrend(trendData);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [backendUrl, serviceName]);

  const handleTabChange = (event: React.ChangeEvent<{}>, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Cost Visibility" subtitle="Kubernetes and AWS cost analysis">
          <HeaderLabel label="Owner" value="Platform Team" />
          <HeaderLabel label="Lifecycle" value="Production" />
        </Header>
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Cost Visibility" subtitle="Kubernetes and AWS cost analysis">
          <HeaderLabel label="Owner" value="Platform Team" />
          <HeaderLabel label="Lifecycle" value="Production" />
        </Header>
        <Content>
          <ResponseErrorPanel error={new Error(error)} />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title="Cost Visibility" subtitle="Kubernetes and AWS cost analysis with benchmarking">
        <HeaderLabel label="Owner" value="Platform Team" />
        <HeaderLabel label="Lifecycle" value="Production" />
        <SupportButton>
          Enhanced OpenCost integration with AWS cost correlation and benchmarking capabilities.
        </SupportButton>
      </Header>
      <Content>
        <Tabs value={tabValue} onChange={handleTabChange} indicatorColor="primary">
          <Tab label="Enhanced Cost View" />
          <Tab label="Standard OpenCost" />
        </Tabs>
        
        {tabValue === 0 && (
          <Box mt={3}>
            <Grid container spacing={3}>
              {costData && (
                <Grid item xs={12}>
                  <CostBreakdownCard costData={costData} />
                </Grid>
              )}
              
              {trend && (
                <Grid item xs={12} md={6}>
                  <CostTrendCard trend={trend} serviceName={serviceName} />
                </Grid>
              )}
              
              {benchmarks.length > 0 && (
                <Grid item xs={12}>
                  <BenchmarkTable benchmarks={benchmarks} serviceName={serviceName} />
                </Grid>
              )}
            </Grid>
          </Box>
        )}
        
        {tabValue === 1 && (
          <Box mt={3}>
            <BaseOpenCostPage />
          </Box>
        )}
      </Content>
    </Page>
  );
};

export default EnhancedOpenCostPage;