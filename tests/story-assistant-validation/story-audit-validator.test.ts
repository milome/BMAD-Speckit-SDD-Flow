import { describe, it, expect, beforeEach } from 'vitest';
import { StoryAuditValidator } from '../../src/story-assistant-validation/story-audit-validator';
import { AuditReport } from '../../src/story-assistant-validation/types';

describe('StoryAuditValidator', () => {
  let validator: StoryAuditValidator;

  beforeEach(() => {
    validator = new StoryAuditValidator({
      epic: 'E001',
      story: 'S001',
      epicSlug: 'test-epic',
      storySlug: 'test-story',
    });
  });

  describe('T2.1: StoryAuditValidator 基础结构', () => {
    it('should create validator with required options', () => {
      expect(validator).toBeDefined();
      expect(validator.options.epic).toBe('E001');
      expect(validator.options.story).toBe('S001');
    });

    it('should have validateAuditReport method', () => {
      expect(validator.validateAuditReport).toBeDefined();
      expect(typeof validator.validateAuditReport).toBe('function');
    });

    it('should have parseScoringBlock method', () => {
      expect(validator.parseScoringBlock).toBeDefined();
      expect(typeof validator.parseScoringBlock).toBe('function');
    });

    it('should have validateProhibitedWordsDetection method', () => {
      expect(validator.validateProhibitedWordsDetection).toBeDefined();
      expect(typeof validator.validateProhibitedWordsDetection).toBe('function');
    });
  });

  describe('T2.2: 禁止词识别验证', () => {
    it('should validate prohibited words were detected in audit', () => {
      const auditContent = '## Audit Report\n\nFound prohibited words: 可能, 也许\n\n## Scoring';
      const result = validator.validateProhibitedWordsDetection(auditContent, ['可能', '也许']);
      expect(result.passed).toBe(true);
    });

    it('should fail if prohibited words not detected', () => {
      const auditContent = '## Audit Report\n\nNo issues found\n\n## Scoring';
      const result = validator.validateProhibitedWordsDetection(auditContent, ['可能', '也许']);
      expect(result.passed).toBe(false);
    });

    it('should return error severity when prohibited words exist but not detected', () => {
      const auditContent = 'Clean document';
      const result = validator.validateProhibitedWordsDetection(auditContent, ['可能']);
      expect(result.severity).toBe('error');
    });
  });

  describe('T2.3: 评分块验证', () => {
    it('should parse valid JSON scoring block', () => {
      const content = `
## Scoring Block

\`\`\`json
{
  "dimensions": [
    { "name": "clarity", "score": 8, "maxScore": 10 },
    { "name": "completeness", "score": 7, "maxScore": 10 }
  ],
  "totalScore": 75,
  "grade": "B"
}
\`\`\`
      `;
      const result = validator.parseScoringBlock(content);
      expect(result).toBeDefined();
      expect(result?.dimensions).toHaveLength(2);
    });

    it('should return null for invalid JSON', () => {
      const content = '## Scoring\n\n```json\ninvalid json\n```';
      const result = validator.parseScoringBlock(content);
      expect(result).toBeNull();
    });

    it('should validate scoring dimensions are complete', () => {
      const report: AuditReport = {
        epic: 'E001',
        story: 'S001',
        grade: 'B',
        totalScore: 85,
        maxScore: 100,
        dimensions: [
          { name: 'clarity', score: 8, maxScore: 10 },
          { name: 'completeness', score: 7, maxScore: 10 },
          { name: 'consistency', score: 6, maxScore: 10 },
          { name: 'testability', score: 7, maxScore: 10 },
          { name: 'feasibility', score: 8, maxScore: 10 },
        ],
        gaps: [],
        iterationCount: 1,
        timestamp: '2024-01-01',
      };

      const results = validator.validateScoringDimensions(report);
      const allPassed = results.every((r) => r.passed);
      expect(allPassed).toBe(true);
    });

    it('should fail when scoring dimensions are incomplete', () => {
      const report: AuditReport = {
        epic: 'E001',
        story: 'S001',
        grade: 'B',
        totalScore: 85,
        maxScore: 100,
        dimensions: [{ name: 'clarity', score: 8, maxScore: 10 }],
        gaps: [],
        iterationCount: 1,
        timestamp: '2024-01-01',
      };

      const results = validator.validateScoringDimensions(report);
      expect(results.some((r) => !r.passed)).toBe(true);
    });

    it('should validate JSON format is parseable', () => {
      const validContent = '{"dimensions":[],"totalScore":80}';
      const result = validator.validateJsonFormat(validContent);
      expect(result.passed).toBe(true);
    });

    it('should fail when JSON is not parseable', () => {
      const invalidContent = 'not valid json';
      const result = validator.validateJsonFormat(invalidContent);
      expect(result.passed).toBe(false);
    });
  });

  describe('T2.4: 审计报告路径验证', () => {
    it('should validate audit report path format', () => {
      const path =
        '_bmad-output/implementation-artifacts/epic-E001-test-epic/story-E001-5-verify-story-assistant-enhancement/AUDIT_spec-E001-S001.md';
      const result = validator.validateAuditPath(path);
      expect(result.passed).toBe(true);
    });

    it('should fail for invalid path format', () => {
      const path = 'invalid/path/to/audit.md';
      const result = validator.validateAuditPath(path);
      expect(result.passed).toBe(false);
    });

    it('should validate path contains epic and story identifiers', () => {
      const path =
        '_bmad-output/implementation-artifacts/epic-E001/story-S001/AUDIT_spec-E001-S001.md';
      const result = validator.validateAuditPath(path);
      expect(result.passed).toBe(true);
    });
  });

  describe('完整审计验证流程', () => {
    it('should validate complete audit report', async () => {
      const auditContent = `
# AUDIT: E001-S001

## Audit Summary
- Grade: B
- Total Score: 85/100
- Iteration: 1

## Gap Analysis
No significant gaps found.

## Scoring Block

\`\`\`json
{
  "epic": "E001",
  "story": "S001",
  "grade": "B",
  "totalScore": 85,
  "maxScore": 100,
  "dimensions": [
    { "name": "clarity", "score": 8, "maxScore": 10, "feedback": "Clear" },
    { "name": "completeness", "score": 7, "maxScore": 10, "feedback": "Complete" },
    { "name": "consistency", "score": 6, "maxScore": 10, "feedback": "Consistent" },
    { "name": "testability", "score": 7, "maxScore": 10, "feedback": "Testable" },
    { "name": "feasibility", "score": 8, "maxScore": 10, "feedback": "Feasible" }
  ],
  "gaps": [],
  "iterationCount": 1,
  "timestamp": "2024-01-01T00:00:00Z"
}
\`\`\`
      `;

      const report = await validator.validateAuditReport(auditContent);
      expect(report).toBeDefined();
      expect(report.epic).toBe('E001');
      expect(report.story).toBe('S001');
    });
  });
});
