import { makeStyles, Theme, Grid, Paper } from '@material-ui/core';

import { CatalogSearchResultListItem } from '@backstage/plugin-catalog';
import {
  catalogApiRef,
  CATALOG_FILTER_EXISTS,
} from '@backstage/plugin-catalog-react';
import { TechDocsSearchResultListItem } from '@backstage/plugin-techdocs';

import { SearchType } from '@backstage/plugin-search';
import {
  SearchBar,
  SearchFilter,
  SearchResult,
  SearchPagination,
  useSearch,
} from '@backstage/plugin-search-react';
import {
  CatalogIcon,
  Content,
  DocsIcon,
  Header,
  Page,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';

const useStyles = makeStyles((theme: Theme) => ({
  bar: {
    padding: theme.spacing(1, 0),
  },
  filters: {
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  filter: {
    '& + &': {
      marginTop: theme.spacing(2.5),
    },
  },
}));

const SearchPage = () => {
  const classes = useStyles();
  const { types } = useSearch();
  const catalogApi = useApi(catalogApiRef);

  return (
    <Page themeId="home">
      <Header title="Search" subtitle="Find services, documentation, APIs, and more" />
      <Content>
        <Grid container direction="row">
          <Grid item xs={12}>
            <Paper className={classes.bar}>
              <SearchBar />
            </Paper>
          </Grid>
          <Grid item xs={3}>
            <SearchType.Accordion
              name="Result Type"
              defaultValue="software-catalog"
              types={[
                {
                  value: 'software-catalog',
                  name: 'Software Catalog',
                  icon: <CatalogIcon />,
                },
                {
                  value: 'techdocs',
                  name: 'Documentation',
                  icon: <DocsIcon />,
                },
              ]}
            />
            <Paper className={classes.filters}>
              {/* Entity filter for TechDocs */}
              {types.includes('techdocs') && (
                <SearchFilter.Select
                  className={classes.filter}
                  label="Entity"
                  name="name"
                  values={async () => {
                    // Return a list of entities which are documented.
                    const { items } = await catalogApi.getEntities({
                      fields: ['metadata.name'],
                      filter: {
                        'metadata.annotations.backstage.io/techdocs-ref':
                          CATALOG_FILTER_EXISTS,
                      },
                    });

                    const names = items.map(entity => entity.metadata.name);
                    names.sort();
                    return names;
                  }}
                />
              )}
              
              {/* Kind/Type filter */}
              <SearchFilter.Select
                className={classes.filter}
                label="Kind"
                name="kind"
                values={['Component', 'API', 'Resource', 'System', 'Domain', 'Template']}
              />
              
              {/* Lifecycle filter */}
              <SearchFilter.Checkbox
                className={classes.filter}
                label="Lifecycle"
                name="lifecycle"
                values={['experimental', 'production', 'deprecated']}
              />
              
              {/* Tags filter */}
              <SearchFilter.Autocomplete
                className={classes.filter}
                label="Tags"
                name="tags"
                values={async () => {
                  // Get all unique tags from catalog
                  const { items } = await catalogApi.getEntities({
                    fields: ['metadata.tags'],
                  });
                  
                  const allTags = new Set<string>();
                  items.forEach(entity => {
                    entity.metadata.tags?.forEach(tag => allTags.add(tag));
                  });
                  
                  return Array.from(allTags).sort();
                }}
              />
              
              {/* Owner filter */}
              <SearchFilter.Autocomplete
                className={classes.filter}
                label="Owner"
                name="owner"
                values={async () => {
                  // Get all unique owners from catalog
                  const { items } = await catalogApi.getEntities({
                    fields: ['spec.owner'],
                  });
                  
                  const owners = new Set<string>();
                  items.forEach(entity => {
                    if (entity.spec?.owner) {
                      owners.add(entity.spec.owner as string);
                    }
                  });
                  
                  return Array.from(owners).sort();
                }}
              />
            </Paper>
          </Grid>
          <Grid item xs={9}>
            <SearchPagination />
            <SearchResult>
              <CatalogSearchResultListItem icon={<CatalogIcon />} />
              <TechDocsSearchResultListItem icon={<DocsIcon />} />
            </SearchResult>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};

export const searchPage = <SearchPage />;
