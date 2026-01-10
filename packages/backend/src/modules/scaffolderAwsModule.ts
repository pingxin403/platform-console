/*
 * AWS Scaffolder Actions Module
 * 
 * Provides AWS-specific scaffolder actions for S3, ECR, and Secrets Manager operations.
 */

import { createBackendModule, coreServices } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import {
  createAwsS3CpAction,
  createEcrAction,
  createAwsSecretsManagerCreateAction,
} from '@roadiehq/scaffolder-backend-module-aws';

export const scaffolderAwsModule = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'aws-actions',
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        logger: coreServices.logger,
      },
      init({ scaffolder, logger }) {
        logger.info('Registering Roadie AWS scaffolder actions');
        
        // Register AWS S3 copy action
        scaffolder.addActions(createAwsS3CpAction());
        
        // Register ECR repository creation action
        scaffolder.addActions(createEcrAction());
        
        // Register AWS Secrets Manager create action
        scaffolder.addActions(createAwsSecretsManagerCreateAction());
        
        logger.info('AWS scaffolder actions registered successfully');
      },
    });
  },
});