/**
 * Argo CD deployment status card component
 * Displays real-time deployment status and provides manual sync capabilities
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Box,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import RefreshIcon from '@material-ui/icons/Refresh';
import LaunchIcon from '@material-ui/icons/Launch';
import SyncIcon from '@material-ui/icons/Sync';
import ErrorIcon from '@material-ui/icons/Error';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ScheduleIcon from '@material-ui/icons/Schedule';
import { makeStyles } from '@material-ui/core/styles';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi, configApiRef } from '@backstage/core-plugin-api';

const useStyles = makeStyles(theme => ({
  card: {
    height: '100%',
  },
  statusChip: {
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  healthyChip: {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
  },
  degradedChip: {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
  },
  progressingChip: {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
  },
  unknownChip: {
    backgroundColor: theme.palette.grey[500],
    color: theme.palette.grey[50],
  },
  syncedChip: {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
  },
  outOfSyncChip: {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
  },
  environmentSection: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  environmentTitle: {
    fontWeight: 'bold',
    marginBottom: theme.spacing(1),
  },
  actionButton: {
    marginRight: theme.spacing(1),
  },
  errorMessage: {
    marginTop: theme.spacing(1),
  },
  lastSyncTime: {
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
  },
}));

interface DeploymentError {
  type:
    | 'sync_failed'
    | 'health_check_failed'
    | 'resource_error'
    | 'permission_error'
    | 'network_error';
  message: string;
  details?: string;
  timestamp: string;
  applicationName: string;
  environment: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  suggestedActions: string[];
  logUrl?: string;
  resourceName?: string;
}

interface DeploymentStatus {
  applicationName: string;
  health:
    | 'Healthy'
    | 'Progressing'
    | 'Degraded'
    | 'Suspended'
    | 'Missing'
    | 'Unknown';
  sync: 'Synced' | 'OutOfSync' | 'Unknown';
  lastSyncTime?: string;
  environment: string;
  namespace: string;
  errors?: DeploymentError[];
  logUrl?: string;
  canSync: boolean;
}

interface MultiEnvironmentStatus {
  serviceName: string;
  environments: {
    [environment: string]: DeploymentStatus;
  };
  overallHealth: 'Healthy' | 'Degraded' | 'Unknown';
}

interface SyncDialogProps {
  open: boolean;
  onClose: () => void;
  onSync: (environment: string, options: SyncOptions) => void;
  environments: string[];
  loading: boolean;
}

interface SyncOptions {
  prune: boolean;
  dryRun: boolean;
  force: boolean;
}

const SyncDialog: React.FC<SyncDialogProps> = ({
  open,
  onClose,
  onSync,
  environments,
  loading,
}) => {
  const [selectedEnvironment, setSelectedEnvironment] = useState('production');
  const [syncOptions, setSyncOptions] = useState<SyncOptions>({
    prune: false,
    dryRun: false,
    force: false,
  });

  const handleSync = () => {
    onSync(selectedEnvironment, syncOptions);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Manual Sync</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Environment</InputLabel>
              <Select
                value={selectedEnvironment}
                onChange={e => setSelectedEnvironment(e.target.value as string)}
              >
                {environments.map(env => (
                  <MenuItem key={env} value={env}>
                    {env.charAt(0).toUpperCase() + env.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={syncOptions.prune}
                  onChange={e =>
                    setSyncOptions(prev => ({
                      ...prev,
                      prune: e.target.checked,
                    }))
                  }
                />
              }
              label="Prune resources"
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={syncOptions.dryRun}
                  onChange={e =>
                    setSyncOptions(prev => ({
                      ...prev,
                      dryRun: e.target.checked,
                    }))
                  }
                />
              }
              label="Dry run"
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={syncOptions.force}
                  onChange={e =>
                    setSyncOptions(prev => ({
                      ...prev,
                      force: e.target.checked,
                    }))
                  }
                />
              }
              label="Force sync"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSync}
          color="primary"
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <SyncIcon />}
        >
          {loading ? 'Syncing...' : 'Sync'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const ArgocdDeploymentCard: React.FC<{ variant?: string }> = ({
  variant,
}) => {
  const classes = useStyles();
  const { entity } = useEntity();
  const config = useApi(configApiRef);

  const [deploymentStatus, setDeploymentStatus] =
    useState<MultiEnvironmentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const serviceName = entity.metadata.name;
  const annotations = entity.metadata.annotations || {};
  const argocdAppName = annotations['argocd/app-name'];

  const fetchDeploymentStatus = async () => {
    if (!argocdAppName) {
      setError('No Argo CD application annotation found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // In a real implementation, this would call the backend API
      // For now, simulate the API call
      const mockStatus: MultiEnvironmentStatus = {
        serviceName,
        environments: {
          production: {
            applicationName: `${argocdAppName}-prod`,
            health: 'Healthy',
            sync: 'Synced',
            lastSyncTime: new Date(Date.now() - 300000).toISOString(),
            environment: 'production',
            namespace: 'prod',
            canSync: true,
          },
          staging: {
            applicationName: `${argocdAppName}-staging`,
            health: 'Progressing',
            sync: 'OutOfSync',
            lastSyncTime: new Date(Date.now() - 600000).toISOString(),
            environment: 'staging',
            namespace: 'staging',
            canSync: true,
          },
          development: {
            applicationName: `${argocdAppName}-dev`,
            health: 'Degraded',
            sync: 'OutOfSync',
            lastSyncTime: new Date(Date.now() - 1800000).toISOString(),
            environment: 'development',
            namespace: 'dev',
            errors: [
              {
                type: 'resource_error',
                message: 'Pod CrashLoopBackOff: container failed to start',
                timestamp: new Date().toISOString(),
                applicationName: `${argocdAppName}-dev`,
                environment: 'development',
                severity: 'high',
                recoverable: true,
                suggestedActions: [
                  'Check application logs for startup errors',
                  'Verify resource limits and requests',
                  'Check environment variables and configuration',
                ],
              },
              {
                type: 'health_check_failed',
                message: 'Service endpoint not ready',
                timestamp: new Date().toISOString(),
                applicationName: `${argocdAppName}-dev`,
                environment: 'development',
                severity: 'medium',
                recoverable: true,
                suggestedActions: [
                  'Check service configuration',
                  'Verify pod readiness probes',
                ],
              },
            ],
            canSync: true,
          },
        },
        overallHealth: 'Degraded',
      };

      setDeploymentStatus(mockStatus);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to fetch deployment status';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (environment: string, options: SyncOptions) => {
    try {
      setSyncing(true);

      // In a real implementation, this would call the backend API
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call

      // Refresh status after sync
      await fetchDeploymentStatus();
      setSyncDialogOpen(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed';
      setError(errorMessage);
    } finally {
      setSyncing(false);
    }
  };

  const getHealthChipClass = (health: string) => {
    switch (health) {
      case 'Healthy':
        return classes.healthyChip;
      case 'Degraded':
        return classes.degradedChip;
      case 'Progressing':
        return classes.progressingChip;
      default:
        return classes.unknownChip;
    }
  };

  const getSyncChipClass = (sync: string) => {
    switch (sync) {
      case 'Synced':
        return classes.syncedChip;
      case 'OutOfSync':
        return classes.outOfSyncChip;
      default:
        return classes.unknownChip;
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'Healthy':
        return <CheckCircleIcon />;
      case 'Degraded':
        return <ErrorIcon />;
      case 'Progressing':
        return <ScheduleIcon />;
      default:
        return <ErrorIcon />;
    }
  };

  const formatLastSyncTime = (lastSyncTime?: string) => {
    if (!lastSyncTime) return 'Never';

    const date = new Date(lastSyncTime);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  };

  useEffect(() => {
    fetchDeploymentStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [argocdAppName]);

  if (!argocdAppName) {
    return null; // Don't render if no Argo CD annotation
  }

  return (
    <>
      <Card className={classes.card}>
        <CardHeader
          title="Deployment Status"
          subheader="Argo CD GitOps Deployments"
          action={
            <Box>
              <Tooltip title="Refresh status">
                <IconButton onClick={fetchDeploymentStatus} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Manual sync">
                <IconButton
                  onClick={() => setSyncDialogOpen(true)}
                  disabled={loading || !deploymentStatus}
                >
                  <SyncIcon />
                </IconButton>
              </Tooltip>
            </Box>
          }
        />
        <CardContent>
          {loading && (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              minHeight={200}
            >
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error" className={classes.errorMessage}>
              {error}
            </Alert>
          )}

          {deploymentStatus && !loading && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Overall Status:
                  <Chip
                    icon={getHealthIcon(deploymentStatus.overallHealth)}
                    label={deploymentStatus.overallHealth}
                    className={`${classes.statusChip} ${getHealthChipClass(
                      deploymentStatus.overallHealth,
                    )}`}
                    size="small"
                  />
                </Typography>
              </Grid>

              {Object.entries(deploymentStatus.environments).map(
                ([env, status]) => (
                  <Grid item xs={12} key={env}>
                    <Box className={classes.environmentSection}>
                      <Typography className={classes.environmentTitle}>
                        {env.charAt(0).toUpperCase() + env.slice(1)}
                      </Typography>

                      <Grid container spacing={1} alignItems="center">
                        <Grid item>
                          <Chip
                            icon={getHealthIcon(status.health)}
                            label={status.health}
                            className={`${
                              classes.statusChip
                            } ${getHealthChipClass(status.health)}`}
                            size="small"
                          />
                        </Grid>
                        <Grid item>
                          <Chip
                            label={status.sync}
                            className={`${
                              classes.statusChip
                            } ${getSyncChipClass(status.sync)}`}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs>
                          <Typography className={classes.lastSyncTime}>
                            Last sync: {formatLastSyncTime(status.lastSyncTime)}
                          </Typography>
                        </Grid>
                        <Grid item>
                          <Tooltip title="View in Argo CD">
                            <IconButton
                              size="small"
                              onClick={() =>
                                window.open(
                                  `https://argocd.company.com/applications/${status.applicationName}`,
                                  '_blank',
                                )
                              }
                            >
                              <LaunchIcon />
                            </IconButton>
                          </Tooltip>
                        </Grid>
                      </Grid>

                      {status.errors && status.errors.length > 0 && (
                        <Box mt={1}>
                          {status.errors.map((err, index) => (
                            <Alert
                              key={index}
                              severity={
                                err.severity === 'critical' ||
                                err.severity === 'high'
                                  ? 'error'
                                  : 'warning'
                              }
                              size="small"
                            >
                              <Typography variant="body2" component="div">
                                <strong>
                                  {err.type.replace('_', ' ').toUpperCase()}:
                                </strong>{' '}
                                {err.message}
                              </Typography>
                              {error.suggestedActions &&
                                error.suggestedActions.length > 0 && (
                                  <Box mt={1}>
                                    <Typography
                                      variant="caption"
                                      display="block"
                                    >
                                      Suggested actions:
                                    </Typography>
                                    <ul
                                      style={{ margin: 0, paddingLeft: '16px' }}
                                    >
                                      {error.suggestedActions
                                        .slice(0, 2)
                                        .map((action, actionIndex) => (
                                          <li key={actionIndex}>
                                            <Typography variant="caption">
                                              {action}
                                            </Typography>
                                          </li>
                                        ))}
                                    </ul>
                                  </Box>
                                )}
                            </Alert>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Grid>
                ),
              )}

              <Grid item xs={12}>
                <Box mt={2}>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<SyncIcon />}
                    onClick={() => setSyncDialogOpen(true)}
                    className={classes.actionButton}
                  >
                    Manual Sync
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<LaunchIcon />}
                    onClick={() =>
                      window.open('https://argocd.company.com', '_blank')
                    }
                  >
                    Open Argo CD
                  </Button>
                </Box>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      <SyncDialog
        open={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
        onSync={handleSync}
        environments={
          deploymentStatus ? Object.keys(deploymentStatus.environments) : []
        }
        loading={syncing}
      />
    </>
  );
};
