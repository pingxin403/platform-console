import '@testing-library/jest-dom';

// Mock problematic plugins that cause test failures
// This allows us to focus on core platform functionality during MVP checkpoint

// Mock the Kiali plugin to prevent font-related test failures
jest.mock('@backstage-community/plugin-kiali', () => ({
  EntityKialiContent: () => null,
  EntityKialiGraphCard: () => null,
  isKialiAvailable: () => false,
}));

// Note: @veecode-platform/backstage-plugin-kubernetes-gpt-analyzer is not installed
// If you need AI-powered Kubernetes troubleshooting, install it with:
// yarn workspace app add @veecode-platform/backstage-plugin-kubernetes-gpt-analyzer
