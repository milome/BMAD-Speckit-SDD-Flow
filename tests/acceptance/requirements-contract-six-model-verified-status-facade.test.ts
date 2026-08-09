import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createRequirementsContractSixModelConsumerInventory,
  REQUIREMENTS_CONTRACT_SIX_MODEL_READER_ROLES,
  REQUIREMENTS_CONTRACT_SIX_MODEL_WRITER_ROLES,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-consumer-registry';
import { runRequirementsContractSixModelProjectionParityCase } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-six-model-projection-parity-case-runner';
import { resolveSixModelProjectionParitySurfaceFileSets } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-six-model-projection-parity-evidence-builder';
import {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionRecordPatch,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-status-decision-receipt';
import {
  resolveVerifiedSixModelPanorama,
  resolveVerifiedSixModelStatus,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/verified-six-model-status-facade';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

function authorityRecord() {
  const record = {
    recordId: 'REQ-FACADE',
    requirementSetId: 'REQSET-FACADE',
    currentAttemptId: 'IMP-CURRENT',
    sourceDocumentHash: hash('1'),
    implementationConfirmationHash: hash('2'),
    semanticModelHash: hash('3'),
    sixModelResults: {},
    runtimeStatusDecisionReceipts: [],
    artifactIndex: [],
  };
  const update = createRuntimeStatusProjectionUpdate({
    recordId: record.recordId,
    requirementSetId: record.requirementSetId,
    modelId: 'architecture_confirmation',
    implementationAttemptId: record.currentAttemptId,
    sourceDocumentHash: record.sourceDocumentHash,
    implementationConfirmationHash: record.implementationConfirmationHash,
    semanticModelHash: record.semanticModelHash,
    stageInputs: [{ role: 'page', path: 'evidence/page.json', hash: hash('4') }],
    deterministicGateOutputs: [{ role: 'gate', path: 'evidence/gate.json', hash: hash('5') }],
    blockerRefs: [],
    evidenceRefs: ['evidence/gate.json'],
    authorityClass: 'controlled_confirmation',
    decision: 'pass',
    effectiveStatus: 'pass',
    createdAt: '2026-07-15T00:00:00.000Z',
    receiptPath: 'evidence/status/architecture-confirmation.json',
    projection: { status: 'pass' },
  });
  const artifact = (
    artifactType: string,
    sourceOfTruthRole: 'control' | 'evidence',
    artifactPath: string,
    contentHash: string
  ) => ({
    artifactType,
    sourceOfTruthRole,
    recordId: record.recordId,
    requirementSetId: record.requirementSetId,
    path: artifactPath,
    contentHash,
    producer: 'requirements-contract-six-model-verified-status-facade.test',
    purpose: `Fixture authority for ${artifactPath}.`,
    relatedRequirementIds: [record.recordId],
    status: 'active',
    inputVersion: 'fixture/v1',
    outputVersion: 'fixture/v1',
  });
  return {
    ...record,
    ...runtimeStatusProjectionRecordPatch({
      record,
      modelId: 'architecture_confirmation',
      update,
    }),
    artifactIndex: [
      artifact(
        'runtime_status_decision_receipt',
        'control',
        update.receiptRef!.path,
        update.receiptRef!.receipt.receiptHash
      ),
      artifact('runtime_status_stage_input', 'evidence', 'evidence/page.json', hash('4')),
      artifact('runtime_status_gate_output', 'evidence', 'evidence/gate.json', hash('5')),
    ],
  };
}

describe('verified six-model status facade', () => {
  it('returns complete current-receipt authority and preserves fixed panorama order', () => {
    const record = authorityRecord();
    const status = resolveVerifiedSixModelStatus({
      record,
      modelId: 'architecture_confirmation',
      currentImplementationAttemptId: 'IMP-CURRENT',
    });

    expect(status).toMatchObject({
      effectiveStatus: 'pass',
      projectionStatus: 'pass',
      projectionIntegrity: 'valid',
      authorityClass: 'controlled_confirmation',
      currentAttemptId: 'IMP-CURRENT',
      blockerRefs: [],
      evidenceRefs: ['evidence/gate.json'],
    });
    expect(status.decisionReceiptRef).toBe('evidence/status/architecture-confirmation.json');
    expect(status.decisionReceiptHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(
      resolveVerifiedSixModelPanorama({
        record,
        currentImplementationAttemptId: 'IMP-CURRENT',
      }).map((entry) => entry.modelId)
    ).toEqual([
      'requirement_confirmation',
      'architecture_confirmation',
      'implementation_readiness',
      'execution_closure',
      'audit_review',
      'delivery_confirmation',
    ]);
  });

  it('fails closed for missing, stale, mismatched, and blocked authority', () => {
    const missing = authorityRecord();
    missing.runtimeStatusDecisionReceipts = [];
    expect(
      resolveVerifiedSixModelStatus({
        record: missing,
        modelId: 'architecture_confirmation',
        currentImplementationAttemptId: 'IMP-CURRENT',
      })
    ).toMatchObject({
      effectiveStatus: 'not_established',
      projectionIntegrity: 'missing',
      blockerRefs: ['runtime_status_decision_receipt_missing'],
    });

    const stale = authorityRecord();
    expect(
      resolveVerifiedSixModelStatus({
        record: stale,
        modelId: 'architecture_confirmation',
        currentImplementationAttemptId: 'IMP-NEW',
      })
    ).toMatchObject({
      effectiveStatus: 'stale',
      projectionIntegrity: 'stale',
      blockerRefs: expect.arrayContaining(['runtime_status_receipt_attempt_stale']),
    });

    const mismatch = authorityRecord();
    mismatch.sixModelResults.architecture_confirmation.status = 'blocked';
    expect(
      resolveVerifiedSixModelStatus({
        record: mismatch,
        modelId: 'architecture_confirmation',
        currentImplementationAttemptId: 'IMP-CURRENT',
      })
    ).toMatchObject({
      effectiveStatus: 'blocked',
      projectionIntegrity: 'mismatch',
      blockerRefs: expect.arrayContaining(['runtime_status_projection_decision_mismatch']),
    });
  });

  it('fails closed when canonical receipt or gate artifacts are absent or hash-mismatched', () => {
    const missingReceiptArtifact = authorityRecord();
    missingReceiptArtifact.artifactIndex = missingReceiptArtifact.artifactIndex.filter(
      (artifact) => artifact.artifactType !== 'runtime_status_decision_receipt'
    );
    expect(
      resolveVerifiedSixModelStatus({
        record: missingReceiptArtifact,
        modelId: 'architecture_confirmation',
        currentImplementationAttemptId: 'IMP-CURRENT',
      })
    ).toMatchObject({
      effectiveStatus: 'blocked',
      projectionIntegrity: 'invalid',
      blockerRefs: ['runtime_status_receipt_artifact_missing'],
    });

    const mismatchedGateArtifact = authorityRecord();
    const gateArtifact = mismatchedGateArtifact.artifactIndex.find(
      (artifact) => artifact.path === 'evidence/gate.json'
    );
    gateArtifact!.contentHash = hash('9');
    expect(
      resolveVerifiedSixModelStatus({
        record: mismatchedGateArtifact,
        modelId: 'architecture_confirmation',
        currentImplementationAttemptId: 'IMP-CURRENT',
      })
    ).toMatchObject({
      effectiveStatus: 'blocked',
      projectionIntegrity: 'invalid',
      blockerRefs: ['runtime_status_bound_artifact_hash_mismatch:evidence/gate.json'],
    });
  });

  it('executes the complete AMEND-07 parity case set against the real source authority core', () => {
    const runtimeCorePath = path.resolve(
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-status-authority-core.cjs'
    );
    const expected = {
      valid_receipt: ['pass', 'pass', 'valid', 'valid', 'controlled_confirmation'],
      missing_receipt: ['not_established', 'pass', 'missing', 'missing', 'none'],
      missing_projection: ['not_established', null, 'missing', 'valid', 'none'],
      projection_mismatch: ['blocked', 'blocked', 'mismatch', 'valid', 'controlled_confirmation'],
      stale_attempt: ['stale', 'pass', 'stale', 'stale', 'controlled_confirmation'],
      blocked_receipt: ['blocked', 'blocked', 'valid', 'blocked', 'deterministic_gate'],
      synthetic_bridge: ['not_established', 'not_established', 'missing', 'missing', 'none'],
      complete_panorama: ['not_established', null, 'missing', 'missing', 'none'],
    } as const;

    for (const [caseId, outcome] of Object.entries(expected)) {
      const observation = runRequirementsContractSixModelProjectionParityCase({
        runtimeCorePath,
        surface: 'source',
        caseId,
        contractHash: hash('6'),
        requirementSetId: 'REQSET-PARITY-CASE',
        implementationAttemptId: 'IMP-PARITY-CASE',
        observedAt: '2026-07-17T00:00:00.000Z',
      });

      expect(observation.outcome).toMatchObject({
        effectiveStatus: outcome[0],
        projectionStatus: outcome[1],
        projectionIntegrity: outcome[2],
        receiptState: outcome[3],
        authorityClass: outcome[4],
        syntheticBridgePass: false,
      });
    }

    const panorama = runRequirementsContractSixModelProjectionParityCase({
      runtimeCorePath,
      surface: 'source',
      caseId: 'complete_panorama',
      contractHash: hash('6'),
      requirementSetId: 'REQSET-PARITY-CASE',
      implementationAttemptId: 'IMP-PARITY-CASE',
      observedAt: '2026-07-17T00:00:00.000Z',
    });
    expect(panorama.outcome.panoramaModelOrder).toEqual([
      'requirement_confirmation',
      'architecture_confirmation',
      'implementation_readiness',
      'execution_closure',
      'audit_review',
      'delivery_confirmation',
    ]);
    expect(panorama.outcome.panoramaRowCount).toBe(6);
  });

  it('derives parity runtime record identity from the controlled command inputs', () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'six-model-parity-record-'));
    const runtimeCorePath = path.join(temporaryRoot, 'capture-runtime-core.cjs');
    const capturePath = path.join(temporaryRoot, 'captured-record.json');
    fs.writeFileSync(
      runtimeCorePath,
      [
        "const fs = require('node:fs');",
        'module.exports = {',
        '  resolveVerifiedSixModelStatus(input) {',
        "    fs.writeFileSync(process.env.BMAD_PARITY_RECORD_CAPTURE, JSON.stringify(input.record), 'utf8');",
        "    return { effectiveStatus: 'pass', projectionStatus: 'pass', projectionIntegrity: 'valid', authorityClass: 'controlled_confirmation' };",
        '  },',
        '  resolveVerifiedSixModelPanorama() { return []; },',
        '};',
        '',
      ].join('\n'),
      'utf8'
    );
    const previousCapture = process.env.BMAD_PARITY_RECORD_CAPTURE;
    process.env.BMAD_PARITY_RECORD_CAPTURE = capturePath;
    try {
      runRequirementsContractSixModelProjectionParityCase({
        runtimeCorePath,
        surface: 'source',
        caseId: 'valid_receipt',
        contractHash: hash('7'),
        requirementSetId: 'REQSET-PARITY-A',
        implementationAttemptId: 'IMP-PARITY-A',
        observedAt: '2026-07-17T00:00:00.000Z',
      });
      const first = JSON.parse(fs.readFileSync(capturePath, 'utf8')) as Record<string, string>;

      runRequirementsContractSixModelProjectionParityCase({
        runtimeCorePath,
        surface: 'source',
        caseId: 'valid_receipt',
        contractHash: hash('8'),
        requirementSetId: 'REQSET-PARITY-B',
        implementationAttemptId: 'IMP-PARITY-B',
        observedAt: '2026-07-17T00:00:01.000Z',
      });
      const second = JSON.parse(fs.readFileSync(capturePath, 'utf8')) as Record<string, string>;

      expect(first).toMatchObject({
        recordId: 'REQSET-PARITY-A',
        requirementSetId: 'REQSET-PARITY-A',
        currentAttemptId: 'IMP-PARITY-A',
        sourceDocumentHash: hash('7'),
      });
      expect(second).toMatchObject({
        recordId: 'REQSET-PARITY-B',
        requirementSetId: 'REQSET-PARITY-B',
        currentAttemptId: 'IMP-PARITY-B',
        sourceDocumentHash: hash('8'),
      });
      expect(first.implementationConfirmationHash).not.toBe(second.implementationConfirmationHash);
      expect(first.semanticModelHash).not.toBe(second.semanticModelHash);
    } finally {
      if (previousCapture === undefined) delete process.env.BMAD_PARITY_RECORD_CAPTURE;
      else process.env.BMAD_PARITY_RECORD_CAPTURE = previousCapture;
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it(
    'resolves generated-dist parity readers and writers from the dynamic consumer inventory',
    () => {
      const repositoryRoot = path.resolve('.');
      const packageRoot = path.join(repositoryRoot, 'packages', 'bmad-speckit');
      const inventory = createRequirementsContractSixModelConsumerInventory(repositoryRoot);
      const generatedDist = resolveSixModelProjectionParitySurfaceFileSets({
        repositoryRoot,
        packageRoot,
        installedRoot: path.join(repositoryRoot, '.unused-installed-root'),
        extractedRoot: path.join(repositoryRoot, '.unused-extracted-root'),
        tarball: path.join(repositoryRoot, '.unused-package.tgz'),
      })['generated-dist'];
      const generatedEntries = inventory.entries.filter(
        (entry) => entry.surface === 'package-dist'
      );
      const readerRoles = new Set(REQUIREMENTS_CONTRACT_SIX_MODEL_READER_ROLES);
      const writerRoles = new Set(REQUIREMENTS_CONTRACT_SIX_MODEL_WRITER_ROLES);
      const expectedReaders = generatedEntries
        .filter((entry) => entry.roles.some((role) => readerRoles.has(role)))
        .map((entry) => path.resolve(repositoryRoot, entry.path));
      const expectedWriters = generatedEntries
        .filter((entry) => entry.roles.some((role) => writerRoles.has(role)))
        .map((entry) => path.resolve(repositoryRoot, entry.path));

      expect(expectedReaders.length).toBeGreaterThan(2);
      expect(expectedWriters.length).toBeGreaterThan(1);
      expect(generatedDist.readerPaths).toEqual(expectedReaders);
      expect(generatedDist.writerPaths).toEqual(expectedWriters);
    },
    60_000
  );

  it('blocks canonical verification with an explicit reason when evidence generation fails', async () => {
    const failure = 'canonical parity generation failed';
    const buildEvidence = vi.fn(() => {
      throw new Error(failure);
    });
    vi.resetModules();
    vi.doMock(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-six-model-projection-parity-evidence-builder',
      async () => {
        const actual = await vi.importActual<
          typeof import('../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-six-model-projection-parity-evidence-builder')
        >(
          '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-six-model-projection-parity-evidence-builder'
        );
        return {
          ...actual,
          buildRequirementsContractSixModelProjectionParityEvidence: buildEvidence,
          isCanonicalSixModelProjectionParityEvidenceRoot: () => true,
        };
      }
    );
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'six-model-parity-verifier-'));
    const out = path.join(temporaryRoot, 'report.json');
    try {
      const { requirementsContractSixModelProjectionParityVerifyCommand } =
        await import('../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-six-model-projection-parity-verifier');
      const exitCode = requirementsContractSixModelProjectionParityVerifyCommand({
        evidenceRoot: path.resolve('docs/plans/evidence/loop-engineering-remediation'),
        out,
      });
      const report = JSON.parse(fs.readFileSync(out, 'utf8')) as {
        decision: string;
        blockingReasons: string[];
      };

      expect(buildEvidence).toHaveBeenCalledOnce();
      expect(exitCode).toBe(2);
      expect(report.decision).toBe('BLOCK');
      expect(report.blockingReasons).toContain(`canonical_evidence_build_failed:${failure}`);
    } finally {
      vi.doUnmock(
        '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-six-model-projection-parity-evidence-builder'
      );
      vi.resetModules();
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
