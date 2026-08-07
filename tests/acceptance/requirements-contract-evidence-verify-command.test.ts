import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { requirementsContractEvidenceVerifyCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-evidence-verify';
import { deriveRequirementsContractFrozenUniverseFromText } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-frozen-universe';

const sha256 = (value: string) =>
  `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;

const CONTRACT_PATH =
  'tests/acceptance/fixtures/requirements-contract-evidence-closure/frozen-universe-contract.md';
const ARTIFACT_FIELD_CONTRACT_PATH =
  'tests/acceptance/fixtures/requirements-contract-evidence-closure/artifact-field-contract.md';
const COMPLETION_SCHEMA_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-completion-evidence.schema.json';

function frozenArtifactFields(): string[] {
  const lines = readFileSync(ARTIFACT_FIELD_CONTRACT_PATH, 'utf8').split(/\r?\n/u);
  const artifactRow = lines.find((line) => line.startsWith('| ARTIFACT-01 |'));
  if (!artifactRow) throw new Error('artifact_01_contract_row_missing');
  const tableFields = [...(artifactRow.split('|')[4] ?? '').matchAll(/`([^`]+)`/gu)].map(
    (match) => match[1]
  );
  const overlayFields = lines
    .filter((line) => line.startsWith('- ARTIFACT-01 MUST bind'))
    .flatMap((line) => [...line.matchAll(/`([A-Za-z][A-Za-z0-9-]+)`/gu)].map((match) => match[1]));
  return [...new Set([...tableFields, ...overlayFields])];
}

function writeJson(root: string, relativePath: string, value: unknown) {
  const target = path.join(root, relativePath);
  const serialized = `${JSON.stringify(value)}\n`;
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, serialized, 'utf8');
  return { path: relativePath, hash: sha256(serialized), decision: 'PASS' };
}

function writeText(root: string, relativePath: string, value: string) {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
  return { path: relativePath, hash: sha256(value), decision: 'PASS' };
}

function addFrozenFields(root: string, bundle: Record<string, unknown>) {
  const frozenFields = frozenArtifactFields();
  for (const field of frozenFields) {
    if (field in bundle) continue;
    if (field === 'goalExecutionApplicability') {
      bundle[field] = 'required';
      continue;
    }
    if (/(Bytes|Lines)$/u.test(field)) {
      bundle[field] = 1;
      continue;
    }
    if (/Authority$/u.test(field)) {
      bundle[field] = `${field}-fixture`;
      continue;
    }
    if (field.endsWith('Path')) {
      const ref = writeJson(root, `bindings/${field}.json`, {
        schemaVersion: 'requirements-contract-test-binding/v1',
        field,
      });
      bundle[field] = ref.path;
      const hashField = `${field.slice(0, -4)}Hash`;
      if (frozenFields.includes(hashField)) bundle[hashField] = ref.hash;
      continue;
    }
    if (field.endsWith('Hash')) {
      bundle[field] = sha256(field);
      continue;
    }
    throw new Error(`unsupported_frozen_artifact_field:${field}`);
  }
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'requirements-evidence-verify-'));
  const contractText = readFileSync(CONTRACT_PATH, 'utf8');
  const universe = deriveRequirementsContractFrozenUniverseFromText(contractText);
  const contractRef = writeText(root, CONTRACT_PATH, contractText);
  const artifactIndex = universe.artifactIndexIds.map((artifactId) => ({
    artifactId,
    ...writeJson(root, `artifacts/${artifactId}.json`, {
      schemaVersion: 'requirements-contract-test-artifact/v1',
      decision: 'PASS',
    }),
  }));
  const evidenceIndex = universe.evidenceIds.map((evidenceId) => ({
    evidenceId,
    ...writeJson(root, `evidence/${evidenceId}.json`, {
      schemaVersion: 'requirements-contract-test-evidence/v1',
      decision: 'PASS',
    }),
  }));
  const bundle: Record<string, unknown> = {
    schemaVersion: 'requirements-contract-completion-evidence/v1',
    transactionId: `TX-${randomUUID()}`,
    implementationAttemptId: `IMP-${randomUUID()}`,
    auditAttemptId: `AUD-${randomUUID()}`,
    architectureAuditAttemptId: `AUD-${randomUUID()}`,
    preCandidateAuditAttemptId: `AUD-${randomUUID()}`,
    finalAuditAttemptId: `AUD-${randomUUID()}`,
    evidenceBundleId: `EVIDENCE-${randomUUID()}`,
    contractHash: contractRef.hash,
    sourcePlanHash: sha256('source'),
    sourceAmendmentHashes: universe.sourceAmendmentHashes,
    aggregateAmendmentHash: sha256('aggregate'),
    semanticModelHash: sha256('semantic'),
    sequenceContractHash: sha256('sequence'),
    closureReportHash: sha256('closure'),
    coverage: {
      storyIds: universe.sourceIds,
      acceptanceIds: universe.acceptanceIds,
      traceIds: universe.traceIds,
      commandIds: universe.commandIds,
    },
    criticalMetrics: {
      missingArtifactCount: 0,
      hashMismatchCount: 0,
      circularHashCount: 0,
      nonPassDecisionCount: 0,
    },
    evidenceIndex,
    artifactIndex,
  };
  const promotionReadbackRef = writeJson(
    root,
    'bindings/contract-promotion-readback-receipt.json',
    {
      schemaVersion: 'contract-promotion-readback-receipt/v1',
      amendmentId: universe.sourceAmendments.at(-1)?.amendmentId,
      decision: 'pass',
      targetPath: CONTRACT_PATH,
      expectedHash: contractRef.hash,
      observedHash: contractRef.hash,
      readbackVerified: true,
    }
  );
  bundle.contractPromotionReadbackReceiptPath = promotionReadbackRef.path;
  bundle.contractPromotionReadbackReceiptHash = promotionReadbackRef.hash;
  addFrozenFields(root, bundle);
  writeJson(root, 'implementation-evidence.json', bundle);
  return { root, bundle };
}

describe('requirements contract evidence verify command', () => {
  it('requires every frozen ARTIFACT-01 field declared by the contract', () => {
    const schema = JSON.parse(readFileSync(COMPLETION_SCHEMA_PATH, 'utf8'));
    const missingFields = frozenArtifactFields().filter(
      (field) => !schema.required.includes(field)
    );

    expect(missingFields).toEqual([]);
  });

  it('recomputes the complete frozen evidence universe without trusting declared hashes', async () => {
    const { root } = fixture();
    try {
      const receipt = await requirementsContractEvidenceVerifyCommand({
        cwd: root,
        bundle: 'implementation-evidence.json',
        json: false,
      });
      expect(receipt.decision).toBe('pass');
      expect(receipt.verifiedArtifactCount).toBe(2);
      expect(receipt.verifiedEvidenceCount).toBe(2);
      expect(receipt.coveredStoryCount).toBe(2);
      expect(receipt.coveredAcceptanceCount).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when a frozen ARTIFACT-01 overlay field is omitted', async () => {
    const { root, bundle } = fixture();
    try {
      delete bundle.stageFinalGateReportHash;
      writeJson(root, 'implementation-evidence.json', bundle);

      await expect(
        requirementsContractEvidenceVerifyCommand({
          cwd: root,
          bundle: 'implementation-evidence.json',
          json: false,
        })
      ).rejects.toThrow('evidence_verify_bundle_schema_invalid');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when an indexed artifact changes after bundle assembly', async () => {
    const { root } = fixture();
    try {
      writeFileSync(path.join(root, 'artifacts/ARTIFACT-02.json'), '{"decision":"PASS"}\n');
      await expect(
        requirementsContractEvidenceVerifyCommand({
          cwd: root,
          bundle: 'implementation-evidence.json',
          json: false,
        })
      ).rejects.toThrow('evidence_verify_hash_mismatch:ARTIFACT-02');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
