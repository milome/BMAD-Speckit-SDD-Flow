/**
 * Story Assistant Validation - Type Definitions
 * @module types
 */

/**
 * Validation result for a single check
 */
export interface ValidationResult {
  /** Whether the check passed */
  passed: boolean;
  /** Check identifier */
  check: string;
  /** Detailed message */
  message: string;
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
}

/**
 * Complete validation report
 */
export interface ValidationReport {
  /** Overall pass status */
  passed: boolean;
  /** Epic identifier */
  epic: string;
  /** Story identifier */
  story: string;
  /** Timestamp of validation */
  timestamp: string;
  /** All validation results */
  results: ValidationResult[];
  /** Summary statistics */
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

/**
 * Story metadata structure
 */
export interface StoryMetadata {
  /** Epic identifier */
  epic: string;
  /** Story identifier */
  story: string;
  /** Epic slug */
  epicSlug: string;
  /** Story slug */
  storySlug: string;
  /** Current status */
  status: string;
  /** Creation timestamp */
  createdAt: string;
}

/**
 * Story document structure
 */
export interface StoryDocument {
  /** Document metadata */
  metadata: StoryMetadata;
  /** Document content sections */
  sections: {
    background?: string;
    objectives?: string;
    requirements?: string;
    acceptanceCriteria?: string[];
    technicalConstraints?: string;
    dependencies?: string[];
    risks?: string[];
    outputs?: string[];
    relatedInfo?: string;
  };
  /** Raw document content */
  rawContent: string;
}

/**
 * Scoring dimension
 */
export interface ScoringDimension {
  /** Dimension name */
  name: string;
  /** Maximum score */
  maxScore: number;
  /** Actual score */
  score: number;
  /** Feedback */
  feedback?: string;
}

/**
 * Audit report structure
 */
export interface AuditReport {
  /** Epic identifier */
  epic: string;
  /** Story identifier */
  story: string;
  /** Overall grade */
  grade: string;
  /** Total score */
  totalScore: number;
  /** Maximum possible score */
  maxScore: number;
  /** Scoring dimensions */
  dimensions: ScoringDimension[];
  /** Gap analysis results */
  gaps: string[];
  /** Iteration count */
  iterationCount: number;
  /** Audit timestamp */
  timestamp: string;
}

/**
 * Story state machine states
 */
export enum StoryState {
  STORY_CREATED = 'story-created',
  AUDIT_PASSED = 'audit-passed',
  READY_FOR_DEV = 'ready-for-dev',
  DEV_COMPLETED = 'dev-completed',
  POST_AUDIT_PASSED = 'post-audit-passed',
}

/**
 * Valid state transitions
 */
export type StateTransition = {
  from: StoryState;
  to: StoryState;
};

/**
 * State file structure
 */
export interface StateFile {
  /** Current state */
  state: StoryState;
  /** Epic identifier */
  epic: string;
  /** Story identifier */
  story: string;
  /** State history */
  history: Array<{
    state: StoryState;
    timestamp: string;
  }>;
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Handoff file structure
 */
export interface HandoffFile {
  /** Epic identifier */
  epic: string;
  /** Story identifier */
  story: string;
  /** Layer identifier */
  layer: number;
  /** Stage identifier */
  stage: string;
  /** Artifact path */
  artifactPath: string;
  /** Next action */
  nextAction: string;
  /** Next agent */
  nextAgent: string;
  /** Handoff timestamp */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Handoff validation result
 */
export interface HandoffValidationResult {
  /** Whether handoff is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validated handoff data */
  handoff?: HandoffFile;
}

/**
 * Prohibited word match
 */
export interface ProhibitedWordMatch {
  /** The matched word */
  word: string;
  /** Line number where found */
  line: number;
  /** Context snippet */
  context: string;
}

/**
 * Validator options
 */
export interface ValidatorOptions {
  /** Epic identifier */
  epic: string;
  /** Story identifier */
  story: string;
  /** Epic slug */
  epicSlug: string;
  /** Story slug */
  storySlug: string;
  /** Base output path */
  outputPath?: string;
}
