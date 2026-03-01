/**
 * Service Maturity Scoring Plugin
 * 
 * This plugin provides service maturity scoring across 5 categories:
 * - Documentation
 * - Testing
 * - Monitoring
 * - Security
 * - Cost Efficiency
 */

export { serviceMaturityPlugin as default } from './plugin';
export * from './types';
export { ScoringEngine } from './scoring-engine';
export { SuggestionEngine } from './suggestion-engine';
export type { ImprovementRoadmap, RoadmapItem } from './suggestion-engine';
export { MaturityScoreCache } from './cache';
export { ReadinessGate, DEFAULT_READINESS_CONFIG } from './readiness-gate';
export type { ReadinessGateConfig, ApprovalRequest } from './readiness-gate';
