import { describe, expect, it } from 'vitest';
import {
  assertValidRalphPrdDocument,
  parseRalphPrdDocument,
  RalphSchemaValidationError,
} from '../../scripts/ralph-method/schema';
import { RALPH_PRD_SCHEMA_VERSION, type RalphPrdDocument } from '../../scripts/ralph-method/types';

function makeBaseDocument(): RalphPrdDocument {
  return {
    schemaVersion: RALPH_PRD_SCHEMA_VERSION,
    branchName: 'ralph/example-feature',
    taskDescription: 'Example feature tracking',
    projectContext: {
      framework: 'Node.js',
      testCommand: 'npm test',
      buildCommand: 'npm run build',
      lintCommand: 'npm run lint',
    },
    userStories: [
      {
        id: 'US-001',
        title: 'Implement service logic',
        description: 'Create service logic for the feature.',
        acceptanceCriteria: ['Service exists', 'Tests pass'],
        priority: 1,
        passes: false,
        involvesProductionCode: true,
        tddSteps: [
          { phase: 'TDD-RED', passes: false },
          { phase: 'TDD-GREEN', passes: false },
          { phase: 'TDD-REFACTOR', passes: false },
        ],
      },
    ],
  };
}

describe('ralph-method schema v2', () => {
  it('accepts a valid production-code user story', () => {
    expect(() => assertValidRalphPrdDocument(makeBaseDocument())).not.toThrow();
  });

  it('accepts a valid non-production user story with DONE-only tddSteps', () => {
    const doc = makeBaseDocument();
    doc.userStories = [
      {
        id: 'US-002',
        title: 'Document rollout notes',
        description: 'Write release notes.',
        acceptanceCriteria: ['Notes are updated'],
        priority: 2,
        passes: false,
        involvesProductionCode: false,
        tddSteps: [{ phase: 'DONE', passes: false }],
      },
    ];

    expect(parseRalphPrdDocument(doc).userStories[0].tddSteps[0]?.phase).toBe('DONE');
  });

  it('rejects non-production stories that use TDD-RED/TDD-GREEN/TDD-REFACTOR phases', () => {
    const doc = {
      ...makeBaseDocument(),
      userStories: [
      {
        id: 'US-003',
        title: 'Update docs',
        description: 'Update documentation.',
        acceptanceCriteria: ['Docs updated'],
        priority: 3,
        passes: false,
        involvesProductionCode: false,
        tddSteps: [
          { phase: 'TDD-RED', passes: false },
          { phase: 'TDD-GREEN', passes: false },
          { phase: 'TDD-REFACTOR', passes: false },
        ],
      },
      ],
    } as unknown;

    expect(() => assertValidRalphPrdDocument(doc)).toThrow(RalphSchemaValidationError);
  });

  it('rejects production stories missing TDD-REFACTOR', () => {
    const doc = {
      ...makeBaseDocument(),
      userStories: [
        {
          ...makeBaseDocument().userStories[0]!,
          tddSteps: [
            { phase: 'TDD-RED', passes: false },
            { phase: 'TDD-GREEN', passes: false },
          ],
        },
      ],
    } as unknown;

    expect(() => assertValidRalphPrdDocument(doc)).toThrow(
      /invalid tddSteps length|invalid tddSteps order/
    );
  });

  it('rejects duplicate user story ids', () => {
    const doc = makeBaseDocument();
    doc.userStories.push({
      ...doc.userStories[0]!,
      title: 'Duplicate story id',
    });

    expect(() => assertValidRalphPrdDocument(doc)).toThrow(/Duplicate user story id/);
  });
});
