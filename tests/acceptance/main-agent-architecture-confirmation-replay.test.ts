import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runIngestArchitectureConfirmation } from '../../packages/bmad-speckit/src/main-agent/actions/ingest-architecture-confirmation';
import { runPrepareArchitectureConfirmation } from '../../packages/bmad-speckit/src/main-agent/actions/prepare-architecture-confirmation';
import { createRequirementsContractBuildManifest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest';
import { artifactBytesHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains';
import { compileRequirementsEffectivePassReceiptV2 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-requirements-effective-pass-gate';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { createRequirementsContractSemanticIr } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';
import { createRequirementsContractSourceBindingCapsule } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-binding-capsule';
import { createRequirementsContractSourceBindingRefreshReceipt } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-binding-refresh';
import { createRuntimeStatusDecisionReceipt } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-status-decision-receipt';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

function writeJson(root: string, relativePath: string, value: unknown): string {
  const target = path.join(root, ...relativePath.split('/'));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return target;
}

function writeText(root: string, relativePath: string, value: string): string {
  const target = path.join(root, ...relativePath.split('/'));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
  return target;
}

function fixture(root: string) {
  const requestId = 'REQ-ARCH-REPLAY-001';
  const recordRoot = path.join(root, '_bmad-output/runtime/requirement-records', requestId);
  const semanticIr = createRequirementsContractSemanticIr({
    recordId: requestId,
    requestId,
    parentSemanticRevisionId: null,
    compilerVersion: 'requirements-contract-cp02-compiler/v1',
    semantics: {
      requirements: [{ id: 'MUST-001', text: 'Implement worker.', oracle: 'Test passes.' }],
      atoms: [
        {
          id: 'MUST-001-A1',
          requirementRef: 'MUST-001',
          action: 'Implement worker.',
          oracle: 'Test passes.',
        },
      ],
      decisions: [],
    },
    evidenceClaims: [],
    specSpanRegistry: [],
    executionConstraints: [
      {
        constraintId: 'PATH-worker',
        kind: 'PATH',
        canonicalValue: 'src/worker.ts',
        applicableMustRefs: ['MUST-001'],
        applicableAtomRefs: ['MUST-001-A1'],
        premiseRefs: ['MUST-001'],
        derivationReceiptRefs: [],
        disposition: 'proven',
      },
      ...(['CMD', 'ART', 'CTM', 'EVDREQ', 'STOP'] as const).map((kind) => ({
        constraintId: `${kind}-worker`,
        kind,
        canonicalValue:
          kind === 'CMD'
            ? 'npm test -- worker.test.ts'
            : kind === 'ART'
              ? 'dist/worker.js'
              : kind === 'CTM'
                ? 'worker vertical slice'
                : kind === 'EVDREQ'
                  ? 'worker RED/GREEN evidence'
                  : '.git/**',
        applicableMustRefs: ['MUST-001'],
        applicableAtomRefs: ['MUST-001-A1'],
        premiseRefs: ['MUST-001'],
        derivationReceiptRefs: [],
        disposition: 'proven' as const,
      })),
    ],
    semanticProvenance: { 'MUST-001': 'MUST-001' },
  });
  const binding = createRequirementsContractSourceBindingCapsule({
    recordId: requestId,
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    parentBindingRevisionId: null,
    resolverIdentity: 'requirements-contract-consumer-authority-scanner/v1',
    sourceArtifacts: [
      {
        sourceArtifactId: 'repo-worker',
        role: 'repository_authority',
        mediaType: 'application/json',
        sourceSnapshotHash: hash('1'),
        orderedPosition: 0,
        immutableBlobRef: 'repo/worker.json',
      },
      {
        sourceArtifactId: 'policy-worker',
        role: 'policy_authority',
        mediaType: 'application/json',
        sourceSnapshotHash: hash('2'),
        orderedPosition: 1,
        immutableBlobRef: 'policy/worker.json',
      },
    ],
    sourceSpans: [],
    evidenceClaimBindings: [],
  });
  const semanticPath = `authoring/semantic-revisions/${semanticIr.semanticRevisionId}/semantic-ir.json`;
  const bindingPath = `authoring/source-bindings/${binding.bindingRevisionId}/source-binding.json`;
  const executionPath = 'authoring/staging/ATTEMPT-001/execution-manifest.json';
  const buildPath = 'authoring/staging/ATTEMPT-001/contract-build-manifest.json';
  writeJson(recordRoot, semanticPath, semanticIr);
  writeJson(recordRoot, bindingPath, binding);
  const executionManifest = {
    schemaVersion: 'requirements-contract-execution-manifest/v1',
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    constraints: semanticIr.semanticPayload.executionConstraints,
  };
  writeJson(recordRoot, executionPath, executionManifest);
  const buildManifest = createRequirementsContractBuildManifest({
    authoringRequestId: requestId,
    authoringAttemptId: 'ATTEMPT-001',
    inputManifestHash: hash('2'),
    terminalCheckpointManifestRef: {
      checkpointId: 'cp08',
      checkpointOrdinal: 8,
      path: 'authoring/staging/ATTEMPT-001/manifests/8-cp08.json',
      hash: hash('3'),
    },
    semanticAuthorityRef: {
      semanticRevisionId: semanticIr.semanticRevisionId,
      path: semanticPath,
      hash: semanticIr.scopeSemanticHash,
    },
    bindingAuthorityRef: {
      bindingRevisionId: binding.bindingRevisionId,
      path: bindingPath,
      hash: binding.sourceBindingHash,
    },
    artifactEntries: [
      {
        role: 'execution_manifest',
        schemaVersion: 'requirements-contract-execution-manifest/v1',
        artifactId: 'execution-manifest',
        recordRelativePath: executionPath,
        artifactHash: sha256Stable(executionManifest),
      },
    ],
    decisionReceiptRefs: [],
    auditPacketRef: {
      artifactId: 'judge-audit-packet',
      path: 'authoring/staging/ATTEMPT-001/judge-audit-packet.json',
      hash: hash('5'),
    },
    projectionReportRefs: [],
  });
  writeJson(recordRoot, buildPath, buildManifest);
  const activeAuthority = {
    activeSemanticRevisionId: semanticIr.semanticRevisionId,
    activeSemanticIrPath: semanticPath,
    activeScopeSemanticHash: semanticIr.scopeSemanticHash,
    activeBindingRevisionId: binding.bindingRevisionId,
    activeSourceBindingPath: bindingPath,
    activeSourceBindingHash: binding.sourceBindingHash,
    activeAuthoringAttemptId: 'ATTEMPT-001',
    activeBuildManifestPath: buildPath,
    activeBuildManifestHash: buildManifest.buildManifestHash,
  };
  const effectivePass = compileRequirementsEffectivePassReceiptV2({
    activeAuthority,
    aggregate: {
      schemaVersion: 'requirements-contract-requirements-audit-aggregate/v2',
      semanticRevisionId: semanticIr.semanticRevisionId,
      scopeSemanticHash: semanticIr.scopeSemanticHash,
      sourceBindingHash: binding.sourceBindingHash,
      buildManifestHash: buildManifest.buildManifestHash,
      providerSelectionHash: hash('6'),
      judgeRequestHash: hash('7'),
      judgeResponseHash: hash('8'),
      requirementsAuditAggregateHash: hash('9'),
      validatedDimensionIds: ['authority'],
      reviewedArtifactRefs: ['judge-audit-packet'],
      reviewedMustRefs: ['MUST-001'],
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
    `bindingRevisionId=${binding.bindingRevisionId}`,
    `requirementsEffectivePassHash=${effectivePass.requirementsEffectivePassHash}`,
  ].join('\n');
  const requirementsMarkdownPath = 'requirements/confirmed.md';
  const requirementsHtmlPath = 'requirements/confirmed.html';
  const requirementsMarkdownTarget = writeText(
    root,
    requirementsMarkdownPath,
    `# Requirements Contract\n\n## Confirmation\n\n\`\`\`text\n${exactConfirmationText}\n\`\`\`\n`
  );
  const requirementsHtmlTarget = writeText(
    root,
    requirementsHtmlPath,
    `<!doctype html><title>Requirements confirmation</title><pre>${exactConfirmationText}</pre>\n`
  );
  const promotionPath = 'confirmation/confirmation-promotion-receipt.json';
  const promotionTarget = writeJson(recordRoot, promotionPath, {
    schemaVersion: 'requirements-contract-confirmation-promotion-receipt/v1',
    requestId,
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    bindingRevisionId: binding.bindingRevisionId,
    sourceBindingHash: binding.sourceBindingHash,
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
    bindingRevisionId: binding.bindingRevisionId,
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
    semanticIr,
    semanticPath,
    binding,
    activeAuthority,
    exactConfirmationText,
    promotionPath,
    promotionArtifactBytesHash,
    requirementsMarkdownPath,
    requirementsHtmlPath,
    requirementsMarkdownTarget,
    requirementsHtmlTarget,
  };
}

const actionContext = (root: string, action: string, args: string[]) => ({
  cwd: root,
  args: {},
  rawArgv: [action, ...args, '--json'],
  json: true,
});

describe('Main Agent architecture confirmation replay', () => {
  it('validates confirmed Requirements authority without reading Markdown or HTML projections', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-replay-'));
    try {
      const input = fixture(root);
      rmSync(input.requirementsMarkdownTarget);
      rmSync(input.requirementsHtmlTarget);

      const prepared = runPrepareArchitectureConfirmation(
        actionContext(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;

      expect(prepared.exitCode, JSON.stringify(prepared, null, 2)).toBe(0);
      expect(prepared.result.status).toBe('user_confirmable');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('performs zero writes for the same current candidate and does not persist a state-check event', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-replay-'));
    try {
      const input = fixture(root);
      const first = runPrepareArchitectureConfirmation(
        actionContext(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;
      const candidatePath = path.join(root, ...first.result.candidateRef.path.split('/'));
      const pagePath = path.join(root, ...first.result.pageRef.path.split('/'));
      const candidateDirectory = path.dirname(candidatePath);
      const pageDirectory = path.dirname(pagePath);
      const old = new Date('2020-01-01T00:00:00.000Z');
      utimesSync(candidatePath, old, old);
      utimesSync(pagePath, old, old);
      utimesSync(candidateDirectory, old, old);
      utimesSync(pageDirectory, old, old);
      utimesSync(input.recordPath, old, old);

      const second = runPrepareArchitectureConfirmation(
        actionContext(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;
      expect(second.result).toEqual(first.result);
      expect(statSync(candidatePath).mtime.toISOString()).toBe(old.toISOString());
      expect(statSync(pagePath).mtime.toISOString()).toBe(old.toISOString());
      expect(statSync(candidateDirectory).mtime.toISOString()).toBe(old.toISOString());
      expect(statSync(pageDirectory).mtime.toISOString()).toBe(old.toISOString());
      expect(statSync(input.recordPath).mtime.toISOString()).toBe(old.toISOString());
      const record = JSON.parse(readFileSync(input.recordPath, 'utf8'));
      expect(record.architectureConfirmationStateChecks).toBeUndefined();
      expect(record.lastEventType).toBeUndefined();

      const ingested = runIngestArchitectureConfirmation(
        actionContext(root, 'ingest-architecture-confirmation', [
          '--request-id',
          input.requestId,
          '--architecture-confirmation-candidate-hash',
          first.result.architectureConfirmationCandidateHash,
          '--exact-confirmation-text',
          first.result.exactConfirmationText,
        ])
      ) as Record<string, any>;
      expect(ingested.exitCode, JSON.stringify(ingested, null, 2)).toBe(0);
      const eventPath = path.join(input.recordRoot, ...ingested.result.eventRef.path.split('/'));
      const runtimeReceiptPath = path.join(
        input.recordRoot,
        ...ingested.result.runtimeStatusDecisionRef.path.split('/')
      );
      expect(path.dirname(runtimeReceiptPath)).toBe(path.dirname(eventPath));
      const runtimeReceipt = JSON.parse(readFileSync(runtimeReceiptPath, 'utf8'));
      const requirementsRecord = JSON.parse(readFileSync(input.recordPath, 'utf8'));
      const requirementsEffectivePass = JSON.parse(
        readFileSync(
          path.join(input.recordRoot, 'quality', 'requirements-effective-pass-receipt.json'),
          'utf8'
        )
      );
      expect(ingested.result.event.requirementsConfirmationEventRef).toEqual(
        requirementsRecord.confirmationEventRef
      );
      expect(ingested.result.event.requirementsEffectivePassRef).toEqual({
        path: 'quality/requirements-effective-pass-receipt.json',
        hash: requirementsEffectivePass.requirementsEffectivePassHash,
      });
      expect(runtimeReceipt.stageInputs).toContainEqual({
        role: 'requirements_confirmation_event',
        path: requirementsRecord.confirmationEventRef.path,
        hash: requirementsRecord.confirmationEventRef.artifactBytesHash,
      });
      expect(runtimeReceipt.stageInputs).toContainEqual({
        role: 'requirements_effective_pass',
        path: 'quality/requirements-effective-pass-receipt.json',
        hash: requirementsEffectivePass.requirementsEffectivePassHash,
      });
      const receiptPaths = [
        ...runtimeReceipt.stageInputs.map((entry: Record<string, string>) => entry.path),
        ...runtimeReceipt.deterministicGateOutputs.map(
          (entry: Record<string, string>) => entry.path
        ),
        ...runtimeReceipt.evidenceRefs,
      ];
      expect(
        receiptPaths.every((artifactPath: string) => !artifactPath.startsWith('_bmad-output/'))
      ).toBe(true);
      expect(
        receiptPaths.every((artifactPath: string) =>
          existsSync(path.join(input.recordRoot, ...artifactPath.split('/')))
        )
      ).toBe(true);
      utimesSync(eventPath, old, old);
      utimesSync(runtimeReceiptPath, old, old);
      const recordBytes = readFileSync(input.recordPath);
      const repeatedIngest = runIngestArchitectureConfirmation(
        actionContext(root, 'ingest-architecture-confirmation', [
          '--request-id',
          input.requestId,
          '--architecture-confirmation-candidate-hash',
          first.result.architectureConfirmationCandidateHash,
          '--exact-confirmation-text',
          first.result.exactConfirmationText,
        ])
      ) as Record<string, any>;
      expect(repeatedIngest.exitCode, JSON.stringify(repeatedIngest, null, 2)).toBe(0);
      expect(repeatedIngest.status).toBe('architecture_confirmation_reused');
      expect(repeatedIngest.result.status).toBe('architecture_confirmation_reused');
      expect(statSync(eventPath).mtime.toISOString()).toBe(old.toISOString());
      expect(statSync(runtimeReceiptPath).mtime.toISOString()).toBe(old.toISOString());
      expect(readFileSync(input.recordPath)).toEqual(recordBytes);
      utimesSync(input.recordPath, old, old);
      const reused = runPrepareArchitectureConfirmation(
        actionContext(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;
      expect(reused.result.status).toBe('architecture_confirmation_reused');
      expect(statSync(input.recordPath).mtime.toISOString()).toBe(old.toISOString());
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects non-exact acceptance without changing the record', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-replay-'));
    try {
      const input = fixture(root);
      const prepared = runPrepareArchitectureConfirmation(
        actionContext(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;
      const before = readFileSync(input.recordPath);
      const rejected = runIngestArchitectureConfirmation(
        actionContext(root, 'ingest-architecture-confirmation', [
          '--request-id',
          input.requestId,
          '--architecture-confirmation-candidate-hash',
          prepared.result.architectureConfirmationCandidateHash,
          '--exact-confirmation-text',
          '确认架构技术决策',
        ])
      ) as Record<string, any>;
      expect(rejected.exitCode, JSON.stringify(rejected, null, 2)).toBe(1);
      expect(readFileSync(input.recordPath)).toEqual(before);

      const whitespaceRejected = runIngestArchitectureConfirmation(
        actionContext(root, 'ingest-architecture-confirmation', [
          '--request-id',
          input.requestId,
          '--architecture-confirmation-candidate-hash',
          prepared.result.architectureConfirmationCandidateHash,
          '--exact-confirmation-text',
          `${prepared.result.exactConfirmationText}\n`,
        ])
      ) as Record<string, any>;
      expect(whitespaceRejected.exitCode, JSON.stringify(whitespaceRejected, null, 2)).toBe(1);
      expect(whitespaceRejected.result.issueCodes).toEqual([
        'architecture_confirmation_exact_text_mismatch',
      ]);
      expect(readFileSync(input.recordPath)).toEqual(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('short-circuits help before the public ingest route can write acceptance artifacts', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-replay-'));
    try {
      const input = fixture(root);
      const prepared = runPrepareArchitectureConfirmation(
        actionContext(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;
      const confirmationRoot = path.join(input.recordRoot, 'architecture', 'confirmations');

      const result = runIngestArchitectureConfirmation(
        actionContext(root, 'ingest-architecture-confirmation', [
          '--help',
          '--request-id',
          input.requestId,
          '--architecture-confirmation-candidate-hash',
          prepared.result.architectureConfirmationCandidateHash,
          '--exact-confirmation-text',
          prepared.result.exactConfirmationText,
        ])
      ) as Record<string, any>;

      expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(0);
      expect(existsSync(confirmationRoot)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a stale candidate and tampered confirmation page without changing the record', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-replay-'));
    try {
      const input = fixture(root);
      const prepared = runPrepareArchitectureConfirmation(
        actionContext(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;
      const before = readFileSync(input.recordPath);
      const stale = runIngestArchitectureConfirmation(
        actionContext(root, 'ingest-architecture-confirmation', [
          '--request-id',
          input.requestId,
          '--architecture-confirmation-candidate-hash',
          hash('f'),
          '--exact-confirmation-text',
          prepared.result.exactConfirmationText,
        ])
      ) as Record<string, any>;
      expect(stale.exitCode, JSON.stringify(stale, null, 2)).toBe(1);
      expect(readFileSync(input.recordPath)).toEqual(before);

      const pagePath = path.join(root, ...prepared.result.pageRef.path.split('/'));
      writeFileSync(pagePath, '<!doctype html><title>tampered</title>\n', 'utf8');
      const tamperedPage = runIngestArchitectureConfirmation(
        actionContext(root, 'ingest-architecture-confirmation', [
          '--request-id',
          input.requestId,
          '--architecture-confirmation-candidate-hash',
          prepared.result.architectureConfirmationCandidateHash,
          '--exact-confirmation-text',
          prepared.result.exactConfirmationText,
        ])
      ) as Record<string, any>;
      expect(tamperedPage.exitCode, JSON.stringify(tamperedPage, null, 2)).toBe(1);
      expect(readFileSync(input.recordPath)).toEqual(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('ignores an abandoned sibling staging directory and commits one complete acceptance bundle', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-replay-'));
    try {
      const input = fixture(root);
      const prepared = runPrepareArchitectureConfirmation(
        actionContext(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;
      const candidateId = prepared.result.architectureConfirmationCandidateHash.slice(
        'sha256:'.length
      );
      const acceptanceParent = path.join(input.recordRoot, 'architecture', 'confirmations');
      const abandoned = path.join(acceptanceParent, `.${candidateId}.staging.abandoned`);
      mkdirSync(abandoned, { recursive: true });
      writeFileSync(path.join(abandoned, 'architecture-confirmation-event.json'), '{}\n', 'utf8');

      const ingested = runIngestArchitectureConfirmation(
        actionContext(root, 'ingest-architecture-confirmation', [
          '--request-id',
          input.requestId,
          '--architecture-confirmation-candidate-hash',
          prepared.result.architectureConfirmationCandidateHash,
          '--exact-confirmation-text',
          prepared.result.exactConfirmationText,
        ])
      ) as Record<string, any>;

      expect(ingested.exitCode, JSON.stringify(ingested, null, 2)).toBe(0);
      const acceptanceDirectory = path.join(acceptanceParent, candidateId);
      expect(
        existsSync(path.join(acceptanceDirectory, 'architecture-confirmation-event.json'))
      ).toBe(true);
      expect(
        existsSync(path.join(acceptanceDirectory, 'runtime-status-decision-receipt.json'))
      ).toBe(true);
      expect(existsSync(path.join(abandoned, 'runtime-status-decision-receipt.json'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when the canonical acceptance directory is only partially published', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-replay-'));
    try {
      const input = fixture(root);
      const prepared = runPrepareArchitectureConfirmation(
        actionContext(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;
      const candidateId = prepared.result.architectureConfirmationCandidateHash.slice(
        'sha256:'.length
      );
      const acceptanceDirectory = path.join(
        input.recordRoot,
        'architecture',
        'confirmations',
        candidateId
      );
      mkdirSync(acceptanceDirectory, { recursive: true });
      writeFileSync(
        path.join(acceptanceDirectory, 'architecture-confirmation-event.json'),
        '{}\n',
        'utf8'
      );

      const ingested = runIngestArchitectureConfirmation(
        actionContext(root, 'ingest-architecture-confirmation', [
          '--request-id',
          input.requestId,
          '--architecture-confirmation-candidate-hash',
          prepared.result.architectureConfirmationCandidateHash,
          '--exact-confirmation-text',
          prepared.result.exactConfirmationText,
        ])
      ) as Record<string, any>;

      expect(ingested.exitCode, JSON.stringify(ingested, null, 2)).toBe(2);
      expect(ingested.result.issueCodes).toEqual(['architecture_confirmation_integrity_invalid']);
      expect(
        existsSync(path.join(acceptanceDirectory, 'runtime-status-decision-receipt.json'))
      ).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects conflicting bytes for an existing canonical acceptance bundle', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-replay-'));
    try {
      const module =
        await import('../../packages/bmad-speckit/src/main-agent/source-authority/scripts/ingest-architecture-confirmation');
      const publish = (module as Record<string, any>).publishArchitectureConfirmationAcceptance;
      expect(typeof publish).toBe('function');
      const acceptanceDirectory = path.join(root, 'accepted');
      expect(
        publish({
          acceptanceDirectory,
          eventBytes: Buffer.from('{"decision":"pass"}', 'utf8'),
          runtimeReceiptBytes: Buffer.from('{"receipt":"first"}', 'utf8'),
        })
      ).toBe('published');

      expect(() =>
        publish({
          acceptanceDirectory,
          eventBytes: Buffer.from('{"decision":"different"}', 'utf8'),
          runtimeReceiptBytes: Buffer.from('{"receipt":"second"}', 'utf8'),
        })
      ).toThrow('architecture_confirmation_acceptance_conflict');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('removes a newly published acceptance bundle when authority changes at the commit boundary', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-replay-'));
    try {
      const module =
        await import('../../packages/bmad-speckit/src/main-agent/source-authority/scripts/ingest-architecture-confirmation');
      const publish = (module as Record<string, any>).publishArchitectureConfirmationAcceptance;
      const acceptanceDirectory = path.join(root, 'accepted');
      let currentnessChecks = 0;

      expect(() =>
        publish({
          acceptanceDirectory,
          eventBytes: Buffer.from('{"decision":"pass"}', 'utf8'),
          runtimeReceiptBytes: Buffer.from('{"receipt":"pass"}', 'utf8'),
          assertCurrentAuthority() {
            currentnessChecks += 1;
            if (currentnessChecks === 3)
              throw new Error('architecture_confirmation_candidate_stale');
          },
        })
      ).toThrow('architecture_confirmation_candidate_stale');
      expect(currentnessChecks).toBe(3);
      expect(existsSync(acceptanceDirectory)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects an accepted event whose page locator is not the deterministic projection path', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-replay-'));
    try {
      const input = fixture(root);
      const prepared = runPrepareArchitectureConfirmation(
        actionContext(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;
      const ingested = runIngestArchitectureConfirmation(
        actionContext(root, 'ingest-architecture-confirmation', [
          '--request-id',
          input.requestId,
          '--architecture-confirmation-candidate-hash',
          prepared.result.architectureConfirmationCandidateHash,
          '--exact-confirmation-text',
          prepared.result.exactConfirmationText,
        ])
      ) as Record<string, any>;
      expect(ingested.exitCode, JSON.stringify(ingested, null, 2)).toBe(0);

      const eventPath = path.join(input.recordRoot, ...ingested.result.eventRef.path.split('/'));
      const receiptPath = path.join(
        input.recordRoot,
        ...ingested.result.runtimeStatusDecisionRef.path.split('/')
      );
      const event = JSON.parse(readFileSync(eventPath, 'utf8'));
      const projectedPagePath = path.join(input.recordRoot, ...event.pageRef.path.split('/'));
      const alternatePagePath = path.join(input.recordRoot, 'architecture', 'alternate-page.html');
      mkdirSync(path.dirname(alternatePagePath), { recursive: true });
      writeFileSync(alternatePagePath, readFileSync(projectedPagePath));
      event.pageRef.path = path.relative(input.recordRoot, alternatePagePath).replace(/\\/gu, '/');
      writeFileSync(eventPath, JSON.stringify(event), 'utf8');
      const eventBytesHash = artifactBytesHash({
        role: 'architecture_confirmation_event',
        mediaType: 'application/json',
        bytes: readFileSync(eventPath),
      });
      const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
      receipt.deterministicGateOutputs = receipt.deterministicGateOutputs.map(
        (binding: Record<string, string>) =>
          binding.role === 'architecture_confirmation_event'
            ? { ...binding, hash: eventBytesHash }
            : binding
      );
      const { schemaVersion: _schemaVersion, receiptHash: _receiptHash, ...receiptInput } = receipt;
      writeFileSync(
        receiptPath,
        JSON.stringify(createRuntimeStatusDecisionReceipt(receiptInput), null, 2),
        'utf8'
      );

      const replayed = runPrepareArchitectureConfirmation(
        actionContext(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;
      expect(replayed.exitCode, JSON.stringify(replayed, null, 2)).toBe(2);
      expect(replayed.result.issueCodes).toEqual(['architecture_confirmation_integrity_invalid']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reuses the accepted candidate after consecutive locator-only Requirements binding refreshes', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-replay-'));
    try {
      const input = fixture(root);
      const first = runPrepareArchitectureConfirmation(
        actionContext(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;
      const ingested = runIngestArchitectureConfirmation(
        actionContext(root, 'ingest-architecture-confirmation', [
          '--request-id',
          input.requestId,
          '--architecture-confirmation-candidate-hash',
          first.result.architectureConfirmationCandidateHash,
          '--exact-confirmation-text',
          first.result.exactConfirmationText,
        ])
      ) as Record<string, any>;
      expect(ingested.exitCode, JSON.stringify(ingested, null, 2)).toBe(0);
      const candidatePath = path.join(root, ...first.result.candidateRef.path.split('/'));
      const candidateDirectory = path.dirname(candidatePath);
      const oldCandidateTime = new Date('2020-01-01T00:00:00.000Z');
      utimesSync(candidateDirectory, oldCandidateTime, oldCandidateTime);

      const refreshedBinding = createRequirementsContractSourceBindingCapsule({
        recordId: input.requestId,
        semanticRevisionId: input.semanticIr.semanticRevisionId,
        scopeSemanticHash: input.semanticIr.scopeSemanticHash,
        parentBindingRevisionId: input.binding.bindingRevisionId,
        resolverIdentity: input.binding.resolverIdentity,
        sourceArtifacts: input.binding.sourceArtifacts.map((artifact) => ({
          ...artifact,
          immutableBlobRef: 'repo/worker-refreshed.json',
        })),
        sourceSpans: input.binding.sourceSpanRegistry,
        evidenceClaimBindings: input.binding.evidenceClaimBindings,
      });
      const bindingPath = `authoring/source-bindings/${refreshedBinding.bindingRevisionId}/source-binding.json`;
      writeJson(input.recordRoot, bindingPath, refreshedBinding);
      const activeAuthority = {
        ...input.activeAuthority,
        activeBindingRevisionId: refreshedBinding.bindingRevisionId,
        activeSourceBindingPath: bindingPath,
        activeSourceBindingHash: refreshedBinding.sourceBindingHash,
      };
      const refreshedExactConfirmationText = input.exactConfirmationText.replace(
        `bindingRevisionId=${input.binding.bindingRevisionId}`,
        `bindingRevisionId=${refreshedBinding.bindingRevisionId}`
      );
      writeText(
        root,
        input.requirementsMarkdownPath,
        `# Requirements Contract\n\n## Confirmation\n\n\`\`\`text\n${refreshedExactConfirmationText}\n\`\`\`\n`
      );
      writeText(
        root,
        input.requirementsHtmlPath,
        `<!doctype html><title>Requirements confirmation</title><pre>${refreshedExactConfirmationText}</pre>\n`
      );
      const refreshReceipt = createRequirementsContractSourceBindingRefreshReceipt({
        semanticRevisionId: input.semanticIr.semanticRevisionId,
        scopeSemanticHash: input.semanticIr.scopeSemanticHash,
        fromBindingRevisionId: input.binding.bindingRevisionId,
        toBindingRevisionId: refreshedBinding.bindingRevisionId,
        fromSourceBindingHash: input.binding.sourceBindingHash,
        toSourceBindingHash: refreshedBinding.sourceBindingHash,
        fromSnapshotSetHash: sha256Stable(input.binding.sourceArtifacts),
        toSnapshotSetHash: sha256Stable(refreshedBinding.sourceArtifacts),
        fromSourceSpanRegistryHash: input.binding.sourceSpanRegistryHash,
        toSourceSpanRegistryHash: refreshedBinding.sourceSpanRegistryHash,
        evidenceClaimRegistryHash: refreshedBinding.evidenceClaimBindingRegistryHash,
        pageEvidence: {
          confirmationPromotionReceiptRef: {
            path: input.promotionPath,
            hash: input.promotionArtifactBytesHash,
          },
          pageArtifactBytesHash: artifactBytesHash({
            role: 'final_markdown',
            mediaType: 'text/markdown',
            bytes: readFileSync(input.requirementsMarkdownTarget),
          }),
          htmlPageArtifactBytesHash: artifactBytesHash({
            role: 'confirmation_html',
            mediaType: 'text/html',
            bytes: readFileSync(input.requirementsHtmlTarget),
          }),
        },
      });
      const refreshPath = `authoring/source-bindings/${refreshedBinding.bindingRevisionId}/source-binding-refresh-receipt.json`;
      const refreshTarget = writeJson(input.recordRoot, refreshPath, refreshReceipt);
      const refreshedRecord = JSON.parse(readFileSync(input.recordPath, 'utf8'));
      refreshedRecord.activeAuthority = activeAuthority;
      refreshedRecord.currentPromotionEvidence = {
        path: refreshPath,
        artifactBytesHash: artifactBytesHash({
          role: 'source-binding-refresh-receipt',
          mediaType: 'application/json',
          bytes: readFileSync(refreshTarget),
        }),
      };
      writeFileSync(input.recordPath, `${JSON.stringify(refreshedRecord, null, 2)}\n`, 'utf8');

      const secondBinding = createRequirementsContractSourceBindingCapsule({
        recordId: input.requestId,
        semanticRevisionId: input.semanticIr.semanticRevisionId,
        scopeSemanticHash: input.semanticIr.scopeSemanticHash,
        parentBindingRevisionId: refreshedBinding.bindingRevisionId,
        resolverIdentity: input.binding.resolverIdentity,
        sourceArtifacts: refreshedBinding.sourceArtifacts.map((artifact) => ({
          ...artifact,
          immutableBlobRef: 'repo/worker-refreshed-again.json',
        })),
        sourceSpans: refreshedBinding.sourceSpanRegistry,
        evidenceClaimBindings: refreshedBinding.evidenceClaimBindings,
      });
      const secondBindingPath = `authoring/source-bindings/${secondBinding.bindingRevisionId}/source-binding.json`;
      writeJson(input.recordRoot, secondBindingPath, secondBinding);
      const secondRefreshReceipt = createRequirementsContractSourceBindingRefreshReceipt({
        semanticRevisionId: input.semanticIr.semanticRevisionId,
        scopeSemanticHash: input.semanticIr.scopeSemanticHash,
        fromBindingRevisionId: refreshedBinding.bindingRevisionId,
        toBindingRevisionId: secondBinding.bindingRevisionId,
        fromSourceBindingHash: refreshedBinding.sourceBindingHash,
        toSourceBindingHash: secondBinding.sourceBindingHash,
        fromSnapshotSetHash: sha256Stable(refreshedBinding.sourceArtifacts),
        toSnapshotSetHash: sha256Stable(secondBinding.sourceArtifacts),
        fromSourceSpanRegistryHash: refreshedBinding.sourceSpanRegistryHash,
        toSourceSpanRegistryHash: secondBinding.sourceSpanRegistryHash,
        evidenceClaimRegistryHash: secondBinding.evidenceClaimBindingRegistryHash,
        pageEvidence: {
          confirmationPromotionReceiptRef: refreshReceipt.confirmationPromotionReceiptRef!,
          pageArtifactBytesHash: refreshReceipt.pageArtifactBytesHash!,
          htmlPageArtifactBytesHash: refreshReceipt.htmlPageArtifactBytesHash!,
        },
      });
      const secondRefreshPath = `authoring/source-bindings/${secondBinding.bindingRevisionId}/source-binding-refresh-receipt.json`;
      const secondRefreshTarget = writeJson(
        input.recordRoot,
        secondRefreshPath,
        secondRefreshReceipt
      );
      refreshedRecord.activeAuthority = {
        ...activeAuthority,
        activeBindingRevisionId: secondBinding.bindingRevisionId,
        activeSourceBindingPath: secondBindingPath,
        activeSourceBindingHash: secondBinding.sourceBindingHash,
      };
      refreshedRecord.currentPromotionEvidence = {
        path: secondRefreshPath,
        artifactBytesHash: artifactBytesHash({
          role: 'source-binding-refresh-receipt',
          mediaType: 'application/json',
          bytes: readFileSync(secondRefreshTarget),
        }),
      };
      writeFileSync(input.recordPath, `${JSON.stringify(refreshedRecord, null, 2)}\n`, 'utf8');
      const recordBytes = readFileSync(input.recordPath);

      const replayed = runPrepareArchitectureConfirmation(
        actionContext(root, 'prepare-architecture-confirmation', ['--request-id', input.requestId])
      ) as Record<string, any>;
      expect(replayed.exitCode, JSON.stringify(replayed, null, 2)).toBe(0);
      expect(replayed.result.status).toBe('architecture_confirmation_reused');
      expect(replayed.result.architectureConfirmationCandidateHash).toBe(
        first.result.architectureConfirmationCandidateHash
      );
      expect(replayed.result.candidateRef).toEqual(first.result.candidateRef);
      expect(replayed.result.pageRef.path).not.toBe(first.result.pageRef.path);
      expect(statSync(candidateDirectory).mtime.toISOString()).toBe(oldCandidateTime.toISOString());
      expect(readFileSync(input.recordPath)).toEqual(recordBytes);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
