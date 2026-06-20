import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  expectedRalphTddPhasesForStory,
  RALPH_PRD_SCHEMA_VERSION,
  type RalphPrdDocument,
  type RalphTddPhase,
} from './types';

const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);

export class RalphSchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RalphSchemaValidationError';
  }
}

const ralphTddStepSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['phase', 'passes'],
  properties: {
    phase: { type: 'string', enum: ['TDD-RED', 'TDD-GREEN', 'TDD-REFACTOR', 'DONE'] },
    passes: { type: 'boolean' },
    command: { type: 'string' },
    note: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' },
  },
} as const;

const ralphProjectContextSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    framework: { type: 'string' },
    testCommand: { type: 'string' },
    buildCommand: { type: 'string' },
    lintCommand: { type: 'string' },
  },
} as const;

const ralphUserStorySchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'title',
    'description',
    'acceptanceCriteria',
    'priority',
    'passes',
    'involvesProductionCode',
    'tddSteps',
  ],
  properties: {
    id: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 1 },
    description: { type: 'string', minLength: 1 },
    acceptanceCriteria: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', minLength: 1 },
    },
    priority: { type: 'integer', minimum: 1 },
    passes: { type: 'boolean' },
    notes: { type: 'string' },
    involvesProductionCode: { type: 'boolean' },
    tddSteps: {
      type: 'array',
      minItems: 1,
      items: ralphTddStepSchema,
    },
  },
} as const;

export const ralphPrdSchemaV2 = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'RalphPrdDocument',
  description: 'Canonical Ralph Wiggum Method PRD tracking schema v2.',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'branchName', 'taskDescription', 'projectContext', 'userStories'],
  properties: {
    schemaVersion: { type: 'string', const: RALPH_PRD_SCHEMA_VERSION },
    branchName: { type: 'string', minLength: 1 },
    taskDescription: { type: 'string', minLength: 1 },
    projectContext: ralphProjectContextSchema,
    userStories: {
      type: 'array',
      minItems: 1,
      items: ralphUserStorySchema,
    },
  },
} as const;

const validateRalphPrdSchemaV2 = ajv.compile(ralphPrdSchemaV2);

function assertUniqueUserStoryIds(userStories: RalphPrdDocument['userStories']): void {
  const seen = new Set<string>();
  for (const story of userStories) {
    if (seen.has(story.id)) {
      throw new RalphSchemaValidationError(`Duplicate user story id: ${story.id}`);
    }
    seen.add(story.id);
  }
}

function normalizePhaseSequence(story: RalphPrdDocument['userStories'][number]): RalphTddPhase[] {
  return story.tddSteps.map((step) => step.phase);
}

function assertExpectedTddShape(story: RalphPrdDocument['userStories'][number]): void {
  const expected = [...expectedRalphTddPhasesForStory(story.involvesProductionCode)];
  const actual = normalizePhaseSequence(story);

  if (actual.length !== expected.length) {
    throw new RalphSchemaValidationError(
      `User story ${story.id} has invalid tddSteps length: expected ${expected.length}, got ${actual.length}`
    );
  }

  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new RalphSchemaValidationError(
        `User story ${story.id} has invalid tddSteps order: expected ${expected.join(' -> ')}, got ${actual.join(' -> ')}`
      );
    }
  }
}

function assertSemanticRalphPrdDocument(document: RalphPrdDocument): void {
  assertUniqueUserStoryIds(document.userStories);
  document.userStories.forEach(assertExpectedTddShape);
}

export function assertValidRalphPrdDocument(value: unknown): asserts value is RalphPrdDocument {
  if (!validateRalphPrdSchemaV2(value)) {
    throw new RalphSchemaValidationError(
      `Invalid Ralph PRD document: ${ajv.errorsText(validateRalphPrdSchemaV2.errors, {
        separator: '; ',
      })}`
    );
  }

  assertSemanticRalphPrdDocument(value as RalphPrdDocument);
}

export function parseRalphPrdDocument(value: unknown): RalphPrdDocument {
  assertValidRalphPrdDocument(value);
  return value;
}
