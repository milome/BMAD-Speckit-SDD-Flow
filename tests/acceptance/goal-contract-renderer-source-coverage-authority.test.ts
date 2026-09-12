import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const { renderGoalContract } = require('../../_bmad/shared/goal-contract/scripts/render-goal-contract.js');
const { profileHashFor, templateHashFor } = require('../../_bmad/shared/goal-contract/scripts/extract-goal-contract-profile.js');
const sourceHash = `sha256:${createHash('sha256').update('test-only-renderer-source').digest('hex')}`;
const header = '| Source ID | Intent | Goal Tasks | Acceptance | Commands | Evidence |';
const separator = '| --- | --- | --- | --- | --- | --- |';
const row = (id: string) => `| ${id} | source-bound | | | | |`;
const table = (ids: string[]) => [header, separator, ...ids.map(row)].join('\n');

function render(matrix: string, ids = ['REQ-01', 'WORK-01'], options: { title?: string; tail?: string } = {}) {
  const templateText = `sourcePlanHash: ${sourceHash}\n# Test-only coverage projection\n`
    + `${options.title ?? '## Source Coverage Matrix'}\n<!-- goal-slot:matrix -->\n<!-- /goal-slot:matrix -->\n`
    + '## Appendix\n<!-- goal-slot:tail -->\n<!-- /goal-slot:tail -->\n';
  const base = { profileVersion: '1.1.0', compatibility: { supportedMajorVersions: [1] }, requiredSlots: ['matrix', 'tail'],
    requiredSections: [], invariantFragments: [], templateHash: templateHashFor(templateText) };
  const profile = { ...base, profileHash: profileHashFor(base) };
  const sourceObligations = ids.map(id => ({ id, goalTaskRefs: [], acceptanceRefs: [], commandRefs: [], evidenceRefs: [],
    executionRole: id.startsWith('WORK') ? 'action' : 'requirement' }));
  return renderGoalContract({ templateText, profile, slotData: { matrix, tail: options.tail || 'Test-only appendix.' },
    coverageReceipt: { sourcePlanHash: sourceHash, sourceObligations, unmappedSourceObligations: [] }, generationMode: 'source_plan_strict' });
}

describe('renderer source coverage matrix follows complete receipt ID authority', () => {
  it('accepts real typed IDs without inventing SRC aliases or references for non-actions', () => {
    const result = render(table(['REQ-01', 'WORK-01']));
    expect(result.audit.coverageDecision).toBe('pass');
    expect(result.audit.sourceObligationCount).toBe(2);
    expect(result.document).not.toContain('SRC001');
    expect(result.document).not.toContain('STOP002');
  });
  it('retains the historical SRC001 row format', () => {
    expect(render(table(['SRC001']), ['SRC001']).audit.coverageDecision).toBe('pass');
  });
  it('permits row ordering independently of receipt ordering', () => {
    expect(render(table(['WORK-01', 'REQ-01'])).audit.coverageDecision).toBe('pass');
  });
  it.each([
    ['missing row', ['SRC001']],
    ['duplicate row', ['SRC001', 'SRC001', 'REQ-01']],
    ['extra row', ['SRC001', 'REQ-01', 'EXTRA-01']],
    ['prefix lookalike', ['SRC001', 'REQ-01-extra']],
  ])('rejects %s despite all receipt IDs appearing in prose', (_label, ids) => {
    expect(() => render(table(ids), ['SRC001', 'REQ-01'], { tail: 'SRC001 REQ-01 are named in this unrelated prose.' }))
      .toThrow(/GOAL_CONTRACT_COVERAGE_REF_INVALID/);
  });
  it('rejects a complete matrix located only in another section', () => {
    expect(() => render('No coverage rows here.', ['SRC001'], { tail: table(['SRC001']) }))
      .toThrow(/GOAL_CONTRACT_COVERAGE_MATRIX_MISSING/);
  });
  it('rejects apparent coverage rows inside a fenced code example', () => {
    expect(() => render(`\`\`\`markdown\n${table(['SRC001'])}\n\`\`\``, ['SRC001']))
      .toThrow(/GOAL_CONTRACT_COVERAGE_MATRIX_MISSING/);
  });
  it('rejects commented-out coverage rows', () => {
    expect(() => render(`<!--\n${table(['SRC001'])}\n-->`, ['SRC001']))
      .toThrow(/GOAL_CONTRACT_COVERAGE_MATRIX_MISSING/);
  });
  it('rejects duplicate receipt IDs instead of treating them as a set silently', () => {
    expect(() => render(table(['SRC001']), ['SRC001', 'SRC001']))
      .toThrow(/GOAL_CONTRACT_COVERAGE_REF_INVALID/);
  });
  it('rejects ambiguous duplicate coverage sections', () => {
    expect(() => render(table(['SRC001']), ['SRC001'], { tail: `## Source Coverage Matrix\n${table(['SRC001'])}` }))
      .toThrow(/GOAL_CONTRACT_COVERAGE_REF_INVALID/);
  });
  it('requires a real coverage table header rather than an arbitrary pipe line', () => {
    expect(() => render(row('SRC001'), ['SRC001'])).toThrow(/GOAL_CONTRACT_COVERAGE_MATRIX_MISSING/);
  });
  it('does not let a fenced heading end the real coverage section', () => {
    expect(render(`\`\`\`markdown\n## Example heading\n\`\`\`\n${table(['REQ-01', 'WORK-01'])}`).audit.coverageDecision).toBe('pass');
  });
  it('conserves the complete real source authority IDs and multiline conditions through rendering', () => {
    const result = spawnSync(process.execPath, [path.join(process.cwd(), 'node_modules/tsx/dist/cli.mjs'),
      'tests/acceptance/helpers/canonical-proof-probe.cjs'], { cwd: process.cwd(), input: JSON.stringify({ operation: 'real-renderer' }),
      encoding: 'utf8', timeout: 30000, windowsHide: true, maxBuffer: 128 * 1024 });
    expect(result.status, result.stderr.slice(0, 500)).toBe(0);
    const evidence = JSON.parse(result.stdout);
    expect(evidence).toMatchObject({ accepted: true, coverageDecision: 'pass', conditionTextPreserved: true,
      authorityIdsConserved: true, allConditionQuotesRendered: true,
      evidenceClass: 'test-only-renderer-authority-conservation-not-extraction-oracle',
      sourceSha256: '06f1c8f44fdfea09fb0f12832cd0a319c7938c79aac91aae48f44b54dc731d4a', judgeDispatchCount: 0 });
    expect(evidence.registryIdsHash).toBe(evidence.sourceAuthorityIdsHash);
    expect(evidence.renderedBytes).toBeGreaterThan(1_048_576);
  }, 30000);
});
