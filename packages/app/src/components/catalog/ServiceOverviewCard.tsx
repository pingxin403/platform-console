import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  Typography,
  Link,
  Box,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  InfoCard,
  Link as BackstageLink,
  StatusOK,
  StatusError,
  StatusPending,
} from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  ANNOTATION_EDIT_URL,
  ANNOTATION_VIEW_URL,
  ANNOTATION_SOURCE_LOCATION,
  Entity,
} from '@backstage/catalog-model';
import { ScmIntegrationsApi, scmIntegrationsApiRef } from '@backstage/integration-react';
import { useApi } from '@backstage/core-plugin-api';

const useStyles = makeStyles(theme => ({
  gridItemCard: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100% - 10px)', // for pages without content header
    marginBottom: theme.spacing(3),
  },
  gridItemCardContent: {
    flex: 1,
  },
  metadataSection: {
    marginBottom: theme.spacing(2),
  },
  chip: {
    margin: theme.spacing(0.5),
  },
  linkSection: {
    marginTop: theme.spacing(1),
  },
}));

interface ServiceOverviewCardProps {
  variant?: 'gridItem';
}

export const ServiceOverviewCard = ({ variant }: ServiceOverviewCardProps) => {
  const classes = useStyles();
  const { entity } = useEntity();
  const scmIntegrationsApi = useApi(scmIntegrationsApiRef);

  const isGridItem = variant === 'gridItem';

  const getRepositoryUrl = (entity: Entity): string | undefined => {
    const sourceLocation = entity.metadata.annotations?.[ANNOTATION_SOURCE_LOCATION];
    const viewUrl = entity.metadata.annotations?.[ANNOTATION_VIEW_URL];
    const editUrl = entity.metadata.annotations?.[ANNOTATION_EDIT_URL];

    if (viewUrl) return viewUrl;
    if (editUrl) return editUrl;
    if (sourceLocation) {
      try {
        const integration = scmIntegrationsApi.byUrl(sourceLocation);
        if (integration) {
          // Extract repository URL from source location
          const url = new URL(sourceLocation);
          const pathParts = url.pathname.split('/');
          if (pathParts.length >= 3) {
            return `${url.origin}/${pathParts[1]}/${pathParts[2]}`;
          }
        }
      } catch (error) {
        // Fallback to source location if parsing fails
        return sourceLocation;
      }
    }
    return undefined;
  };

  const getOwnerInfo = (entity: Entity) => {
    const owner = entity.spec?.owner as string;
    const ownerType = entity.relations?.find(r => r.type === 'ownedBy')?.targetRef;
    return { owner, ownerType };
  };

  const getDependencies = (entity: Entity) => {
    return entity.relations?.filter(r => r.type === 'dependsOn') || [];
  };

  const getProvidedApis = (entity: Entity) => {
    return entity.relations?.filter(r => r.type === 'providesApi') || [];
  };

  const getConsumedApis = (entity: Entity) => {
    return entity.relations?.filter(r => r.type === 'consumesApi') || [];
  };

  const repositoryUrl = getRepositoryUrl(entity);
  const { owner, ownerType } = getOwnerInfo(entity);
  const dependencies = getDependencies(entity);
  const providedApis = getProvidedApis(entity);
  const consumedApis = getConsumedApis(entity);

  const lifecycle = entity.spec?.lifecycle as string;
  const type = entity.spec?.type as string;
  const system = entity.spec?.system as string;

  const content = (
    <CardContent className={isGridItem ? classes.gridItemCardContent : undefined}>
      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12}>
          <Box className={classes.metadataSection}>
            <Typography variant="h6" gutterBottom>
              Service Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="textSecondary">
                  Type
                </Typography>
                <Typography variant="body1">
                  {type || 'Not specified'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="textSecondary">
                  Lifecycle
                </Typography>
                <Chip
                  label={lifecycle || 'unknown'}
                  size="small"
                  color={lifecycle === 'production' ? 'primary' : 'default'}
                  className={classes.chip}
                />
              </Grid>
              {system && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    System
                  </Typography>
                  <Typography variant="body1">{system}</Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        </Grid>

        {/* Owner Information */}
        <Grid item xs={12}>
          <Box className={classes.metadataSection}>
            <Typography variant="h6" gutterBottom>
              Ownership
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Owner
            </Typography>
            <Typography variant="body1">
              {owner ? (
                <BackstageLink to={`/catalog/default/${ownerType?.split(':')[0] || 'group'}/${owner}`}>
                  {owner}
                </BackstageLink>
              ) : (
                'Not specified'
              )}
            </Typography>
          </Box>
        </Grid>

        {/* Repository Information */}
        {repositoryUrl && (
          <Grid item xs={12}>
            <Box className={classes.metadataSection}>
              <Typography variant="h6" gutterBottom>
                Repository
              </Typography>
              <Box className={classes.linkSection}>
                <Link
                  href={repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  color="primary"
                >
                  View Repository
                </Link>
              </Box>
            </Box>
          </Grid>
        )}

        {/* Dependencies */}
        {dependencies.length > 0 && (
          <Grid item xs={12}>
            <Box className={classes.metadataSection}>
              <Typography variant="h6" gutterBottom>
                Dependencies ({dependencies.length})
              </Typography>
              <Box>
                {dependencies.map((dep, index) => (
                  <Chip
                    key={index}
                    label={dep.targetRef.split('/').pop()}
                    size="small"
                    variant="outlined"
                    className={classes.chip}
                    component={BackstageLink}
                    to={`/catalog/${dep.targetRef.replace(':', '/')}`}
                    clickable
                  />
                ))}
              </Box>
            </Box>
          </Grid>
        )}

        {/* APIs */}
        {(providedApis.length > 0 || consumedApis.length > 0) && (
          <Grid item xs={12}>
            <Box className={classes.metadataSection}>
              <Typography variant="h6" gutterBottom>
                API Integration
              </Typography>
              {providedApis.length > 0 && (
                <Box mb={1}>
                  <Typography variant="body2" color="textSecondary">
                    Provides APIs
                  </Typography>
                  <Box>
                    {providedApis.map((api, index) => (
                      <Chip
                        key={index}
                        label={api.targetRef.split('/').pop()}
                        size="small"
                        color="primary"
                        className={classes.chip}
                        component={BackstageLink}
                        to={`/catalog/${api.targetRef.replace(':', '/')}`}
                        clickable
                      />
                    ))}
                  </Box>
                </Box>
              )}
              {consumedApis.length > 0 && (
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Consumes APIs
                  </Typography>
                  <Box>
                    {consumedApis.map((api, index) => (
                      <Chip
                        key={index}
                        label={api.targetRef.split('/').pop()}
                        size="small"
                        variant="outlined"
                        className={classes.chip}
                        component={BackstageLink}
                        to={`/catalog/${api.targetRef.replace(':', '/')}`}
                        clickable
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Grid>
        )}
      </Grid>
    </CardContent>
  );

  if (isGridItem) {
    return (
      <Card className={classes.gridItemCard}>
        <CardHeader title="Service Overview" />
        {content}
      </Card>
    );
  }

  return (
    <InfoCard title="Service Overview">
      {content}
    </InfoCard>
  );
};