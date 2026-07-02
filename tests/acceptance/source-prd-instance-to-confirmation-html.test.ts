import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { lintRequirementsContractSourcePrd } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/lint-requirements-contract-source-prd';

const ROOT = process.cwd();
const GOLDEN_SOURCE_PRD = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority',
  'tests',
  'fixtures',
  'source-prd',
  'golden-source-prd.md'
);

describe('source PRD instance to confirmation HTML readiness', () => {
  it('accepts the golden source PRD and preserves all renderer-readiness seeds', () => {
    const result = lintRequirementsContractSourcePrd({
      source: GOLDEN_SOURCE_PRD,
      entrySource: 'source_prd_draft',
      json: true,
    });
    const source = fs.readFileSync(GOLDEN_SOURCE_PRD, 'utf8');

    expect(result.ok, JSON.stringify(result.issues, null, 2)).toBe(true);
    expect(result.status).toBe('source_prd_draft_ready');
    expect(result.sourcePrdDraftReady).toBe(true);
    expect(result.counts).toMatchObject({
      requirementRows: 2,
      negativeRows: 1,
      pathRows: 1,
      currentTargetRows: 1,
    });

    for (const requiredSeed of [
      'Happy-path sequence view',
      'Failure-path sequence view',
      'State and flow view',
      'Edge-case view',
      'Business and governance boundary view',
      'Artifact automation plan',
      'Current-vs-target map',
      'aiTddContractExecutionManifestProjection',
    ]) {
      expect(source).toContain(requiredSeed);
    }

    for (const requiredSection of [
      '## Trace Matrix Source',
      '## Implementation Path Map',
      '## Source Current State',
      '## Source Target State',
      '## Current Target Map',
      '## Negative Requirements And Not Done Conditions',
      '## Acceptance Evidence',
      '## Test And Verification Paths',
    ]) {
      expect(source).toContain(requiredSection);
    }
  });
});
