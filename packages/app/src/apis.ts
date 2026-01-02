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
} from '@backstage/core-plugin-api';
import {
  DatadogApiClient,
  datadogApiRef,
} from '@roadiehq/backstage-plugin-datadog';
import {
  sentryApiRef,
  SentryApi,
} from '@backstage/plugin-sentry';

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
  ScmAuth.createDefaultApiFactory(),
];
