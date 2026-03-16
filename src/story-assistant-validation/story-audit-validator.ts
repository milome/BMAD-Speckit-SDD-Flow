/**
 * Story Audit Validator
 * @module story-audit-validator
 *
 * Validates audit reports for proper format, scoring, and content.
 */

import { ValidationResult, ValidatorOptions, AuditReport } from './types';
import { SCORING_DIMENSIONS } from './constants';

/**
 * Validator for story audit reports
 */
export class StoryAuditValidator {
  /** Validator configuration options */
  options: ValidatorOptions;

  /**
   * Creates a new StoryAuditValidator instance
   * @param options - Validator configuration options
   */
  constructor(options: ValidatorOptions) {
    this.options = options;
  }

  /**
   * Validates a complete audit report
   * @param content - The audit report content to validate
   * @returns Promise resolving to an audit report
   */
  async validateAuditReport(content: string): Promise<AuditReport> {
    const results: ValidationResult[] = [];

    // Parse scoring block
    const scoringBlock = this.parseScoringBlock(content);

    if (!scoringBlock) {
      results.push({
        passed: false,
        check: 'scoring_block_parse',
        message: 'Failed to parse scoring block from audit report',
        severity: 'error',
      });

      // Return minimal report on parse failure
      return {
        epic: this.options.epic,
        story: this.options.story,
        grade: 'F',
        totalScore: 0,
        maxScore: 100,
        dimensions: [],
        gaps: ['Failed to parse scoring block'],
        iterationCount: 0,
        timestamp: new Date().toISOString(),
      };
    }

    // Validate scoring dimensions
    const dimensionResults = this.validateScoringDimensions(scoringBlock);
    results.push(...dimensionResults);

    // Validate JSON format
    const jsonResult = this.validateJsonFormat(JSON.stringify(scoringBlock));
    results.push(jsonResult);

    // Validate report structure
    const structureResults = this.validateReportStructure(scoringBlock);
    results.push(...structureResults);

    return {
      ...scoringBlock,
      epic: this.options.epic,
      story: this.options.story,
    };
  }

  /**
   * Parses the scoring block from audit report content
   * @param content - The audit report content
   * @returns Parsed audit report or null if parsing fails
   */
  parseScoringBlock(content: string): AuditReport | null {
    // Look for JSON block in markdown code fences
    const jsonRegex = /```json\s*([\s\S]*?)```/;
    const match = content.match(jsonRegex);

    if (!match) {
      return null;
    }

    try {
      const parsed = JSON.parse(match[1].trim()) as AuditReport;

      // Validate required fields
      if (!parsed.dimensions || !Array.isArray(parsed.dimensions)) {
        return null;
      }

      if (typeof parsed.totalScore !== 'number') {
        return null;
      }

      if (typeof parsed.grade !== 'string') {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Validates that prohibited words were detected
   * @param auditContent - The audit report content
   * @param expectedWords - Words that should have been detected
   * @returns Validation result
   */
  validateProhibitedWordsDetection(
    auditContent: string,
    expectedWords: string[]
  ): ValidationResult {
    const detectedWords: string[] = [];

    for (const word of expectedWords) {
      if (auditContent.includes(word)) {
        detectedWords.push(word);
      }
    }

    if (expectedWords.length > 0 && detectedWords.length === 0) {
      return {
        passed: false,
        check: 'prohibited_words_detection',
        message: `Audit did not detect prohibited words: ${expectedWords.join(', ')}`,
        severity: 'error',
      };
    }

    if (detectedWords.length < expectedWords.length) {
      const missing = expectedWords.filter((w) => !detectedWords.includes(w));
      return {
        passed: false,
        check: 'prohibited_words_detection',
        message: `Audit missed prohibited words: ${missing.join(', ')}`,
        severity: 'warning',
      };
    }

    return {
      passed: true,
      check: 'prohibited_words_detection',
      message: `All ${detectedWords.length} prohibited words detected`,
      severity: 'info',
    };
  }

  /**
   * Validates scoring dimensions are complete
   * @param report - The audit report to validate
   * @returns Array of validation results
   */
  validateScoringDimensions(report: AuditReport): ValidationResult[] {
    const results: ValidationResult[] = [];
    const dimensionNames = report.dimensions.map((d) => d.name);

    // Check all required dimensions are present
    for (const requiredDim of SCORING_DIMENSIONS) {
      if (!dimensionNames.includes(requiredDim)) {
        results.push({
          passed: false,
          check: `dimension_${requiredDim}`,
          message: `Missing scoring dimension: ${requiredDim}`,
          severity: 'error',
        });
      } else {
        const dim = report.dimensions.find((d) => d.name === requiredDim);
        if (dim) {
          results.push({
            passed: true,
            check: `dimension_${requiredDim}`,
            message: `Dimension ${requiredDim}: ${dim.score}/${dim.maxScore}`,
            severity: 'info',
          });
        }
      }
    }

    // Validate dimension scores
    for (const dim of report.dimensions) {
      if (dim.score < 0 || dim.score > dim.maxScore) {
        results.push({
          passed: false,
          check: `dimension_${dim.name}_score`,
          message: `Invalid score for ${dim.name}: ${dim.score} (max: ${dim.maxScore})`,
          severity: 'error',
        });
      }
    }

    return results;
  }

  /**
   * Validates JSON format is parseable
   * @param content - JSON content to validate
   * @returns Validation result
   */
  validateJsonFormat(content: string): ValidationResult {
    try {
      JSON.parse(content);
      return {
        passed: true,
        check: 'json_format',
        message: 'JSON format is valid',
        severity: 'info',
      };
    } catch (error) {
      return {
        passed: false,
        check: 'json_format',
        message: `Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      };
    }
  }

  /**
   * Validates audit report path format
   * @param path - The audit report path
   * @returns Validation result
   */
  validateAuditPath(path: string): ValidationResult {
    // Expected format: _bmad-output/implementation-artifacts/epic-{epic}/{story-path}/AUDIT_*.md
    const pathRegex =
      /_bmad-output\/implementation-artifacts\/epic-[^/]+\/story-[^/]+\/AUDIT_.+\.md$/;

    if (!pathRegex.test(path)) {
      return {
        passed: false,
        check: 'audit_path_format',
        message: `Invalid audit path format: ${path}`,
        severity: 'error',
      };
    }

    // Check epic and story identifiers are present
    const epicMatch = path.match(/epic-([^/]+)/);
    const storyMatch = path.match(/story-([^/]+)/);

    if (!epicMatch || !storyMatch) {
      return {
        passed: false,
        check: 'audit_path_identifiers',
        message: 'Audit path missing epic or story identifiers',
        severity: 'error',
      };
    }

    return {
      passed: true,
      check: 'audit_path_format',
      message: 'Audit path format is valid',
      severity: 'info',
    };
  }

  /**
   * Validates report structure has required fields
   * @param report - The audit report to validate
   * @returns Array of validation results
   */
  private validateReportStructure(report: AuditReport): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Validate iteration count
    if (typeof report.iterationCount !== 'number' || report.iterationCount < 0) {
      results.push({
        passed: false,
        check: 'iteration_count',
        message: 'Invalid or missing iteration count',
        severity: 'error',
      });
    } else {
      results.push({
        passed: true,
        check: 'iteration_count',
        message: `Iteration count: ${report.iterationCount}`,
        severity: 'info',
      });
    }

    // Validate gaps array
    if (!Array.isArray(report.gaps)) {
      results.push({
        passed: false,
        check: 'gaps_array',
        message: 'Gaps field must be an array',
        severity: 'error',
      });
    } else {
      results.push({
        passed: true,
        check: 'gaps_array',
        message: `Found ${report.gaps.length} gap(s)`,
        severity: 'info',
      });
    }

    // Validate timestamp
    if (!report.timestamp) {
      results.push({
        passed: false,
        check: 'timestamp',
        message: 'Missing timestamp',
        severity: 'warning',
      });
    } else {
      results.push({
        passed: true,
        check: 'timestamp',
        message: `Timestamp: ${report.timestamp}`,
        severity: 'info',
      });
    }

    return results;
  }
}
