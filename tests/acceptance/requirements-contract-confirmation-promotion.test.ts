import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequirementsContractBuildManifest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest';
import {
  confirmRequirementsContractIrScope,
  renderAndPromoteRequirementsContractConfirmation,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-acceptance';
import { artifactBytesHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains';
import { compileRequirementsEffectivePassReceiptV2 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-requirements-effective-pass-gate';
import { createRequirementsContractSemanticIr } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { createRequirementsContractSourceBindingCapsule } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-binding-capsule';
import { canonicalSourceSpanId } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-span-registry';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

function writeJson(root: string, relativePath: string, value: unknown): void {
  const target = path.join(root, ...relativePath.split('/'));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value)}\n`, 'utf8');
}

function fixture(root: string) {
  const requestId = 'REQ-PROMOTION-001';
  const attemptId = 'ATTEMPT-PROMOTION-001';
  const recordRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records', requestId);
  const semanticIr = createRequirementsContractSemanticIr({
    recordId: requestId,
    requestId,
    parentSemanticRevisionId: null,
    compilerVersion: 'requirements-contract-cp02-compiler/v1',
    semantics: {
      requirements: [
        { id: 'MUST-FR-001', text: 'Persist refund audit records.', oracle: 'ACC-001 passes.' },
      ],
      atoms: [
        {
          id: 'MUST-FR-001-A1',
          action: 'Persist refund audit records.',
          oracle: 'ACC-001 passes.',
          requirementRef: 'MUST-FR-001',
        },
      ],
      decisions: [],
    },
    evidenceClaims: [
      {
        evidenceClaimId: 'EVIDENCE-CLAIM-MUST-FR-001',
        authorityClass: 'source_grounded',
        normalizedClaimHash: hash('1'),
        sourceEvidenceRequired: true,
        decisionReceiptRefs: [],
        premiseRefs: [],
        derivationReceiptRefs: [],
      },
    ],
    specSpanRegistry: [
      {
        authorityClass: 'source_grounded',
        normalizedClaimHash: hash('1'),
        boundSemanticNodeIds: ['MUST-FR-001', 'MUST-FR-001-A1'],
        boundObligationIds: ['MUST-FR-001'],
        evidenceClaimRefs: ['EVIDENCE-CLAIM-MUST-FR-001'],
        decisionReceiptRefs: [],
        derivationReceiptRefs: [],
      },
    ],
    executionConstraints: [],
    semanticProvenance: { 'MUST-FR-001': 'MUST-FR-001' },
  });
  const sourceContent = 'Persist refund audit records.\n';
  const sourceSnapshotHash = sha256Stable({
    domain: 'requirements-source-snapshot/v1',
    content: sourceContent,
  });
  const sourceSpan = {
    sourceArtifactId: 'MUST-FR-001',
    sourceSnapshotHash,
    startByte: 0,
    endByteExclusive: Buffer.byteLength(sourceContent),
    startLine: 1,
    startColumn: 1,
    endLine: 1,
    endColumn: sourceContent.trimEnd().length + 1,
    exactTextHash: sha256Stable({ domain: 'exact/v1', content: sourceContent }),
    normalizedTextHash: sha256Stable({ domain: 'normalized/v1', content: sourceContent }),
    structuralAnchor: 'MUST-FR-001',
  };
  const sourceSpanId = canonicalSourceSpanId(sourceSpan);
  const sourceBinding = createRequirementsContractSourceBindingCapsule({
    recordId: requestId,
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    parentBindingRevisionId: null,
    resolverIdentity: 'requirements-contract-consumer-authority-scanner/v1',
    sourceArtifacts: [
      {
        sourceArtifactId: 'MUST-FR-001',
        role: 'functional_requirement',
        mediaType: 'application/json',
        sourceSnapshotHash,
        orderedPosition: 0,
        immutableBlobRef: 'policy/refund-audit.json',
      },
    ],
    sourceSpans: [{ ...sourceSpan, sourceSpanId }],
    evidenceClaimBindings: [
      {
        evidenceClaimId: 'EVIDENCE-CLAIM-MUST-FR-001',
        specSpanId: semanticIr.semanticPayload.specSpanRegistry[0]!.specSpanId,
        authorityClass: 'source_grounded',
        sourceSpanRefs: [sourceSpanId],
      },
    ],
  });
  const semanticPath = `authoring/semantic-revisions/${semanticIr.semanticRevisionId}/semantic-ir.json`;
  const bindingPath = `authoring/source-bindings/${sourceBinding.bindingRevisionId}/source-binding.json`;
  writeJson(recordRoot, semanticPath, semanticIr);
  writeJson(recordRoot, bindingPath, sourceBinding);
  const resolvedIndex = {
    schemaVersion: 'requirements-contract-resolved-evidence-index/v1',
    semanticRevisionId: semanticIr.semanticRevisionId,
    bindingRevisionId: sourceBinding.bindingRevisionId,
    sourceBindingHash: sourceBinding.sourceBindingHash,
    resolutions: [
      {
        evidenceClaimId: 'EVIDENCE-CLAIM-MUST-FR-001',
        authorityClass: 'source_grounded',
        sourceSpanRefs: [sourceBinding.sourceSpanRegistry[0]!.sourceSpanId],
        decisionReceiptRefs: [],
        premiseRefs: [],
        derivationReceiptRefs: [],
      },
    ],
  };
  writeJson(
    recordRoot,
    `authoring/source-bindings/${sourceBinding.bindingRevisionId}/resolved-evidence-index.json`,
    resolvedIndex
  );
  const buildManifest = createRequirementsContractBuildManifest({
    authoringRequestId: requestId,
    authoringAttemptId: attemptId,
    inputManifestHash: hash('2'),
    terminalCheckpointManifestRef: {
      checkpointId: 'cp08',
      checkpointOrdinal: 8,
      path: `authoring/staging/${attemptId}/manifests/8-cp08.json`,
      hash: hash('3'),
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
    artifactEntries: [],
    decisionReceiptRefs: [],
    auditPacketRef: {
      artifactId: 'judge-audit-packet',
      path: `authoring/staging/${attemptId}/judge-audit-packet.json`,
      hash: hash('4'),
    },
    projectionReportRefs: [],
  });
  const buildPath = `authoring/staging/${attemptId}/contract-build-manifest.json`;
  writeJson(recordRoot, buildPath, buildManifest);
  const activeAuthority = {
    activeSemanticRevisionId: semanticIr.semanticRevisionId,
    activeSemanticIrPath: semanticPath,
    activeScopeSemanticHash: semanticIr.scopeSemanticHash,
    activeBindingRevisionId: sourceBinding.bindingRevisionId,
    activeSourceBindingPath: bindingPath,
    activeSourceBindingHash: sourceBinding.sourceBindingHash,
    activeAuthoringAttemptId: attemptId,
    activeBuildManifestPath: buildPath,
    activeBuildManifestHash: buildManifest.buildManifestHash,
  };
  const aggregate = {
    schemaVersion: 'requirements-contract-requirements-audit-aggregate/v2',
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    sourceBindingHash: sourceBinding.sourceBindingHash,
    buildManifestHash: buildManifest.buildManifestHash,
    providerSelectionHash: hash('5'),
    judgeRequestHash: hash('6'),
    judgeResponseHash: hash('7'),
    requirementsAuditAggregateHash: hash('8'),
    validatedDimensionIds: ['authority'],
    reviewedArtifactRefs: ['judge-audit-packet'],
    reviewedMustRefs: ['MUST-FR-001'],
    findings: [],
    issueCodes: [],
    decision: 'pass',
  };
  const effectivePass = compileRequirementsEffectivePassReceiptV2({
    activeAuthority,
    aggregate,
  });
  writeJson(recordRoot, 'quality/requirements-effective-pass-receipt.json', effectivePass);
  writeJson(recordRoot, 'record/requirement-record.json', {
    schemaVersion: 'requirements-contract-record/v1',
    recordId: requestId,
    lifecycle: 'audit_pending',
    confirmedScopeSemanticHash: null,
    activeAuthority,
  });
  writeJson(recordRoot, `authoring/staging/${attemptId}/authoring-context.json`, {
    schemaVersion: 'requirements-authoring-continuation-context/v1',
    authoringRequestId: requestId,
    authoringAttemptId: attemptId,
    confirmationLanguage: 'en-US',
    intakeSource: 'requirements.md',
    targetSource: 'docs/refund-requirements.md',
    authoritySourceListHash: hash('2'),
  });
  return { requestId, recordRoot, effectivePass };
}

describe('Requirements confirmation promotion', () => {
  it('renders, reads back and promotes once before exposing confirmation', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-promotion-'));
    try {
      const input = fixture(root);
      const first = renderAndPromoteRequirementsContractConfirmation({
        projectRoot: root,
        requestId: input.requestId,
      });
      const second = renderAndPromoteRequirementsContractConfirmation({
        projectRoot: root,
        requestId: input.requestId,
      });

      expect(first).toMatchObject({ status: 'user_confirmable', unresolvedDecisionCount: 0 });
      expect(second).toEqual(first);
      expect(readFileSync(path.join(root, 'docs', 'refund-requirements.md'), 'utf8')).toContain(
        'MUST-FR-001'
      );
      expect(first.confirmation.exactConfirmationText).toContain(input.requestId);
      expect(first.confirmation.markdownArtifactBytesHash).toBe(
        artifactBytesHash({
          role: 'final_markdown',
          mediaType: 'text/markdown',
          bytes: readFileSync(path.join(root, 'docs', 'refund-requirements.md')),
        })
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects unsafe request identities before resolving a requirement record path', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-promotion-'));
    try {
      expect(() =>
        confirmRequirementsContractIrScope({
          projectRoot: root,
          requestId: '../outside-record',
          exactConfirmationText: 'not-used',
        })
      ).toThrowError('requirements_confirmation_request_id_invalid');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires the current promotion evidence and EffectivePass at confirmation time', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-promotion-'));
    try {
      const input = fixture(root);
      const rendered = renderAndPromoteRequirementsContractConfirmation({
        projectRoot: root,
        requestId: input.requestId,
      });
      const recordPath = path.join(input.recordRoot, 'record', 'requirement-record.json');
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      delete record.currentPromotionEvidence;
      writeFileSync(recordPath, `${JSON.stringify(record)}\n`, 'utf8');
      expect(() =>
        confirmRequirementsContractIrScope({
          projectRoot: root,
          requestId: input.requestId,
          exactConfirmationText: rendered.confirmation.exactConfirmationText,
        })
      ).toThrowError('requirements_confirmation_promotion_evidence_missing');

      record.currentPromotionEvidence = {
        path: 'confirmation/confirmation-promotion-receipt.json',
        artifactBytesHash: rendered.confirmation.promotionArtifactBytesHash,
      };
      writeFileSync(recordPath, `${JSON.stringify(record)}\n`, 'utf8');
      unlinkSync(
        path.join(input.recordRoot, 'quality', 'requirements-effective-pass-receipt.json')
      );
      expect(() =>
        confirmRequirementsContractIrScope({
          projectRoot: root,
          requestId: input.requestId,
          exactConfirmationText: rendered.confirmation.exactConfirmationText,
        })
      ).toThrowError('requirements_confirmation_effective_pass_missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not confirm a record before the user-confirmable transition commits', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-promotion-'));
    try {
      const input = fixture(root);
      const rendered = renderAndPromoteRequirementsContractConfirmation({
        projectRoot: root,
        requestId: input.requestId,
      });
      const recordPath = path.join(input.recordRoot, 'record', 'requirement-record.json');
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      record.lifecycle = 'final_render_pending';
      writeFileSync(recordPath, `${JSON.stringify(record)}\n`, 'utf8');

      expect(() =>
        confirmRequirementsContractIrScope({
          projectRoot: root,
          requestId: input.requestId,
          exactConfirmationText: rendered.confirmation.exactConfirmationText,
        })
      ).toThrowError('requirements_confirmation_not_confirmable');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['final_markdown', 'docs/refund-requirements.md'],
    ['confirmation_html', 'docs/refund-requirements.html'],
  ])('rejects a stale %s page', (_role, relativePath) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-promotion-'));
    try {
      const input = fixture(root);
      const rendered = renderAndPromoteRequirementsContractConfirmation({
        projectRoot: root,
        requestId: input.requestId,
      });
      writeFileSync(path.join(root, ...relativePath.split('/')), 'stale page\n', 'utf8');

      expect(() =>
        confirmRequirementsContractIrScope({
          projectRoot: root,
          requestId: input.requestId,
          exactConfirmationText: rendered.confirmation.exactConfirmationText,
        })
      ).toThrowError('requirements_confirmation_page_stale');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
