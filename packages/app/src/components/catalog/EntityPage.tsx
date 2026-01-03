import { Button, Grid } from '@material-ui/core';
import {
  EntityApiDefinitionCard,
  EntityConsumedApisCard,
  EntityConsumingComponentsCard,
  EntityHasApisCard,
  EntityProvidedApisCard,
  EntityProvidingComponentsCard,
} from '@backstage/plugin-api-docs';
import {
  EntityAboutCard,
  EntityDependsOnComponentsCard,
  EntityDependsOnResourcesCard,
  EntityHasComponentsCard,
  EntityHasResourcesCard,
  EntityHasSubcomponentsCard,
  EntityHasSystemsCard,
  EntityLayout,
  EntityLinksCard,
  EntitySwitch,
  EntityOrphanWarning,
  EntityProcessingErrorsPanel,
  isComponentType,
  isKind,
  hasCatalogProcessingErrors,
  isOrphan,
  hasRelationWarnings,
  EntityRelationWarning,
} from '@backstage/plugin-catalog';
import {
  EntityUserProfileCard,
  EntityGroupProfileCard,
  EntityMembersListCard,
  EntityOwnershipCard,
} from '@backstage/plugin-org';
import { EntityTechdocsContent } from '@backstage/plugin-techdocs';
import { EmptyState } from '@backstage/core-components';
import {
  Direction,
  EntityCatalogGraphCard,
} from '@backstage/plugin-catalog-graph';
import {
  RELATION_API_CONSUMED_BY,
  RELATION_API_PROVIDED_BY,
  RELATION_CONSUMES_API,
  RELATION_DEPENDENCY_OF,
  RELATION_DEPENDS_ON,
  RELATION_HAS_PART,
  RELATION_PART_OF,
  RELATION_PROVIDES_API,
} from '@backstage/catalog-model';

import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';

import {
  EntityKubernetesContent,
  isKubernetesAvailable,
} from '@backstage/plugin-kubernetes';

// Datadog plugin imports
import {
  EntityDatadogContent,
  EntityDatadogGraphCard,
  isDatadogAvailable,
} from '@roadiehq/backstage-plugin-datadog';

// Sentry plugin imports
import {
  EntitySentryCard,
  EntitySentryContent,
  isSentryAvailable,
} from '@backstage/plugin-sentry';

// Prometheus plugin imports
import {
  EntityPrometheusContent,
  EntityPrometheusGraphCard,
  isPrometheusAvailable,
} from '@roadiehq/backstage-plugin-prometheus';

// Grafana plugin imports
import {
  EntityGrafanaContent,
  EntityGrafanaDashboardsCard,
  isGrafanaAvailable,
} from '@k-phoen/backstage-plugin-grafana';

// Security Insights plugin imports
import {
  EntitySecurityInsightsContent,
  EntitySecurityInsightsCard,
  isSecurityInsightsAvailable,
} from '@roadiehq/backstage-plugin-security-insights';

// Lighthouse plugin imports
import {
  EntityLighthouseContent,
  EntityLastLighthouseAuditCard,
  isLighthouseAvailable,
} from '@backstage/plugin-lighthouse';

// GitHub Actions plugin imports
import {
  EntityGithubActionsContent,
  isGithubActionsAvailable,
} from '@backstage/plugin-github-actions';

// GitHub Pull Requests plugin imports
import {
  EntityGithubPullRequestsContent,
  EntityGithubPullRequestsOverviewCard,
  isGithubPullRequestsAvailable,
} from '@roadiehq/backstage-plugin-github-pull-requests';

// CI/CD Statistics plugin imports
import {
  EntityCicdStatisticsContent,
  EntityCicdStatisticsCard,
  isCicdStatisticsAvailable,
} from '@backstage-community/plugin-cicd-statistics';

// GitHub Insights plugin imports for release tracking and analytics
import {
  EntityGithubInsightsContent,
  EntityGithubInsightsLanguagesCard,
  EntityGithubInsightsReleasesCard,
  EntityGithubInsightsReadmeCard,
  isGithubInsightsAvailable,
} from '@roadiehq/backstage-plugin-github-insights';

// Jenkins plugin imports for CI/CD integration
import {
  EntityJenkinsContent,
  EntityLatestJenkinsRunCard,
  isJenkinsAvailable,
} from '@backstage/plugin-jenkins';

// Topology plugin imports for Kubernetes visualization
import {
  EntityTopologyContent,
  isTopologyAvailable,
} from '@backstage-community/plugin-topology';

// Jaeger plugin imports for distributed tracing
import {
  EntityJaegerContent,
  isJaegerAvailable,
} from '@backstage-community/plugin-jaeger';

// Vault plugin imports for secrets management
import {
  EntityVaultContent,
  EntityVaultCard,
  isVaultAvailable,
} from '@backstage-community/plugin-vault';

// Nexus Repository Manager plugin imports for artifact management
import {
  EntityNexusRepositoryManagerContent,
  EntityNexusRepositoryManagerCard,
  isNexusRepositoryManagerAvailable,
} from '@backstage-community/plugin-nexus-repository-manager';

// Terraform plugin imports for infrastructure management
import {
  EntityTerraformContent,
  EntityTerraformCard,
  EntityTerraformLatestRunCard,
  EntityTerraformWorkspaceHealthAssessmentsCard,
  isTerraformAvailable,
} from '@globallogicuki/backstage-plugin-terraform';

// Argo CD plugin imports for GitOps cluster management
import {
  EntityArgoCDContent,
  EntityArgoCDOverviewCard,
  isArgocdAvailable,
} from '@roadiehq/backstage-plugin-argo-cd';

// Kiali plugin imports for service mesh observability
import {
  EntityKialiContent,
  EntityKialiGraphCard,
  isKialiAvailable,
} from '@backstage-community/plugin-kiali';

// Kubelog plugin imports for Kubernetes log viewing
import {
  EntityKubelogContent,
  isKubelogAvailable,
} from '@jfvilas/plugin-kubelog';

// Import our custom components
import { ServiceOverviewCard } from './ServiceOverviewCard';
import { EnhancedDependencyCard } from './EnhancedDependencyCard';
import { ArgocdDeploymentCard } from './ArgocdDeploymentCard';

// OpsLevel Service Maturity plugin imports
import {
  EntityOpsLevelMaturityContent,
  EntityOpsLevelMaturityCard,
  isOpsLevelMaturityAvailable,
} from '@opslevel/backstage-maturity';

// OpenDORA plugin imports for DORA metrics
import {
  EntityOpenDoraContent,
  EntityOpenDoraCard,
  isOpenDoraAvailable,
} from '@devoteam-nl/open-dora-backstage-plugin';

// Cortex plugin imports for engineering effectiveness
import {
  EntityCortexContent,
  EntityCortexScorecardCard,
  isCortexAvailable,
} from '@cortexapps/backstage-plugin';

// FireHydrant plugin imports for incident management
import {
  EntityFireHydrantContent,
  EntityFireHydrantCard,
  isFireHydrantAvailable,
} from '@backstage-community/plugin-firehydrant';

// Kubernetes GPT Analyzer plugin imports for AI troubleshooting
import {
  EntityKubernetesGptAnalyzerContent,
  EntityKubernetesGptAnalyzerCard,
  isKubernetesGptAnalyzerAvailable,
} from '@veecode-platform/backstage-plugin-kubernetes-gpt-analyzer';

// TODO plugin imports for code quality tracking
import {
  EntityTodoContent,
  isTodoAvailable,
} from '@backstage/plugin-todo';

const techdocsContent = (
  <EntityTechdocsContent>
    <TechDocsAddons>
      <ReportIssue />
    </TechDocsAddons>
  </EntityTechdocsContent>
);

const cicdContent = (
  // This is an example of how you can implement your company's logic in entity page.
  // You can for example enforce that all components of type 'service' should use GitHubActions
  <EntitySwitch>
    <EntitySwitch.Case if={isGithubActionsAvailable}>
      <EntityGithubActionsContent />
    </EntitySwitch.Case>
    <EntitySwitch.Case if={isCicdStatisticsAvailable}>
      <EntityCicdStatisticsContent />
    </EntitySwitch.Case>
    <EntitySwitch.Case if={isJenkinsAvailable}>
      <EntityJenkinsContent />
    </EntitySwitch.Case>
    <EntitySwitch.Case>
      <EmptyState
        title="No CI/CD available for this entity"
        missing="info"
        description="You need to add an annotation to your component if you want to enable CI/CD for it. You can read more about annotations in Backstage by clicking the button below."
        action={
          <Button
            variant="contained"
            color="primary"
            href="https://backstage.io/docs/features/software-catalog/well-known-annotations"
          >
            Read more
          </Button>
        }
      />
    </EntitySwitch.Case>
  </EntitySwitch>
);

const entityWarningContent = (
  <>
    <EntitySwitch>
      <EntitySwitch.Case if={isOrphan}>
        <Grid item xs={12}>
          <EntityOrphanWarning />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>

    <EntitySwitch>
      <EntitySwitch.Case if={hasRelationWarnings}>
        <Grid item xs={12}>
          <EntityRelationWarning />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>

    <EntitySwitch>
      <EntitySwitch.Case if={hasCatalogProcessingErrors}>
        <Grid item xs={12}>
          <EntityProcessingErrorsPanel />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
  </>
);

const overviewContent = (
  <Grid container spacing={3} alignItems="stretch">
    {entityWarningContent}
    <Grid item md={6}>
      <ServiceOverviewCard variant="gridItem" />
    </Grid>
    <Grid item md={6} xs={12}>
      <EnhancedDependencyCard variant="gridItem" />
    </Grid>

    <Grid item md={6} xs={12}>
      <ArgocdDeploymentCard variant="gridItem" />
    </Grid>
    <Grid item md={6} xs={12}>
      <EntityLinksCard />
    </Grid>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isDatadogAvailable}>
        <Grid item md={6} xs={12}>
          <EntityDatadogGraphCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isSentryAvailable}>
        <Grid item md={6} xs={12}>
          <EntitySentryCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isPrometheusAvailable}>
        <Grid item md={6} xs={12}>
          <EntityPrometheusGraphCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isGrafanaAvailable}>
        <Grid item md={6} xs={12}>
          <EntityGrafanaDashboardsCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isSecurityInsightsAvailable}>
        <Grid item md={6} xs={12}>
          <EntitySecurityInsightsCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isLighthouseAvailable}>
        <Grid item md={6} xs={12}>
          <EntityLastLighthouseAuditCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isGithubPullRequestsAvailable}>
        <Grid item md={6} xs={12}>
          <EntityGithubPullRequestsOverviewCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isCicdStatisticsAvailable}>
        <Grid item md={6} xs={12}>
          <EntityCicdStatisticsCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isGithubInsightsAvailable}>
        <Grid item md={6} xs={12}>
          <EntityGithubInsightsReleasesCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isGithubInsightsAvailable}>
        <Grid item md={6} xs={12}>
          <EntityGithubInsightsLanguagesCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isJenkinsAvailable}>
        <Grid item md={6} xs={12}>
          <EntityLatestJenkinsRunCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isVaultAvailable}>
        <Grid item md={6} xs={12}>
          <EntityVaultCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isNexusRepositoryManagerAvailable}>
        <Grid item md={6} xs={12}>
          <EntityNexusRepositoryManagerCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isTerraformAvailable}>
        <Grid item md={6} xs={12}>
          <EntityTerraformCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isTerraformAvailable}>
        <Grid item md={6} xs={12}>
          <EntityTerraformLatestRunCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isTerraformAvailable}>
        <Grid item md={12} xs={12}>
          <EntityTerraformWorkspaceHealthAssessmentsCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isArgocdAvailable}>
        <Grid item md={6} xs={12}>
          <EntityArgoCDOverviewCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isKialiAvailable}>
        <Grid item md={6} xs={12}>
          <EntityKialiGraphCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isOpsLevelMaturityAvailable}>
        <Grid item md={6} xs={12}>
          <EntityOpsLevelMaturityCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isOpenDoraAvailable}>
        <Grid item md={6} xs={12}>
          <EntityOpenDoraCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isCortexAvailable}>
        <Grid item md={6} xs={12}>
          <EntityCortexScorecardCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isFireHydrantAvailable}>
        <Grid item md={6} xs={12}>
          <EntityFireHydrantCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <EntitySwitch>
      <EntitySwitch.Case if={isKubernetesGptAnalyzerAvailable}>
        <Grid item md={6} xs={12}>
          <EntityKubernetesGptAnalyzerCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
    
    <Grid item md={12} xs={12}>
      <EntityHasSubcomponentsCard variant="gridItem" />
    </Grid>
  </Grid>
);

const serviceEntityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      {overviewContent}
    </EntityLayout.Route>

    <EntityLayout.Route path="/deployments" title="Deployments">
      <Grid container spacing={3} alignItems="stretch">
        <Grid item xs={12}>
          <ArgocdDeploymentCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route 
      path="/monitoring" 
      title="Monitoring"
    >
      <Grid container spacing={3} alignItems="stretch">
        <EntitySwitch>
          <EntitySwitch.Case if={isDatadogAvailable}>
            <Grid item xs={12}>
              <EntityDatadogContent />
            </Grid>
          </EntitySwitch.Case>
        </EntitySwitch>
        
        <EntitySwitch>
          <EntitySwitch.Case if={isSentryAvailable}>
            <Grid item xs={12}>
              <EntitySentryContent />
            </Grid>
          </EntitySwitch.Case>
        </EntitySwitch>
        
        <EntitySwitch>
          <EntitySwitch.Case if={isPrometheusAvailable}>
            <Grid item xs={12}>
              <EntityPrometheusContent />
            </Grid>
          </EntitySwitch.Case>
        </EntitySwitch>
        
        <EntitySwitch>
          <EntitySwitch.Case if={isGrafanaAvailable}>
            <Grid item xs={12}>
              <EntityGrafanaContent />
            </Grid>
          </EntitySwitch.Case>
        </EntitySwitch>
        
        <EntitySwitch>
          <EntitySwitch.Case if={isSecurityInsightsAvailable}>
            <Grid item xs={12}>
              <EntitySecurityInsightsContent />
            </Grid>
          </EntitySwitch.Case>
        </EntitySwitch>
        
        <EntitySwitch>
          <EntitySwitch.Case if={isLighthouseAvailable}>
            <Grid item xs={12}>
              <EntityLighthouseContent />
            </Grid>
          </EntitySwitch.Case>
        </EntitySwitch>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route 
      path="/security" 
      title="Security"
      if={isSecurityInsightsAvailable}
    >
      <EntitySecurityInsightsContent />
    </EntityLayout.Route>

    <EntityLayout.Route 
      path="/performance" 
      title="Performance"
      if={isLighthouseAvailable}
    >
      <EntityLighthouseContent />
    </EntityLayout.Route>

    <EntityLayout.Route path="/ci-cd" title="CI/CD">
      {cicdContent}
    </EntityLayout.Route>

    <EntityLayout.Route 
      path="/pull-requests" 
      title="Pull Requests"
      if={isGithubPullRequestsAvailable}
    >
      <EntityGithubPullRequestsContent />
    </EntityLayout.Route>

    <EntityLayout.Route 
      path="/build-analytics" 
      title="Build Analytics"
      if={isCicdStatisticsAvailable}
    >
      <EntityCicdStatisticsContent />
    </EntityLayout.Route>

    <EntityLayout.Route 
      path="/releases" 
      title="Releases"
      if={isGithubInsightsAvailable}
    >
      <Grid container spacing={3} alignItems="stretch">
        <Grid item xs={12}>
          <EntityGithubInsightsContent />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityGithubInsightsReleasesCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityGithubInsightsReadmeCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route
      path="/kubernetes"
      title="Kubernetes"
      if={isKubernetesAvailable}
    >
      <EntityKubernetesContent />
    </EntityLayout.Route>

    <EntityLayout.Route
      path="/topology"
      title="Topology"
      if={isTopologyAvailable}
    >
      <EntityTopologyContent />
    </EntityLayout.Route>

    <EntityLayout.Route
      path="/tracing"
      title="Tracing"
      if={isJaegerAvailable}
    >
      <EntityJaegerContent />
    </EntityLayout.Route>

    <EntityLayout.Route
      path="/secrets"
      title="Secrets"
      if={isVaultAvailable}
    >
      <EntityVaultContent />
    </EntityLayout.Route>

    <EntityLayout.Route
      path="/artifacts"
      title="Artifacts"
      if={isNexusRepositoryManagerAvailable}
    >
      <EntityNexusRepositoryManagerContent />
    </EntityLayout.Route>

    <EntityLayout.Route
      path="/terraform"
      title="Terraform"
      if={isTerraformAvailable}
    >
      <EntityTerraformContent />
    </EntityLayout.Route>

    <EntityLayout.Route
      path="/gitops"
      title="GitOps"
      if={isArgocdAvailable}
    >
      <EntityArgoCDContent />
    </EntityLayout.Route>

    <EntityLayout.Route
      path="/service-mesh"
      title="Service Mesh"
      if={isKialiAvailable}
    >
      <EntityKialiContent />
    </EntityLayout.Route>

    <EntityLayout.Route
      path="/logs"
      title="Logs"
      if={isKubelogAvailable}
    >
      <EntityKubelogContent />
    </EntityLayout.Route>

    <EntityLayout.Route path="/api" title="API">
      <Grid container spacing={3} alignItems="stretch">
        <Grid item md={6}>
          <EntityProvidedApisCard />
        </Grid>
        <Grid item md={6}>
          <EntityConsumedApisCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/dependencies" title="Dependencies">
      <Grid container spacing={3} alignItems="stretch">
        <Grid item xs={12}>
          <EnhancedDependencyCard />
        </Grid>
        <Grid item md={6}>
          <EntityDependsOnComponentsCard variant="gridItem" />
        </Grid>
        <Grid item md={6}>
          <EntityDependsOnResourcesCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/docs" title="Docs">
      {techdocsContent}
    </EntityLayout.Route>

    <EntityLayout.Route 
      path="/todos" 
      title="TODOs"
      if={isTodoAvailable}
    >
      <EntityTodoContent />
    </EntityLayout.Route>

    <EntityLayout.Route 
      path="/service-maturity" 
      title="Service Maturity"
      if={isOpsLevelMaturityAvailable}
    >
      <EntityOpsLevelMaturityContent />
    </EntityLayout.Route>

    <EntityLayout.Route 
      path="/dora-metrics" 
      title="DORA Metrics"
      if={isOpenDoraAvailable}
    >
      <EntityOpenDoraContent />
    </EntityLayout.Route>

    <EntityLayout.Route 
      path="/engineering-effectiveness" 
      title="Engineering Effectiveness"
      if={isCortexAvailable}
    >
      <EntityCortexContent />
    </EntityLayout.Route>

    <EntityLayout.Route 
      path="/incident-management" 
      title="Incident Management"
      if={isFireHydrantAvailable}
    >
      <EntityFireHydrantContent />
    </EntityLayout.Route>

    <EntityLayout.Route 
      path="/ai-troubleshooting" 
      title="AI Troubleshooting"
      if={isKubernetesGptAnalyzerAvailable}
    >
      <EntityKubernetesGptAnalyzerContent />
    </EntityLayout.Route>
  </EntityLayout>
);

const websiteEntityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      {overviewContent}
    </EntityLayout.Route>

    <EntityLayout.Route path="/ci-cd" title="CI/CD">
      {cicdContent}
    </EntityLayout.Route>

    <EntityLayout.Route
      path="/kubernetes"
      title="Kubernetes"
      if={isKubernetesAvailable}
    >
      <EntityKubernetesContent />
    </EntityLayout.Route>

    <EntityLayout.Route path="/dependencies" title="Dependencies">
      <Grid container spacing={3} alignItems="stretch">
        <Grid item md={6}>
          <EntityDependsOnComponentsCard variant="gridItem" />
        </Grid>
        <Grid item md={6}>
          <EntityDependsOnResourcesCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/docs" title="Docs">
      {techdocsContent}
    </EntityLayout.Route>
  </EntityLayout>
);

/**
 * NOTE: This page is designed to work on small screens such as mobile devices.
 * This is based on Material UI Grid. If breakpoints are used, each grid item must set the `xs` prop to a column size or to `true`,
 * since this does not default. If no breakpoints are used, the items will equitably share the available space.
 * https://material-ui.com/components/grid/#basic-grid.
 */

const defaultEntityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      {overviewContent}
    </EntityLayout.Route>

    <EntityLayout.Route path="/docs" title="Docs">
      {techdocsContent}
    </EntityLayout.Route>
  </EntityLayout>
);

const componentPage = (
  <EntitySwitch>
    <EntitySwitch.Case if={isComponentType('service')}>
      {serviceEntityPage}
    </EntitySwitch.Case>

    <EntitySwitch.Case if={isComponentType('website')}>
      {websiteEntityPage}
    </EntitySwitch.Case>

    <EntitySwitch.Case>{defaultEntityPage}</EntitySwitch.Case>
  </EntitySwitch>
);

const apiPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {entityWarningContent}
        <Grid item md={6}>
          <EntityAboutCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard variant="gridItem" height={400} />
        </Grid>
        <Grid item md={4} xs={12}>
          <EntityLinksCard />
        </Grid>
        <Grid container item md={12}>
          <Grid item md={6}>
            <EntityProvidingComponentsCard />
          </Grid>
          <Grid item md={6}>
            <EntityConsumingComponentsCard />
          </Grid>
        </Grid>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/definition" title="Definition">
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <EntityApiDefinitionCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);

const userPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {entityWarningContent}
        <Grid item xs={12} md={6}>
          <EntityUserProfileCard variant="gridItem" />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityOwnershipCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);

const groupPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {entityWarningContent}
        <Grid item xs={12} md={6}>
          <EntityGroupProfileCard variant="gridItem" />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityOwnershipCard variant="gridItem" />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityMembersListCard />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityLinksCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);

const systemPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard variant="gridItem" height={400} />
        </Grid>
        <Grid item md={4} xs={12}>
          <EntityLinksCard />
        </Grid>
        <Grid item md={8}>
          <EntityHasComponentsCard variant="gridItem" />
        </Grid>
        <Grid item md={6}>
          <EntityHasApisCard variant="gridItem" />
        </Grid>
        <Grid item md={6}>
          <EntityHasResourcesCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>
    <EntityLayout.Route path="/diagram" title="Diagram">
      <EntityCatalogGraphCard
        variant="gridItem"
        direction={Direction.TOP_BOTTOM}
        title="System Diagram"
        height={700}
        relations={[
          RELATION_PART_OF,
          RELATION_HAS_PART,
          RELATION_API_CONSUMED_BY,
          RELATION_API_PROVIDED_BY,
          RELATION_CONSUMES_API,
          RELATION_PROVIDES_API,
          RELATION_DEPENDENCY_OF,
          RELATION_DEPENDS_ON,
        ]}
        unidirectional={false}
      />
    </EntityLayout.Route>
  </EntityLayout>
);

const domainPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard variant="gridItem" height={400} />
        </Grid>
        <Grid item md={6}>
          <EntityHasSystemsCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);

export const entityPage = (
  <EntitySwitch>
    <EntitySwitch.Case if={isKind('component')} children={componentPage} />
    <EntitySwitch.Case if={isKind('api')} children={apiPage} />
    <EntitySwitch.Case if={isKind('group')} children={groupPage} />
    <EntitySwitch.Case if={isKind('user')} children={userPage} />
    <EntitySwitch.Case if={isKind('system')} children={systemPage} />
    <EntitySwitch.Case if={isKind('domain')} children={domainPage} />

    <EntitySwitch.Case>{defaultEntityPage}</EntitySwitch.Case>
  </EntitySwitch>
);
