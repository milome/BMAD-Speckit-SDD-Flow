import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainIngestArchitectureConfirmation } from '../../scripts/ingest-architecture-confirmation';
import { resolveArchitectureConfirmationHashRecipe } from '../../scripts/architecture-confirmation-hash-recipe';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(',')}}`;
}

function sha256(content: string): string {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function writeFixture(root: string): {
  architecturePath: string;
  reportPath: string;
  recordPath: string;
  confirmationText: string;
} {
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-ARCH-INGEST');
  const architectureDir = path.join(base, 'architecture');
  mkdirSync(architectureDir, { recursive: true });
  const recipe = resolveArchitectureConfirmationHashRecipe();
  const recordPath = path.join(base, 'requirement-record.json');
  const architecturePath = path.join(architectureDir, 'architecture-confirmation.json');
  const reportPath = path.join(architectureDir, 'architecture-confirmation.render-report.json');
  const architecture = {
    schemaVersion: 'architecture-confirmation/v1',
    recordId: 'REQ-ARCH-INGEST',
    requirementSetId: 'REQ-ARCH-INGEST',
    runId: 'arch-run-001',
    status: 'draft',
    decision: 'full_architecture_confirmed',
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    architectureConfirmationHashRecipe: recipe,
    resolvedRecipeHash: recipe.resolvedRecipeHash,
    targetPaths: ['scripts/main-agent-orchestration.ts'],
    targetPathsHash: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    consumerImpactScan: [{ category: 'product_capability', status: 'triggered' }],
    consumerImpactScanHash: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
    governanceImpactScan: [
      { category: 'orchestration_hook_gate_ingest_rerun_closeout', status: 'triggered' },
    ],
    governanceImpactScanHash: 'sha256:6666666666666666666666666666666666666666666666666666666666666666',
  };
  const artifactHash = sha256(stableStringify(architecture));
  const confirmationText = [
    '确认架构确认进入实施准备',
    'sourceDocumentHash=sha256:1111111111111111111111111111111111111111111111111111111111111111',
    'implementationConfirmationHash=sha256:2222222222222222222222222222222222222222222222222222222222222222',
    `resolvedRecipeHash=${recipe.resolvedRecipeHash}`,
    `architectureConfirmationArtifactHash=${artifactHash}`,
  ].join('\n');
  const architectureWithHash = {
    ...architecture,
    artifactHash,
    architectureConfirmationArtifactHash: artifactHash,
    confirmationPhrase: confirmationText,
    architectureConfirmationArtifactRef: {
      artifactType: 'architecture_confirmation',
      sourceOfTruthRole: 'evidence',
      path: '_bmad-output/runtime/requirement-records/REQ-ARCH-INGEST/architecture/architecture-confirmation.json',
      hash: artifactHash,
      producer: 'architecture-confirmation-ingest.test',
      purpose: 'prove controlled architecture confirmation ingest behavior',
      relatedRequirementIds: ['MUST-035', 'MUST-036', 'MUST-037', 'EVD-036', 'EVD-037'],
      status: 'active',
      inputVersion: 'architecture-confirmation-fixture-v1',
      outputVersion: 'architecture-confirmation-v1',
    },
  };
  writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        recordId: 'REQ-ARCH-INGEST',
        requirementSetId: 'REQ-ARCH-INGEST',
        status: 'user_confirmed',
        sourceDocumentHash: architecture.sourceDocumentHash,
        implementationConfirmationHash: architecture.implementationConfirmationHash,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  writeFileSync(architecturePath, `${JSON.stringify(architectureWithHash, null, 2)}\n`, 'utf8');
  writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        recordId: 'REQ-ARCH-INGEST',
        runId: 'arch-run-001',
        confirmability: 'confirmable',
        sourceDocumentHash: architecture.sourceDocumentHash,
        implementationConfirmationHash: architecture.implementationConfirmationHash,
        resolvedRecipeHash: recipe.resolvedRecipeHash,
        architectureConfirmationArtifactHash: architectureWithHash.architectureConfirmationArtifactHash,
        htmlRef: {
          artifactType: 'architecture_confirmation_view',
          sourceOfTruthRole: 'projection',
          path: '_bmad-output/runtime/requirement-records/REQ-ARCH-INGEST/architecture/architecture-confirmation.html',
          hash: 'sha256:7777777777777777777777777777777777777777777777777777777777777777',
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return { architecturePath, reportPath, recordPath, confirmationText };
}

describe('architecture confirmation ingest', () => {
  it('records architecture confirmation through controlled ingest', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'arch-confirm-ingest-'));
    try {
      const fixture = writeFixture(root);
      const code = mainIngestArchitectureConfirmation([
        '--architecture-confirmation',
        fixture.architecturePath,
        '--render-report',
        fixture.reportPath,
        '--requirement-record',
        fixture.recordPath,
        '--confirmation-text',
        fixture.confirmationText,
        '--confirmed-by',
        'test-user',
        '--confirmed-at',
        '2026-05-19T00:00:00.000Z',
        '--json',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.lastEventType).toBe('architecture_confirmation_recorded');
      expect(record.architectureConfirmationState).toMatchObject({
        status: 'active',
        currentArchitectureConfirmationRunId: 'arch-run-001',
        currentArchitectureConfirmationHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      });
      expect(record.architectureConfirmations.at(-1)).toMatchObject({
        eventType: 'architecture_confirmation_recorded',
        confirmedBy: 'test-user',
        resolvedRecipeHash: resolveArchitectureConfirmationHashRecipe().resolvedRecipeHash,
      });
      expect(existsSync(path.join(path.dirname(fixture.recordPath), 'artifact-index.jsonl'))).toBe(
        true
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects stale architecture confirmation hashes without writing record state', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'arch-confirm-ingest-stale-'));
    try {
      const fixture = writeFixture(root);
      const before = readFileSync(fixture.recordPath, 'utf8');
      const badText = fixture.confirmationText.replace(
        /architectureConfirmationArtifactHash=sha256:[a-f0-9]{64}/u,
        'architectureConfirmationArtifactHash=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      );
      const code = mainIngestArchitectureConfirmation([
        '--architecture-confirmation',
        fixture.architecturePath,
        '--render-report',
        fixture.reportPath,
        '--requirement-record',
        fixture.recordPath,
        '--confirmation-text',
        badText,
        '--confirmed-by',
        'test-user',
      ]);
      expect(code).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports architecture confirmation state checks as diagnostic-only output', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'arch-confirm-state-check-'));
    try {
      const fixture = writeFixture(root);
      expect(
        mainIngestArchitectureConfirmation([
          '--architecture-confirmation',
          fixture.architecturePath,
          '--render-report',
          fixture.reportPath,
          '--requirement-record',
          fixture.recordPath,
          '--confirmation-text',
          fixture.confirmationText,
          '--confirmed-by',
          'test-user',
          '--confirmed-at',
          '2026-05-19T00:00:00.000Z',
        ])
      ).toBe(0);
      expect(
        mainIngestArchitectureConfirmation([
          '--action',
          'check-state',
          '--requirement-record',
          fixture.recordPath,
          '--confirmed-by',
          'test-agent',
          '--confirmed-at',
          '2026-05-19T00:00:01.000Z',
          '--json',
        ])
      ).toBe(0);
      const active = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(active.architectureConfirmationState.status).toBe('active');
      expect(active.architectureConfirmationStateChecks ?? []).toHaveLength(0);
      expect(active.lastEventType).toBe('architecture_confirmation_recorded');

      active.sourceDocumentHash = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      writeFileSync(fixture.recordPath, `${JSON.stringify(active, null, 2)}\n`, 'utf8');
      expect(
        mainIngestArchitectureConfirmation([
          '--action',
          'check-state',
          '--requirement-record',
          fixture.recordPath,
          '--confirmed-by',
          'test-agent',
          '--confirmed-at',
          '2026-05-19T00:00:02.000Z',
        ])
      ).toBe(1);
      const stale = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(stale.architectureConfirmationState.status).toBe('active');
      expect(stale.architectureConfirmationStateChecks ?? []).toHaveLength(0);
      expect(stale.gateChecks ?? []).toHaveLength(0);
      expect(stale.lastEventType).toBe('architecture_confirmation_recorded');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
