/**
 * RBAC Backend Module
 * 
 * Exports the custom RBAC policy module for Backstage
 */

import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import { RBACPolicy } from './rbac-policy-module';

/**
 * Custom RBAC policy module
 * Replaces the allow-all policy with fine-grained access control
 */
export const rbacPolicyModule = createBackendModule({
  pluginId: 'permission',
  moduleId: 'rbac-policy',
  register(env) {
    env.registerInit({
      deps: {
        policy: policyExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ policy, config, logger }) {
        // Create and register the RBAC policy
        const rbacPolicy = new RBACPolicy(config, logger);
        policy.setPolicy(rbacPolicy);
        
        logger.info('RBAC policy module registered successfully');
      },
    });
  },
});

export { RBACPolicy } from './rbac-policy-module';
