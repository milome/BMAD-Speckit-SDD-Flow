import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { runIngestArchitectureConfirmation } from '../../packages/bmad-speckit/src/main-agent/actions/ingest-architecture-confirmation';
import { runPrepareArchitectureConfirmation } from '../../packages/bmad-speckit/src/main-agent/actions/prepare-architecture-confirmation';
import { createRequirementsContractBuildManifest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest';
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

function fixture(
  projectRoot: string,
  overrides: { buildRequestId?: string; buildAttemptId?: string } = {}
) {
  const requestId = 'REQ-ARCH-CANDIDATE-001';
  const activeAttemptId = 'ATTEMPT-ARCH-001';
  const manifestAttemptId = overrides.buildAttemptId ?? activeAttemptId;
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
      canonicalValue: 'src/refund-worker.ts',
      applicableMustRefs: ['MUST-ARCH-001'],
      applicableAtomRefs: ['MUST-ARCH-001-A1'],
      premiseRefs: ['MUST-ARCH-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
    {
      constraintId: 'CMD-refund-worker-test',
      kind: 'CMD',
      canonicalValue: 'npm test -- refund-worker.test.ts',
      applicableMustRefs: ['MUST-ARCH-001'],
      applicableAtomRefs: ['MUST-ARCH-001-A1'],
      premiseRefs: ['MUST-ARCH-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
    {
      constraintId: 'ART-refund-worker-output',
      kind: 'ART',
      canonicalValue: 'dist/refund-worker.js',
      applicableMustRefs: ['MUST-ARCH-001'],
      applicableAtomRefs: ['MUST-ARCH-001-A1'],
      premiseRefs: ['MUST-ARCH-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
    {
      constraintId: 'CTM-refund-worker-slice',
      kind: 'CTM',
      canonicalValue: 'refund-worker vertical slice',
      applicableMustRefs: ['MUST-ARCH-001'],
      applicableAtomRefs: ['MUST-ARCH-001-A1'],
      premiseRefs: ['MUST-ARCH-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
    {
      constraintId: 'EVDREQ-refund-worker-red-green',
      kind: 'EVDREQ',
      canonicalValue: 'refund-worker RED/GREEN evidence',
      applicableMustRefs: ['MUST-ARCH-001'],
      applicableAtomRefs: ['MUST-ARCH-001-A1'],
      premiseRefs: ['MUST-ARCH-001'],
      derivationReceiptRefs: [],
      disposition: 'proven',
    },
    {
      constraintId: 'STOP-refund-worker-forbidden',
      kind: 'STOP',
      canonicalValue: '.git/**',
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
        sourceSnapshotHash: hash('1'),
        orderedPosition: 0,
        immutableBlobRef: 'repo/refund-worker.json',
      },
      {
        sourceArtifactId: 'policy-refund-worker',
        role: 'policy_authority',
        mediaType: 'application/json',
        sourceSnapshotHash: hash('2'),
        orderedPosition: 1,
        immutableBlobRef: 'policy/refund-worker.json',
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
  const executionPath = `authoring/staging/${activeAttemptId}/execution-manifest.json`;
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
  const buildManifest = createRequirementsContractBuildManifest({
    authoringRequestId: overrides.buildRequestId ?? requestId,
    authoringAttemptId: manifestAttemptId,
    inputManifestHash: hash('3'),
    terminalCheckpointManifestRef: {
      checkpointId: 'cp08',
      checkpointOrdinal: 8,
      path: `authoring/staging/${manifestAttemptId}/manifests/8-cp08.json`,
      hash: hash('4'),
    },
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
  };
}

function context(root: string, action: string, args: string[]) {
  return { cwd: root, args: {}, rawArgv: [action, ...args, '--json'], json: true };
}

describe('Main Agent architecture confirmation candidate', () => {
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

  it('rejects caller-supplied derived architecture fields', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-'));
    try {
      const input = fixture(root);
      const result = runPrepareArchitectureConfirmation(
        context(root, 'prepare-architecture-confirmation', [
          '--request-id',
          input.requestId,
          '--target-paths',
          '["injected.ts"]',
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
    ['STOP', 'architecture_successor_required:forbidden_scope'],
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
      const input = fixture(root);
      const architectureContext = resolveArchitectureConfirmationContext({
        projectRoot: root,
        requestId: input.requestId,
      });
      const target = architectureContext.semanticIr.semanticPayload.executionConstraints.find(
        (constraint) => constraint.kind === 'PATH'
      );
      const forbidden = architectureContext.semanticIr.semanticPayload.executionConstraints.find(
        (constraint) => constraint.kind === 'STOP'
      );
      expect(target).toBeDefined();
      expect(forbidden).toBeDefined();
      forbidden!.canonicalValue = target!.canonicalValue;

      expect(() => deriveArchitectureConfirmationCandidate(architectureContext)).toThrow(
        'architecture_successor_required:forbidden_scope'
      );
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

  it('changes candidate identity when the pinned policy snapshot changes', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'architecture-candidate-'));
    try {
      const input = fixture(root);
      const architectureContext = resolveArchitectureConfirmationContext({
        projectRoot: root,
        requestId: input.requestId,
      });
      const current = deriveArchitectureConfirmationCandidate(architectureContext);
      const policyPremise = architectureContext.sourceBinding.sourceArtifacts.find((artifact) =>
        artifact.role.includes('policy')
      );
      expect(policyPremise).toBeDefined();
      policyPremise!.sourceSnapshotHash = hash('f');

      const successor = deriveArchitectureConfirmationCandidate(architectureContext);

      expect(successor.architectureConfirmationCandidateHash).not.toBe(
        current.architectureConfirmationCandidateHash
      );
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
