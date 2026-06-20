"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ralphPrdSchemaV2 = exports.RalphSchemaValidationError = void 0;
exports.assertValidRalphPrdDocument = assertValidRalphPrdDocument;
exports.parseRalphPrdDocument = parseRalphPrdDocument;
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const types_1 = require("./types");
const ajv = new ajv_1.default({ allErrors: true, strict: true, allowUnionTypes: true });
(0, ajv_formats_1.default)(ajv);
class RalphSchemaValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RalphSchemaValidationError';
    }
}
exports.RalphSchemaValidationError = RalphSchemaValidationError;
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
};
const ralphProjectContextSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        framework: { type: 'string' },
        testCommand: { type: 'string' },
        buildCommand: { type: 'string' },
        lintCommand: { type: 'string' },
    },
};
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
};
exports.ralphPrdSchemaV2 = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'RalphPrdDocument',
    description: 'Canonical Ralph Wiggum Method PRD tracking schema v2.',
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'branchName', 'taskDescription', 'projectContext', 'userStories'],
    properties: {
        schemaVersion: { type: 'string', const: types_1.RALPH_PRD_SCHEMA_VERSION },
        branchName: { type: 'string', minLength: 1 },
        taskDescription: { type: 'string', minLength: 1 },
        projectContext: ralphProjectContextSchema,
        userStories: {
            type: 'array',
            minItems: 1,
            items: ralphUserStorySchema,
        },
    },
};
const validateRalphPrdSchemaV2 = ajv.compile(exports.ralphPrdSchemaV2);
function assertUniqueUserStoryIds(userStories) {
    const seen = new Set();
    for (const story of userStories) {
        if (seen.has(story.id)) {
            throw new RalphSchemaValidationError(`Duplicate user story id: ${story.id}`);
        }
        seen.add(story.id);
    }
}
function normalizePhaseSequence(story) {
    return story.tddSteps.map((step) => step.phase);
}
function assertExpectedTddShape(story) {
    const expected = [...(0, types_1.expectedRalphTddPhasesForStory)(story.involvesProductionCode)];
    const actual = normalizePhaseSequence(story);
    if (actual.length !== expected.length) {
        throw new RalphSchemaValidationError(`User story ${story.id} has invalid tddSteps length: expected ${expected.length}, got ${actual.length}`);
    }
    for (let i = 0; i < expected.length; i++) {
        if (actual[i] !== expected[i]) {
            throw new RalphSchemaValidationError(`User story ${story.id} has invalid tddSteps order: expected ${expected.join(' -> ')}, got ${actual.join(' -> ')}`);
        }
    }
}
function assertSemanticRalphPrdDocument(document) {
    assertUniqueUserStoryIds(document.userStories);
    document.userStories.forEach(assertExpectedTddShape);
}
function assertValidRalphPrdDocument(value) {
    if (!validateRalphPrdSchemaV2(value)) {
        throw new RalphSchemaValidationError(`Invalid Ralph PRD document: ${ajv.errorsText(validateRalphPrdSchemaV2.errors, {
            separator: '; ',
        })}`);
    }
    assertSemanticRalphPrdDocument(value);
}
function parseRalphPrdDocument(value) {
    assertValidRalphPrdDocument(value);
    return value;
}
