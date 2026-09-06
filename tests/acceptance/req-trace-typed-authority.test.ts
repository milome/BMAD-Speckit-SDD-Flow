import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTypedSourceAuthority, createTypedSourceCoverage, type RequirementsTypedSourceGraph } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-source-semantics';
import { decodeGoalSemanticDictionary } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-semantic-dictionary';
import { materializeAiTddManifestCloseoutRunnerFixture } from '../helpers/requirement-fixture-runtime';
import { artifactHashes, rewriteSyntheticConfirmation, runGenerator } from '../helpers/req-trace-budget-publication';
import { validateTypedModelPacket } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-model-packet';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-only-req-trace-typed-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }); });

const graph = (): RequirementsTypedSourceGraph => ({ schemaVersion: 'requirements-contract-typed-source-graph/v2' as const,
  sourceNodes: [{ sourceRootId: 'SOURCE-BOUNDARY', executionRole: 'boundary' as const,
    text: 'Do not replace the confirmed trace order.', polarity: 'forbidden', normativeStrength: 'must',
    conditions: [{ kind: 'when', text: 'When compiling a confirmed source.' }],
    scope: { kind: 'source_section', owner: 'CONFIRMED-SOURCE' }, declaredIds: [] }],
  sourceRelations: [], sourceBlocks: [], commandDeclarations: [], workDeclarations: [],
  scenarioDeclarations: [], fixDeclarations: [], sections: [{ id: 'CONFIRMED-SOURCE' }] });

function addTypedAuthority(confirmation: Record<string, any>) {
  const expected = graph();
  expected.sourceNodes.push(...confirmation.must.map((row: any) => ({
    sourceRootId: row.id, executionRole: 'action', text: row.text,
    polarity: 'required', normativeStrength: 'must', conditions: [],
    scope: { kind: 'work', owner: row.id }, declaredIds: [row.id],
  })));
  confirmation.implementationTasks = confirmation.must.map((row: any) => ({
    id: `${row.id}-A1`, title: row.text, requirementRefs: [row.id],
    traceRefs: confirmation.traceRows.filter((trace: any) => trace.covers.includes(row.id))
      .map((trace: any) => trace.id), evidenceRefs: row.evidenceRefs ?? [], targetPaths: [],
  }));
  for (const trace of confirmation.traceRows) {
    trace.taskRefs = confirmation.implementationTasks.filter((task: any) => task.traceRefs.includes(trace.id))
      .map((task: any) => task.id);
  }
  delete confirmation.atomicImplementationTaskList;
  delete confirmation.mustToAtomicTaskMap;
  delete confirmation.atomicTaskToTraceMap;
  const authority = createTypedSourceAuthority(expected);
  confirmation.typedSourceAuthority = authority;
  confirmation.typedCoverage = createTypedSourceCoverage(authority);
  return { expected, authority };
}

describe.each(['req_trace_direct', 'main_agent_compile'])('%s confirmed typed authority', (entry) => {
  it('preserves the complete graph once and binds its identity to packet, manifest and projections', () => {
    const fixture = materializeAiTddManifestCloseoutRunnerFixture({ root: path.join(root, 'workspace') });
    let expected!: RequirementsTypedSourceGraph;
    let authority!: ReturnType<typeof createTypedSourceAuthority>;
    let traceOrder: string[] = [];
    let confirmed!: Record<string, unknown>;
    rewriteSyntheticConfirmation(fixture, (confirmation) => {
      ({ expected, authority } = addTypedAuthority(confirmation));
      traceOrder = (confirmation.traceRows as Array<{ id: string }>).map((row) => row.id);
      confirmed = structuredClone(confirmation);
    });
    const outDir = path.join(root, 'out');
    const result = runGenerator({ label: `${entry}-typed-preservation`, entry, outDir, fixture });
    expect(result.status, result.stdout).toBe(0);
    const packet = JSON.parse(fs.readFileSync(path.join(outDir, 'model_packet.json'), 'utf8'));
    expect(packet.schemaVersion).toBe('req-trace-ai-tdd-model-packet/v2');
    expect(packet.typedSourceAuthority).toEqual(authority);
    expect(decodeGoalSemanticDictionary(packet.typedSourceAuthority.graph)).toEqual(expected);
    expect(packet.traceOrder).toEqual(traceOrder);
    expect(packet.contractExecutionManifest.typedSourceAuthorityRef).toEqual({
      schemaVersion: authority.schemaVersion, graphHash: authority.graphHash,
      authorityPath: 'model_packet.json#/typedSourceAuthority',
    });
    expect(packet.contractExecutionManifest.typedSourceAuthority).toBeUndefined();
    expect(packet.contractExecutionManifest.schemaVersion).toBe('contract-execution-manifest/v2');
    for (const name of ['human_prompt.txt', 'goal_execution.md']) {
      const projection = fs.readFileSync(path.join(outDir, name), 'utf8');
      expect(projection).toContain(authority.graphHash);
      expect(projection).toContain('typedSourceAuthority');
    }
    const receipt = JSON.parse(fs.readFileSync(path.join(outDir, 'audit_receipt.json'), 'utf8'));
    expect(receipt.typedSourceAuthorityHash).toBe(authority.graphHash);
    const baselineIssues = validateTypedModelPacket(packet, receipt, confirmed);
    expect(baselineIssues, baselineIssues.join(',')).toEqual([]);
    const mutations = {
      'trace-order': (value: typeof packet) => { value.traceOrder[0] = 'TRACE-NOT-CONFIRMED'; },
      'task-trace': (value: typeof packet) => { value.atomicImplementationTaskList[0].traceRefs = ['TRACE-NOT-CONFIRMED']; },
      'task-title': (value: typeof packet) => { value.atomicImplementationTaskList[0].title = 'Delete the confirmed input.'; },
      'trace-covers': (value: typeof packet) => { value.contractExecutionManifest.traceRows[0].covers = ['MUST-NOT-CONFIRMED']; },
      'trace-slice': (value: typeof packet) => { value.traceSlices[0].taskRefs = []; },
      'requirement-text': (value: typeof packet) => { value.requirements.must[0].text = 'Ignore this requirement.'; },
    };
    for (const [damage, mutate] of Object.entries(mutations)) {
      const changed = structuredClone(packet);
      mutate(changed);
      expect(JSON.stringify(changed) !== JSON.stringify(packet), `${damage} must change the candidate`).toBe(true);
      expect(validateTypedModelPacket(changed, receipt, confirmed).length, damage).toBeGreaterThan(0);
    }
  });

  it.each(['hash', 'dictionary', 'version', 'coverage', 'missing-coverage', 'missing-action', 'task-conflict'])(
    'rejects %s corruption without changing an existing quartet', (damage) => {
    const fixture = materializeAiTddManifestCloseoutRunnerFixture({ root: path.join(root, 'workspace') });
    const outDir = path.join(root, 'out');
    expect(runGenerator({ label: `${entry}-${damage}-baseline`, entry, outDir, fixture }).status).toBe(0);
    const before = artifactHashes(outDir);
    rewriteSyntheticConfirmation(fixture, (confirmation) => {
      const { authority }: any = addTypedAuthority(confirmation);
      if (damage === 'hash') authority.graphHash = `sha256:${'0'.repeat(64)}`;
      if (damage === 'dictionary') authority.graph.expandedBytes += 1;
      if (damage === 'version') authority.schemaVersion = 'requirements-contract-typed-source-authority/v999';
      if (damage === 'coverage') (confirmation.typedCoverage as any).graphHash = `sha256:${'0'.repeat(64)}`;
      if (damage === 'missing-coverage') delete confirmation.typedCoverage;
      if (damage === 'missing-action') (confirmation.must as any[]).pop();
      if (damage === 'task-conflict') confirmation.atomicImplementationTaskList = [];
      confirmation.typedSourceAuthority = authority;
    });
    const result = runGenerator({ label: `${entry}-${damage}-reject`, entry, outDir, fixture });
    expect(result.status, result.stdout).toBe(3);
    expect(result.stdout).toContain(damage === 'task-conflict'
      ? 'TYPED_SOURCE_TASK_PROJECTION_CONFLICT' : 'TYPED_SOURCE_AUTHORITY_INVALID');
    expect(artifactHashes(outDir)).toEqual(before);
  });
});
