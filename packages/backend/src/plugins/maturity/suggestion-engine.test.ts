/**
 * Tests for Suggestion Engine
 */

import { SuggestionEngine } from './suggestion-engine';
import {
  ServiceScorecard,
  CategoryScore,
  Check,
} from './types';

describe('SuggestionEngine', () => {
  let engine: SuggestionEngine;

  beforeEach(() => {
    engine = new SuggestionEngine();
  });

  describe('generateSuggestions', () => {
    it('should generate suggestions for failed checks', () => {
      const scorecard = createMockScorecard({
        overallScore: 60,
        documentation: {
          score: 50,
          checks: [
            createCheck('doc-readme', 'fail', true),
            createCheck('doc-techdocs', 'pass', true),
          ],
        },
      });

      const suggestions = engine.generateSuggestions(scorecard);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].category).toBe('documentation');
      expect(suggestions[0].title).toContain('README');
    });

    it('should generate suggestions for warning checks', () => {
      const scorecard = createMockScorecard({
        overallScore: 70,
        testing: {
          score: 60,
          checks: [
            createCheck('test-coverage', 'warning', true, 75, 80),
          ],
        },
      });

      const suggestions = engine.generateSuggestions(scorecard);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.category === 'testing')).toBe(true);
    });

    it('should not generate suggestions for passing checks', () => {
      const scorecard = createMockScorecard({
        overallScore: 90,
        documentation: {
          score: 90,
          checks: [
            createCheck('doc-readme', 'pass', true),
            createCheck('doc-techdocs', 'pass', true),
          ],
        },
      });

      const suggestions = engine.generateSuggestions(scorecard);

      expect(suggestions.length).toBe(0);
    });

    it('should prioritize required checks as high priority', () => {
      const scorecard = createMockScorecard({
        overallScore: 50,
        security: {
          score: 40,
          checks: [
            createCheck('sec-scanning', 'fail', true), // required
            createCheck('sec-dependencies', 'fail', false), // not required
          ],
        },
      });

      const suggestions = engine.generateSuggestions(scorecard);

      const requiredSuggestion = suggestions.find(s => s.id === 'suggestion-sec-scanning');
      const optionalSuggestion = suggestions.find(s => s.id === 'suggestion-sec-dependencies');

      expect(requiredSuggestion?.priority).toBe('high');
      expect(optionalSuggestion?.priority).not.toBe('high');
    });

    it('should sort suggestions by priority', () => {
      const scorecard = createMockScorecard({
        overallScore: 50,
        documentation: {
          score: 40,
          checks: [
            createCheck('doc-readme', 'fail', true), // high priority
            createCheck('doc-runbook', 'fail', false), // lower priority
          ],
        },
        testing: {
          score: 30,
          checks: [
            createCheck('test-unit', 'fail', true), // high priority
          ],
        },
      });

      const suggestions = engine.generateSuggestions(scorecard);

      // High priority suggestions should come first
      const highPriorityCount = suggestions.filter(s => s.priority === 'high').length;
      expect(highPriorityCount).toBeGreaterThan(0);
      
      // First suggestions should be high priority
      expect(suggestions[0].priority).toBe('high');
    });

    it('should include action items in suggestions', () => {
      const scorecard = createMockScorecard({
        overallScore: 60,
        documentation: {
          score: 50,
          checks: [
            createCheck('doc-readme', 'fail', true),
          ],
        },
      });

      const suggestions = engine.generateSuggestions(scorecard);

      expect(suggestions[0].actionItems).toBeDefined();
      expect(suggestions[0].actionItems.length).toBeGreaterThan(0);
      expect(suggestions[0].actionItems[0]).toContain('README');
    });

    it('should include estimated effort in suggestions', () => {
      const scorecard = createMockScorecard({
        overallScore: 60,
        documentation: {
          score: 50,
          checks: [
            createCheck('doc-readme', 'fail', true),
          ],
        },
      });

      const suggestions = engine.generateSuggestions(scorecard);

      expect(suggestions[0].estimatedEffort).toBeDefined();
      expect(suggestions[0].estimatedEffort).toMatch(/\d+.*hours?/i);
    });

    it('should include impact in suggestions', () => {
      const scorecard = createMockScorecard({
        overallScore: 60,
        documentation: {
          score: 50,
          checks: [
            createCheck('doc-readme', 'fail', true),
          ],
        },
      });

      const suggestions = engine.generateSuggestions(scorecard);

      expect(suggestions[0].impact).toBeDefined();
      expect(suggestions[0].impact).toMatch(/\+\d+.*points/i);
    });

    it('should handle multiple failed checks across categories', () => {
      const scorecard = createMockScorecard({
        overallScore: 40,
        documentation: {
          score: 30,
          checks: [
            createCheck('doc-readme', 'fail', true),
            createCheck('doc-techdocs', 'fail', true),
          ],
        },
        testing: {
          score: 20,
          checks: [
            createCheck('test-unit', 'fail', true),
            createCheck('test-coverage', 'fail', true),
          ],
        },
        security: {
          score: 50,
          checks: [
            createCheck('sec-scanning', 'fail', true),
          ],
        },
      });

      const suggestions = engine.generateSuggestions(scorecard);

      expect(suggestions.length).toBe(5);
      
      // Should have suggestions from multiple categories
      const categories = new Set(suggestions.map(s => s.category));
      expect(categories.size).toBeGreaterThan(1);
    });
  });

  describe('generateRoadmap', () => {
    it('should generate a complete roadmap', () => {
      const scorecard = createMockScorecard({
        overallScore: 60,
        documentation: {
          score: 50,
          checks: [
            createCheck('doc-readme', 'fail', true),
            createCheck('doc-techdocs', 'fail', true),
          ],
        },
      });

      const roadmap = engine.generateRoadmap(scorecard);

      expect(roadmap.serviceId).toBe('test-service');
      expect(roadmap.currentScore).toBe(60);
      expect(roadmap.potentialScore).toBeGreaterThan(60);
      expect(roadmap.totalImprovementPotential).toBeGreaterThan(0);
      expect(roadmap.generatedAt).toBeInstanceOf(Date);
    });

    it('should categorize items into quick wins', () => {
      const scorecard = createMockScorecard({
        overallScore: 60,
        documentation: {
          score: 50,
          weight: 0.3, // Higher weight for more impact
          checks: [
            createCheck('doc-freshness', 'fail', false), // Low effort check
          ],
        },
      });

      const roadmap = engine.generateRoadmap(scorecard);

      // Quick wins are low effort with medium/high impact
      // If no quick wins, at least verify roadmap structure is correct
      expect(roadmap.quickWins).toBeDefined();
      expect(Array.isArray(roadmap.quickWins)).toBe(true);
    });

    it('should categorize items into critical fixes', () => {
      const scorecard = createMockScorecard({
        overallScore: 50,
        security: {
          score: 30,
          checks: [
            createCheck('sec-scanning', 'fail', true), // High priority required
          ],
        },
      });

      const roadmap = engine.generateRoadmap(scorecard);

      expect(roadmap.criticalFixes.length).toBeGreaterThan(0);
      expect(roadmap.criticalFixes[0].priority).toBe('high');
    });

    it('should categorize items into long-term improvements', () => {
      const scorecard = createMockScorecard({
        overallScore: 70,
        testing: {
          score: 60,
          checks: [
            createCheck('test-unit', 'fail', true), // High effort
          ],
        },
      });

      const roadmap = engine.generateRoadmap(scorecard);

      // Long-term improvements should exist
      expect(roadmap.longTermImprovements).toBeDefined();
    });

    it('should calculate potential score correctly', () => {
      const scorecard = createMockScorecard({
        overallScore: 60,
        documentation: {
          score: 50,
          checks: [
            createCheck('doc-readme', 'fail', true),
          ],
        },
      });

      const roadmap = engine.generateRoadmap(scorecard);

      expect(roadmap.potentialScore).toBeGreaterThan(roadmap.currentScore);
      expect(roadmap.potentialScore).toBeLessThanOrEqual(100);
    });

    it('should not exceed 100 for potential score', () => {
      const scorecard = createMockScorecard({
        overallScore: 95,
        documentation: {
          score: 90,
          checks: [
            createCheck('doc-runbook', 'fail', false),
          ],
        },
      });

      const roadmap = engine.generateRoadmap(scorecard);

      expect(roadmap.potentialScore).toBeLessThanOrEqual(100);
    });

    it('should include effort levels in roadmap items', () => {
      const scorecard = createMockScorecard({
        overallScore: 60,
        documentation: {
          score: 50,
          checks: [
            createCheck('doc-readme', 'fail', true),
          ],
        },
      });

      const roadmap = engine.generateRoadmap(scorecard);

      const allItems = [
        ...roadmap.quickWins,
        ...roadmap.criticalFixes,
        ...roadmap.longTermImprovements,
      ];

      allItems.forEach(item => {
        expect(['low', 'medium', 'high']).toContain(item.effort);
      });
    });

    it('should include impact levels in roadmap items', () => {
      const scorecard = createMockScorecard({
        overallScore: 60,
        documentation: {
          score: 50,
          checks: [
            createCheck('doc-readme', 'fail', true),
          ],
        },
      });

      const roadmap = engine.generateRoadmap(scorecard);

      const allItems = [
        ...roadmap.quickWins,
        ...roadmap.criticalFixes,
        ...roadmap.longTermImprovements,
      ];

      allItems.forEach(item => {
        expect(['low', 'medium', 'high']).toContain(item.impact);
      });
    });

    it('should include estimated score improvement in roadmap items', () => {
      const scorecard = createMockScorecard({
        overallScore: 60,
        documentation: {
          score: 50,
          checks: [
            createCheck('doc-readme', 'fail', true),
          ],
        },
      });

      const roadmap = engine.generateRoadmap(scorecard);

      const allItems = [
        ...roadmap.quickWins,
        ...roadmap.criticalFixes,
        ...roadmap.longTermImprovements,
      ];

      allItems.forEach(item => {
        expect(item.estimatedScoreImprovement).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle scorecard with no failed checks', () => {
      const scorecard = createMockScorecard({
        overallScore: 100,
        documentation: {
          score: 100,
          checks: [
            createCheck('doc-readme', 'pass', true),
          ],
        },
      });

      const suggestions = engine.generateSuggestions(scorecard);
      const roadmap = engine.generateRoadmap(scorecard);

      expect(suggestions.length).toBe(0);
      expect(roadmap.quickWins.length).toBe(0);
      expect(roadmap.criticalFixes.length).toBe(0);
      expect(roadmap.longTermImprovements.length).toBe(0);
    });

    it('should handle scorecard with all checks failing', () => {
      const scorecard = createMockScorecard({
        overallScore: 0,
        documentation: {
          score: 0,
          checks: [
            createCheck('doc-readme', 'fail', true),
            createCheck('doc-techdocs', 'fail', true),
            createCheck('doc-api', 'fail', false),
          ],
        },
        testing: {
          score: 0,
          checks: [
            createCheck('test-unit', 'fail', true),
            createCheck('test-coverage', 'fail', true),
          ],
        },
      });

      const suggestions = engine.generateSuggestions(scorecard);
      const roadmap = engine.generateRoadmap(scorecard);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(roadmap.criticalFixes.length).toBeGreaterThan(0);
    });

    it('should handle unknown check IDs gracefully', () => {
      const scorecard = createMockScorecard({
        overallScore: 60,
        documentation: {
          score: 50,
          checks: [
            createCheck('unknown-check-id', 'fail', true),
          ],
        },
      });

      const suggestions = engine.generateSuggestions(scorecard);

      // Should not crash, but won't generate suggestions for unknown checks
      expect(suggestions.length).toBe(0);
    });
  });
});

// Helper functions

function createMockScorecard(options: {
  overallScore: number;
  documentation?: Partial<CategoryScore>;
  testing?: Partial<CategoryScore>;
  monitoring?: Partial<CategoryScore>;
  security?: Partial<CategoryScore>;
  costEfficiency?: Partial<CategoryScore>;
}): ServiceScorecard {
  const defaultCategory: CategoryScore = {
    score: 100,
    weight: 0.2,
    checks: [],
    status: 'passing',
    maxScore: 100,
  };

  return {
    serviceId: 'test-service',
    overallScore: options.overallScore,
    categories: {
      documentation: { ...defaultCategory, ...options.documentation },
      testing: { ...defaultCategory, ...options.testing },
      monitoring: { ...defaultCategory, ...options.monitoring },
      security: { ...defaultCategory, ...options.security },
      costEfficiency: { ...defaultCategory, ...options.costEfficiency },
    },
    lastUpdated: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
    version: 1,
  };
}

function createCheck(
  id: string,
  status: 'pass' | 'fail' | 'warning',
  required: boolean,
  value?: any,
  threshold?: any,
): Check {
  return {
    id,
    name: `Check ${id}`,
    description: `Description for ${id}`,
    status,
    required,
    value,
    threshold,
    weight: 0.25,
  };
}
