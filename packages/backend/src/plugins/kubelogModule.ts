import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import { createRouter } from '@jfvilas/plugin-kubelog-backend';

export const kubelogModule = createBackendModule({
  pluginId: 'kubelog',
  moduleId: 'router',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        discovery: coreServices.discovery,
        auth: coreServices.auth,
        permissions: coreServices.permissions,
        tokenManager: coreServices.tokenManager,
      },
      async init({
        httpRouter,
        logger,
        config,
        discovery,
        auth,
        permissions,
        tokenManager,
      }) {
        const router = await createRouter({
          logger,
          config,
          discovery,
          auth,
          permissions,
          tokenManager,
        });
        httpRouter.use('/kubelog', router);
      },
    });
  },
});
