export interface GovernanceStageFixture {
  artifactName: string;
  content: string;
  fixtureIntent: string;
}

function stageFixture(fixtureIntent: string, lines: string[]): GovernanceStageFixture {
  return {
    artifactName: 'architecture.md',
    content: lines.join('\n'),
    fixtureIntent,
  };
}

const IMPLEMENTATION_WORKFLOW_FIXTURE = stageFixture(
  'implementation workflow keeps tasks, testing, and review findings templated so dev-story gate remains intentionally blocked',
  [
    '## Tasks',
    '{{placeholder}}',
    '',
    '## Testing',
    '{{placeholder}}',
    '',
    '## Review Findings',
    '{{placeholder}}',
    '',
    'missing P0 Journey smoke E2E evidence traceability',
  ]
);

export const GOVERNANCE_STAGE_FIXTURE_CATALOG: Record<string, GovernanceStageFixture> = {
  'bmad-create-product-brief/step-02-vision': stageFixture(
    'vision section remains placeholder so brief gate fails on missing P0 journey anchor',
    ['## Product Vision', '{{placeholder}}']
  ),
  'bmad-create-product-brief/step-03-users': stageFixture(
    'target users section remains placeholder so brief gate fails on missing traceability chain',
    ['## Target Users', '{{placeholder}}']
  ),
  'bmad-create-product-brief/step-04-metrics': stageFixture(
    'success metrics section remains placeholder so brief gate fails on missing smoke E2E anchor',
    ['## Success Metrics', '{{placeholder}}']
  ),
  'bmad-create-product-brief/step-05-scope': stageFixture(
    'scope section remains placeholder so brief gate fails on missing evidence requirement',
    ['## Scope', '{{placeholder}}']
  ),
  'bmad-create-prd/step-04-journeys': stageFixture(
    'journey section includes every keyword except traceability so PRD gate fails on one explicit missing contract signal',
    ['## User Journeys', 'P0 Journey smoke E2E evidence pending remediation']
  ),
  'bmad-create-prd/step-11-polish': stageFixture(
    'polished PRD keeps journeys minimally valid but leaves FR/NFR placeholders so polish gate fails on section completeness',
    [
      '## User Journeys',
      'P0 Journey smoke E2E evidence pending remediation',
      '',
      '## Functional Requirements',
      '{{placeholder}}',
      '',
      '## Non-Functional Requirements',
      '{{placeholder}}',
    ]
  ),
  'bmad-create-architecture/step-04-decisions': stageFixture(
    'architecture decision step keeps key path section empty so contract completeness fails before downstream details matter',
    [
      '## P0 Key Path Sequences',
      '{{placeholder}}',
      '',
      'missing smoke E2E evidence traceability',
    ]
  ),
  'bmad-create-architecture/step-07-validation': stageFixture(
    'architecture validation step keeps journey coverage validation empty so readiness validation remains stably blocked',
    [
      '## P0 Journey Coverage Validation',
      '{{placeholder}}',
      '',
      'missing smoke E2E evidence traceability',
    ]
  ),
  'bmad-check-implementation-readiness/step-06-final-assessment': stageFixture(
    'readiness report leaves blockers and deferred gaps unresolved so final assessment stays in explicit blocker state',
    [
      '## Blockers Requiring Immediate Action',
      '{{placeholder}}',
      '',
      '## Deferred Gaps',
      '{{placeholder}}',
      '',
      'missing P0 Journey smoke E2E evidence traceability',
    ]
  ),
  'bmad-create-epics-and-stories/step-02-design-epics': stageFixture(
    'epic design remains placeholder so epics gate fails on missing P0 journey anchor',
    ['## Epic Design', '{{placeholder}}']
  ),
  'bmad-create-epics-and-stories/step-03-create-stories': stageFixture(
    'stories section remains placeholder so epics gate fails on missing task-chain traceability',
    ['## Stories', '{{placeholder}}']
  ),
  'bmad-create-story/workflow': stageFixture(
    'story workflow keeps story and acceptance criteria templated so create-story gate fails before implementation can start',
    [
      '## Story',
      '{{placeholder}}',
      '',
      '## Acceptance Criteria',
      '{{placeholder}}',
      '',
      'missing P0 Journey traceability',
    ]
  ),
  'speckit-specify/workflow': stageFixture(
    'specify workflow leaves user journeys templated so spec contract never establishes journey/evidence chain',
    ['## User Journeys', '{{placeholder}}']
  ),
  'speckit-plan/workflow': stageFixture(
    'plan workflow leaves testing strategy templated so plan contract never binds journey validation to execution',
    ['## Testing Strategy', '{{placeholder}}']
  ),
  'speckit-gaps/workflow': stageFixture(
    'gaps workflow keeps implementation gaps templated so missing journey/smoke evidence stays explicit',
    ['## Implementation Gaps', '{{placeholder}}']
  ),
  'speckit-tasks/workflow': stageFixture(
    'tasks workflow leaves task and testing sections templated so task-chain coverage cannot satisfy rerun gate',
    [
      '## Tasks',
      '{{placeholder}}',
      '',
      '## Testing',
      '{{placeholder}}',
      '',
      'missing P0 Journey smoke E2E evidence task chain',
    ]
  ),
  'bmad-dev-story/workflow': IMPLEMENTATION_WORKFLOW_FIXTURE,
  'speckit-workflow/workflow': IMPLEMENTATION_WORKFLOW_FIXTURE,
};

export function resolveGovernanceStageFixture(key: string): GovernanceStageFixture {
  const fixture = GOVERNANCE_STAGE_FIXTURE_CATALOG[key];
  if (!fixture) {
    throw new Error(`Missing artifact fixture mapping for governed stage: ${key}`);
  }
  return fixture;
}

export function listGovernanceStageFixtureKeys(): string[] {
  return Object.keys(GOVERNANCE_STAGE_FIXTURE_CATALOG).sort((left, right) => left.localeCompare(right));
}
