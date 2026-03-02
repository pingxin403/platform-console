/**
 * Test configuration and constants for E2E tests
 */

export const TEST_CONFIG = {
  // Base URLs
  BASE_URL: process.env.PLAYWRIGHT_URL || 'http://localhost:3000',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:7007',
  
  // Timeouts (in milliseconds)
  TIMEOUTS: {
    DEFAULT: 60000,        // 60 seconds
    PAGE_LOAD: 10000,      // 10 seconds
    NAVIGATION: 5000,      // 5 seconds
    ELEMENT_VISIBLE: 5000, // 5 seconds
    API_RESPONSE: 10000,   // 10 seconds
    SERVICE_CREATION: 30000, // 30 seconds
  },
  
  // Test data
  TEST_DATA: {
    SERVICE: {
      NAME_PREFIX: 'e2e-test-service',
      DESCRIPTION: 'E2E test service created by Playwright',
      OWNER: 'platform-team',
      TEAM: 'platform',
    },
    USER: {
      DEFAULT_USERNAME: 'test-user',
      DEFAULT_EMAIL: 'test@example.com',
    },
  },
  
  // Feature flags
  FEATURES: {
    COST_TRACKING: true,
    ARGOCD_INTEGRATION: true,
    TECH_INSIGHTS: true,
    DORA_METRICS: true,
    SEARCH: true,
  },
  
  // Selectors (common UI elements)
  SELECTORS: {
    // Navigation
    CREATE_BUTTON: 'a[href="/create"]',
    CATALOG_LINK: 'a[href="/catalog"]',
    SEARCH_INPUT: 'input[placeholder*="search" i]',
    
    // Catalog
    SERVICE_CARD: '[data-testid="entity-link"]',
    TEMPLATE_CARD: '[data-testid="template-card"]',
    
    // Forms
    NAME_INPUT: 'input[name="name"]',
    DESCRIPTION_INPUT: 'input[name="description"], textarea[name="description"]',
    OWNER_INPUT: 'input[name="owner"]',
    
    // Buttons
    CREATE_BUTTON_TEXT: 'button:has-text("Create")',
    NEXT_BUTTON: 'button:has-text("Next")',
    CHOOSE_BUTTON: 'button:has-text("Choose")',
    SYNC_BUTTON: 'button:has-text("Sync")',
    
    // Tabs
    COST_TAB: 'button:has-text("Cost"), button:has-text("OpenCost")',
    DEPLOYMENT_TAB: 'button:has-text("CD"), button:has-text("ArgoCD")',
    SCORECARD_TAB: 'button:has-text("Scorecard"), button:has-text("Tech Insights")',
    
    // Status indicators
    SUCCESS_MESSAGE: 'text=success, text=Success, [data-testid="success-message"]',
    ERROR_MESSAGE: 'text=error, text=Error, [data-testid="error-message"]',
  },
  
  // Templates
  TEMPLATES: {
    GO_SERVICE: 'Go Service',
    JAVA_SERVICE: 'Java Service',
    REACT_APP: 'React App',
    REACT_NATIVE_APP: 'React Native App',
  },
  
  // Deployment environments
  ENVIRONMENTS: ['development', 'staging', 'production'],
  
  // Cost categories
  COST_CATEGORIES: ['CPU', 'Memory', 'Storage', 'RDS', 'S3'],
  
  // Maturity scorecard categories
  SCORECARD_CATEGORIES: [
    'Documentation',
    'Testing',
    'Monitoring',
    'Security',
    'Cost Efficiency',
  ],
  
  // Deployment statuses
  DEPLOYMENT_STATUSES: {
    SYNC: ['Synced', 'OutOfSync', 'Unknown'],
    HEALTH: ['Healthy', 'Progressing', 'Degraded', 'Suspended'],
  },
};

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig() {
  const env = process.env.NODE_ENV || 'development';
  
  const configs = {
    development: {
      ...TEST_CONFIG,
      BASE_URL: 'http://localhost:3000',
      BACKEND_URL: 'http://localhost:7007',
    },
    staging: {
      ...TEST_CONFIG,
      BASE_URL: process.env.STAGING_URL || 'https://staging.example.com',
      BACKEND_URL: process.env.STAGING_BACKEND_URL || 'https://staging-api.example.com',
    },
    production: {
      ...TEST_CONFIG,
      BASE_URL: process.env.PRODUCTION_URL || 'https://platform.example.com',
      BACKEND_URL: process.env.PRODUCTION_BACKEND_URL || 'https://api.example.com',
      TIMEOUTS: {
        ...TEST_CONFIG.TIMEOUTS,
        DEFAULT: 90000, // Longer timeouts for production
      },
    },
  };
  
  return configs[env as keyof typeof configs] || configs.development;
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(featureName: keyof typeof TEST_CONFIG.FEATURES): boolean {
  return TEST_CONFIG.FEATURES[featureName];
}

/**
 * Generate test service name
 */
export function generateServiceName(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${TEST_CONFIG.TEST_DATA.SERVICE.NAME_PREFIX}-${timestamp}-${random}`;
}

/**
 * Get selector by name
 */
export function getSelector(selectorName: string): string {
  return TEST_CONFIG.SELECTORS[selectorName as keyof typeof TEST_CONFIG.SELECTORS] || selectorName;
}
