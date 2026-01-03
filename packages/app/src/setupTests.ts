import '@testing-library/jest-dom';

// Mock problematic plugins that cause test failures
// This allows us to focus on core platform functionality during MVP checkpoint

// Mock the Kiali plugin to prevent font-related test failures
jest.mock('@backstage-community/plugin-kiali', () => ({
  EntityKialiContent: () => null,
  EntityKialiGraphCard: () => null,
  isKialiAvailable: () => false,
}));

// Mock the Kubernetes GPT Analyzer plugin to prevent dependency issues
jest.mock('@veecode-platform/backstage-plugin-kubernetes-gpt-analyzer', () => ({
  EntityKubernetesGptAnalyzerContent: () => null,
  EntityKubernetesGptAnalyzerCard: () => null,
  isKubernetesGptAnalyzerAvailable: () => false,
  KubernetesGptAnalyzerPage: () => null,
}));
