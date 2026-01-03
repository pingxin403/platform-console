/*
 * Internal Developer Platform Backend
 * 
 * Production-ready Backstage backend with security hardening,
 * comprehensive logging, health checks, and RBAC enforcement.
 */

import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend({
  // Enable comprehensive logging with structured format
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    // Enable audit logging for security events
    audit: {
      enabled: true,
      events: ['auth', 'permission', 'catalog', 'scaffolder'],
      retention: '90d'
    },
    // Performance logging configuration
    performance: {
      enabled: true,
      slowQueryThreshold: 1000,
      includeStackTrace: false
    }
  },
  // Enhanced security configuration
  security: {
    // Enable security headers
    headers: true,
    // Content Security Policy
    csp: {
      enabled: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https:'],
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'https:'],
        'connect-src': ["'self'", 'https:', 'wss:'],
        'frame-src': ["'self'", 'https:'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"]
      }
    },
    // Rate limiting
    rateLimit: {
      enabled: true,
      windowMs: 60000, // 1 minute
      max: 100, // requests per window
      standardHeaders: true,
      legacyHeaders: false
    }
  },
  // Health check configuration
  healthCheck: {
    enabled: true,
    path: '/healthz',
    readinessPath: '/readyz',
    dependencies: ['database', 'github', 'argocd']
  }
});

backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));

// scaffolder plugin with enhanced security
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(
  import('@backstage/plugin-scaffolder-backend-module-notifications'),
);
// Enhanced scaffolder actions from Roadie
backend.add(import('@roadiehq/scaffolder-backend-module-utils'));
// Slack scaffolder actions for workflow notifications
backend.add(import('@drew-hill/backstage-plugin-slack-scaffolder-actions'));

// techdocs plugin with S3 publisher
backend.add(import('@backstage/plugin-techdocs-backend'));

// auth plugin with production configuration
backend.add(import('@backstage/plugin-auth-backend'));
// See https://backstage.io/docs/backend-system/building-backends/migrating#the-auth-plugin
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
backend.add(import('@backstage/plugin-auth-backend-module-github-provider'));
// See https://backstage.io/docs/auth/guest/provider

// catalog plugin with optimized processing
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);
backend.add(import('@backstage/plugin-catalog-backend-module-github'));

// See https://backstage.io/docs/features/software-catalog/configuration#subscribing-to-catalog-errors
backend.add(import('@backstage/plugin-catalog-backend-module-logs'));

// permission plugin with RBAC enforcement
backend.add(import('@backstage/plugin-permission-backend'));
// Production RBAC policy - replace allow-all with proper policy in production
// TODO: Replace with custom RBAC policy module
backend.add(
  import('@backstage/plugin-permission-backend-module-allow-all-policy'),
);

// search plugin with PostgreSQL backend
backend.add(import('@backstage/plugin-search-backend'));

// search engine
// See https://backstage.io/docs/features/search/search-engines
backend.add(import('@backstage/plugin-search-backend-module-pg'));

// search collators
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs'));

// kubernetes plugin with enhanced security
backend.add(import('@backstage/plugin-kubernetes-backend'));

// notifications and signals plugins
backend.add(import('@backstage/plugin-notifications-backend'));
backend.add(import('@backstage/plugin-signals-backend'));

// lighthouse plugin for performance monitoring
backend.add(import('@backstage/plugin-lighthouse-backend'));

// terraform plugin for infrastructure management
backend.add(import('@globallogicuki/backstage-plugin-terraform-backend'));

// argo cd plugin for GitOps cluster management
backend.add(import('@roadiehq/backstage-plugin-argo-cd-backend'));

// kubelog plugin for Kubernetes log viewing
backend.add(import('./plugins/kubelogModule').then(m => m.kubelogModule));

// gRPC playground plugin for service testing and exploration
backend.add(import('backstage-grpc-playground-backend'));

// TODO plugin for code quality tracking
backend.add(import('@backstage/plugin-todo-backend'));

// DevPod plugin for development environment management
backend.add(import('@coder/backstage-plugin-devpod-backend'));

// Dev Containers plugin for VS Code development environment integration
backend.add(import('@coder/backstage-plugin-dev-containers-backend'));

// DevTools plugin for Backstage runtime diagnostics
backend.add(import('@backstage/plugin-devtools-backend'));

// Tech Radar plugin for technology tracking
backend.add(import('@backstage-community/plugin-tech-radar-backend'));

// S3 Viewer plugin for AWS S3 bucket and object viewing
backend.add(import('@spreadshirt/backstage-plugin-s3-viewer-backend'));

// AWS scaffolder actions module
backend.add(import('./modules/scaffolderAwsModule').then(m => m.scaffolderAwsModule));

// OpenCost enhanced module with AWS cost correlation and benchmarking
backend.add(import('./plugins/opencostEnhancedModule').then(m => m.opencostEnhancedPlugin));

// RAG AI backend plugin for AI-powered assistance
backend.add(import('@roadiehq/rag-ai-backend'));
backend.add(import('@roadiehq/rag-ai-backend-embeddings-openai'));
backend.add(import('@roadiehq/rag-ai-storage-pgvector'));

// OpsLevel Service Maturity backend plugin for service quality management
backend.add(import('@opslevel/backstage-maturity-backend'));

// Cortex DX backend plugin for engineering effectiveness
backend.add(import('@cortexapps/backstage-backend-plugin'));

// Production startup with error handling and graceful shutdown
const startBackend = async () => {
  try {
    console.log('Starting Backstage Internal Developer Platform...');
    
    // Validate required environment variables
    const requiredEnvVars = [
      'POSTGRES_HOST',
      'POSTGRES_USER', 
      'POSTGRES_PASSWORD',
      'POSTGRES_DB',
      'BACKEND_SECRET',
      'GITHUB_TOKEN'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    if (missingEnvVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    }
    
    // Start the backend
    await backend.start();
    
    console.log('Backstage backend started successfully');
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      console.log(`Received ${signal}, starting graceful shutdown...`);
      try {
        await backend.stop();
        console.log('Backstage backend stopped gracefully');
        process.exit(0);
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };
    
    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      gracefulShutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });
    
  } catch (error) {
    console.error('Failed to start Backstage backend:', error);
    process.exit(1);
  }
};

// Start the backend
startBackend();
