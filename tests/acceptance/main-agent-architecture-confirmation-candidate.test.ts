import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { runIngestArchitectureConfirmation } from '../../packages/bmad-speckit/src/main-agent/actions/ingest-architecture-confirmation';
import { runPrepareArchitectureConfirmation } from '../../packages/bmad-speckit/src/main-agent/actions/prepare-architecture-confirmation';
import {
  createRequirementsContractBuildManifest,
  createRequirementsContractCheckpointManifest,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest';
import { artifactBytesHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains';
import { compileRequirementsEffectivePassReceiptV2 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-requirements-effective-pass-gate';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  createRequirementsContractSemanticIr,
  type RequirementsExecutionConstraint,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';
import { createRequirementsContractSourceBindingCapsule } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-binding-capsule';
import {
  deriveArchitectureConfirmationCandidate,
  resolveArchitectureConfirmationContext,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/prepare-architecture-confirmation';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function architectureAuthoritySource(authority: Record<string, unknown>) {
  return {
    schemaVersion: 'requirements-contract-authority-source/v1',
    sourceRootId: authority.authorityId,
    semanticBody: authority,
  };
}

function authoritySnapshotHash(value: unknown): string {
  return sha256Stable({
    domain: 'requirements-source-snapshot/v1',
    content: jsonText(architectureAuthoritySource(value as Record<string, unknown>)),
  });
}

function writeJson(root: string, relativePath: string, value: unknown): string {
  const target = path.join(root, ...relativePath.split('/'));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, jsonText(value), 'utf8');
  return target;
}

function writeText(root: string, relativePath: string, value: string): string {
  const target = path.join(root, ...relativePath.split('/'));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
  return target;
}

function fixture(
  projectRoot: string,
  overrides: {
    buildRequestId?: string;
    buildAttemptId?: string;
    technicalValues?: Partial<{
      targetPath: string;
      command: string;
      artifact: string;
      executionStructure: string;
      evidenceRequirement: string;
      forbiddenPath: string;
    }>;
    repositoryAuthority?: Record<string, unknown>;
    policyAuthority?: Record<string, unknown>;
    executionCheckpointOrdinal?: 6 | 7 | 8;
    executionCheckpointStatus?: 'pending' | 'passed' | 'blocked';
    executionCheckpointCompilerIdentity?: string;
    executionPath?: string;
    directExecutionEntry?: 'matching' | 'absent' | 'conflicting';
  } = {}
) {
  const requestId = 'REQ-ARCH-CANDIDATE-001';
  const activeAttemptId = 'ATTEMPT-ARCH-001';
  const manifestAttemptId = overrides.buildAttemptId ?? activeAttemptId;
  const technicalValues = {
    targetPath: 'src/refund-worker.ts',
    command: 'npm test -- refund-worker.test.ts',
    artifact: 'dist/refund-worker.js',
    executionStructure: 'refund-worker vertical slice',
    evidenceRequirement: 'refund-worker RED/GREEN evidence',
    forbiddenPath: '.git/**',
    ...overrides.technicalValues,
  };
  const recordRoot = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requestId
  );
  const executionConstraints: RequirementsExecutionConstraint[] = [
    {
      constraintId: 'PATH-refund-worker',
      kind: 'PATH',
      canonicalValue: technicalValues.targetPath,
      applicableMustRefs: ['MUST-ARCH-001'],
      applicableAtomRefs: ['MUST-ARCH-001-A1'],
      premiseRefs: ['MUST-ARCH-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
    {
      constraintId: 'CMD-refund-worker-test',
      kind: 'CMD',
      canonicalValue: technicalValues.command,
      applicableMustRefs: ['MUST-ARCH-001'],
      applicableAtomRefs: ['MUST-ARCH-001-A1'],
      premiseRefs: ['MUST-ARCH-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
    {
      constraintId: 'ART-refund-worker-output',
      kind: 'ART',
      canonicalValue: technicalValues.artifact,
      applicableMustRefs: ['MUST-ARCH-001'],
      applicableAtomRefs: ['MUST-ARCH-001-A1'],
      premiseRefs: ['MUST-ARCH-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
    {
      constraintId: 'CTM-refund-worker-slice',
      kind: 'CTM',
      canonicalValue: technicalValues.executionStructure,
      applicableMustRefs: ['MUST-ARCH-001'],
      applicableAtomRefs: ['MUST-ARCH-001-A1'],
      premiseRefs: ['MUST-ARCH-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
    {
      constraintId: 'EVDREQ-refund-worker-red-green',
      kind: 'EVDREQ',
      canonicalValue: technicalValues.evidenceRequirement,
      applicableMustRefs: ['MUST-ARCH-001'],
      applicableAtomRefs: ['MUST-ARCH-001-A1'],
      premiseRefs: ['MUST-ARCH-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
    {
      constraintId: 'STOP-refund-worker-forbidden',
      kind: 'STOP',
      canonicalValue: technicalValues.forbiddenPath,
      applicableMustRefs: ['MUST-ARCH-001'],
      applicableAtomRefs: ['MUST-ARCH-001-A1'],
      premiseRefs: ['MUST-ARCH-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
  ];
  const semanticIr = createRequirementsContractSemanticIr({
    recordId: requestId,
    requestId,
    parentSemanticRevisionId: null,
    compilerVersion: 'requirements-contract-cp02-compiler/v1',
    semantics: {
      requirements: [
        {
          id: 'MUST-ARCH-001',
          text: 'Implement the refund worker.',
          oracle: 'The declared test passes.',
        },
      ],
      atoms: [
        {
          id: 'MUST-ARCH-001-A1',
          requirementRef: 'MUST-ARCH-001',
          action: 'Implement the worker.',
          oracle: 'The declared test passes.',
        },
      ],
      decisions: [],
    },
    evidenceClaims: [],
    specSpanRegistry: [],
    executionConstraints,
    semanticProvenance: { 'MUST-ARCH-001': 'MUST-ARCH-001' },
  });
  const repositoryAuthority = {
    schemaVersion: 'ArchitecturePremiseAuthority/v1',
    authorityKind: 'repository',
    authorityRole: 'repository_authority',
    authorityId: 'repo-refund-worker',
    allowedTargetPaths: [technicalValues.targetPath],
    consumerImpactRules: [
      {
        impactId: 'consumer:logical-targets',
        whenConstraintKinds: ['PATH'],
        whenConstraintIds: [],
      },
    ],
    triggerRules: [
      {
        triggerId: 'architecture:target-scope',
        whenConstraintKinds: ['PATH'],
        whenConstraintIds: [],
      },
      {
        triggerId: 'architecture:toolchain',
        whenConstraintKinds: ['CMD', 'ART', 'EVDREQ'],
        whenConstraintIds: [],
      },
    ],
    ...overrides.repositoryAuthority,
  };
  const policyAuthority = {
    schemaVersion: 'ArchitecturePremiseAuthority/v1',
    authorityKind: 'policy',
    authorityRole: 'policy_authority',
    authorityId: 'policy-refund-worker',
    forbiddenScope: { paths: [technicalValues.forbiddenPath] },
    ownershipRules: [
      {
        targetPath: technicalValues.targetPath,
        owner: 'requirements_backed_main_agent',
      },
    ],
    isolationSelection: 'consumer_worktree',
    governanceImpactRules: [
      { impactId: 'governance:pinned-policy', whenConstraintKinds: [], whenConstraintIds: [] },
    ],
    triggerRules: [
      { triggerId: 'architecture:governance', whenConstraintKinds: [], whenConstraintIds: [] },
      {
        triggerId: 'architecture:execution-structure',
        whenConstraintKinds: ['CTM'],
        whenConstraintIds: [],
      },
    ],
    ...overrides.policyAuthority,
  };
  const repositoryAuthorityPath = 'repo/refund-worker.json';
  const policyAuthorityPath = 'policy/refund-worker.json';
  const repositoryAuthorityTarget = writeJson(
    projectRoot,
    repositoryAuthorityPath,
    architectureAuthoritySource(repositoryAuthority)
  );
  const policyAuthorityTarget = writeJson(
    projectRoot,
    policyAuthorityPath,
    architectureAuthoritySource(policyAuthority)
  );
  const sourceBinding = createRequirementsContractSourceBindingCapsule({
    recordId: requestId,
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    parentBindingRevisionId: null,
    resolverIdentity: 'requirements-contract-consumer-authority-scanner/v1',
    sourceArtifacts: [
      {
        sourceArtifactId: 'repo-refund-worker',
        role: 'repository_authority',
        mediaType: 'application/json',
        sourceSnapshotHash: authoritySnapshotHash(repositoryAuthority),
        orderedPosition: 0,
        immutableBlobRef: repositoryAuthorityPath,
      },
      {
        sourceArtifactId: 'policy-refund-worker',
        role: 'policy_authority',
        mediaType: 'application/json',
        sourceSnapshotHash: authoritySnapshotHash(policyAuthority),
        orderedPosition: 1,
        immutableBlobRef: policyAuthorityPath,
      },
      {
        sourceArtifactId: 'citation-refund-worker',
        role: 'citation_sidecar',
        mediaType: 'application/json',
        sourceSnapshotHash: hash('3'),
        orderedPosition: 2,
        immutableBlobRef: 'citations/refund-worker.json',
      },
    ],
    sourceSpans: [],
    evidenceClaimBindings: [],
  });
  const semanticPath = `authoring/semantic-revisions/${semanticIr.semanticRevisionId}/semantic-ir.json`;
  const bindingPath = `authoring/source-bindings/${sourceBinding.bindingRevisionId}/source-binding.json`;
  const executionPath =
    overrides.executionPath ??
    `authoring/staging/${activeAttemptId}/cp06/execution-manifest.json`;
  const buildPath = `authoring/staging/${activeAttemptId}/contract-build-manifest.json`;
  writeJson(recordRoot, semanticPath, semanticIr);
  writeJson(recordRoot, bindingPath, sourceBinding);
  const executionManifest = {
    schemaVersion: 'requirements-contract-execution-manifest/v1',
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    constraints: semanticIr.semanticPayload.executionConstraints,
  };
  writeJson(recordRoot, executionPath, executionManifest);
  const executionEntry = {
    role: 'execution_manifest' as const,
    schemaVersion: 'requirements-contract-execution-manifest/v1',
    artifactId: 'execution-manifest',
    recordRelativePath: executionPath,
    artifactHash: sha256Stable(executionManifest),
  };
  const checkpointRefs = new Map<
    number,
    { checkpointId: string; checkpointOrdinal: number; path: string; hash: string }
  >();
  let previousCheckpointManifestRef = {
    checkpointId: 'cp05',
    checkpointOrdinal: 5,
    path: `authoring/staging/${manifestAttemptId}/manifests/5-cp05.json`,
    hash: hash('5'),
  };
  const profileIds: Record<number, string> = {
    6: 'requirements-contract-cp06-execution-projection/v1',
    7: 'requirements-contract-cp07-view-diagram-projection/v1',
    8: 'requirements-contract-cp08-reconciliation-renderability/v1',
  };
  for (const ordinal of [6, 7, 8]) {
    const checkpointId = `cp${String(ordinal).padStart(2, '0')}`;
    const checkpoint = createRequirementsContractCheckpointManifest({
      authoringRequestId: requestId,
      authoringAttemptId: manifestAttemptId,
      checkpointId,
      checkpointOrdinal: ordinal,
      stage: checkpointId,
      status: ordinal === 6 ? (overrides.executionCheckpointStatus ?? 'passed') : 'passed',
      inputManifestHash: hash('3'),
      previousCheckpointManifestRef,
      latestValidPredecessorCheckpoint: previousCheckpointManifestRef.checkpointId,
      compilerIdentity:
        ordinal === 6 && overrides.executionCheckpointCompilerIdentity
          ? overrides.executionCheckpointCompilerIdentity
          : profileIds[ordinal],
      artifactEntries:
        ordinal === (overrides.executionCheckpointOrdinal ?? 6) ? [executionEntry] : [],
      decisionReceiptRefs: [],
      baseAuthorityRef: null,
    });
    const checkpointRef = {
      checkpointId,
      checkpointOrdinal: ordinal,
      path: `authoring/staging/${manifestAttemptId}/manifests/${ordinal}-${checkpointId}.json`,
      hash: checkpoint.checkpointManifestHash,
    };
    writeJson(recordRoot, checkpointRef.path, checkpoint);
    checkpointRefs.set(ordinal, checkpointRef);
    previousCheckpointManifestRef = checkpointRef;
  }
  const terminalCheckpointManifestRef = checkpointRefs.get(8)!;
  const directExecutionEntryMode = overrides.directExecutionEntry ?? 'matching';
  const directExecutionEntry =
    directExecutionEntryMode === 'absent'
      ? []
      : directExecutionEntryMode === 'matching'
        ? [executionEntry]
        : [
            {
              ...executionEntry,
              recordRelativePath: `authoring/staging/${manifestAttemptId}/direct-execution-manifest.json`,
            },
          ];
  if (directExecutionEntryMode === 'conflicting') {
    writeJson(
      recordRoot,
      `authoring/staging/${manifestAttemptId}/direct-execution-manifest.json`,
      executionManifest
    );
  }
  const buildManifest = createRequirementsContractBuildManifest({
    authoringRequestId: overrides.buildRequestId ?? requestId,
    authoringAttemptId: manifestAttemptId,
    inputManifestHash: hash('3'),
    terminalCheckpointManifestRef,
    semanticAuthorityRef: {
      semanticRevisionId: semanticIr.semanticRevisionId,
      path: semanticPath,
      hash: semanticIr.scopeSemanticHash,
    },
    bindingAuthorityRef: {
      bindingRevisionId: sourceBinding.bindingRevisionId,
      path: bindingPath,
      hash: sourceBinding.sourceBindingHash,
    },
    artifactEntries: directExecutionEntry,
    decisionReceiptRefs: [],
    auditPacketRef: {
      artifactId: 'judge-audit-packet',
      path: `authoring/staging/${manifestAttemptId}/judge-audit-packet.json`,
      hash: hash('6'),
    },
    projectionReportRefs: [],
  });
  writeJson(recordRoot, buildPath, buildManifest);
  const activeAuthority = {
    activeSemanticRevisionId: semanticIr.semanticRevisionId,
    activeSemanticIrPath: semanticPath,
    activeScopeSemanticHash: semanticIr.scopeSemanticHash,
    activeBindingRevisionId: sourceBinding.bindingRevisionId,
    activeSourceBindingPath: bindingPath,
    activeSourceBindingHash: sourceBinding.sourceBindingHash,
    activeAuthoringAttemptId: activeAttemptId,
    activeBuildManifestPath: buildPath,
    activeBuildManifestHash: buildManifest.buildManifestHash,
  };
  const effectivePass = compileRequirementsEffectivePassReceiptV2({
    activeAuthority,
    aggregate: {
      schemaVersion: 'requirements-contract-requirements-audit-aggregate/v2',
      semanticRevisionId: semanticIr.semanticRevisionId,
      scopeSemanticHash: semanticIr.scopeSemanticHash,
      sourceBindingHash: sourceBinding.sourceBindingHash,
      buildManifestHash: buildManifest.buildManifestHash,
      providerSelectionHash: hash('7'),
      judgeRequestHash: hash('8'),
      judgeResponseHash: hash('9'),
      requirementsAuditAggregateHash: hash('a'),
      validatedDimensionIds: ['authority'],
      reviewedArtifactRefs: ['judge-audit-packet'],
      reviewedMustRefs: ['MUST-ARCH-001'],
      findings: [],
      issueCodes: [],
      decision: 'pass',
    },
  });
  writeJson(recordRoot, 'quality/requirements-effective-pass-receipt.json', effectivePass);
  const exactConfirmationText = [
    'Confirm the Requirements scope above for the next stage',
    `requestId=${requestId}`,
    `semanticRevisionId=${semanticIr.semanticRevisionId}`,
    `scopeSemanticHash=${semanticIr.scopeSemanticHash}`,
    `bindingRevisionId=${sourceBinding.bindingRevisionId}`,
    `requirementsEffectivePassHash=${effectivePass.requirementsEffectivePassHash}`,
  ].join('\n');
  const requirementsMarkdownPath = 'requirements/confirmed.md';
  const requirementsHtmlPath = 'requirements/confirmed.html';
  const requirementsMarkdownTarget = writeText(
    projectRoot,
    requirementsMarkdownPath,
    `# Requirements Contract\n\n## Confirmation\n\n\`\`\`text\n${exactConfirmationText}\n\`\`\`\n`
  );
  const requirementsHtmlTarget = writeText(
    projectRoot,
    requirementsHtmlPath,
    `<!doctype html><title>Requirements confirmation</title><pre>${exactConfirmationText}</pre>\n`
  );
  const promotionPath = 'confirmation/confirmation-promotion-receipt.json';
  const promotionTarget = writeJson(recordRoot, promotionPath, {
    schemaVersion: 'requirements-contract-confirmation-promotion-receipt/v1',
    requestId,
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    bindingRevisionId: sourceBinding.bindingRevisionId,
    sourceBindingHash: sourceBinding.sourceBindingHash,
    buildManifestHash: buildManifest.buildManifestHash,
    requirementsEffectivePassHash: effectivePass.requirementsEffectivePassHash,
    exactConfirmationText,
    artifacts: [
      {
        role: 'final_markdown',
        targetPath: requirementsMarkdownPath,
        artifactBytesHash: artifactBytesHash({
          role: 'final_markdown',
          mediaType: 'text/markdown',
          bytes: readFileSync(requirementsMarkdownTarget),
        }),
      },
      {
        role: 'confirmation_html',
        targetPath: requirementsHtmlPath,
        artifactBytesHash: artifactBytesHash({
          role: 'confirmation_html',
          mediaType: 'text/html',
          bytes: readFileSync(requirementsHtmlTarget),
        }),
      },
    ],
  });
  const promotionArtifactBytesHash = artifactBytesHash({
    role: 'promotion_receipt',
    mediaType: 'application/json',
    bytes: readFileSync(promotionTarget),
  });
  const confirmationPath = 'confirmation/confirmation-event.json';
  const confirmationTarget = writeJson(recordRoot, confirmationPath, {
    schemaVersion: 'requirements-contract-confirmation-event/v1',
    requestId,
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    bindingRevisionId: sourceBinding.bindingRevisionId,
    requirementsEffectivePassRef: {
      path: 'quality/requirements-effective-pass-receipt.json',
      hash: effectivePass.requirementsEffectivePassHash,
    },
    promotionEvidenceRef: {
      path: promotionPath,
      artifactBytesHash: promotionArtifactBytesHash,
    },
    exactConfirmationText,
  });
  const recordPath = writeJson(recordRoot, 'record/requirement-record.json', {
    schemaVersion: 'requirements-contract-record/v1',
    recordId: requestId,
    lifecycle: 'user_confirmed',
    confirmedScopeSemanticHash: semanticIr.scopeSemanticHash,
    activeAuthority,
    currentPromotionEvidence: {
      path: promotionPath,
      artifactBytesHash: promotionArtifactBytesHash,
    },
    confirmationEventRef: {
      path: confirmationPath,
      artifactBytesHash: artifactBytesHash({
        role: 'requirements_confirmation_event',
        mediaType: 'application/json',
        bytes: readFileSync(confirmationTarget),
      }),
    },
  });
  return {
    requestId,
    recordRoot,
    recordPath,
    semanticPath,
    executionPath,
    confirmationPath,
    requirementsMarkdownTarget,
    repositoryAuthority,
    repositoryAuthorityTarget,
    policyAuthority,
    policyAuthorityTarget,
  };
}

function context(root: string, action: string, args: string[]) {
  return { cwd: root, args: {}, rawArgv: [action, ...args, '--json'], json: true };
}

describe('Main Agent architecture confirmation candidate', () => {
  it('resolves the execution manifest through the committed checkpoint lineage', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-checkpoint-lineage-'));
    try {
      const input = fixture(root, { directExecutionEntry: 'absent' });

      expect(
        runPrepareArchitectureConfirmation(
          context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
        )
      ).toMatchObject({ status: 'user_confirmable', exitCode: 0 });
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it.each([7, 8] as const)(
    'rejects an execution manifest assigned to cp0%s instead of cp06',
    (executionCheckpointOrdinal) => {
      const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-checkpoint-stage-'));
      try {
        const input = fixture(root, {
          directExecutionEntry: 'absent',
          executionCheckpointOrdinal,
        });
        const result = runPrepareArchitectureConfirmation(
          context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
        ) as Record<string, any>;

        expect(result.exitCode).toBe(2);
        expect(result.result.issueCodes).toEqual(['architecture_confirmation_integrity_invalid']);
      } finally {
        rmSync(root, { force: true, recursive: true });
      }
    }
  );

  it.each(['pending', 'blocked'] as const)(
    'rejects a %s cp06 execution projection',
    (executionCheckpointStatus) => {
      const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-checkpoint-status-'));
      try {
        const input = fixture(root, {
          directExecutionEntry: 'absent',
          executionCheckpointStatus,
        });
        const result = runPrepareArchitectureConfirmation(
          context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
        ) as Record<string, any>;

        expect(result.exitCode).toBe(2);
        expect(result.result.issueCodes).toEqual(['architecture_confirmation_integrity_invalid']);
      } finally {
        rmSync(root, { force: true, recursive: true });
      }
    }
  );

  it.each([
    {
      name: 'compiler profile',
      overrides: { executionCheckpointCompilerIdentity: 'requirements-contract-cp06-other/v1' },
    },
    {
      name: 'artifact path',
      overrides: {
        executionPath: 'authoring/staging/ATTEMPT-ARCH-001/execution-manifest.json',
      },
    },
  ])('rejects a cp06 execution projection with a noncanonical $name', ({ overrides }) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-checkpoint-identity-'));
    try {
      const input = fixture(root, { directExecutionEntry: 'absent', ...overrides });
      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(result.exitCode).toBe(2);
      expect(result.result.issueCodes).toEqual(['architecture_confirmation_integrity_invalid']);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('rejects a direct execution manifest entry that conflicts with cp06 provenance', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-checkpoint-conflict-'));
    try {
      const input = fixture(root, { directExecutionEntry: 'conflicting' });
      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(result.exitCode).toBe(2);
      expect(result.result.issueCodes).toEqual(['architecture_confirmation_integrity_invalid']);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('derives the only candidate from the confirmed Requirements authority and accepts exact text', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-'));
    try {
      const input = fixture(root);
      const recordBytes = readFileSync(input.recordPath);
      const semanticBytes = readFileSync(
        path.join(input.recordRoot, ...input.semanticPath.split('/'))
      );
      const prepared = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(prepared).toMatchObject({
        status: 'user_confirmable',
        exitCode: 0,
        result: {
          schemaVersion: 'architecture-confirmation-candidate-result/v1',
          status: 'user_confirmable',
          requestId: input.requestId,
          architectureConfirmationCandidateHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          exactConfirmationText: expect.stringContaining('architectureConfirmationCandidateHash='),
        },
      });
      const candidatePath = path.join(root, ...prepared.result.candidateRef.path.split('/'));
      const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
      expect(prepared.result.pageRef.path).toContain(
        prepared.result.pageRef.artifactBytesHash.slice('sha256:'.length)
      );
      expect(candidate).toMatchObject({
        schemaVersion: 'ArchitectureConfirmationCandidate/v1',
        requirementsLineage: {
          semanticRevisionId: expect.any(String),
          scopeSemanticHash: expect.any(String),
          technicalExecutionClosure: 'pass',
        },
        logicalScope: { targetPaths: ['src/refund-worker.ts'] },
        toolchain: {
          commands: [
            {
              commandId: 'CMD-refund-worker-test',
              invocation: 'npm test -- refund-worker.test.ts',
            },
          ],
        },
      });
      expect(candidate.ownership[0].basisRefs).toContain('policy-refund-worker');
      expect(candidate.isolation.basisRefs).toContain('policy-refund-worker');
      expect(
        candidate.pinnedPremises.map((premise: Record<string, string>) => premise.premiseId)
      ).toEqual(['policy-refund-worker', 'repo-refund-worker']);
      const schema = JSON.parse(
        readFileSync(
          path.join(
            process.cwd(),
            'packages/bmad-speckit/src/main-agent/source-authority/schemas/main-agent-architecture-confirmation-candidate.schema.json'
          ),
          'utf8'
        )
      );
      expect(new Ajv2020({ allErrors: true, strict: false }).compile(schema)(candidate)).toBe(true);
      const pagePath = path.join(root, ...prepared.result.pageRef.path.split('/'));
      const html = readFileSync(pagePath, 'utf8');
      for (const expected of [
        input.requestId,
        candidate.requirementsLineage.recordId,
        candidate.requirementsLineage.semanticRevisionId,
        candidate.requirementsLineage.scopeSemanticHash,
        candidate.requirementsLineage.executionConstraintRegistryHash,
        'pass',
        'policy-refund-worker',
        'repo-refund-worker',
        'policy_authority',
        'repository_authority',
        'application/json',
        'src/refund-worker.ts',
        '.git/**',
        'requirements_backed_main_agent',
        'PATH-refund-worker',
        'CMD-refund-worker-test',
        'npm test -- refund-worker.test.ts',
        'ART-refund-worker-output',
        'dist/refund-worker.js',
        'EVDREQ-refund-worker-red-green',
        'refund-worker RED/GREEN evidence',
        'consumer_worktree',
        'consumer:logical-targets',
        'governance:pinned-policy',
        'architecture:target-scope',
        'architecture:toolchain',
        'architecture:governance',
        'architecture:execution-structure',
        'ownership',
        'toolchain',
        'isolation',
        'execution_structure',
        'CTM-refund-worker-slice',
        'refund-worker vertical slice',
        candidate.architectureConfirmationCandidateHash,
      ]) {
        expect(html).toContain(expected);
      }
      expect(html).not.toContain('immutableBlobRef');
      expect(html).not.toContain('citation-refund-worker');
      const resultSchema = JSON.parse(
        readFileSync(
          path.join(
            process.cwd(),
            'packages/bmad-speckit/src/main-agent/source-authority/schemas/main-agent-architecture-confirmation-result.schema.json'
          ),
          'utf8'
        )
      );
      const validateResult = new Ajv2020({ allErrors: true, strict: false }).compile(resultSchema);
      expect(validateResult(prepared.result)).toBe(true);
      expect(
        validateResult({
          schemaVersion: 'architecture-confirmation-candidate-result/v1',
          status: 'blocked',
          requestId: input.requestId,
          requirementsLineage: prepared.result.requirementsLineage,
          issueCodes: ['unknown_architecture_confirmation_issue'],
        })
      ).toBe(false);
      expect(
        validateResult({
          ...prepared.result,
          status: 'blocked',
          issueCodes: ['requirements_confirmation_required'],
        })
      ).toBe(false);
      const ingested = runIngestArchitectureConfirmation(
        context(root, 'ingest-architecture-confirmation', [
          '--request-id',
          input.requestId,
          '--architecture-confirmation-candidate-hash',
          prepared.result.architectureConfirmationCandidateHash,
          '--exact-confirmation-text',
          prepared.result.exactConfirmationText,
        ])
      );
      expect(ingested, JSON.stringify(ingested, null, 2)).toMatchObject({
        status: 'architecture_confirmation_recorded',
        exitCode: 0,
      });
      expect(readFileSync(path.join(input.recordRoot, ...input.semanticPath.split('/')))).toEqual(
        semanticBytes
      );
      expect(readFileSync(input.recordPath)).toEqual(recordBytes);
      expect(existsSync(path.join(input.recordRoot, 'readiness'))).toBe(false);
      expect(existsSync(path.join(input.recordRoot, 'goal'))).toBe(false);
      expect(existsSync(path.join(input.recordRoot, 'partition'))).toBe(false);
      expect(existsSync(path.join(input.recordRoot, 'execution'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps source action and same-run built package CLI result and candidate identity in parity', () => {
    const build = spawnSync(
      process.execPath,
      [path.join(process.cwd(), 'packages/bmad-speckit/scripts/build-main-agent-dist.cjs')],
      { cwd: process.cwd(), encoding: 'utf8' }
    );
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);

    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-parity-'));
    try {
      const input = fixture(root);
      const sourcePrepared = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;
      const cli = spawnSync(
        process.execPath,
        [
          path.join(process.cwd(), 'packages/bmad-speckit/bin/bmad-speckit.js'),
          'main-agent',
          'prepare-architecture-confirmation',
          '--cwd',
          root,
          '--request-id',
          input.requestId,
          '--json',
        ],
        { cwd: process.cwd(), encoding: 'utf8' }
      );

      expect(cli.status, `${cli.stdout}\n${cli.stderr}`).toBe(0);
      const cliEnvelope = JSON.parse(cli.stdout) as Record<string, any>;
      const cliResult = cliEnvelope.data?.result ?? cliEnvelope.result ?? cliEnvelope;
      expect(cliResult).toEqual(sourcePrepared.result);
      const candidatePath = path.join(root, ...sourcePrepared.result.candidateRef.path.split('/'));
      const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
      expect(candidate.architectureConfirmationCandidateHash).toBe(
        sourcePrepared.result.architectureConfirmationCandidateHash
      );
      expect(cliResult.architectureConfirmationCandidateHash).toBe(
        candidate.architectureConfirmationCandidateHash
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 120_000);

  it('keeps installed consumer prepare, renderer, and ingest in parity with source authority', () => {
    const build = spawnSync(
      process.execPath,
      [path.join(process.cwd(), 'packages/bmad-speckit/scripts/build-main-agent-dist.cjs')],
      { cwd: process.cwd(), encoding: 'utf8' }
    );
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);

    const packRoot = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-pack-'));
    const consumerRoot = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-consumer-'));
    try {
      const cleanEnv = { ...process.env, npm_config_loglevel: 'error' };
      delete cleanEnv.NODE_PATH;
      delete cleanEnv.BMAD_SPECKIT_PACKAGE_ROOT;
      writeJson(consumerRoot, 'package.json', {
        name: 'architecture-candidate-consumer',
        version: '1.0.0',
        private: true,
      });
      const npm = spawnSync(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['pack', '--ignore-scripts', '--pack-destination', packRoot, '--json'],
        {
          cwd: path.join(process.cwd(), 'packages/bmad-speckit'),
          encoding: 'utf8',
          shell: process.platform === 'win32',
          env: cleanEnv,
        }
      );
      expect(npm.status, `${npm.stdout}\n${npm.stderr}`).toBe(0);
      const packed = JSON.parse(npm.stdout) as Array<{ filename: string }>;
      expect(packed[0]?.filename).toBeTruthy();
      const tgz = path.join(packRoot, packed[0].filename);
      const install = spawnSync(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['install', '--ignore-scripts', '--no-save', tgz],
        {
          cwd: consumerRoot,
          encoding: 'utf8',
          shell: process.platform === 'win32',
          env: cleanEnv,
        }
      );
      expect(install.status, `${install.stdout}\n${install.stderr}`).toBe(0);

      const input = fixture(consumerRoot);
      const cli = path.join(consumerRoot, 'node_modules', 'bmad-speckit', 'bin', 'bmad-speckit.js');
      const runInstalled = (args: string[]) =>
        spawnSync(process.execPath, [cli, ...args], {
          cwd: consumerRoot,
          encoding: 'utf8',
          env: cleanEnv,
        });
      const preparedProcess = runInstalled([
        'main-agent',
        'prepare-architecture-confirmation',
        '--request-id',
        input.requestId,
        '--json',
      ]);
      expect(preparedProcess.status, `${preparedProcess.stdout}\n${preparedProcess.stderr}`).toBe(
        0
      );
      const preparedEnvelope = JSON.parse(preparedProcess.stdout) as Record<string, any>;
      const prepared = preparedEnvelope.data?.result ?? preparedEnvelope.result ?? preparedEnvelope;
      expect(prepared.exactConfirmationText).toContain('\n');
      const candidatePath = path.join(consumerRoot, ...prepared.candidateRef.path.split('/'));
      const renderedPath = path.join(consumerRoot, 'rendered', 'architecture-confirmation.html');
      const renderer = path.join(
        consumerRoot,
        'node_modules',
        'bmad-speckit',
        '_bmad',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'render-architecture-confirmation-html.cjs'
      );
      const rendered = spawnSync(
        process.execPath,
        [
          renderer,
          '--architecture-confirmation-candidate',
          candidatePath,
          '--out',
          renderedPath,
          '--json',
        ],
        { cwd: consumerRoot, encoding: 'utf8', env: cleanEnv }
      );
      expect(rendered.status, `${rendered.stdout}\n${rendered.stderr}`).toBe(0);
      expect(readFileSync(renderedPath, 'utf8')).toContain(
        prepared.architectureConfirmationCandidateHash
      );

      const ingested = runInstalled([
        'main-agent',
        'ingest-architecture-confirmation',
        '--request-id',
        input.requestId,
        '--architecture-confirmation-candidate-hash',
        prepared.architectureConfirmationCandidateHash,
        '--exact-confirmation-text',
        prepared.exactConfirmationText,
        '--json',
      ]);
      expect(ingested.status, `${ingested.stdout}\n${ingested.stderr}`).toBe(0);
      const ingestEnvelope = JSON.parse(ingested.stdout) as Record<string, any>;
      expect(ingestEnvelope.data?.status ?? ingestEnvelope.status).toBe(
        'architecture_confirmation_recorded'
      );
    } finally {
      rmSync(packRoot, { recursive: true, force: true });
      rmSync(consumerRoot, { recursive: true, force: true });
    }
  }, 180_000);

  it('HTML-escapes every free-text technical value in the canonical page', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-escaping-'));
    try {
      const input = fixture(root, {
        technicalValues: {
          targetPath: 'src/refund<worker>&"quoted".ts',
          command: 'npm test -- "refund<worker>&quoted"',
          artifact: 'dist/refund<worker>&"quoted".js',
          executionStructure: 'refund<worker>&"quoted" vertical slice',
          evidenceRequirement: 'refund<worker>&"quoted" evidence',
          forbiddenPath: '.git/<private>&"quoted"/**',
        },
      });
      const prepared = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(prepared.exitCode, JSON.stringify(prepared, null, 2)).toBe(0);
      const html = readFileSync(
        path.join(root, ...prepared.result.pageRef.path.split('/')),
        'utf8'
      );
      expect(html).toContain('src/refund&lt;worker&gt;&amp;&quot;quoted&quot;.ts');
      expect(html).toContain('.git/&lt;private&gt;&amp;&quot;quoted&quot;/**');
      expect(html).toContain('npm test -- &quot;refund&lt;worker&gt;&amp;quoted&quot;');
      expect(html).toContain('dist/refund&lt;worker&gt;&amp;&quot;quoted&quot;.js');
      expect(html).toContain('refund&lt;worker&gt;&amp;&quot;quoted&quot; evidence');
      expect(html).toContain('refund&lt;worker&gt;&amp;&quot;quoted&quot; vertical slice');
      expect(html).not.toContain('refund<worker>');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['--target-paths', '["injected.ts"]'],
    ['--consumer-impact-scan', '[]'],
    ['--governance-impact-scan', '[]'],
    ['--full-architecture-trigger-matrix', '[]'],
    ['--candidate-hash', hash('a')],
    ['--result', '{}'],
  ])('rejects caller-supplied derived architecture field %s', (flag, value) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-'));
    try {
      const input = fixture(root);
      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', [
          '--request-id',
          input.requestId,
          flag,
          value,
        ])
      ) as Record<string, any>;
      expect(result.exitCode).toBe(2);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('caller_derived_input_forbidden'),
        })
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('short-circuits prepare help without creating a requirement record root', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-'));
    try {
      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--help'])
      ) as Record<string, any>;

      expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(0);
      expect(existsSync(path.join(root, '_bmad-output'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects execution manifest bytes that no longer match the build manifest', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-'));
    try {
      const input = fixture(root);
      const executionPath = path.join(input.recordRoot, ...input.executionPath.split('/'));
      const executionManifest = JSON.parse(readFileSync(executionPath, 'utf8'));
      writeFileSync(
        executionPath,
        `${JSON.stringify({ ...executionManifest, tampered: true }, null, 2)}\n`,
        'utf8'
      );

      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(2);
      expect(result.result.issueCodes).toEqual(['architecture_confirmation_integrity_invalid']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(['requirementsEffectivePassRef', 'promotionEvidenceRef', 'exactConfirmationText'])(
    'rejects an incomplete controlled Requirements confirmation event: %s',
    (field) => {
      const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-'));
      try {
        const input = fixture(root);
        const confirmationTarget = path.join(
          input.recordRoot,
          ...input.confirmationPath.split('/')
        );
        const event = JSON.parse(readFileSync(confirmationTarget, 'utf8'));
        delete event[field];
        writeFileSync(confirmationTarget, `${JSON.stringify(event, null, 2)}\n`, 'utf8');
        const record = JSON.parse(readFileSync(input.recordPath, 'utf8'));
        record.confirmationEventRef.artifactBytesHash = artifactBytesHash({
          role: 'requirements_confirmation_event',
          mediaType: 'application/json',
          bytes: readFileSync(confirmationTarget),
        });
        writeFileSync(input.recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

        const result = runPrepareArchitectureConfirmation(
          context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
        ) as Record<string, any>;

        expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(1);
        expect(result.result.issueCodes).toEqual(['requirements_confirmation_event_stale']);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );

  it('rejects a malformed active Requirements authority tuple before consuming its paths', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-'));
    try {
      const input = fixture(root);
      const record = JSON.parse(readFileSync(input.recordPath, 'utf8'));
      record.activeAuthority.unexpectedField = 'forbidden';
      writeFileSync(input.recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(1);
      expect(result.result.issueCodes).toEqual([
        'requirements_successor_required:active_authority_tuple',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('ignores Requirements confirmation page drift after machine confirmation', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-'));
    try {
      const input = fixture(root);
      const before = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;
      writeFileSync(input.requirementsMarkdownTarget, '# tampered\n', 'utf8');

      const after = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(after.exitCode, JSON.stringify(after, null, 2)).toBe(0);
      expect(after.result.architectureConfirmationCandidateHash).toBe(
        before.result.architectureConfirmationCandidateHash
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    { buildRequestId: 'REQ-ARCH-OTHER', buildAttemptId: undefined },
    { buildRequestId: undefined, buildAttemptId: 'ATTEMPT-ARCH-OTHER' },
  ])('rejects a build manifest outside the active authoring lineage', (overrides) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-'));
    try {
      const input = fixture(root, overrides);
      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(1);
      expect(result.result.issueCodes).toEqual(['requirements_successor_required:build_manifest']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['CMD', 'architecture_successor_required:toolchain'],
    ['ART', 'architecture_successor_required:artifacts'],
    ['CTM', 'architecture_successor_required:execution_structure'],
    ['EVDREQ', 'architecture_successor_required:evidence_requirements'],
  ] as const)('blocks when %s cannot uniquely close the architecture candidate', (kind, issue) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-'));
    try {
      const input = fixture(root);
      const architectureContext = resolveArchitectureConfirmationContext({
        projectRoot: root,
        requestId: input.requestId,
      });
      architectureContext.semanticIr.semanticPayload.executionConstraints =
        architectureContext.semanticIr.semanticPayload.executionConstraints.filter(
          (constraint) => constraint.kind !== kind
        );
      expect(() => deriveArchitectureConfirmationCandidate(architectureContext)).toThrow(issue);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when logical target and forbidden scopes overlap', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-'));
    try {
      const input = fixture(root, {
        policyAuthority: {
          forbiddenScope: { paths: ['src/refund-worker.ts'] },
        },
      });
      const architectureContext = resolveArchitectureConfirmationContext({
        projectRoot: root,
        requestId: input.requestId,
      });

      expect(() => deriveArchitectureConfirmationCandidate(architectureContext)).toThrow(
        'architecture_successor_required:forbidden_scope'
      );
      const cli = spawnSync(
        process.execPath,
        [
          path.join(process.cwd(), 'packages/bmad-speckit/bin/bmad-speckit.js'),
          'main-agent',
          'prepare-architecture-confirmation',
          '--request-id',
          input.requestId,
          '--json',
        ],
        { cwd: root, encoding: 'utf8' }
      );
      expect(cli.status, `${cli.stdout}\n${cli.stderr}`).toBe(1);
      const envelope = JSON.parse(cli.stdout) as Record<string, any>;
      const result = envelope.data?.result ?? envelope.result ?? envelope;
      expect(result.issueCodes).toEqual(['architecture_successor_required:forbidden_scope']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when a forbidden scope is nested under a broader logical target', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-'));
    try {
      const input = fixture(root, {
        technicalValues: { targetPath: 'src/**' },
        policyAuthority: {
          forbiddenScope: { paths: ['src/secrets/**'] },
        },
      });
      const architectureContext = resolveArchitectureConfirmationContext({
        projectRoot: root,
        requestId: input.requestId,
      });

      expect(() => deriveArchitectureConfirmationCandidate(architectureContext)).toThrow(
        'architecture_successor_required:forbidden_scope'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks a non-canonical logical target before authority scope comparison', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-path-'));
    try {
      const input = fixture(root, {
        technicalValues: { targetPath: 'src/../.git/config' },
        repositoryAuthority: { allowedTargetPaths: ['src/**'] },
        policyAuthority: {
          forbiddenScope: { paths: ['.git/**'] },
          ownershipRules: [
            { targetPath: 'src/**', owner: 'requirements_backed_main_agent' },
          ],
        },
      });
      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(1);
      expect(result.result.issueCodes).toEqual([
        'architecture_successor_required:logical_target_paths',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks a non-canonical typed forbidden path', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-path-'));
    try {
      const input = fixture(root, {
        policyAuthority: { forbiddenScope: { paths: ['.git/../src/**'] } },
      });
      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(1);
      expect(result.result.issueCodes).toEqual([
        'architecture_successor_required:forbidden_scope',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['repo', 'architecture_successor_required:repository_premise'],
    ['policy', 'architecture_successor_required:policy_premise'],
  ] as const)('blocks when the pinned %s authority premise is missing', (role, issue) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-'));
    try {
      const input = fixture(root);
      const architectureContext = resolveArchitectureConfirmationContext({
        projectRoot: root,
        requestId: input.requestId,
      });
      architectureContext.sourceBinding.sourceArtifacts =
        architectureContext.sourceBinding.sourceArtifacts.filter(
          (artifact) => !artifact.role.includes(role)
        );
      expect(() => deriveArchitectureConfirmationCandidate(architectureContext)).toThrow(issue);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not project a general STOP constraint into forbidden scope or isolation', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-stop-'));
    try {
      const input = fixture(root, {
        technicalValues: { forbiddenPath: 'Stop on schema drift.' },
        policyAuthority: { forbiddenScope: { paths: ['.git/**'] } },
      });
      const architectureContext = resolveArchitectureConfirmationContext({
        projectRoot: root,
        requestId: input.requestId,
      });
      const candidate = deriveArchitectureConfirmationCandidate(architectureContext) as Record<
        string,
        any
      >;

      expect(candidate.logicalScope.forbiddenPaths).toEqual(['.git/**']);
      expect(candidate.isolation.forbiddenPaths).toEqual(['.git/**']);
      expect(candidate.isolation.basisRefs).not.toContain('STOP-refund-worker-forbidden');
      expect(JSON.stringify(candidate)).not.toContain('Stop on schema drift.');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['repository', 'allowedTargetPaths', 'architecture_successor_required:target_authority'],
    ['repository', 'consumerImpactRules', 'architecture_successor_required:consumer_impact'],
    ['repository', 'triggerRules', 'architecture_successor_required:trigger_rules'],
    ['policy', 'forbiddenScope', 'architecture_successor_required:forbidden_scope'],
    ['policy', 'ownershipRules', 'architecture_successor_required:ownership'],
    ['policy', 'isolationSelection', 'architecture_successor_required:isolation'],
    ['policy', 'governanceImpactRules', 'architecture_successor_required:governance_impact'],
    ['policy', 'triggerRules', 'architecture_successor_required:trigger_rules'],
  ] as const)(
    'blocks when %s authority omits required field %s',
    (authorityKind, field, issueCode) => {
      const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-authority-'));
      try {
        const authority = { [field]: undefined };
        const input = fixture(root, {
          ...(authorityKind === 'repository'
            ? { repositoryAuthority: authority }
            : { policyAuthority: authority }),
        });
        const result = runPrepareArchitectureConfirmation(
          context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
        ) as Record<string, any>;

        expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(1);
        expect(result.result.issueCodes).toEqual([issueCode]);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );

  it.each([
    [
      { ownershipRules: [{ targetPath: 'src/refund-worker.ts', owner: '   ' }] },
      'architecture_successor_required:ownership',
    ],
    [{ isolationSelection: '   ' }, 'architecture_successor_required:isolation'],
  ] as const)('blocks blank typed policy authority values', (policyAuthority, issueCode) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-blank-authority-'));
    try {
      const input = fixture(root, { policyAuthority });
      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(1);
      expect(result.result.issueCodes).toEqual([issueCode]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['repository', { allowedTargetPaths: [] }, 'architecture_successor_required:target_authority'],
    ['repository', { consumerImpactRules: [] }, 'architecture_successor_required:consumer_impact'],
    ['repository', { triggerRules: [] }, 'architecture_successor_required:trigger_rules'],
    [
      'policy',
      { forbiddenScope: { paths: [] } },
      'architecture_successor_required:forbidden_scope',
    ],
    ['policy', { ownershipRules: [] }, 'architecture_successor_required:ownership'],
    ['policy', { governanceImpactRules: [] }, 'architecture_successor_required:governance_impact'],
    ['policy', { triggerRules: [] }, 'architecture_successor_required:trigger_rules'],
  ] as const)(
    'blocks when required %s authority rule collection is empty',
    (authorityKind, authority, issueCode) => {
      const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-empty-authority-'));
      try {
        const input = fixture(root, {
          ...(authorityKind === 'repository'
            ? { repositoryAuthority: authority }
            : { policyAuthority: authority }),
        });
        const result = runPrepareArchitectureConfirmation(
          context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
        ) as Record<string, any>;

        expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(1);
        expect(result.result.issueCodes).toEqual([issueCode]);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );

  it('rejects an authorityId that does not match its source artifact identity', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-identity-'));
    try {
      const input = fixture(root, {
        repositoryAuthority: { authorityId: 'different-repository-authority' },
      });
      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(2);
      expect(result.result.issueCodes).toEqual(['architecture_confirmation_integrity_invalid']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when repository authority does not cover every logical target', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-coverage-'));
    try {
      const input = fixture(root, {
        repositoryAuthority: { allowedTargetPaths: ['src/other-worker.ts'] },
      });
      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(1);
      expect(result.result.issueCodes).toEqual([
        'architecture_successor_required:target_authority',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('projects authority body mutations into their corresponding typed fields and decisions', () => {
    const currentRoot = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-current-'));
    const successorRoot = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-successor-'));
    try {
      const currentInput = fixture(currentRoot);
      const successorInput = fixture(successorRoot, {
        repositoryAuthority: {
          consumerImpactRules: [
            {
              impactId: 'consumer:logical-targets',
              whenConstraintKinds: ['CMD'],
              whenConstraintIds: ['CMD-refund-worker-test'],
            },
          ],
          triggerRules: [
            {
              triggerId: 'architecture:target-scope',
              whenConstraintKinds: ['STOP'],
              whenConstraintIds: ['STOP-refund-worker-forbidden'],
            },
            {
              triggerId: 'architecture:toolchain',
              whenConstraintKinds: ['CMD', 'ART', 'EVDREQ'],
              whenConstraintIds: [],
            },
          ],
        },
        policyAuthority: {
          ownershipRules: [{ targetPath: 'src/refund-worker.ts', owner: 'refund_platform_owner' }],
          isolationSelection: 'isolated_consumer_worktree',
          governanceImpactRules: [
            {
              impactId: 'governance:pinned-policy',
              whenConstraintKinds: ['ART'],
              whenConstraintIds: ['ART-refund-worker-output'],
            },
          ],
          triggerRules: [
            {
              triggerId: 'architecture:governance',
              whenConstraintKinds: ['PATH'],
              whenConstraintIds: ['PATH-refund-worker'],
            },
            {
              triggerId: 'architecture:execution-structure',
              whenConstraintKinds: ['CTM'],
              whenConstraintIds: [],
            },
          ],
        },
      });
      const current = deriveArchitectureConfirmationCandidate(
        resolveArchitectureConfirmationContext({
          projectRoot: currentRoot,
          requestId: currentInput.requestId,
        })
      ) as Record<string, any>;
      const successor = deriveArchitectureConfirmationCandidate(
        resolveArchitectureConfirmationContext({
          projectRoot: successorRoot,
          requestId: successorInput.requestId,
        })
      ) as Record<string, any>;

      expect(successor.ownership[0].owner).toBe('refund_platform_owner');
      expect(successor.isolation.mode).toBe('isolated_consumer_worktree');
      expect(successor.consumerImpact[0]).toMatchObject({
        status: 'applicable',
        basisRefs: expect.arrayContaining(['repo-refund-worker', 'CMD-refund-worker-test']),
      });
      expect(successor.consumerImpact[0].basisRefs).not.toContain('PATH-refund-worker');
      expect(successor.governanceImpact[0]).toMatchObject({
        status: 'applicable',
        basisRefs: expect.arrayContaining(['policy-refund-worker', 'ART-refund-worker-output']),
      });
      expect(
        successor.triggerMatrix.find(
          (entry: Record<string, unknown>) => entry.triggerId === 'architecture:target-scope'
        ).triggered
      ).toBe(true);
      expect(
        successor.triggerMatrix.find(
          (entry: Record<string, unknown>) => entry.triggerId === 'architecture:target-scope'
        ).basisRefs
      ).toEqual(
        expect.arrayContaining(['STOP-refund-worker-forbidden', 'repo-refund-worker'])
      );
      expect(
        successor.triggerMatrix.find(
          (entry: Record<string, unknown>) => entry.triggerId === 'architecture:target-scope'
        ).basisRefs
      ).toHaveLength(2);
      expect(
        successor.triggerMatrix.find(
          (entry: Record<string, unknown>) => entry.triggerId === 'architecture:governance'
        ).basisRefs
      ).toEqual(expect.arrayContaining(['PATH-refund-worker', 'policy-refund-worker']));
      expect(
        successor.triggerMatrix.find(
          (entry: Record<string, unknown>) => entry.triggerId === 'architecture:governance'
        ).basisRefs
      ).toHaveLength(2);
      expect(
        successor.architectureDecisions.find(
          (entry: Record<string, unknown>) => entry.decisionType === 'ownership'
        ).selection
      ).toContain('refund_platform_owner');
      expect(
        successor.architectureDecisions.find(
          (entry: Record<string, unknown>) => entry.decisionType === 'isolation'
        ).selection
      ).toBe('isolated_consumer_worktree');
      expect(successor.architectureConfirmationCandidateHash).not.toBe(
        current.architectureConfirmationCandidateHash
      );
      const schema = JSON.parse(
        readFileSync(
          path.join(
            process.cwd(),
            'packages/bmad-speckit/src/main-agent/source-authority/schemas/main-agent-architecture-confirmation-candidate.schema.json'
          ),
          'utf8'
        )
      );
      const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
      expect(validate(successor), JSON.stringify(validate.errors, null, 2)).toBe(true);
    } finally {
      rmSync(currentRoot, { recursive: true, force: true });
      rmSync(successorRoot, { recursive: true, force: true });
    }
  });

  it('blocks an unknown constraint ID in an authority predicate', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-predicate-ref-'));
    try {
      const input = fixture(root, {
        repositoryAuthority: {
          consumerImpactRules: [
            {
              impactId: 'consumer:logical-targets',
              whenConstraintKinds: ['CMD'],
              whenConstraintIds: ['CMD-unknown'],
            },
          ],
        },
      });
      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(1);
      expect(result.result.issueCodes).toEqual(['architecture_successor_required:consumer_impact']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks the same trigger ID with different repository and policy predicates', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-trigger-conflict-'));
    try {
      const input = fixture(root, {
        repositoryAuthority: {
          triggerRules: [
            {
              triggerId: 'architecture:shared-trigger',
              whenConstraintKinds: ['PATH'],
              whenConstraintIds: [],
            },
          ],
        },
        policyAuthority: {
          triggerRules: [
            {
              triggerId: 'architecture:shared-trigger',
              whenConstraintKinds: ['CMD'],
              whenConstraintIds: [],
            },
          ],
        },
      });
      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(1);
      expect(result.result.issueCodes).toEqual(['architecture_successor_required:trigger_rules']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails integrity when authority snapshot bytes no longer match the binding hash', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-snapshot-'));
    try {
      const input = fixture(root);
      writeFileSync(
        input.policyAuthorityTarget,
        jsonText(
          architectureAuthoritySource({
            ...input.policyAuthority,
            isolationSelection: 'tampered_worktree',
          })
        ),
        'utf8'
      );
      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(2);
      expect(result.result.issueCodes).toEqual(['architecture_confirmation_integrity_invalid']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['mediaType', 'text/plain', 'architecture_confirmation_authority_media_type_invalid'],
    [
      'immutableBlobRef',
      '../outside.json',
      'architecture_confirmation_authority_blob_path_invalid',
    ],
    ['immutableBlobRef', 'repo', 'architecture_confirmation_authority_file_type_invalid'],
  ] as const)('rejects an authority artifact with invalid %s', (field, value, issueCode) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-artifact-'));
    try {
      const input = fixture(root);
      const architectureContext = resolveArchitectureConfirmationContext({
        projectRoot: root,
        requestId: input.requestId,
      });
      const repositoryArtifact = architectureContext.sourceBinding.sourceArtifacts.find(
        (artifact) => artifact.role === 'repository_authority'
      );
      expect(repositoryArtifact).toBeDefined();
      repositoryArtifact![field] = value;

      expect(() => deriveArchitectureConfirmationCandidate(architectureContext)).toThrow(issueCode);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects an authority payload whose role does not match its source artifact role', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-role-'));
    try {
      const input = fixture(root, {
        repositoryAuthority: { authorityRole: 'policy_authority' },
      });
      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(2);
      expect(result.result.issueCodes).toEqual(['architecture_confirmation_integrity_invalid']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks conflicting authorities of the same kind', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-conflict-'));
    try {
      const input = fixture(root);
      const architectureContext = resolveArchitectureConfirmationContext({
        projectRoot: root,
        requestId: input.requestId,
      });
      const conflictingAuthority = {
        ...input.repositoryAuthority,
        authorityId: 'repo-refund-worker-conflict',
        consumerImpactRules: [
          {
            impactId: 'consumer:logical-targets',
            whenConstraintKinds: [],
            whenConstraintIds: ['NO-MATCH'],
          },
        ],
      };
      const relativePath = 'repo/refund-worker-conflict.json';
      writeJson(root, relativePath, architectureAuthoritySource(conflictingAuthority));
      architectureContext.sourceBinding.sourceArtifacts.push({
        sourceArtifactId: 'repo-refund-worker-conflict',
        role: 'repository_authority',
        mediaType: 'application/json',
        sourceSnapshotHash: authoritySnapshotHash(conflictingAuthority),
        orderedPosition: 3,
        immutableBlobRef: relativePath,
      });

      expect(() => deriveArchitectureConfirmationCandidate(architectureContext)).toThrow(
        'architecture_successor_required:repository_premise'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('treats set-like authority rule ordering as semantically equivalent', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-equivalent-'));
    try {
      const input = fixture(root);
      const architectureContext = resolveArchitectureConfirmationContext({
        projectRoot: root,
        requestId: input.requestId,
      });
      const equivalentAuthority = {
        ...input.repositoryAuthority,
        authorityId: 'repo-refund-worker-equivalent',
        triggerRules: [...input.repositoryAuthority.triggerRules].reverse(),
      };
      const relativePath = 'repo/refund-worker-equivalent.json';
      writeJson(root, relativePath, architectureAuthoritySource(equivalentAuthority));
      architectureContext.sourceBinding.sourceArtifacts.push({
        sourceArtifactId: equivalentAuthority.authorityId,
        role: 'repository_authority',
        mediaType: 'application/json',
        sourceSnapshotHash: authoritySnapshotHash(equivalentAuthority),
        orderedPosition: 3,
        immutableBlobRef: relativePath,
      });

      expect(() => deriveArchitectureConfirmationCandidate(architectureContext)).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('excludes citation sidecar bytes from candidate identity', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-'));
    try {
      const input = fixture(root);
      const architectureContext = resolveArchitectureConfirmationContext({
        projectRoot: root,
        requestId: input.requestId,
      });
      const current = deriveArchitectureConfirmationCandidate(architectureContext);
      const citationSidecar = architectureContext.sourceBinding.sourceArtifacts.find(
        (artifact) => artifact.role === 'citation_sidecar'
      );
      expect(citationSidecar).toBeDefined();
      citationSidecar!.sourceSnapshotHash = hash('f');

      const refreshed = deriveArchitectureConfirmationCandidate(architectureContext);

      expect(refreshed.architectureConfirmationCandidateHash).toBe(
        current.architectureConfirmationCandidateHash
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
