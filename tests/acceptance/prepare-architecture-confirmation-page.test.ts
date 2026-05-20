import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const PREPARE = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'prepare-architecture-confirmation-page.ts'
);

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-confirm-prepare-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function runNode(script: string, args: string[]) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function writeConfirmedFixture() {
  const source = path.join(tempDir, 'source.md');
  const record = path.join(tempDir, '_bmad-output/runtime/requirement-records/REQ-PREPARE/requirement-record.json');
  const sourceHash = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const implementationHash = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const block = `implementationConfirmation:
  contractSchemaVersion: 1
  status: user_confirmed
  recordId: REQ-PREPARE
  requirementSetId: REQ-PREPARE
  entryFlow: standalone_tasks
  entryFlowClass: task_packet_entry
  workflowAdapter: direct
  contractAuthoringRequired: true
  confirmationLanguage: zh-CN
  confirmedAt: '2026-05-20T00:00:00.000Z'
  confirmedBy: tester
  sourceDocumentHash: ${sourceHash}
  implementationConfirmationHash: ${implementationHash}
  must:
    - id: MUST-001
      text: fixture
      evidenceRefs: [EVD-001]
  evidence:
    - id: EVD-001
      text: fixture evidence
`;
  fs.writeFileSync(source, `# Fixture\n\n\`\`\`yaml\n${block}\`\`\`\n`, 'utf8');
  const renderer = path.join(
    ROOT,
    '_bmad',
    'skills',
    'requirements-contract-authoring',
    'scripts',
    'render-requirements-confirmation-html.ts'
  );
  const htmlOut = path.join(tempDir, 'confirmation.html');
  const render = runNode(renderer, [
    '--source',
    source,
    '--out',
    htmlOut,
    '--language',
    'zh-CN',
    '--record-id',
    'REQ-PREPARE',
    '--entry-flow',
    'standalone_tasks',
    '--strict',
    'false',
    '--json',
  ]);
  expect(render.status, `${render.stdout}\n${render.stderr}`).toBe(0);
  const report = JSON.parse(fs.readFileSync(path.join(tempDir, 'confirmation-render-report.json'), 'utf8'));
  fs.writeFileSync(
    source,
    fs.readFileSync(source, 'utf8')
      .replace(sourceHash, report.sourceDocumentHash)
      .replace(implementationHash, report.implementationConfirmationHash),
    'utf8'
  );
  fs.mkdirSync(path.dirname(record), { recursive: true });
  fs.writeFileSync(
    record,
    `${JSON.stringify(
      {
        recordId: 'REQ-PREPARE',
        requirementSetId: 'REQ-PREPARE',
        status: 'user_confirmed',
        sourceDocumentHash: report.sourceDocumentHash,
        implementationConfirmationHash: report.implementationConfirmationHash,
        architectureConfirmationState: {
          status: 'active',
          currentArchitectureConfirmationRunId: 'old-arch',
          currentArchitectureConfirmationHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
          resolvedRecipeHash: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
          staleInputs: {
            sourceDocumentHash: 'sha256:9999999999999999999999999999999999999999999999999999999999999999',
            implementationConfirmationHash: report.implementationConfirmationHash,
            targetPathsHash: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
            consumerImpactScanHash: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
            governanceImpactScanHash: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
          },
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return { source, record };
}

const targetPaths = JSON.stringify(['scripts/main-agent-implementation-readiness-gate.ts']);
const consumerImpactScan = JSON.stringify([{ category: 'data_model', status: 'triggered', summary: 'fixture' }]);
const governanceImpactScan = JSON.stringify([
  { category: 'orchestration_hook_gate_ingest_rerun_closeout', status: 'triggered', summary: 'fixture' },
]);
const triggerMatrix = JSON.stringify([{ trigger: 'shared_schema_or_contract_changed', decision: 'triggered', reason: 'fixture' }]);

describe('prepare-architecture-confirmation-page', () => {
  it('automatically checks stale state, generates the architecture artifact, and renders user-facing HTML', () => {
    const fixture = writeConfirmedFixture();
    const out = path.join(tempDir, '_bmad-output/runtime/requirement-records/REQ-PREPARE/architecture/architecture-confirmation-run-001.html');
    const result = runNode(PREPARE, [
      '--source',
      fixture.source,
      '--requirement-record',
      fixture.record,
      '--run-id',
      'run-001',
      '--target-paths',
      targetPaths,
      '--consumer-impact-scan',
      consumerImpactScan,
      '--governance-impact-scan',
      governanceImpactScan,
      '--full-architecture-trigger-matrix',
      triggerMatrix,
      '--out',
      out,
      '--json',
    ]);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.userFacingNextStep).toBe('open_architecture_confirmation_html_and_confirm_hashes');
    expect(output.internalSteps.map((step: { label: string }) => step.label)).toEqual([
      'architecture_confirmation_state_checked',
      'generate_architecture_confirmation_artifact',
      'render_architecture_confirmation_html',
    ]);
    expect(output.confirmInstruction).toContain('确认架构确认进入实施准备');
    expect(output.confirmInstruction).toContain('architectureConfirmationArtifactHash=sha256:');
    expect(fs.existsSync(output.architectureConfirmationPath)).toBe(true);
    expect(fs.existsSync(output.htmlPath)).toBe(true);
    expect(fs.existsSync(output.prepareReportPath)).toBe(true);

    expect(output.internalSteps[0]).toMatchObject({
      eventType: 'architecture_confirmation_state_checked',
    });
    expect(['pass', 'fail', 'blocked']).toContain(output.internalSteps[0].decision);
    const prepareReport = JSON.parse(fs.readFileSync(output.prepareReportPath, 'utf8'));
    expect(prepareReport.userFacingNextStep).toBe('open_architecture_confirmation_html_and_confirm_hashes');
    expect(prepareReport.internalSteps[0].label).toBe('architecture_confirmation_state_checked');

    const record = JSON.parse(fs.readFileSync(fixture.record, 'utf8'));
    expect(record.architectureConfirmationStateChecks.at(-1)).toMatchObject({
      eventType: 'architecture_confirmation_state_checked',
    });
    expect(record.architectureConfirmations).toBeUndefined();
  });

  it('fails closed instead of rendering when required architecture inputs are missing', () => {
    const fixture = writeConfirmedFixture();
    const out = path.join(tempDir, 'architecture-confirmation.html');
    const result = runNode(PREPARE, [
      '--source',
      fixture.source,
      '--requirement-record',
      fixture.record,
      '--run-id',
      'run-002',
      '--target-paths',
      '[]',
      '--consumer-impact-scan',
      consumerImpactScan,
      '--governance-impact-scan',
      governanceImpactScan,
      '--full-architecture-trigger-matrix',
      triggerMatrix,
      '--out',
      out,
      '--json',
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('targetPaths must not be empty');
    expect(fs.existsSync(out)).toBe(false);
  });
});
