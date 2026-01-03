import {
  ScmIntegrationsApi,
  scmIntegrationsApiRef,
  ScmAuth,
} from '@backstage/integration-react';
import {
  AnyApiFactory,
  configApiRef,
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import {
  DatadogApiClient,
  datadogApiRef,
} from '@roadiehq/backstage-plugin-datadog';
import {
  sentryApiRef,
  SentryApi,
} from '@backstage/plugin-sentry';
import {
  CicdStatisticsApi,
  cicdStatisticsApiRef,
  statusTypes,
  ChartTypes,
  FetchBuildsOptions,
  CicdState,
} from '@backstage-community/plugin-cicd-statistics';
import {
  gitOpsApiRef,
  GitOpsRestApi,
} from '@backstage-community/plugin-gitops-profiles';
import { Entity, ApiEntity } from '@backstage/catalog-model';
import { FetchApi } from '@backstage/core-plugin-api';
import { apiDocsConfigRef, defaultDefinitionWidgets } from '@backstage/plugin-api-docs';
import { GrpcPlaygroundComponent } from 'backstage-grpc-playground';

// CI/CD Statistics API implementation for GitHub Actions integration
class GitHubActionsCicdStatisticsClient implements CicdStatisticsApi {
  constructor(private readonly fetchApi: FetchApi) {}

  async getConfiguration(_opts: { entity: Entity }) {
    const chartTypesAllStatuses: Record<string, ChartTypes> = {
      succeeded: ['duration', 'count'],
      failed: ['duration', 'count'],
      running: ['count'],
      aborted: ['count'],
      unknown: ['count'],
      scheduled: ['count'],
      enqueued: ['count'],
      stalled: ['count'],
      expired: ['count'],
    };

    return {
      availableStatuses: statusTypes,
      defaults: {
        normalizeTimeRange: true,
        lowercaseNames: true,
        hideLimit: 6,
        collapsedLimit: 10,
        chartTypes: chartTypesAllStatuses as any,
        filterStatus: ['succeeded', 'failed'],
        filterType: 'all',
      },
      formatStageName: (_parents: string[], name: string) => name,
    };
  }

  async fetchBuilds(options: FetchBuildsOptions): Promise<CicdState> {
    const {
      entity,
      timeFrom,
      timeTo,
      filterStatus,
      filterType,
      abortSignal,
      updateProgress,
    } = options;

    updateProgress(0, 1);

    // Get GitHub project slug from entity annotations
    const projectSlug = entity.metadata.annotations?.['github.com/project-slug'];
    if (!projectSlug) {
      updateProgress(1, 1);
      return { builds: [] };
    }

    try {
      // Fetch GitHub Actions workflow runs via proxy
      const response = await this.fetchApi.fetch(`/api/proxy/github/repos/${projectSlug}/actions/runs?per_page=100`, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        },
        signal: abortSignal,
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform GitHub Actions data to CI/CD Statistics format
      const builds = data.workflow_runs?.map((run: any) => ({
        id: run.id.toString(),
        name: run.name || run.display_title,
        source: 'github-actions',
        status: mapGitHubStatusToCicdStatus(run.status, run.conclusion),
        requestedAt: new Date(run.created_at),
        finishedAt: run.updated_at ? new Date(run.updated_at) : undefined,
        duration: run.updated_at && run.created_at 
          ? new Date(run.updated_at).getTime() - new Date(run.created_at).getTime()
          : undefined,
        stages: [{
          name: run.name || 'Build',
          status: mapGitHubStatusToCicdStatus(run.status, run.conclusion),
          duration: run.updated_at && run.created_at 
            ? new Date(run.updated_at).getTime() - new Date(run.created_at).getTime()
            : undefined,
        }],
        onRestartClick: () => {
          // Optional: implement restart functionality
          console.log('Restart build:', run.id);
        },
      })) || [];

      // Filter builds by time range
      const filteredBuilds = builds.filter((build: any) => {
        const buildTime = build.requestedAt.getTime();
        return buildTime >= timeFrom.getTime() && buildTime <= timeTo.getTime();
      });

      updateProgress(1, 1);
      return { builds: filteredBuilds };
    } catch (error) {
      console.error('Error fetching GitHub Actions data:', error);
      updateProgress(1, 1);
      return { builds: [] };
    }
  }
}

// Helper function to map GitHub Actions status to CI/CD Statistics status
function mapGitHubStatusToCicdStatus(status: string, conclusion: string | null): string {
  if (status === 'completed') {
    switch (conclusion) {
      case 'success':
        return 'succeeded';
      case 'failure':
        return 'failed';
      case 'cancelled':
        return 'aborted';
      case 'skipped':
        return 'aborted';
      default:
        return 'unknown';
    }
  }
  
  switch (status) {
    case 'queued':
      return 'enqueued';
    case 'in_progress':
      return 'running';
    case 'waiting':
      return 'scheduled';
    default:
      return 'unknown';
  }
}

export const apis: AnyApiFactory[] = [
  createApiFactory({
    api: scmIntegrationsApiRef,
    deps: { configApi: configApiRef },
    factory: ({ configApi }) => ScmIntegrationsApi.fromConfig(configApi),
  }),
  createApiFactory({
    api: datadogApiRef,
    deps: { discoveryApi: discoveryApiRef },
    factory: ({ discoveryApi }) => new DatadogApiClient({ discoveryApi }),
  }),
  createApiFactory({
    api: sentryApiRef,
    deps: { discoveryApi: discoveryApiRef, configApi: configApiRef },
    factory: ({ discoveryApi, configApi }) => new SentryApi({ discoveryApi, configApi }),
  }),
  createApiFactory({
    api: cicdStatisticsApiRef,
    deps: { fetchApi: fetchApiRef },
    factory: ({ fetchApi }) => new GitHubActionsCicdStatisticsClient(fetchApi),
  }),
  createApiFactory({
    api: gitOpsApiRef,
    deps: { configApi: configApiRef },
    factory: ({ configApi }) => {
      const baseUrl =
        configApi.getOptionalString('gitopsProfiles.apiBaseUrl') ??
        'http://localhost:3008';
      return new GitOpsRestApi(baseUrl);
    },
  }),
  // gRPC Playground API configuration
  createApiFactory({
    api: apiDocsConfigRef,
    deps: {},
    factory: () => {
      const definitionWidgets = defaultDefinitionWidgets();

      return {
        getApiDefinitionWidget: (apiEntity: ApiEntity) => {
          if (apiEntity.spec.type === 'grpc') {
            return {
              type: 'grpc',
              title: 'gRPC Playground',
              component: GrpcPlaygroundComponent,
            };
          }

          return definitionWidgets.find(d => d.type === apiEntity.spec.type);
        },
      };
    },
  }),
  ScmAuth.createDefaultApiFactory(),
];
