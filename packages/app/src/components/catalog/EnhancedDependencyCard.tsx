import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Grid,
  Typography,
  Box,
  Chip,
  Divider,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { InfoCard, Link as BackstageLink } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import {
  Direction,
  EntityCatalogGraphCard,
} from '@backstage/plugin-catalog-graph';
import {
  RELATION_CONSUMES_API,
  RELATION_DEPENDENCY_OF,
  RELATION_DEPENDS_ON,
  RELATION_PROVIDES_API,
} from '@backstage/catalog-model';

const useStyles = makeStyles(theme => ({
  gridItemCard: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100% - 10px)',
    marginBottom: theme.spacing(3),
  },
  gridItemCardContent: {
    flex: 1,
  },
  section: {
    marginBottom: theme.spacing(2),
  },
  chip: {
    margin: theme.spacing(0.5),
  },
  graphContainer: {
    minHeight: 300,
    marginTop: theme.spacing(2),
  },
  dependencyList: {
    maxHeight: 200,
    overflowY: 'auto',
  },
}));

interface EnhancedDependencyCardProps {
  variant?: 'gridItem';
}

export const EnhancedDependencyCard = ({ variant }: EnhancedDependencyCardProps) => {
  const classes = useStyles();
  const { entity } = useEntity();

  const isGridItem = variant === 'gridItem';

  const getDependencies = (entity: Entity) => {
    return entity.relations?.filter(r => r.type === 'dependsOn') || [];
  };

  const getDependents = (entity: Entity) => {
    return entity.relations?.filter(r => r.type === 'dependencyOf') || [];
  };

  const getApiRelations = (entity: Entity) => {
    const provides = entity.relations?.filter(r => r.type === 'providesApi') || [];
    const consumes = entity.relations?.filter(r => r.type === 'consumesApi') || [];
    return { provides, consumes };
  };

  const dependencies = getDependencies(entity);
  const dependents = getDependents(entity);
  const { provides: providedApis, consumes: consumedApis } = getApiRelations(entity);

  const formatEntityName = (targetRef: string) => {
    const parts = targetRef.split('/');
    return parts[parts.length - 1] || targetRef;
  };

  const formatEntityLink = (targetRef: string) => {
    return `/catalog/${targetRef.replace(':', '/')}`;
  };

  const content = (
    <CardContent className={isGridItem ? classes.gridItemCardContent : undefined}>
      <Grid container spacing={3}>
        {/* Dependencies Section */}
        <Grid item xs={12} md={6}>
          <Box className={classes.section}>
            <Typography variant="h6" gutterBottom>
              Dependencies ({dependencies.length})
            </Typography>
            {dependencies.length > 0 ? (
              <Box className={classes.dependencyList}>
                {dependencies.map((dep, index) => (
                  <Box key={index} mb={1}>
                    <Chip
                      label={formatEntityName(dep.targetRef)}
                      size="small"
                      variant="outlined"
                      className={classes.chip}
                      component={BackstageLink}
                      to={formatEntityLink(dep.targetRef)}
                      clickable
                    />
                    <Typography variant="caption" color="textSecondary" display="block">
                      {dep.targetRef.split('/')[0]} • {dep.targetRef.split('/')[1]}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="textSecondary">
                No dependencies found
              </Typography>
            )}
          </Box>
        </Grid>

        {/* Dependents Section */}
        <Grid item xs={12} md={6}>
          <Box className={classes.section}>
            <Typography variant="h6" gutterBottom>
              Dependents ({dependents.length})
            </Typography>
            {dependents.length > 0 ? (
              <Box className={classes.dependencyList}>
                {dependents.map((dep, index) => (
                  <Box key={index} mb={1}>
                    <Chip
                      label={formatEntityName(dep.targetRef)}
                      size="small"
                      color="primary"
                      className={classes.chip}
                      component={BackstageLink}
                      to={formatEntityLink(dep.targetRef)}
                      clickable
                    />
                    <Typography variant="caption" color="textSecondary" display="block">
                      {dep.targetRef.split('/')[0]} • {dep.targetRef.split('/')[1]}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="textSecondary">
                No dependents found
              </Typography>
            )}
          </Box>
        </Grid>

        {/* API Relations */}
        {(providedApis.length > 0 || consumedApis.length > 0) && (
          <>
            <Grid item xs={12}>
              <Divider />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box className={classes.section}>
                <Typography variant="h6" gutterBottom>
                  Provided APIs ({providedApis.length})
                </Typography>
                {providedApis.length > 0 ? (
                  <Box>
                    {providedApis.map((api, index) => (
                      <Chip
                        key={index}
                        label={formatEntityName(api.targetRef)}
                        size="small"
                        color="primary"
                        className={classes.chip}
                        component={BackstageLink}
                        to={formatEntityLink(api.targetRef)}
                        clickable
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No APIs provided
                  </Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box className={classes.section}>
                <Typography variant="h6" gutterBottom>
                  Consumed APIs ({consumedApis.length})
                </Typography>
                {consumedApis.length > 0 ? (
                  <Box>
                    {consumedApis.map((api, index) => (
                      <Chip
                        key={index}
                        label={formatEntityName(api.targetRef)}
                        size="small"
                        variant="outlined"
                        className={classes.chip}
                        component={BackstageLink}
                        to={formatEntityLink(api.targetRef)}
                        clickable
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No APIs consumed
                  </Typography>
                )}
              </Box>
            </Grid>
          </>
        )}

        {/* Visual Dependency Graph */}
        <Grid item xs={12}>
          <Divider />
          <Box className={classes.graphContainer}>
            <Typography variant="h6" gutterBottom>
              Dependency Graph
            </Typography>
            <EntityCatalogGraphCard
              variant="gridItem"
              direction={Direction.LEFT_RIGHT}
              title=""
              height={300}
              relations={[
                RELATION_DEPENDS_ON,
                RELATION_DEPENDENCY_OF,
                RELATION_PROVIDES_API,
                RELATION_CONSUMES_API,
              ]}
              unidirectional={false}
            />
          </Box>
        </Grid>
      </Grid>
    </CardContent>
  );

  if (isGridItem) {
    return (
      <Card className={classes.gridItemCard}>
        <CardHeader title="Dependencies & Relations" />
        {content}
      </Card>
    );
  }

  return (
    <InfoCard title="Dependencies & Relations">
      {content}
    </InfoCard>
  );
};