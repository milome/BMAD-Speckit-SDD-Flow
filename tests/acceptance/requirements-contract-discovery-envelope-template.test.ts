import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

const canonicalPath = path.resolve(
  '_bmad/shared/requirements-contract/templates/discovery-prd-envelope-template.md'
);
const projectionPaths = [
  '_bmad/bmm/workflows/2-plan-workflows/bmad-create-prd/templates/prd-template.md',
  '_bmad/bmm/workflows/2-plan-workflows/create-prd/templates/prd-template.md',
  '_bmad/core/tasks/bmad-create-prd/templates/prd-template.md',
  'packages/bmad-speckit/_bmad/bmm/workflows/2-plan-workflows/bmad-create-prd/templates/prd-template.md',
  'packages/bmad-speckit/_bmad/bmm/workflows/2-plan-workflows/create-prd/templates/prd-template.md',
  'packages/bmad-speckit/_bmad/core/tasks/bmad-create-prd/templates/prd-template.md',
].map((candidate) => path.resolve(candidate));

it('projects one non-authoritative Discovery Envelope template to every BMAD PRD surface', () => {
  expect(existsSync(canonicalPath)).toBe(true);
  const canonical = readFileSync(canonicalPath, 'utf8');

  expect(canonical).toContain('artifactRole: discovery_envelope');
  expect(canonical).toContain('authority: none');
  expect(canonical).toContain('## Workflow Progress');
  expect(canonical).toContain('## Input References');
  expect(canonical).toContain('## Discovery Transcript References');
  expect(canonical).toContain('## Semantic Candidate References');
  expect(canonical).toContain('## Open Decisions');
  expect(canonical).toContain('## Materialization Handoff');
  expect(canonical).not.toMatch(
    /implementationConfirmation|currentTargetMap|## Trace Matrix Source|## Acceptance Evidence|## Implementation Path Map|source_prd_draft_ready/u
  );

  for (const projectionPath of projectionPaths) {
    expect(readFileSync(projectionPath, 'utf8')).toBe(canonical);
  }
});
