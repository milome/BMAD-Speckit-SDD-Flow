/**
 * Story Creation Validator
 * @module story-creation-validator
 *
 * Validates story documents for proper structure, metadata, and content quality.
 */

import {
  StoryDocument,
  ValidationResult,
  ValidationReport,
  ValidatorOptions,
  ProhibitedWordMatch,
} from './types';
import { PROHIBITED_WORDS } from './constants';

/**
 * Validator for story creation documents
 */
export class StoryCreationValidator {
  /** Validator configuration options */
  options: ValidatorOptions;

  /**
   * Creates a new StoryCreationValidator instance
   * @param options - Validator configuration options
   */
  constructor(options: ValidatorOptions) {
    this.options = options;
  }

  /**
   * Validates a complete story document
   * @param document - The story document to validate
   * @returns Promise resolving to a validation report
   */
  async validate(document: StoryDocument): Promise<ValidationReport> {
    const results: ValidationResult[] = [];

    // Validate document structure
    const structureResults = this.validateDocumentStructure(document);
    results.push(...structureResults);

    // Validate metadata
    const metadataResults = this.validateMetadata(document.metadata);
    results.push(...metadataResults);

    // Check for prohibited words
    const prohibitedMatches = this.checkProhibitedWords(document.rawContent);
    if (prohibitedMatches.length > 0) {
      results.push({
        passed: false,
        check: 'prohibited_words',
        message: `Found ${prohibitedMatches.length} prohibited word(s): ${prohibitedMatches.map((m) => m.word).join(', ')}`,
        severity: 'error',
      });
    } else {
      results.push({
        passed: true,
        check: 'prohibited_words',
        message: 'No prohibited words found',
        severity: 'info',
      });
    }

    // Validate clarity of descriptions
    const clarityResult = this.validateClarity(document);
    results.push(clarityResult);

    const passed = results.every((r) => r.passed || r.severity !== 'error');
    const failed = results.filter((r) => !r.passed && r.severity === 'error').length;
    const warnings = results.filter((r) => !r.passed && r.severity === 'warning').length;

    return {
      passed,
      epic: this.options.epic,
      story: this.options.story,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        total: results.length,
        passed: results.length - failed - warnings,
        failed,
        warnings,
      },
    };
  }

  /**
   * Validates the document structure has all required sections
   * @param document - The story document to validate
   * @returns Array of validation results
   */
  validateDocumentStructure(document: StoryDocument): ValidationResult[] {
    const results: ValidationResult[] = [];
    const sections = document.sections;

    // Check required sections
    const sectionMap: Record<string, keyof typeof sections> = {
      背景与目标: 'background',
      需求描述: 'requirements',
      验收标准: 'acceptanceCriteria',
      技术约束: 'technicalConstraints',
      依赖清单: 'dependencies',
      风险标记: 'risks',
      产出物: 'outputs',
      关联信息: 'relatedInfo',
    };

    const missingSections: string[] = [];
    for (const [displayName, key] of Object.entries(sectionMap)) {
      const value = sections[key];
      if (
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'string' && value.trim() === '')
      ) {
        missingSections.push(displayName);
      }
    }

    if (missingSections.length > 0) {
      results.push({
        passed: false,
        check: 'required_sections',
        message: `Missing required sections: ${missingSections.join(', ')}`,
        severity: 'error',
      });
    } else {
      results.push({
        passed: true,
        check: 'required_sections',
        message: 'All required sections present',
        severity: 'info',
      });
    }

    // Validate acceptance criteria has items
    if (!sections.acceptanceCriteria || sections.acceptanceCriteria.length === 0) {
      results.push({
        passed: false,
        check: 'acceptance_criteria_items',
        message: 'Acceptance criteria must have at least one item',
        severity: 'error',
      });
    } else {
      results.push({
        passed: true,
        check: 'acceptance_criteria_items',
        message: `Found ${sections.acceptanceCriteria.length} acceptance criteria`,
        severity: 'info',
      });
    }

    return results;
  }

  /**
   * Validates metadata fields
   * @param metadata - Partial metadata object to validate
   * @returns Array of validation results
   */
  validateMetadata(metadata: Partial<StoryDocument['metadata']>): ValidationResult[] {
    const results: ValidationResult[] = [];

    const requiredFields: Array<keyof StoryDocument['metadata']> = [
      'epic',
      'story',
      'epicSlug',
      'storySlug',
      'status',
      'createdAt',
    ];

    for (const field of requiredFields) {
      if (!metadata[field]) {
        results.push({
          passed: false,
          check: `metadata_${field}`,
          message: `Missing required metadata field: ${field}`,
          severity: 'error',
        });
      } else {
        results.push({
          passed: true,
          check: `metadata_${field}`,
          message: `Metadata field ${field} is present`,
          severity: 'info',
        });
      }
    }

    return results;
  }

  /**
   * Checks for prohibited words in content
   * @param content - Text content to check
   * @returns Array of prohibited word matches
   */
  checkProhibitedWords(content: string): ProhibitedWordMatch[] {
    const matches: ProhibitedWordMatch[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const word of PROHIBITED_WORDS) {
        if (line.includes(word)) {
          matches.push({
            word,
            line: i + 1,
            context: line.trim(),
          });
        }
      }
    }

    return matches;
  }

  /**
   * Validates clarity of document descriptions
   * @param document - The story document to validate
   * @returns Validation result for clarity
   */
  private validateClarity(document: StoryDocument): ValidationResult {
    const vaguePatterns = [
      /\b(可能|也许|大概|差不多)\b/g,
      /\b(考虑一下|看一下|研究一下)\b/g,
      /\b(待定|TBD|tbd)\b/g,
    ];

    let vagueCount = 0;
    const content = document.rawContent;

    for (const pattern of vaguePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        vagueCount += matches.length;
      }
    }

    if (vagueCount > 0) {
      return {
        passed: false,
        check: 'clarity',
        message: `Found ${vagueCount} vague expression(s) that should be clarified`,
        severity: 'warning',
      };
    }

    return {
      passed: true,
      check: 'clarity',
      message: 'Descriptions are clear and specific',
      severity: 'info',
    };
  }
}
