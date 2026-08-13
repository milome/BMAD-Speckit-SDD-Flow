import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createTempRoot,
  readJson,
  removeTempRoot,
  runIntakeAuthoring,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';
import type { RequirementContractModel } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model';
import {
  compileRequirementsContractCp02Candidate,
  compileRequirementContractModel,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-compiler';
import {
  resolveRequirementsTechnicalPlanningCapability,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-technical-planning-capability';
import {
  sha256Stable,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  prepareRequirementsContractCp02PipelineStage,
  prepareRequirementsContractCp04FreezeStage,
  publishRequirementsContractCp04FreezeStage,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-semantic-pipeline';
import {
  ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH,
  activeAuthoringAttemptPointerHash,
  type ActiveAuthoringAttemptPointer,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-active-authoring-attempt-pointer';
import {
  requirementsContractCoreCheckpointProfile,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-cp00-cp04';
import {
  verifyRequirementsContractCoreArtifactReadback,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-conservation-verifier';
import {
  closeRequirementContractInvariants,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-invariant-closure';

function compilerSource(): string {
  return [
    '# Compiler Closure PRD',
    '',
    '目标文件：`src/compiler_target.py`',
    '',
    '## Functional Requirements',
    '',
    '| FR ID | Requirement |',
    '| --- | --- |',
    '| FR-001 | System MUST compile source-bound requirements into a closed model. |',
    '| FR-002 | System MUST preserve trace, acceptance, evidence, and view closure. |',
    '',
    '## Out Of Scope',
    '',
    '- User confirmation is out of scope for authoring.',
  ].join('\n');
}

function sourceBoundIncompleteModel(label: string): RequirementContractModel {
  const normalized = label.toUpperCase();
  const sourcePath = `docs/requirements/${label}.md`;
  const must = {
    id: `REQUIREMENT-${normalized}-PRIMARY`,
    text: `${label} primary behavior is required.`,
    sourceRequirementId: `SOURCE-${normalized}-PRIMARY`,
    sourcePath,
    sourceSpan: { startLine: 7, endLine: 7 },
  };
  const negative = {
    id: `REQUIREMENT-${normalized}-NEGATIVE`,
    text: `${label} forbidden behavior must remain absent.`,
    sourceRequirementId: `SOURCE-${normalized}-NEGATIVE`,
    sourcePath,
    sourceSpan: { startLine: 8, endLine: 8 },
  };
  const boundary = {
    id: `BOUNDARY-${normalized}`,
    text: `${label} unrelated behavior is out of scope.`,
    authorityState: 'source_boundary' as const,
    provenance: {
      sourceRequirementId: `SOURCE-${normalized}-BOUNDARY`,
      sourcePath,
      sourceSpan: { startLine: 9, endLine: 9 },
    },
  };
  return compileRequirementContractModel({
    recordId: `MODEL-${normalized}`,
    requirementSetId: `MODEL-${normalized}-SET`,
    must: [must],
    notDone: [negative],
    outOfScope: [boundary],
    requiredCommands: [
      {
        id: `VALIDATION-${normalized}`,
        command: `npx vitest run tests/${label}.test.ts`,
        requirementRefs: [must.id],
      },
    ],
    targetPaths: [
      {
        id: `MODIFICATION-${normalized}`,
        path: `src/${label}.ts`,
        requirementRefs: [must.id],
      },
    ],
  });
}

describe('requirements contract authoring compiler invariant closure', () => {
  it('compiles a deterministic cp02 candidate only from a resolved technical registry', () => {
    const technicalPlanning = resolveRequirementsTechnicalPlanningCapability({
      authoringRequestId: 'request-cp02-compiler',
      authoringAttemptId: 'attempt-cp02-compiler',
      checkpointId: 'cp02',
      capability: {
        capabilityId: 'repository-technical-planner',
        status: 'available',
        capabilityHash: sha256Stable('capability'),
        configHash: sha256Stable('config'),
      },
      premiseHash: sha256Stable('premises'),
      candidates: [
        { kind: 'CMD', id: 'targeted-test', value: 'npm test -- compiler.test.ts' },
        { kind: 'PATH', id: 'compiler-owner', value: 'src/compiler.ts' },
      ],
    });
    const input = {
      authoringRequestId: 'request-cp02-compiler',
      authoringAttemptId: 'attempt-cp02-compiler',
      atoms: [{
        atomId: 'ATOM-COMPILE-001',
        action: 'Compile the source-bound atom.',
        oracle: 'The candidate readback matches its canonical hash.',
        dependencies: [],
        coverageSeed: 'MUST-COMPILE-001',
        originBindings: [{ sourceRootId: 'MUST-COMPILE-001', sourceSpanRef: 'SPAN-001' }],
        authorityRefs: ['AUTH-COMPILE-001'],
        spanRefs: ['SPAN-001'],
        executionConstraintRefs: ['CMD:targeted-test', 'PATH:compiler-owner'],
      }],
      decisions: [],
      technicalPlanning,
    };

    const first = compileRequirementsContractCp02Candidate(input);
    const replay = compileRequirementsContractCp02Candidate(input);

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      schemaVersion: 'requirements-contract-cp02-candidate/v1',
      status: 'closed',
      issueCodes: [],
      executionRegistryHash: technicalPlanning.executionRegistry?.registryHash,
    });
    expect(first.candidateHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it('stops the production semantic pipeline at a stable technical planning checkpoint', () => {
    const technicalPlanning = resolveRequirementsTechnicalPlanningCapability({
      authoringRequestId: 'request-cp02-pipeline',
      authoringAttemptId: 'attempt-cp02-pipeline',
      checkpointId: 'cp02',
      capability: {
        capabilityId: 'repository-technical-planner',
        status: 'unavailable',
        capabilityHash: sha256Stable('pipeline-capability'),
        configHash: sha256Stable('pipeline-config'),
      },
      premiseHash: sha256Stable('pipeline-premises'),
      candidates: [],
    });

    const result = prepareRequirementsContractCp02PipelineStage({
      authoringRequestId: 'request-cp02-pipeline',
      authoringAttemptId: 'attempt-cp02-pipeline',
      atoms: [{
        atomId: 'ATOM-PIPELINE-001',
        action: 'Prepare the semantic pipeline candidate.',
        oracle: 'The pending trigger identity remains stable on replay.',
        dependencies: [],
        coverageSeed: 'MUST-PIPELINE-001',
        originBindings: [{ sourceRootId: 'MUST-PIPELINE-001', sourceSpanRef: 'SPAN-001' }],
        authorityRefs: ['AUTH-PIPELINE-001'],
        spanRefs: ['SPAN-001'],
        executionConstraintRefs: ['CMD:targeted-test'],
      }],
      decisions: [],
      technicalPlanning,
    });

    expect(result).toMatchObject({
      status: 'technical_planning_pending',
      issueCodes: ['requirements_technical_planning_pending'],
      technicalPlanningTriggerIdentity: technicalPlanning.triggerIdentity,
      executionRegistryHash: null,
    });
  });

  it('accepts the cp02 candidate only from the deterministic compiler boundary', () => {
    const technicalPlanning = resolveRequirementsTechnicalPlanningCapability({
      authoringRequestId: 'request-cp02-pipeline-closed',
      authoringAttemptId: 'attempt-cp02-pipeline-closed',
      checkpointId: 'cp02',
      capability: {
        capabilityId: 'repository-technical-planner',
        status: 'available',
        capabilityHash: sha256Stable('pipeline-closed-capability'),
        configHash: sha256Stable('pipeline-closed-config'),
      },
      premiseHash: sha256Stable('pipeline-closed-premises'),
      candidates: [
        { kind: 'CMD', id: 'targeted-test', value: 'npm test -- pipeline.test.ts' },
      ],
    });
    const input = {
      authoringRequestId: 'request-cp02-pipeline-closed',
      authoringAttemptId: 'attempt-cp02-pipeline-closed',
      atoms: [{
        atomId: 'ATOM-PIPELINE-CLOSED-001',
        action: 'Prepare the deterministic cp02 candidate.',
        oracle: 'The pipeline candidate equals the compiler candidate.',
        dependencies: [],
        coverageSeed: 'MUST-PIPELINE-CLOSED-001',
        originBindings: [{
          sourceRootId: 'MUST-PIPELINE-CLOSED-001',
          sourceSpanRef: 'SPAN-001',
        }],
        authorityRefs: ['AUTH-PIPELINE-CLOSED-001'],
        spanRefs: ['SPAN-001'],
        executionConstraintRefs: ['CMD:targeted-test'],
      }],
      decisions: [],
      technicalPlanning,
    };

    const pipelineCandidate = prepareRequirementsContractCp02PipelineStage(input);

    expect(pipelineCandidate).toEqual(compileRequirementsContractCp02Candidate(input));
    expect(JSON.stringify(pipelineCandidate)).not.toMatch(
      /judge|auditor|roundOutcome|consecutiveNoNewGapRounds/iu
    );
  });

  it('uses distinct semantic profiles for cp00, cp01, cp03, and cp04', () => {
    const profiles = (['cp00', 'cp01', 'cp03', 'cp04'] as const)
      .map(requirementsContractCoreCheckpointProfile);

    expect(profiles.map((profile) => profile.checkpointId)).toEqual([
      'cp-00-semantic-kernel',
      'cp-01-must-decomposition-packet',
      'cp-03-packet-to-source-materialization',
      'cp-04-id-freeze',
    ]);
    expect(new Set(profiles.map((profile) => profile.profileId)).size).toBe(4);
    expect(profiles.map((profile) => profile.artifactRoles)).toEqual([
      ['semantic-kernel'],
      ['must-decomposition-packet'],
      ['id-registry', 'semantic-conservation', 'binding-conservation'],
      ['semantic-ir', 'source-binding', 'resolved-evidence-index'],
    ]);
    expect(JSON.stringify(profiles)).not.toMatch(/judge|auditor|round/iu);
  });

  it('prepares cp04 semantic and compatible binding freezes in readback order', () => {
    const result = prepareRequirementsContractCp04FreezeStage({
      semanticIr: {
        schemaVersion: 'requirements-contract-semantic-ir/v1',
        requirementSetId: 'REQ-CP04-SET',
        mustIds: ['MUST-001'],
      },
      sourceBinding: {
        schemaVersion: 'requirements-contract-source-binding/v1',
        snapshotRefs: ['snapshots/source-001.json'],
      },
      resolvedEvidenceIndex: {
        schemaVersion: 'requirements-contract-resolved-evidence-index/v1',
        claimRefs: ['EVIDENCE-CLAIM-001'],
      },
    });

    expect(result.status).toBe('ready_to_publish');
    expect(result.sourceBinding).toMatchObject(result.semanticIdentity);
    expect(result.resolvedEvidenceIndex).toMatchObject({
      ...result.semanticIdentity,
      ...result.bindingIdentity,
    });
    expect(result.readback).toEqual({
      semanticIr: true,
      sourceBinding: true,
      resolvedEvidenceIndex: true,
    });
    expect(verifyRequirementsContractCoreArtifactReadback({
      freeze: result.freezes.semanticIr,
      artifact: { ...result.semanticIr, mutableJudgeState: 'forbidden' },
    })).toBe(false);
    const profile = requirementsContractCoreCheckpointProfile('cp04');
    const forbiddenArtifact = { ...result.semanticIr, judge: { status: 'pass' } };
    const artifactHash = sha256Stable({
      domain: 'requirements-contract-core-artifact/v1',
      checkpointId: profile.checkpointId,
      profileId: profile.profileId,
      artifactRole: 'semantic-ir',
      artifact: forbiddenArtifact,
    });
    const forgedPayload = {
      schemaVersion: 'requirements-contract-core-artifact-freeze/v1',
      checkpointId: profile.checkpointId,
      profileId: profile.profileId,
      artifactRole: 'semantic-ir',
      artifactHash,
    };
    expect(verifyRequirementsContractCoreArtifactReadback({
      freeze: {
        ...forgedPayload,
        freezeHash: sha256Stable({
          domain: 'requirements-contract-core-artifact-freeze/v1',
          payload: forgedPayload,
        }),
      },
      artifact: forbiddenArtifact,
    })).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/auditor|roundOutcome|consecutiveNoNewGapRounds/iu);
  });

  it('treats the model as projection authority without materializing missing views', () => {
    const model = sourceBoundIncompleteModel('projection-authority');
    const closed = closeRequirementContractInvariants(model);

    expect(closed.businessViews).toEqual(model.businessViews);
    expect(closed.traceRows).toEqual(model.traceRows);
    expect(closed.invariantClosure.terminalState).toBe('blocked');
    expect(closed.invariantClosure.issues.map((issue) => issue.code)).toContain(
      'missing_business_view_projection'
    );
    expect(closed.invariantClosure.rendererBlockerPolicy).toBe(
      'renderer_blocker_release_failure'
    );
  });

  it('keeps checkpoint-produced projection obligations out of the pre-checkpoint closure profile', () => {
    const model = sourceBoundIncompleteModel('pre-checkpoint-profile');
    const preCheckpoint = closeRequirementContractInvariants(model, {
      profile: 'pre_checkpoint',
    });
    const full = closeRequirementContractInvariants(model);

    expect(preCheckpoint.invariantClosure.terminalState).toBe('confirmable');
    expect(preCheckpoint.invariantClosure.issues).toEqual([]);
    expect(full.invariantClosure.terminalState).toBe('blocked');
    expect(full.invariantClosure.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'missing_evidence_coverage',
        'missing_acceptance_coverage',
        'missing_trace_coverage',
        'missing_business_view_projection',
      ])
    );
  });

  it('computes before and after measures from the actual unchanged model', () => {
    const model = sourceBoundIncompleteModel('closure-measure');
    const closed = closeRequirementContractInvariants(model);

    expect(closed.invariantClosure.measureBefore).toMatchObject({
      unresolvedInvariantCount: expect.any(Number),
      orphanReferenceCount: expect.any(Number),
      missingProjectionCount: expect.any(Number),
      localizationParityCount: expect.any(Number),
      schemaValidationCount: expect.any(Number),
    });
    expect(closed.invariantClosure.measureAfter).toEqual(
      closed.invariantClosure.measureBefore
    );
    expect(closed.invariantClosure.measureAfter?.unresolvedInvariantCount).toBeGreaterThan(0);
    expect(closed.invariantClosure.measureAfter?.missingProjectionCount).toBeGreaterThan(0);
  });

  it('records only executed validation passes without changing semantic fields', () => {
    const model = sourceBoundIncompleteModel('pass-receipts');
    const closed: RequirementContractModel = closeRequirementContractInvariants(model);
    const receipts = closed.invariantClosure.roundReceipts ?? [];

    expect(closed.invariantClosure.remainingIssueCount).toBe(
      closed.invariantClosure.issues.length
    );
    expect(closed.invariantClosure.appliedPasses).toEqual(
      receipts.map((receipt) => receipt.passId)
    );
    expect(closed.invariantClosure.appliedPasses).not.toContain('closeMustCoverage');
    expect(closed.invariantClosure.appliedPasses).not.toContain('closeNegCoverage');
    expect(receipts.every((receipt) => receipt.outputs.changedFields.length === 0)).toBe(true);
    expect(closed.evidence).toEqual(model.evidence);
    expect(closed.acceptanceCriteria).toEqual(model.acceptanceCriteria);
    expect(closed.targetModificationPaths).toEqual(model.targetModificationPaths);
  });

  it('writes a blocking measured report when source semantics are incomplete', () => {
    const root = createTempRoot('bmad-compiler-closure-');
    try {
      const intakeSource = writeText(root, 'source.md', compilerSource());
      const targetSource = path.join(root, 'generated.md');
      const recordId = 'REQ-TEST-COMPILER-CLOSURE';
      const result = runIntakeAuthoring(root, intakeSource, targetSource, recordId, {
        targetPath: 'tests/trader/test_gateway_profile_registry.py',
        requiredCommand: 'python -m pytest tests/trader/test_gateway_profile_registry.py',
        confirmationLanguage: 'en-US',
        sessionId: 'session-compiler-closure',
        sessionTurnId: 'turn-compiler-closure',
        sessionMessageId: 'message-compiler-closure',
        sessionActorIdentityClass: 'requesting_user',
        sessionBranch: 'test-compiler-closure',
        sessionCapturedAt: '2026-07-14T00:00:00.000Z',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const paths = artifacts(root, recordId, `${recordId}-SET`);
      const modelPath = path.join(paths.authoring, 'requirement-contract-model.json');
      const reportPath = path.join(paths.authoring, 'compiler-closure-report.json');
      expect(existsSync(paths.invocationAuthorityReceipt)).toBe(true);
      expect(readJson<Record<string, unknown>>(paths.invocationAuthorityReceipt)).toMatchObject({
        schemaVersion: 'requirements-contract-invocation-authority-receipt/v1',
        requirementSetId: `${recordId}-SET`,
        recordId,
        entrySource: 'session_requirements',
      });
      expect(existsSync(modelPath)).toBe(true);
      expect(existsSync(reportPath)).toBe(true);
      expect(readJson<Record<string, unknown>>(reportPath)).toMatchObject({
        terminalState: 'blocked',
        rendererBlockerPolicy: 'renderer_blocker_release_failure',
      });
      expect(
        Number(readJson<Record<string, unknown>>(reportPath).remainingIssueCount)
      ).toBeGreaterThan(0);
      expect(result.blockingIssues.map((issue) => issue.code)).toContain(
        'renderer_blocker_release_failure'
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('publishes cp04 authority artifacts before CAS publishing the attempt pointer', () => {
    const root = createTempRoot('requirements-contract-cp04-publish-');
    try {
      const stage = prepareRequirementsContractCp04FreezeStage({
        semanticIr: { schemaVersion: 'requirements-contract-semantic-ir/v1', mustIds: ['MUST-001'] },
        sourceBinding: { schemaVersion: 'requirements-contract-source-binding/v1', snapshotRefs: ['SNAP-001'] },
        resolvedEvidenceIndex: { schemaVersion: 'requirements-contract-resolved-evidence-index/v1', claimRefs: ['CLAIM-001'] },
      });
      const publication = publishRequirementsContractCp04FreezeStage({
        recordRootPath: root,
        stage,
        authoringRequestId: 'REQUEST-CP04',
        authoringAttemptId: 'ATTEMPT-CP04',
        inputManifestHash: sha256Stable('cp04-input'),
        previousCheckpointManifestRef: {
          checkpointId: 'cp03', checkpointOrdinal: 3,
          path: 'authoring/staging/ATTEMPT-CP04/manifests/3-cp03.json',
          hash: sha256Stable('cp03-manifest'),
        },
        compilerIdentity: 'requirements-contract-compiler/v1',
        decisionReceiptRefs: [],
        baseAuthorityRef: null,
        expectedCurrentPointerHash: null,
        compareAndSwapAttemptPointer(targetPath, expectedHash, pointer, pointerHash) {
          const absolute = path.join(root, ...targetPath.split('/'));
          const currentHash = existsSync(absolute)
            ? activeAuthoringAttemptPointerHash(readJson<ActiveAuthoringAttemptPointer>(absolute))
            : null;
          if (currentHash !== expectedHash) return false;
          writeText(root, targetPath, `${JSON.stringify(pointer, null, 2)}\n`);
          return activeAuthoringAttemptPointerHash(
            readJson<ActiveAuthoringAttemptPointer>(absolute)
          ) === pointerHash;
        },
      });

      expect(publication.readback).toEqual({
        semanticIr: true,
        sourceBinding: true,
        resolvedEvidenceIndex: true,
        checkpointManifest: true,
      });
      expect(readJson<Record<string, unknown>>(publication.paths.semanticIr)).toEqual(stage.semanticIr);
      expect(readJson<Record<string, unknown>>(publication.paths.sourceBinding)).toEqual(stage.sourceBinding);
      expect(readJson<Record<string, unknown>>(publication.paths.resolvedEvidenceIndex))
        .toEqual(stage.resolvedEvidenceIndex);
      expect(readJson<ActiveAuthoringAttemptPointer>(
        path.join(root, ...ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH.split('/'))
      )).toEqual(publication.attemptPointer.pointer);
    } finally {
      removeTempRoot(root);
    }
  });

  it('leaves the attempt pointer unpublished when cp04 artifact publication crashes', () => {
    const root = createTempRoot('requirements-contract-cp04-crash-');
    try {
      const stage = prepareRequirementsContractCp04FreezeStage({
        semanticIr: { schemaVersion: 'requirements-contract-semantic-ir/v1', mustIds: ['MUST-001'] },
        sourceBinding: { schemaVersion: 'requirements-contract-source-binding/v1', snapshotRefs: ['SNAP-001'] },
        resolvedEvidenceIndex: { schemaVersion: 'requirements-contract-resolved-evidence-index/v1', claimRefs: ['CLAIM-001'] },
      });
      const input = {
        recordRootPath: root,
        stage,
        authoringRequestId: 'REQUEST-CP04',
        authoringAttemptId: 'ATTEMPT-CP04',
        inputManifestHash: sha256Stable('cp04-input'),
        previousCheckpointManifestRef: {
          checkpointId: 'cp03', checkpointOrdinal: 3,
          path: 'authoring/staging/ATTEMPT-CP04/manifests/3-cp03.json',
          hash: sha256Stable('cp03-manifest'),
        },
        compilerIdentity: 'requirements-contract-compiler/v1',
        decisionReceiptRefs: [],
        baseAuthorityRef: null,
        expectedCurrentPointerHash: null,
        compareAndSwapAttemptPointer: () => true,
      } as const;
      expect(() => publishRequirementsContractCp04FreezeStage({
        ...input,
        onArtifactPhase(role, phase) {
          if (role === 'source-binding' && phase === 'after_publish') {
            throw new Error('cp04-publication-crash');
          }
        },
      })).toThrow('cp04-publication-crash');
      expect(existsSync(path.join(root, ...ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH.split('/'))))
        .toBe(false);
      expect(publishRequirementsContractCp04FreezeStage(input).readback.checkpointManifest)
        .toBe(true);
    } finally {
      removeTempRoot(root);
    }
  });
});
