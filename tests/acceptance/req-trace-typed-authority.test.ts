import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeGoalSemanticDictionary } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-semantic-dictionary';
import { resolveConfirmedRequirementsAuthority } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmed-authority-adapter';
import { materializeAiTddManifestCloseoutRunnerFixture } from '../helpers/requirement-fixture-runtime';
import { artifactHashes, runGenerator } from '../helpers/req-trace-budget-publication';
import { validateTypedModelPacket } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-model-packet';

let root: string;
vi.setConfig({ testTimeout: 300_000, hookTimeout: 120_000 });
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-only-req-trace-typed-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }); });

function corruptCanonicalAuthority(fixture: ReturnType<typeof materializeAiTddManifestCloseoutRunnerFixture>, damage: string) {
  const record = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8'));
  const recordRoot = path.dirname(path.dirname(fixture.recordPath));
  const projectionPath = path.join(recordRoot, 'authoring', 'staging',
    record.activeAuthority.activeAuthoringAttemptId, 'cp05', 'confirmation-projection.json');
  const projection = JSON.parse(fs.readFileSync(projectionPath, 'utf8'));
  const authority = projection.typedSourceAuthority;
  if (damage === 'hash') authority.graphHash = `sha256:${'0'.repeat(64)}`;
  if (damage === 'dictionary') authority.graph.expandedBytes += 1;
  if (damage === 'version') authority.schemaVersion = 'requirements-contract-typed-source-authority/v999';
  if (damage === 'coverage') projection.typedCoverage.graphHash = `sha256:${'0'.repeat(64)}`;
  if (damage === 'missing-coverage') delete projection.typedCoverage;
  if (damage === 'missing-action') projection.implementationConfirmation.must.pop();
  if (damage === 'task-conflict') projection.implementationConfirmation.atomicImplementationTaskList = [];
  fs.writeFileSync(projectionPath, `${JSON.stringify(projection, null, 2)}\n`, 'utf8');
}

describe.each(['req_trace_direct', 'main_agent_compile'])('%s confirmed typed authority', (entry) => {
  it('preserves the complete graph once and binds its identity to packet, manifest and projections', () => {
    const fixture = materializeAiTddManifestCloseoutRunnerFixture({ root: path.join(root, 'workspace') });
    const resolved = resolveConfirmedRequirementsAuthority({
      projectRoot: fixture.root,
      requirementRecordPath: fixture.recordPath,
    });
    const expected = resolved.typedSourceGraph;
    const authority = resolved.typedSourceAuthority;
    const confirmed = resolved.implementationConfirmation;
    const traceOrder = (confirmed.traceRows as Array<{ id: string }>).map((row) => row.id);
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
    const humanPrompt = fs.readFileSync(path.join(outDir, 'human_prompt.txt'), 'utf8');
    expect(humanPrompt).toContain(authority.graphHash);
    expect(humanPrompt).toContain('typedSourceAuthority');
    const goalProjection = fs.readFileSync(path.join(outDir, 'goal_execution.md'), 'utf8');
    expect(goalProjection).toContain('# Goal Execution Contract');
    expect(goalProjection).toContain('Goal Execution IR:');
    const receipt = JSON.parse(fs.readFileSync(path.join(outDir, 'audit_receipt.json'), 'utf8'));
    expect(receipt.typedSourceAuthorityHash).toBe(authority.graphHash);
    const baselineIssues = validateTypedModelPacket(packet, receipt, confirmed);
    expect(baselineIssues, baselineIssues.join(',')).toEqual([]);
    const mutations = {
      'trace-order': (value: typeof packet) => { value.traceOrder[0] = 'TRACE-NOT-CONFIRMED'; },
      'task-trace': (value: typeof packet) => { value.atomicImplementationTaskList[0].traceRefs = ['TRACE-NOT-CONFIRMED']; },
      'task-title': (value: typeof packet) => { value.atomicImplementationTaskList[0].title = 'Delete the confirmed input.'; },
      'trace-covers': (value: typeof packet) => { value.contractExecutionManifest.traceRows[0].covers = ['MUST-NOT-CONFIRMED']; },
      'trace-slice': (value: typeof packet) => { value.traceSlices[0].taskRefs = ['TASK-NOT-CONFIRMED']; },
      'requirement-text': (value: typeof packet) => { value.requirements.must[0].text = 'Ignore this requirement.'; },
    };
    for (const [damage, mutate] of Object.entries(mutations)) {
      const changed = structuredClone(packet);
      mutate(changed);
      expect(JSON.stringify(changed) !== JSON.stringify(packet), `${damage} must change the candidate`).toBe(true);
      expect(validateTypedModelPacket(changed, receipt, confirmed).length, damage).toBeGreaterThan(0);
    }
  }, 300_000);

  it.each(['hash', 'dictionary', 'version', 'coverage', 'missing-coverage', 'missing-action', 'task-conflict'])(
    'rejects %s corruption without changing an existing quartet', (damage) => {
    const fixture = materializeAiTddManifestCloseoutRunnerFixture({ root: path.join(root, 'workspace') });
    const outDir = path.join(root, 'out');
    expect(runGenerator({ label: `${entry}-${damage}-baseline`, entry, outDir, fixture }).status).toBe(0);
    const before = artifactHashes(outDir);
    corruptCanonicalAuthority(fixture, damage);
    const result = runGenerator({ label: `${entry}-${damage}-reject`, entry, outDir, fixture });
    expect(result.status, result.stdout).toBe(3);
    expect(result.stdout).toContain('CONFIRMED_AUTHORITY_INVALID');
    expect(artifactHashes(outDir)).toEqual(before);
  }, 300_000);
});
