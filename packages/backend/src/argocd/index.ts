/**
 * Argo CD integration module
 * Provides deployment status and GitOps management capabilities
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

export { ArgocdService, createArgocdService } from './argocd-service';
export { createArgocdRouter } from './argocd-router';
export { ArgocdErrorHandler, createArgocdErrorHandler } from './error-handler';
export type {
  DeploymentStatus,
  MultiEnvironmentStatus,
  SyncResult,
} from './argocd-service';
export type {
  DeploymentError,
  ManualSyncOperation,
  RecoveryAction,
} from './error-handler';
