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
      {
        category: 'data_model',
        status: 'triggered',
        summary: 'schema changes require architecture confirmation',
      },
      { category: 'frontend_ux', status: 'not_triggered', summary: 'no UI change' },
    ],
    consumerImpactScanHash:
      'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    governanceImpactScan: [
      {
        category: 'orchestration_hook_gate_ingest_rerun_closeout',
        status: 'triggered',
        summary: 'readiness gate and controlled ingest are affected',
      },
    ],
    governanceImpactScanHash:
      'sha256:5555555555555555555555555555555555555555555555555555555555555555',
    fullArchitectureTriggerMatrix: [
      {
        trigger: 'shared_schema_or_contract_changed',
        decision: 'triggered',
        reason: 'record schema is affected',
      },
      {
        trigger: 'frontend_ux_changed',
        decision: 'not_triggered',
        reason: 'no user-facing UI change',
      },
    ],
    riskStatement: 'Fixture architecture risk statement.',
    rollbackPlan: 'Fixture rollback plan.',
    evidenceRefs: ['EVD-036', 'EVD-037'],
    staleInputs: {
      sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
      implementationConfirmationHash:
        'sha256:2222222222222222222222222222222222222222222222222222222222222222',
      targetPathsHash: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
      consumerImpactScanHash:
        'sha256:4444444444444444444444444444444444444444444444444444444444444444',
      governanceImpactScanHash:
        'sha256:5555555555555555555555555555555555555555555555555555555555555555',
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
    expect(html).toContain('id="architecture-delta"');
    expect(html).toContain('class="review-flow"');
    expect(html).toContain('class="review-step"');
    expect(html).toContain('本次架构确认重点');
    expect(html).toContain('重点影响行');
    expect(html).toContain('有效路径样例');
    expect(html).toContain('消费项目影响扫描');
    expect(html).toContain('治理系统影响扫描');
    expect(html).toContain('完整架构触发矩阵');
    expect(html).toContain('确认架构确认进入实施准备');
    expect(html).toContain('data-copy-target="architecture-confirmation-phrase"');
    expect(html).toContain('id="architecture-confirmation-phrase"');
    expect(html).toContain('复制确认口令');
    expect(html).toContain('data-copy-status');
    expect(html).toContain('--shadow:none');
    expect(html).toContain('main.layout{display:grid;grid-template-columns:280px minmax(0,1fr)');
    expect(html).toContain(
      '.hero,.card{background:transparent;border:0;border-top:1px solid var(--line);border-radius:0;box-shadow:none'
    );
    expect(html).toContain('counter-reset:arch-section');
    expect(html).toContain(
      '.card>h2::before,.section-title h2::before{counter-increment:arch-section'
    );
    expect(html).toContain(
      '.table-wrap{overflow-x:auto;overflow-y:auto;border:1px solid var(--line);border-radius:0;min-width:0;max-width:100%;scrollbar-gutter:stable;background:#fff}'
    );
    expect(html).toContain(
      '.table-wrap table{width:max-content;min-width:100%;border-collapse:collapse;background:#fff;table-layout:auto}'
    );
    const architectureDeltaSection = html.slice(
      html.indexOf('id="architecture-delta"'),
      html.indexOf('id="impact"')
    );
    expect(architectureDeltaSection).toContain('class="review-flow"');
    expect(architectureDeltaSection.match(/class="review-step"/g)?.length).toBeGreaterThanOrEqual(
      3
    );
    expect(architectureDeltaSection).not.toContain('class="grid"');
    const impactSection = html.slice(html.indexOf('id="impact"'), html.indexOf('id="triggers"'));
    expect(impactSection).toContain('class="review-flow"');
    expect(impactSection).not.toContain('class="grid"');

    const report = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'architecture-confirmation.render-report.json'), 'utf8')
    );
    expect(report.confirmability).toBe('confirmable');
    expect(report.htmlRef).toMatchObject({
      artifactType: 'architecture_confirmation_view',
      sourceOfTruthRole: 'projection',
    });
    expect(report.htmlRef.hash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(report.confirmInstruction).toContain('architectureConfirmationArtifactHash=sha256:');

    const summary = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'architecture-confirmation.summary.json'), 'utf8')
    );
    expect(summary.counts).toMatchObject({
      targetPaths: 2,
      consumerImpactScan: 2,
      governanceImpactScan: 1,
      fullArchitectureTriggerMatrix: 2,
    });
    expect(summary.architectureDelta.counts).toMatchObject({
      targetPaths: 2,
      triggeredConsumerImpacts: 1,
      triggeredGovernanceImpacts: 1,
      triggeredArchitectureRules: 1,
    });
    expect(summary.architectureDelta.reviewFocus.length).toBeGreaterThanOrEqual(3);
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
    const report = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'architecture-confirmation.render-report.json'), 'utf8')
    );
    expect(report.confirmability).toBe('blocked');
    expect(report.blockingIssues).toContain('architecture_confirmation_artifact_hash_mismatch');
  });

  it('uses the selected language for architecture confirmation labels', () => {
    const source = writeArchitectureConfirmation();
    const out = path.join(tempDir, 'architecture-confirmation-en.html');
    const result = runRenderer([
      '--architecture-confirmation',
      source,
      '--out',
      out,
      '--language',
      'en-US',
      '--json',
    ]);

    expect(result.status).toBe(0);
    const html = fs.readFileSync(out, 'utf8');
    expect(html).toContain('Architecture Confirmation Draft');
    expect(html).toContain('Architecture Review Focus');
    expect(html).toContain('Focus Rows');
    expect(html).toContain('Target Path Samples');
    expect(html).toContain('Consumer Impact Scan');
    expect(html).toContain('Governance Impact Scan');
    expect(html).toContain('Copy Confirmation Phrase');
    expect(html).not.toContain('本次架构确认重点');
    expect(html).not.toContain('重点影响行');
    expect(html).not.toContain('复制确认口令');
  });
});
