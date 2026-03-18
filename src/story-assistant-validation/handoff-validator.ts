/**
 * Handoff Validator
 * @module handoff-validator
 *
 * Validates handoff files for proper structure, fields, and routing.
 */

import {
  HandoffFile,
  HandoffValidationResult,
  ValidationResult,
  ValidatorOptions,
} from './types';
import { REQUIRED_HANDOFF_FIELDS, STAGE_AGENT_MAP } from './constants';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

/**
 * Validator for handoff files
 */
export class HandoffValidator {
  /** Validator configuration options */
  options: ValidatorOptions;

  /**
   * Creates a new HandoffValidator instance
   * @param options - Validator configuration options
   */
  constructor(options: ValidatorOptions) {
    this.options = options;
  }

  /**
   * Validates a complete handoff file
   * @param filePath - Path to the handoff file
   * @returns Promise resolving to validation result
   */
  async validateHandoff(filePath: string): Promise<HandoffValidationResult> {
    const errors: string[] = [];

    // Check file exists
    if (!fs.existsSync(filePath)) {
      return {
        valid: false,
        errors: [`Handoff file not found: ${filePath}`],
      };
    }

    // Load handoff
    let handoff: HandoffFile;
    try {
      handoff = await this.loadHandoff(filePath);
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to load handoff: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }

    // Validate required fields
    const requiredResult = this.validateRequiredFields(handoff);
    if (!requiredResult.valid) {
      errors.push(...requiredResult.errors);
    }

    // Validate artifact path
    const artifactResult = this.validateArtifactPath(handoff.artifactPath);
    if (!artifactResult.passed) {
      errors.push(artifactResult.message);
    }

    // Validate routing
    const routingResult = this.validateNextAgentRouting(handoff);
    if (!routingResult.passed) {
      errors.push(routingResult.message);
    }

    // Validate path
    const pathResult = this.validateHandoffPath(filePath);
    if (!pathResult.passed) {
      errors.push(pathResult.message);
    }

    return {
      valid: errors.length === 0,
      errors,
      handoff: errors.length === 0 ? handoff : undefined,
    };
  }

  /**
   * Loads a handoff file from disk
   * @param filePath - Path to the handoff file
   * @returns Promise resolving to the handoff file
   */
  async loadHandoff(filePath: string): Promise<HandoffFile> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const handoff = yaml.load(content) as HandoffFile;

    // Validate it's a valid handoff object
    if (!handoff || typeof handoff !== 'object') {
      throw new Error('Invalid handoff file format');
    }

    return handoff;
  }

  /**
   * Validates required fields are present
   * @param handoff - The handoff file to validate
   * @returns Validation result with list of missing fields
   */
  validateRequiredFields(handoff: HandoffFile): HandoffValidationResult {
    const errors: string[] = [];

    for (const field of REQUIRED_HANDOFF_FIELDS) {
      const value = handoff[field as keyof HandoffFile];
      if (value === undefined || value === null || value === '') {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate field types
    if (typeof handoff.layer !== 'number') {
      errors.push('Field "layer" must be a number');
    }

    if (typeof handoff.timestamp !== 'string') {
      errors.push('Field "timestamp" must be a string');
    }

    return {
      valid: errors.length === 0,
      errors,
      handoff: errors.length === 0 ? handoff : undefined,
    };
  }

  /**
   * Validates the artifact path format
   * @param artifactPath - The artifact path to validate
   * @returns Validation result
   */
  validateArtifactPath(artifactPath: string): ValidationResult {
    // Check basic format
    if (!artifactPath || typeof artifactPath !== 'string') {
      return {
        passed: false,
        check: 'artifact_path',
        message: 'Artifact path is required',
        severity: 'error',
      };
    }

    // Check for implementation artifacts pattern
    const artifactRegex = /_bmad-output\/implementation-artifacts\/epic-[^/]+\/story-[^/]+\//;
    if (!artifactRegex.test(artifactPath)) {
      return {
        passed: false,
        check: 'artifact_path',
        message: `Invalid artifact path format. Expected: _bmad-output/implementation-artifacts/epic-{epic}/story-{story}/...`,
        severity: 'error',
      };
    }

    // Check for epic identifier
    const epicMatch = artifactPath.match(/epic-[^/]+/);
    if (!epicMatch) {
      return {
        passed: false,
        check: 'artifact_path_epic',
        message: 'Artifact path must contain epic identifier',
        severity: 'error',
      };
    }

    return {
      passed: true,
      check: 'artifact_path',
      message: 'Artifact path format is valid',
      severity: 'info',
    };
  }

  /**
   * Validates next agent matches stage routing
   * @param handoff - The handoff file to validate
   * @returns Validation result
   */
  validateNextAgentRouting(handoff: HandoffFile): ValidationResult {
    const expectedAgent = STAGE_AGENT_MAP[handoff.stage];

    if (!expectedAgent) {
      return {
        passed: false,
        check: 'next_agent_routing',
        message: `Unknown stage: ${handoff.stage}. Cannot determine expected agent.`,
        severity: 'error',
      };
    }

    if (handoff.nextAgent !== expectedAgent) {
      return {
        passed: false,
        check: 'next_agent_routing',
        message: `Next agent mismatch for stage ${handoff.stage}. Expected: ${expectedAgent}, Got: ${handoff.nextAgent}`,
        severity: 'error',
      };
    }

    return {
      passed: true,
      check: 'next_agent_routing',
      message: `Next agent ${handoff.nextAgent} matches stage ${handoff.stage}`,
      severity: 'info',
    };
  }

  /**
   * Validates YAML format
   * @param content - YAML content to validate
   * @returns Validation result
   */
  async validateYamlFormat(content: string): Promise<ValidationResult> {
    try {
      yaml.load(content);
      return {
        passed: true,
        check: 'yaml_format',
        message: 'YAML format is valid',
        severity: 'info',
      };
    } catch (error) {
      return {
        passed: false,
        check: 'yaml_format',
        message: `Invalid YAML format: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      };
    }
  }

  /**
   * Validates handoff file path
   * @param filePath - The file path to validate
   * @returns Validation result
   */
  validateHandoffPath(filePath: string): ValidationResult {
    // Expected format: _bmad-output/.../handoff.yaml or handoff-*.yaml
    const pathRegex = /_bmad-output\/implementation-artifacts\/epic-[^/]+\/story-[^/]+/;

    if (!pathRegex.test(filePath)) {
      return {
        passed: false,
        check: 'handoff_path',
        message: `Invalid handoff path format. Expected path under _bmad-output/implementation-artifacts/epic-{epic}/story-{story}/`,
        severity: 'warning',
      };
    }

    // Check file extension
    if (!filePath.endsWith('.yaml') && !filePath.endsWith('.yml')) {
      return {
        passed: false,
        check: 'handoff_extension',
        message: 'Handoff file must have .yaml or .yml extension',
        severity: 'error',
      };
    }

    return {
      passed: true,
      check: 'handoff_path',
      message: 'Handoff path format is valid',
      severity: 'info',
    };
  }

  /**
   * Validates handoff timestamp
   * @param timestamp - The timestamp to validate
   * @returns Validation result
   */
  validateTimestamp(timestamp: string): ValidationResult {
    if (!timestamp) {
      return {
        passed: false,
        check: 'timestamp',
        message: 'Timestamp is required',
        severity: 'error',
      };
    }

    // Check ISO 8601 format
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;
    if (!isoRegex.test(timestamp)) {
      return {
        passed: false,
        check: 'timestamp_format',
        message: 'Timestamp must be in ISO 8601 format',
        severity: 'warning',
      };
    }

    // Check timestamp is not in the future
    const timestampDate = new Date(timestamp);
    const now = new Date();
    if (timestampDate > now) {
      return {
        passed: false,
        check: 'timestamp_future',
        message: 'Timestamp cannot be in the future',
        severity: 'warning',
      };
    }

    return {
      passed: true,
      check: 'timestamp',
      message: 'Timestamp is valid',
      severity: 'info',
    };
  }
}
