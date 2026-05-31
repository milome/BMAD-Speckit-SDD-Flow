import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const FIXTURE_PATH = join(
  ROOT,
  'tests',
  'fixtures',
  'requirements',
  'REQ-REQ-TRACE-AI-TDD-PACKET-COMPILER',
  'controlled-integration-extension.fixture.json'
);
const RECORD_RELATIVE_PATH =
  '_bmad-output/runtime/requirement-records/REQ-REQ-TRACE-AI-TDD-PACKET-COMPILER/requirement-record.json';
const ARTIFACT_RELATIVE_PATH =
  '_bmad-output/runtime/requirement-records/REQ-REQ-TRACE-AI-TDD-PACKET-COMPILER/artifacts/controlled-clarifications/execution-discipline-profile-ref-integration-extension.json';

const REQUIRED_FIELDS = [
  'schemaVersion',
  'recordId',
  'relatedPlanPath',
  'extensionId',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'confirmationPageHash',
  'authorityDecision',
  'allowedCompilerInput',
  'forbiddenEffects',
  'createdBy',
  'createdAt',
  'inputRefs',
  'contentHash',
] as const;

const REQUIRED_FORBIDDEN_EFFECTS = [
  'change_confirmed_source_hash',
  'change_implementation_confirmation_hash',
  'add_or_remove_must_trace_evd_acc_e2e_rows',
  'override_model_packet_authority',
  'override_required_commands',
  'write_requirement_record_directly',
  'advance_mental_model',
] as const;

let tempDir: string;

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(tempDir, relativePath), 'utf8')) as T;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function materializeFixtureRuntime(): void {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as {
    recordId: string;
    requirementSetId: string;
    recordHashes: {
      sourceDocumentHash: string;
      implementationConfirmationHash: string;
      confirmationPageHash: string;
    };
    artifact: Record<string, unknown>;
  };
  const record = {
    schemaVersion: 'requirement-record/v1',
    recordId: fixture.recordId,
    requirementSetId: fixture.requirementSetId,
    ...fixture.recordHashes,
    artifactIndex: [] as Array<Record<string, unknown>>,
    contractChecks: [
      {
        eventType: 'contract_check_recorded',
        contract: 'controlled_integration_extension',
        sourceRefs: [
          {
            sourceType: 'controlled_clarification_artifact',
            id: ARTIFACT_RELATIVE_PATH,
          },
        ],
      },
    ],
  };
  const artifact = { ...fixture.artifact };
  artifact.contentHash = sha256(stableStringify(artifact));
  record.artifactIndex.push({
    eventType: 'artifact_indexed',
    path: ARTIFACT_RELATIVE_PATH,
    contentHash: artifact.contentHash,
  });
  writeJson(join(tempDir, RECORD_RELATIVE_PATH), record);
  writeJson(join(tempDir, ARTIFACT_RELATIVE_PATH), artifact);
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'controlled-integration-extension-'));
  materializeFixtureRuntime();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('controlled integration extension contract', () => {
  it('records execution-discipline-profile-ref as a hash-bound controlled clarification', () => {
    expect(existsSync(join(tempDir, ARTIFACT_RELATIVE_PATH))).toBe(true);

    const record = readJson<Record<string, any>>(RECORD_RELATIVE_PATH);
    const artifact = readJson<Record<string, any>>(ARTIFACT_RELATIVE_PATH);

    for (const field of REQUIRED_FIELDS) expect(artifact[field], field).toBeDefined();

    expect(artifact.schemaVersion).toBe(
      'controlled-clarification/execution-discipline-profile-ref/v1'
    );
    expect(artifact.recordId).toBe('REQ-REQ-TRACE-AI-TDD-PACKET-COMPILER');
    expect(artifact.relatedPlanPath).toBe(
      'docs/plans/2026-05-26-main-agent-compiled-prompt-dispatch-integration-plan.md'
    );
    expect(artifact.extensionId).toBe('execution-discipline-profile-ref-integration-extension');
    expect(artifact.authorityDecision).toBe('discipline_profile_only');
    expect(artifact.allowedCompilerInput).toBe('--execution-discipline-profile-ref');

    expect(artifact.sourceDocumentHash).toBe(record.sourceDocumentHash);
    expect(artifact.implementationConfirmationHash).toBe(record.implementationConfirmationHash);
    expect(artifact.confirmationPageHash).toBe(record.confirmationPageHash);

    for (const effect of REQUIRED_FORBIDDEN_EFFECTS) {
      expect(artifact.forbiddenEffects).toContain(effect);
    }

    const withoutContentHash = { ...artifact };
    delete withoutContentHash.contentHash;
    expect(artifact.contentHash).toBe(sha256(stableStringify(withoutContentHash)));

    const contractCheckLinked = (
      Array.isArray(record.contractChecks) ? record.contractChecks : []
    ).some(
      (check: Record<string, any>) =>
        check.eventType === 'contract_check_recorded' &&
        check.contract === 'controlled_integration_extension' &&
        (Array.isArray(check.sourceRefs) ? check.sourceRefs : []).some(
          (ref: Record<string, unknown>) =>
            ref.sourceType === 'controlled_clarification_artifact' &&
            ref.id === ARTIFACT_RELATIVE_PATH
        )
    );
    const artifactIndexLinked = [
      ...(Array.isArray(record.artifactIndex) ? record.artifactIndex : []),
      ...(Array.isArray(record.extensionRefs) ? record.extensionRefs : []),
    ].some(
      (ref: Record<string, unknown>) =>
        ref.eventType === 'artifact_indexed' &&
        ref.path === ARTIFACT_RELATIVE_PATH &&
        ref.contentHash === artifact.contentHash
    );

    expect(contractCheckLinked || artifactIndexLinked).toBe(true);
  });
});
