import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  architectureConfirmationHashFor,
  resolveArchitectureConfirmationHashRecipe,
} from '../../scripts/architecture-confirmation-hash-recipe';

const ROOT = process.cwd();
const SCRIPT = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'render-architecture-confirmation-html.ts'
);

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-confirm-html-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeArchitectureConfirmation(overrides: Record<string, unknown> = {}): string {
  const recipe = resolveArchitectureConfirmationHashRecipe();
  const file = path.join(tempDir, 'architecture-confirmation.json');
  const base: Record<string, unknown> = {
    schemaVersion: 'architecture-confirmation/v1',
    recordId: 'REQ-ARCH-HTML',
    requirementSetId: 'REQ-ARCH-HTML',
    runId: 'arch-confirm-test-001',
    status: 'draft',
    entryFlow: 'standalone_tasks',
    decision: 'full_architecture_confirmed',
    outcome: 'full_architecture_confirmed',
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    architectureConfirmationHashRecipe: recipe,
    resolvedRecipeHash: recipe.resolvedRecipeHash,
    targetPaths: [
      '_bmad/_schemas/requirement-record.schema.json',
      'scripts/main-agent-implementation-readiness-gate.ts',
    ],
    targetPathsHash: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    consumerImpactScan: [
      { category: 'data_model', status: 'triggered', summary: 'schema changes require architecture confirmation' },
      { category: 'frontend_ux', status: 'not_triggered', summary: 'no UI change' },
    ],
    consumerImpactScanHash: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    governanceImpactScan: [
      {
        category: 'orchestration_hook_gate_ingest_rerun_closeout',
        status: 'triggered',
        summary: 'readiness gate and controlled ingest are affected',
      },
    ],
    governanceImpactScanHash: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
    fullArchitectureTriggerMatrix: [
      { trigger: 'shared_schema_or_contract_changed', decision: 'triggered', reason: 'record schema is affected' },
      { trigger: 'frontend_ux_changed', decision: 'not_triggered', reason: 'no user-facing UI change' },
    ],
    riskStatement: 'Fixture architecture risk statement.',
    rollbackPlan: 'Fixture rollback plan.',
    evidenceRefs: ['EVD-036', 'EVD-037'],
    staleInputs: {
      sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
      implementationConfirmationHash:
        'sha256:2222222222222222222222222222222222222222222222222222222222222222',
      targetPathsHash: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
      consumerImpactScanHash: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
      governanceImpactScanHash: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
      resolvedRecipeHash: recipe.resolvedRecipeHash,
    },
    architectureConfirmationArtifactRef: {
      artifactType: 'architecture_confirmation',
      sourceOfTruthRole: 'evidence',
      path: '_bmad-output/runtime/requirement-records/REQ-ARCH-HTML/architecture/architecture-confirmation.json',
      producer: 'test',
      purpose: 'fixture',
      relatedRequirementIds: ['MUST-035', 'EVD-036'],
      status: 'active',
      inputVersion: 'fixture',
      outputVersion: 'architecture-confirmation-v1',
    },
    ...overrides,
  };
  const hash = architectureConfirmationHashFor(base, recipe);
  base.artifactHash = hash;
  base.architectureConfirmationArtifactHash = hash;
  base.confirmationPhrase = [
    '确认架构确认进入实施准备',
    `sourceDocumentHash=${base.sourceDocumentHash}`,
    `implementationConfirmationHash=${base.implementationConfirmationHash}`,
    `resolvedRecipeHash=${recipe.resolvedRecipeHash}`,
    `architectureConfirmationArtifactHash=${hash}`,
  ].join('\n');
  (base.architectureConfirmationArtifactRef as Record<string, unknown>).hash = hash;
  fs.writeFileSync(file, `${JSON.stringify(base, null, 2)}\n`, 'utf8');
  return file;
}

function runRenderer(args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

describe('render-architecture-confirmation-html', () => {
  it('renders a full architecture confirmation HTML projection and machine reports', () => {
    const source = writeArchitectureConfirmation();
    const out = path.join(tempDir, 'architecture-confirmation.html');
    const result = runRenderer([
      '--architecture-confirmation',
      source,
      '--out',
      out,
      '--language',
      'zh-CN',
      '--json',
    ]);

    expect(result.status).toBe(0);
    expect(fs.existsSync(out)).toBe(true);
    const html = fs.readFileSync(out, 'utf8');
    expect(html).toContain('REQ-ARCH-HTML 架构确认草案');
    expect(html).toContain('消费项目影响扫描');
    expect(html).toContain('治理系统影响扫描');
    expect(html).toContain('完整架构触发矩阵');
    expect(html).toContain('确认架构确认进入实施准备');

    const report = JSON.parse(fs.readFileSync(path.join(tempDir, 'architecture-confirmation.render-report.json'), 'utf8'));
    expect(report.confirmability).toBe('confirmable');
    expect(report.htmlRef).toMatchObject({
      artifactType: 'architecture_confirmation_view',
      sourceOfTruthRole: 'projection',
    });
    expect(report.htmlRef.hash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(report.confirmInstruction).toContain('architectureConfirmationArtifactHash=sha256:');

    const summary = JSON.parse(fs.readFileSync(path.join(tempDir, 'architecture-confirmation.summary.json'), 'utf8'));
    expect(summary.counts).toMatchObject({
      targetPaths: 2,
      consumerImpactScan: 2,
      governanceImpactScan: 1,
      fullArchitectureTriggerMatrix: 2,
    });
  });

  it('blocks when the architecture confirmation artifact hash is stale', () => {
    const source = writeArchitectureConfirmation();
    const stale = JSON.parse(fs.readFileSync(source, 'utf8')) as Record<string, unknown>;
    stale.architectureConfirmationArtifactHash =
      'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    stale.artifactHash = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    fs.writeFileSync(source, `${JSON.stringify(stale, null, 2)}\n`, 'utf8');
    const out = path.join(tempDir, 'architecture-confirmation.html');
    const result = runRenderer([
      '--architecture-confirmation',
      source,
      '--out',
      out,
      '--language',
      'zh-CN',
      '--json',
    ]);

    expect(result.status).toBe(1);
    const report = JSON.parse(fs.readFileSync(path.join(tempDir, 'architecture-confirmation.render-report.json'), 'utf8'));
    expect(report.confirmability).toBe('blocked');
    expect(report.blockingIssues).toContain('architecture_confirmation_artifact_hash_mismatch');
  });
});
