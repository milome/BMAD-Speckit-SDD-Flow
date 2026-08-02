import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createJudgeRuntimeBindingsFixture } from './helpers/requirements-contract-judge-runtime-bindings-fixture';
import {
  canonicalJson,
  sha256,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';
import { resolveRequirementsContractJudgeRuntimeBindings } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-runtime-bindings';

const roots: string[] = [];

afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-runtime-bindings-'));
  roots.push(root);
  const phaseAuditAttemptId = `AUD-${path.basename(root)}`;
  const phaseRoot = path.join(root, 'audit', phaseAuditAttemptId);
  const { judgeAuditUnitSet, judgeRuntimeBindings, stageEvidence } =
    createJudgeRuntimeBindingsFixture({
      root,
      phaseRoot,
      phaseAuditAttemptId,
    });
  const context = {
    schemaVersion: 'requirements-contract-stage-audit-context/v1',
    phase: 'pre-candidate',
    phaseAuditAttemptId,
    requirementSetId: judgeAuditUnitSet.requirementSetId,
    transactionId: `TX-${path.basename(root)}`,
    implementationAttemptId: `IMP-${path.basename(root)}`,
    frozenUniverseHash: judgeAuditUnitSet.judgeAuditUniverseHash,
    sourceHashes: { source: judgeRuntimeBindings.sourceRef.hash },
    semanticModelHashes: { semantic: judgeAuditUnitSet.semanticModelHash },
    consumerIdentityHash: judgeRuntimeBindings.baseEvidenceRef.hash,
    stageEvidence,
    judgeRuntimeBindings,
  };
  return {
    root,
    phaseRoot,
    phaseAuditAttemptId,
    judgeAuditUnitSet,
    judgeRuntimeBindings,
    context,
  };
}

describe('requirements contract Judge runtime bindings', () => {
  it('resolves the current phase bundle and derives the frozen base input hash', () => {
    const input = fixture();
    const result = resolveRequirementsContractJudgeRuntimeBindings({
      root: input.root,
      phaseRoot: input.phaseRoot,
      phase: 'pre-candidate',
      phaseAuditAttemptId: input.phaseAuditAttemptId,
      context: input.context,
    });

    expect(result.refs.judgeAuditUnitSet).toEqual(input.judgeRuntimeBindings.judgeAuditUnitSetRef);
    expect(result.judgeAuditUnitSet).toEqual(input.judgeAuditUnitSet);
    expect(result.baseJudgeInputBundleHash).toBe(
      sha256(
        canonicalJson({
          schemaVersion: 'requirements-contract-base-judge-input-bundle/v1',
          phase: input.context.phase,
          phaseAuditAttemptId: input.phaseAuditAttemptId,
          requirementSetId: input.context.requirementSetId,
          transactionId: input.context.transactionId,
          implementationAttemptId: input.context.implementationAttemptId,
          judgeAuditUnitSetRef: result.refs.judgeAuditUnitSet,
          judgeAuditUniverseHash: input.judgeAuditUnitSet.judgeAuditUniverseHash,
          judgeAuditUnitSetHash: input.judgeAuditUnitSet.judgeAuditUnitSetHash,
          rubricRef: result.refs.rubric,
          systemPromptRef: result.refs.systemPrompt,
          sourceRef: result.refs.source,
          traceRef: result.refs.trace,
          redRef: result.refs.red,
          baseEvidenceRef: result.refs.baseEvidence,
          authorizedChallengeDerivationProtocolRef:
            result.refs.authorizedChallengeDerivationProtocol,
        })
      )
    );
  });

  it('rejects artifact drift, attempt drift, and audit-universe drift', () => {
    const artifactDrift = fixture();
    const rubricPath = path.resolve(
      artifactDrift.root,
      artifactDrift.judgeRuntimeBindings.rubricRef.path
    );
    writeFileSync(rubricPath, `${readFileSync(rubricPath, 'utf8')}\n`, 'utf8');
    expect(() =>
      resolveRequirementsContractJudgeRuntimeBindings({
        root: artifactDrift.root,
        phaseRoot: artifactDrift.phaseRoot,
        phase: 'pre-candidate',
        phaseAuditAttemptId: artifactDrift.phaseAuditAttemptId,
        context: artifactDrift.context,
      })
    ).toThrow(/judge_runtime_binding_hash_mismatch:rubricRef/u);

    const attemptDrift = fixture();
    expect(() =>
      resolveRequirementsContractJudgeRuntimeBindings({
        root: attemptDrift.root,
        phaseRoot: attemptDrift.phaseRoot,
        phase: 'pre-candidate',
        phaseAuditAttemptId: `${attemptDrift.phaseAuditAttemptId}-stale`,
        context: attemptDrift.context,
      })
    ).toThrow(/judge_runtime_binding_attempt_context_mismatch/u);

    const universeDrift = fixture();
    const staleContext = {
      ...universeDrift.context,
      frozenUniverseHash: sha256(`${universeDrift.context.frozenUniverseHash}:stale`),
    };
    expect(() =>
      resolveRequirementsContractJudgeRuntimeBindings({
        root: universeDrift.root,
        phaseRoot: universeDrift.phaseRoot,
        phase: 'pre-candidate',
        phaseAuditAttemptId: universeDrift.phaseAuditAttemptId,
        context: staleContext,
      })
    ).toThrow(/judge_runtime_binding_judge_audit_unit_set_context_mismatch/u);
  });
});
