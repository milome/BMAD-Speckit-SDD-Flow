import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function probe(operation: string, input: unknown) {
  const script = `const fs = require('node:fs'); const mod = require('./packages/bmad-speckit/src/utils/goal-contract/slot-data-builder.ts'); process.stdout.write(JSON.stringify(mod[process.argv[1]](JSON.parse(fs.readFileSync(0, 'utf8')))));`;
  const result = spawnSync(process.execPath, [path.join(process.cwd(), 'node_modules/tsx/dist/cli.mjs'), '-e', script, operation],
    { cwd: process.cwd(), input: JSON.stringify(input), encoding: 'utf8', windowsHide: true, timeout: 20000, maxBuffer: 128 * 1024 });
  if (result.status !== 0) throw new Error(`test_only_source_proof_probe_failed:${result.status}:${result.stderr.slice(0, 500)}`);
  return JSON.parse(result.stdout);
}
const implementationProofAudit = (rows: unknown[]) => probe('implementationProofAudit', rows);
const makeRegistries = (rows: unknown[]) => probe('makeRegistries', rows);

function row(id: string, changes: Record<string, unknown> = {}) {
  return { id, declaredSourceId: id, kind: 'implementation_requirement',
    text: 'MUST implement src/export.ts', summary: 'CLI implementation',
    sourcePlanHash: `sha256:${'1'.repeat(64)}`, sourcePlanPath: 'test-only/source.md',
    headingPath: ['Implementation'], sourceBlockRefs: [`BLOCK-${id}`],
    normativeStrength: 'must', polarity: 'required', executionRole: 'action', required: true,
    normativeClauses: [], conditions: [], commandDeclarations: [], provenanceRefs: [`BLOCK-${id}`],
    applicability: { scope: 'obligations', sourceRefs: [`BLOCK-${id}`], obligationRefs: [id] },
    taskRefs: [], acceptanceRefs: [], commandRefs: [], evidenceRefs: [], dependencyRefs: [],
    ...changes };
}

describe('source-backed proof applicability (test-only, no command execution)', () => {
  it.each([
    ['optional permission', { normativeStrength: 'may', polarity: 'permitted', executionRole: 'guidance', required: false }],
    ['recommendation', { normativeStrength: 'should', executionRole: 'guidance', required: false }],
    ['definition', { normativeStrength: 'descriptive', polarity: 'descriptive', executionRole: 'definition', required: false }],
    ['negative boundary', { polarity: 'forbidden', executionRole: 'boundary' }],
  ])('does not demand implementation commands for %s mentioning technical paths', (_label, semanticFields) => {
    expect(implementationProofAudit([row('NORM-001', semanticFields)])).toMatchObject({
      decision: 'pass', codeObligationCount: 0,
    });
  });

  it('still rejects a mandatory implementation action without a source-bound proof command', () => {
    expect(implementationProofAudit([row('WORK-001')])).toMatchObject({ decision: 'blocked', codeObligationCount: 1 });
  });

  it('cannot borrow an unrelated command to justify a mandatory implementation', () => {
    const command = row('CMD-OTHER', { kind: 'verification_command', executionRole: 'binding',
      commandDeclarations: [{ id: 'CMD-OTHER', invocation: 'node --test tests/other.test.js' }],
      text: 'node --test tests/other.test.js', summary: '', taskRefs: ['WORK-OTHER'] });
    expect(implementationProofAudit([row('WORK-001'), command])).toMatchObject({ decision: 'blocked' });
  });

  it('requires proof for a conditional mandatory action without claiming its condition is satisfied', () => {
    const conditions = [{ text: 'Only when export is selected', kind: 'source_condition', state: 'unevaluated', sourceRefs: ['BLOCK-WORK-001'] }];
    const action = row('WORK-001', { required: false, applicabilityState: 'conditional', conditions });
    expect(implementationProofAudit([action])).toMatchObject({ decision: 'blocked', codeObligationCount: 1 });
    expect(action.conditions).toEqual(conditions);
  });

  it('accepts a real verification command bound to the required action', () => {
    const action = row('WORK-001', { commandRefs: ['CMD-EXPORT'] });
    const command = row('CMD-EXPORT', { kind: 'verification_command', executionRole: 'binding',
      commandDeclarations: [{ id: 'CMD-EXPORT', invocation: 'node --test tests/export.test.js' }],
      text: 'node --test tests/export.test.js', summary: '', taskRefs: ['WORK-001'] });
    expect(implementationProofAudit([action, command])).toMatchObject({ decision: 'pass', codeObligationCount: 1 });
  });

  it('cannot use a source-prohibited command as implementation proof', () => {
    const action = row('WORK-001', { commandRefs: ['CMD-PROHIBITED'] });
    const command = row('STOP-COMMAND', { executionRole: 'boundary', polarity: 'forbidden',
      commandDeclarations: [{ id: 'CMD-PROHIBITED', invocation: 'node --test tests/export.test.js',
        polarity: 'forbidden', authorization: 'prohibited' }] });
    expect(implementationProofAudit([action, command])).toMatchObject({ decision: 'blocked' });
  });

  it('does not treat a command ID without a literal invocation as proof', () => {
    const action = row('WORK-001', { commandRefs: ['CMD-EMPTY'] });
    const command = row('COMMAND-DECLARATION', { executionRole: 'binding',
      commandDeclarations: [{ id: 'CMD-EMPTY', invocation: '' }] });
    expect(implementationProofAudit([action, command])).toMatchObject({ decision: 'blocked' });
  });

  it('keeps typed tasks and references without synthesizing a task for every normative clause', () => {
    const input = [
      row('WORK-001', { kind: 'declared_execution_task', taskRefs: ['WORK-001'], commandRefs: ['CMD-EXPORT'] }),
      row('REQ-001', { executionRole: 'requirement', taskRefs: ['WORK-001'] }),
      row('AC-001', { kind: 'acceptance_condition', executionRole: 'acceptance', taskRefs: ['WORK-001'] }),
      row('CMD-EXPORT', { kind: 'verification_command', executionRole: 'binding', taskRefs: ['WORK-001'],
        commandDeclarations: [{ id: 'CMD-EXPORT', invocation: 'node --test tests/export.test.js' }] }),
      row('EVD-EXPORT', { kind: 'evidence_contract', executionRole: 'binding', taskRefs: ['WORK-001'] }),
      row('PERMIT-001', { normativeStrength: 'may', polarity: 'permitted', executionRole: 'guidance', required: false }),
      row('STOP-001', { polarity: 'forbidden', executionRole: 'boundary' }),
    ];
    const result = makeRegistries(input);
    expect(result.projectionMode).toBe('semantic');
    expect(result.tasks).toEqual(['WORK-001']);
    expect(result.acceptance).toEqual(['AC-001']);
    expect(result.commands).toEqual(['CMD-EXPORT']);
    expect(result.evidence).toEqual(['EVD-EXPORT']);
    expect(result.sourceObligations.find((value: any) => value.id === 'REQ-001')).toMatchObject({
      goalTaskRefs: ['WORK-001'], commandRefs: [], acceptanceRefs: [], evidenceRefs: [],
    });
    for (const id of ['PERMIT-001', 'STOP-001']) {
      expect(result.sourceObligations.find((value: any) => value.id === id)).toMatchObject({
        goalTaskRefs: [], commandRefs: [], acceptanceRefs: [], evidenceRefs: [],
      });
    }
    expect(input[0]).not.toHaveProperty('goalTaskRefs');
  });

  it('retains the legacy registry projection for historical untyped inputs', () => {
    const result = makeRegistries([{ id: 'SRC001', kind: 'requirement', text: 'Preserve behavior' }]);
    expect(result.projectionMode).toBe('legacy');
    expect(result.tasks).toEqual(['G001']);
  });
});
