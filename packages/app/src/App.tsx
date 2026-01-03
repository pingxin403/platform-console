import { Navigate, Route } from 'react-router-dom';
import { apiDocsPlugin, ApiExplorerPage } from '@backstage/plugin-api-docs';
import {
  CatalogEntityPage,
  CatalogIndexPage,
  catalogPlugin,
} from '@backstage/plugin-catalog';
import {
  CatalogImportPage,
  catalogImportPlugin,
} from '@backstage/plugin-catalog-import';
import { ScaffolderPage, scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { orgPlugin } from '@backstage/plugin-org';
import { SearchPage } from '@backstage/plugin-search';
import {
  TechDocsIndexPage,
  techdocsPlugin,
  TechDocsReaderPage,
} from '@backstage/plugin-techdocs';
import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';
import { UserSettingsPage } from '@backstage/plugin-user-settings';
import { apis } from './apis';
import { entityPage } from './components/catalog/EntityPage';
import { searchPage } from './components/search/SearchPage';
import { Root } from './components/Root';
import { GrpcPlaygroundPage } from 'backstage-grpc-playground';
import { ToolboxPage } from '@drodil/backstage-plugin-toolbox';
import { DevToolsPage } from '@backstage/plugin-devtools';
import { TechRadarPage } from '@backstage-community/plugin-tech-radar';
import { S3ViewerPage } from '@spreadshirt/backstage-plugin-s3-viewer';
import { EnhancedOpenCostPage } from './components/opencost/EnhancedOpenCostPage';
import { RagAiPage } from '@roadiehq/rag-ai';
import { OpsLevelMaturityPage } from '@opslevel/backstage-maturity';
import { OpenDoraPage } from '@devoteam-nl/open-dora-backstage-plugin';
import { CortexPage } from '@cortexapps/backstage-plugin';
import { FireHydrantPage } from '@backstage-community/plugin-firehydrant';
import { KubernetesGptAnalyzerPage } from '@veecode-platform/backstage-plugin-kubernetes-gpt-analyzer';
import { JiraPage } from '@roadiehq/backstage-plugin-jira';
import { GithubPullRequestsBoardPage } from '@dazn/backstage-plugin-github-pull-requests-board';
import { FeedbackPage } from '@red-hat/backstage-plugin-feedback';
import { JiraDashboardPage } from '@roadiehq/backstage-plugin-jira-dashboard';
import { ShortcutPage } from '@shortcut/backstage-plugin';
import { BuildkitePage } from '@roadiehq/backstage-plugin-buildkite';
import { CostInsightsPage } from '@backstage/plugin-cost-insights';
import { DevPodPage } from '@coder/backstage-plugin-devpod';
import { DevContainersPage } from '@coder/backstage-plugin-dev-containers';
import { GoogleCalendarPage } from '@backstage/plugin-google-calendar';

import {
  AlertDisplay,
  OAuthRequestDialog,
  SignInPage,
} from '@backstage/core-components';
import { createApp } from '@backstage/app-defaults';
import { AppRouter, FlatRoutes } from '@backstage/core-app-api';
import { CatalogGraphPage } from '@backstage/plugin-catalog-graph';
import { RequirePermission } from '@backstage/plugin-permission-react';
import { catalogEntityCreatePermission } from '@backstage/plugin-catalog-common/alpha';
import { NotificationsPage } from '@backstage/plugin-notifications';
import { SignalsDisplay } from '@backstage/plugin-signals';
import {
  GitopsProfilesClusterListPage,
  GitopsProfilesClusterPage,
  GitopsProfilesCreatePage,
} from '@backstage-community/plugin-gitops-profiles';

const app = createApp({
  apis,
  bindRoutes({ bind }) {
    bind(catalogPlugin.externalRoutes, {
      createComponent: scaffolderPlugin.routes.root,
      viewTechDoc: techdocsPlugin.routes.docRoot,
      createFromTemplate: scaffolderPlugin.routes.selectedTemplate,
    });
    bind(apiDocsPlugin.externalRoutes, {
      registerApi: catalogImportPlugin.routes.importPage,
    });
    bind(scaffolderPlugin.externalRoutes, {
      registerComponent: catalogImportPlugin.routes.importPage,
      viewTechDoc: techdocsPlugin.routes.docRoot,
    });
    bind(orgPlugin.externalRoutes, {
      catalogIndex: catalogPlugin.routes.catalogIndex,
    });
  },
  components: {
    SignInPage: props => <SignInPage {...props} auto providers={['guest']} />,
  },
});

const routes = (
  <FlatRoutes>
    <Route path="/" element={<Navigate to="catalog" />} />
    <Route path="/catalog" element={<CatalogIndexPage />} />
    <Route
      path="/catalog/:namespace/:kind/:name"
      element={<CatalogEntityPage />}
    >
      {entityPage}
    </Route>
    <Route path="/docs" element={<TechDocsIndexPage />} />
    <Route
      path="/docs/:namespace/:kind/:name/*"
      element={<TechDocsReaderPage />}
    >
      <TechDocsAddons>
        <ReportIssue />
      </TechDocsAddons>
    </Route>
    <Route path="/create" element={<ScaffolderPage />} />
    <Route path="/api-docs" element={<ApiExplorerPage />} />
    <Route path="/grpc-playground" element={<GrpcPlaygroundPage />} />
    <Route path="/toolbox" element={<ToolboxPage />} />
    <Route path="/devtools" element={<DevToolsPage />} />
    <Route path="/tech-radar" element={<TechRadarPage />} />
    <Route path="/s3-viewer" element={<S3ViewerPage />} />
    <Route path="/opencost" element={<EnhancedOpenCostPage />} />
    <Route path="/ai-assistant" element={<RagAiPage />} />
    <Route path="/service-maturity" element={<OpsLevelMaturityPage />} />
    <Route path="/dora-metrics" element={<OpenDoraPage />} />
    <Route path="/engineering-effectiveness" element={<CortexPage />} />
    <Route path="/incident-management" element={<FireHydrantPage />} />
    <Route path="/kubernetes-ai-troubleshooting" element={<KubernetesGptAnalyzerPage />} />
    <Route path="/jira" element={<JiraPage />} />
    <Route path="/github-pr-board" element={<GithubPullRequestsBoardPage />} />
    <Route path="/feedback" element={<FeedbackPage />} />
    <Route path="/jira-dashboard" element={<JiraDashboardPage />} />
    <Route path="/shortcut" element={<ShortcutPage />} />
    <Route path="/buildkite" element={<BuildkitePage />} />
    <Route path="/cost-insights" element={<CostInsightsPage />} />
    <Route path="/devpod" element={<DevPodPage />} />
    <Route path="/dev-containers" element={<DevContainersPage />} />
    <Route path="/google-calendar" element={<GoogleCalendarPage />} />
    <Route
      path="/catalog-import"
      element={
        <RequirePermission permission={catalogEntityCreatePermission}>
          <CatalogImportPage />
        </RequirePermission>
      }
    />
    <Route path="/search" element={<SearchPage />}>
      {searchPage}
    </Route>
    <Route path="/settings" element={<UserSettingsPage />} />
    <Route path="/catalog-graph" element={<CatalogGraphPage />} />
    <Route path="/notifications" element={<NotificationsPage />} />
    <Route path="/gitops-profiles" element={<GitopsProfilesClusterListPage />} />
    <Route path="/gitops-profiles/create" element={<GitopsProfilesCreatePage />} />
    <Route
      path="/gitops-profiles/:owner/:repo"
      element={<GitopsProfilesClusterPage />}
    />
  </FlatRoutes>
);

export default app.createRoot(
  <>
    <AlertDisplay />
    <OAuthRequestDialog />
    <SignalsDisplay />
    <AppRouter>
      <Root>{routes}</Root>
    </AppRouter>
  </>,
);
