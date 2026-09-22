import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runIngestArchitectureConfirmation } from '../../packages/bmad-speckit/src/main-agent/actions/ingest-architecture-confirmation';
import { runPrepareArchitectureConfirmation } from '../../packages/bmad-speckit/src/main-agent/actions/prepare-architecture-confirmation';
import {
  createRequirementsContractBuildManifestV2,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest';
import { publishRequirementsContentObject } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-content-store';
import {
  artifactBytesHash,
  requirementsContractDomainHash,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains';
import { compileRequirementsEffectivePassReceiptV2 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-requirements-effective-pass-gate';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  createRequirementsContractSemanticIr,
  type RequirementsExecutionConstraint,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';
import { createRequirementsContractSourceBindingCapsule } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-binding-capsule';

const ORACLE = 'ORACLE-REFUND-ACCEPTED';
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

function authoritySnapshotHash(authority: Record<string, unknown>): string {
  return sha256Stable({
    domain: 'requirements-source-snapshot/v1',
    content: jsonText(architectureAuthoritySource(authority)),
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

function actionContext(root: string, action: string, args: string[]) {
  return {
    cwd: root,
    args: {},
    rawArgv: [action, ...args, '--json'],
    json: true,
  };
}

export interface ImplementationReadinessFixture {
  root: string;
  requestId: string;
  recordRoot: string;
  recordPath: string;
  authorityRecordPath: string;
  runtimeRecordPath: string;
  targetPath: string;
  testPath: string;
  configPath: string;
  lockPath: string;
  commandIds: string[];
  oracle: string;
  semanticRevisionId: string;
  scopeSemanticHash: string;
  sourceBindingHash: string;
  requirementsConfirmationPath: string;
  architectureCandidateHash: string;
  architectureEventPath: string;
  architectureDecisionReceiptPath: string;
  cleanup(): void;
}

export function materializeImplementationReadinessFixture(
  input: {
    duplicateCommand?: boolean;
    requestId?: string;
    root?: string;
    invocation?: string;
    invocations?: string[];
    additionalFiles?: Record<string, string>;
    additionalGoalAtoms?: number;
    targetPaths?: string[];
  } = {}
): ImplementationReadinessFixture {
  const root = input.root ?? mkdtempSync(path.join(os.tmpdir(), 'implementation-readiness-'));
  const requestId = input.requestId ?? 'REQ-READINESS-V2-001';
  const recordRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records', requestId);
  mkdirSync(recordRoot, { recursive: true });
  const defaultInvocation = input.invocation ?? 'node --test tests/refund-worker.test.cjs';
  const invocations = input.invocations ?? [
    defaultInvocation,
    ...(input.duplicateCommand ? [defaultInvocation] : []),
  ];
  const commandIds = invocations.map((_invocation, index) =>
    index === 0
      ? 'CMD-readiness-refund'
      : input.duplicateCommand && !input.invocations
        ? 'CMD-readiness-refund-alias'
        : `CMD-readiness-refund-${index + 1}`
  );
  const goalAtomIds = Array.from(
    { length: 1 + (input.additionalGoalAtoms ?? 0) },
    (_value, index) => `MUST-READINESS-001-A${index + 1}`
  );
  const targetPaths = input.targetPaths ?? ['src/refund-worker.cjs'];
  if (targetPaths.length === 0) throw new Error('fixture_target_paths_missing');
  const constraint = (
    constraintId: string,
    kind: RequirementsExecutionConstraint['kind'],
    canonicalValue: string,
    applicableAtomRefs: string[] = goalAtomIds
  ): RequirementsExecutionConstraint => ({
    constraintId,
    kind,
    canonicalValue,
    applicableMustRefs: ['MUST-READINESS-001'],
    applicableAtomRefs,
    premiseRefs: ['MUST-READINESS-001'],
    derivationReceiptRefs: [],
    disposition: 'proven',
  });
  const executionConstraints: RequirementsExecutionConstraint[] = [
    ...targetPaths.map((targetPath, index) =>
      constraint(
        index === 0 ? 'PATH-refund-worker' : `PATH-refund-worker-${index + 1}`,
        'PATH',
        targetPath,
        [goalAtomIds[index] ?? goalAtomIds[goalAtomIds.length - 1]]
      )
    ),
    ...commandIds.map((commandId, index) => constraint(commandId, 'CMD', invocations[index])),
    constraint('ART-refund-worker', 'ART', 'dist/refund-worker.cjs'),
    ...goalAtomIds.map((atomId, index) =>
      constraint(
        `CTM-refund-worker-${index + 1}`,
        'CTM',
        `refund worker vertical slice ${index + 1}`,
        [atomId]
      )
    ),
    constraint('EVDREQ-refund-worker', 'EVDREQ', 'same-test RED/GREEN evidence'),
    constraint('STOP-refund-worker', 'STOP', '.git/**'),
  ];
  const semanticIr = createRequirementsContractSemanticIr({
    recordId: requestId,
    requestId,
    parentSemanticRevisionId: null,
    compilerVersion: 'requirements-contract-cp02-compiler/v1',
    semantics: {
      requirements: [
        {
          id: 'MUST-READINESS-001',
          text: 'Implement the refund worker.',
          oracle: ORACLE,
        },
      ],
      atoms: goalAtomIds.map((atomId, index) => ({
        id: atomId,
        requirementRef: 'MUST-READINESS-001',
        action:
          index === 0
            ? 'Return the accepted refund state.'
            : `Verify accepted refund behavior ${index + 1}.`,
        oracle: ORACLE,
      })),
      decisions: [],
    },
    evidenceClaims: [],
    specSpanRegistry: [],
    executionConstraints,
    semanticProvenance: { 'MUST-READINESS-001': 'MUST-READINESS-001' },
  });
  const repositoryAuthority = {
    schemaVersion: 'ArchitecturePremiseAuthority/v1',
    authorityKind: 'repository',
    authorityRole: 'repository_authority',
    authorityId: 'repo-readiness-fixture',
    allowedTargetPaths: targetPaths,
    consumerImpactRules: [
      {
        impactId: 'consumer:readiness-target',
        whenConstraintKinds: ['PATH'],
        whenConstraintIds: [],
      },
    ],
    triggerRules: [
      {
        triggerId: 'architecture:readiness-target',
        whenConstraintKinds: ['PATH'],
        whenConstraintIds: [],
      },
    ],
  };
  const policyAuthority = {
    schemaVersion: 'ArchitecturePremiseAuthority/v1',
    authorityKind: 'policy',
    authorityRole: 'policy_authority',
    authorityId: 'policy-readiness-fixture',
    forbiddenScope: { paths: ['.git/**'] },
    ownershipRules: targetPaths.map((targetPath) => ({
      targetPath,
      owner: 'requirements_backed_main_agent',
    })),
    isolationSelection: 'consumer_worktree',
    governanceImpactRules: [
      { impactId: 'governance:readiness-policy', whenConstraintKinds: [], whenConstraintIds: [] },
    ],
    triggerRules: [
      {
        triggerId: 'architecture:readiness-policy',
        whenConstraintKinds: [],
        whenConstraintIds: [],
      },
    ],
  };
  const repositoryAuthorityPath = 'repo/readiness.json';
  const policyAuthorityPath = 'policy/readiness.json';
  writeJson(root, repositoryAuthorityPath, architectureAuthoritySource(repositoryAuthority));
  writeJson(root, policyAuthorityPath, architectureAuthoritySource(policyAuthority));
  const sourceBinding = createRequirementsContractSourceBindingCapsule({
    recordId: requestId,
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    parentBindingRevisionId: null,
    resolverIdentity: 'requirements-contract-consumer-authority-scanner/v1',
    sourceArtifacts: [
      {
        sourceArtifactId: 'repo-readiness-fixture',
        role: 'repository_authority',
        mediaType: 'application/json',
        sourceSnapshotHash: authoritySnapshotHash(repositoryAuthority),
        orderedPosition: 0,
        immutableBlobRef: repositoryAuthorityPath,
      },
      {
        sourceArtifactId: 'policy-readiness-fixture',
        role: 'policy_authority',
        mediaType: 'application/json',
        sourceSnapshotHash: authoritySnapshotHash(policyAuthority),
        orderedPosition: 1,
        immutableBlobRef: policyAuthorityPath,
      },
    ],
    sourceSpans: [],
    evidenceClaimBindings: [],
  });
  const executionManifest = {
    schemaVersion: 'requirements-contract-execution-manifest/v1',
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    constraints: semanticIr.semanticPayload.executionConstraints,
  };
  const publishProjection = (
    role: 'semantic_ir' | 'source_binding' | 'execution_manifest',
    schemaVersion: string,
    value: Record<string, unknown>,
  ) => {
    const contentRef = publishRequirementsContentObject({
      recordRoot,
      role,
      mediaType: 'application/json',
      bytes: Buffer.from(jsonText(value), 'utf8'),
    });
    return {
      role,
      schemaVersion,
      semanticHash: requirementsContractDomainHash(`requirements-projection:${role}/v1`, value),
      contentRef,
    };
  };
  const semanticEntry = publishProjection(
    'semantic_ir',
    semanticIr.schemaVersion,
    semanticIr as unknown as Record<string, unknown>,
  );
  const bindingEntry = publishProjection(
    'source_binding',
    sourceBinding.schemaVersion,
    sourceBinding as unknown as Record<string, unknown>,
  );
  const executionEntry = publishProjection(
    'execution_manifest',
    executionManifest.schemaVersion,
    executionManifest,
  );
  const buildManifest = createRequirementsContractBuildManifestV2({
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    sourceBindingHash: sourceBinding.sourceBindingHash,
    compilerIdentity: 'requirements-contract-cp00-cp08-compiler/v3',
    projectionSetHash: sha256Stable({
      semantic: semanticEntry.semanticHash,
      binding: bindingEntry.semanticHash,
      execution: executionEntry.semanticHash,
    }),
    checkpointSummary: {
      checkpointIds: ['cp06', 'cp07', 'cp08'],
      terminalStateHashes: [hash('6'), hash('7'), hash('8')],
    },
    validationSummary: {
      decision: 'pass',
      checkIds: ['semantic_ir', 'source_binding', 'execution_manifest'],
    },
    artifactEntries: [semanticEntry, bindingEntry, executionEntry],
  });
  const buildPath = `authoring/builds/${buildManifest.buildHash.slice('sha256:'.length)}/manifest.json`;
  writeJson(recordRoot, buildPath, buildManifest);
  const activeAuthority = {
    activeSemanticRevisionId: semanticIr.semanticRevisionId,
    activeScopeSemanticHash: semanticIr.scopeSemanticHash,
    activeBindingRevisionId: sourceBinding.bindingRevisionId,
    activeSourceBindingHash: sourceBinding.sourceBindingHash,
    activeBuildHash: buildManifest.buildHash,
    activeBuildManifestPath: buildPath,
    previousBuildHash: null,
    previousBuildManifestPath: null,
  };
  const effectivePass = compileRequirementsEffectivePassReceiptV2({
    activeAuthority,
    aggregate: {
      schemaVersion: 'requirements-contract-requirements-audit-aggregate/v2',
      semanticRevisionId: semanticIr.semanticRevisionId,
      scopeSemanticHash: semanticIr.scopeSemanticHash,
      sourceBindingHash: sourceBinding.sourceBindingHash,
      buildManifestHash: buildManifest.buildHash,
      providerSelectionHash: hash('6'),
      judgeRequestHash: hash('7'),
      judgeResponseHash: hash('8'),
      requirementsAuditAggregateHash: hash('9'),
      validatedDimensionIds: ['authority'],
      reviewedArtifactRefs: ['execution_manifest'],
      reviewedMustRefs: ['MUST-READINESS-001'],
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
  const markdownPath = 'requirements/confirmed.md';
  const htmlPath = 'requirements/confirmed.html';
  const markdownTarget = writeText(
    root,
    markdownPath,
    `# Requirements\n\n${exactConfirmationText}\n`
  );
  const htmlTarget = writeText(root, htmlPath, `<pre>${exactConfirmationText}</pre>\n`);
  const promotionPath = 'confirmation/confirmation-promotion-receipt.json';
  const promotionTarget = writeJson(recordRoot, promotionPath, {
    schemaVersion: 'requirements-contract-confirmation-promotion-receipt/v1',
    requestId,
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    bindingRevisionId: sourceBinding.bindingRevisionId,
    sourceBindingHash: sourceBinding.sourceBindingHash,
    buildManifestHash: buildManifest.buildHash,
    requirementsEffectivePassHash: effectivePass.requirementsEffectivePassHash,
    exactConfirmationText,
    artifacts: [
      {
        role: 'final_markdown',
        targetPath: markdownPath,
        artifactBytesHash: artifactBytesHash({
          role: 'final_markdown',
          mediaType: 'text/markdown',
          bytes: readFileSync(markdownTarget),
        }),
      },
      {
        role: 'confirmation_html',
        targetPath: htmlPath,
        artifactBytesHash: artifactBytesHash({
          role: 'confirmation_html',
          mediaType: 'text/html',
          bytes: readFileSync(htmlTarget),
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
    schemaVersion: 'requirements-contract-record/v3',
    recordId: requestId,
    requirementSetId: requestId,
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
  const targetPath = writeText(
    root,
    'src/refund-worker.cjs',
    "module.exports = { refundStatus: () => 'pending' };\n"
  );
  const testPath = writeText(
    root,
    'tests/refund-worker.test.cjs',
    [
      "const test = require('node:test');",
      "const assert = require('node:assert/strict');",
      "const { refundStatus } = require('../src/refund-worker.cjs');",
      `test('${commandIds.join(' ')} ${ORACLE}', () => {`,
      `  assert.equal(refundStatus(), 'accepted', '${ORACLE}');`,
      '});',
      '',
    ].join('\n')
  );
  const configPath = writeJson(root, 'package.json', {
    name: 'readiness-fixture',
    private: true,
    version: '1.0.0',
  });
  const lockPath = writeJson(root, 'package-lock.json', {
    name: 'readiness-fixture',
    version: '1.0.0',
    lockfileVersion: 3,
    requires: true,
    packages: {},
  });
  for (const [relativePath, content] of Object.entries(input.additionalFiles ?? {})) {
    writeText(root, relativePath, content);
  }
  const prepared = runPrepareArchitectureConfirmation(
    actionContext(root, 'prepare-architecture-confirmation', ['--request-id', requestId])
  ) as {
    exitCode: number;
    result: {
      architectureConfirmationCandidateHash: string;
      exactConfirmationText: string;
    };
  };
  if (prepared.exitCode !== 0)
    throw new Error(`fixture_architecture_prepare_failed:${JSON.stringify(prepared)}`);
  const ingested = runIngestArchitectureConfirmation(
    actionContext(root, 'ingest-architecture-confirmation', [
      '--request-id',
      requestId,
      '--architecture-confirmation-candidate-hash',
      prepared.result.architectureConfirmationCandidateHash,
      '--exact-confirmation-text',
      prepared.result.exactConfirmationText,
    ])
  ) as {
    exitCode: number;
    result: {
      eventRef: { path: string };
      runtimeStatusDecisionRef: { path: string };
    };
  };
  if (ingested.exitCode !== 0)
    throw new Error(`fixture_architecture_ingest_failed:${JSON.stringify(ingested)}`);
  return {
    root,
    requestId,
    recordRoot,
    recordPath,
    authorityRecordPath: recordPath,
    runtimeRecordPath: path.join(recordRoot, 'requirement-record.json'),
    targetPath,
    testPath,
    configPath,
    lockPath,
    commandIds,
    oracle: ORACLE,
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    sourceBindingHash: sourceBinding.sourceBindingHash,
    requirementsConfirmationPath: confirmationTarget,
    architectureCandidateHash: prepared.result.architectureConfirmationCandidateHash,
    architectureEventPath: path.join(recordRoot, ...ingested.result.eventRef.path.split('/')),
    architectureDecisionReceiptPath: path.join(
      recordRoot,
      ...ingested.result.runtimeStatusDecisionRef.path.split('/')
    ),
    cleanup: () => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }),
  };
}

export function readinessActionContext(fixture: ImplementationReadinessFixture) {
  return {
    cwd: fixture.root,
    args: {
      requestId: fixture.requestId,
      executeRedProof: 'true',
      cwd: fixture.root,
      json: 'true',
    },
    rawArgv: [
      'implementation-readiness-gate',
      '--cwd',
      fixture.root,
      '--request-id',
      fixture.requestId,
      '--execute-red-proof',
      '--json',
    ],
    json: true,
  };
}
