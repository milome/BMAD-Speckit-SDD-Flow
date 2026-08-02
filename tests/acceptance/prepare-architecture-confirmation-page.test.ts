import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRecordedConfirmationHistory } from './helpers/requirement-record-confirmation-fixture';

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

function copyPrepareScriptIntoInstallSurface(root: string): string {
  const source = fs.readFileSync(PREPARE, 'utf8');
  const script = path.join(
    root,
    '.codex',
    'skills',
    'requirements-contract-authoring',
    'scripts',
    'prepare-architecture-confirmation-page.ts'
  );
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.writeFileSync(script, source, 'utf8');
  return script;
}

function writeConfirmedFixture() {
  const source = path.join(tempDir, 'source.md');
  const record = path.join(
    tempDir,
    '_bmad-output/runtime/requirement-records/REQ-PREPARE/requirement-record.json'
  );
  const sourceHash = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const implementationHash =
    'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
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
  const report = JSON.parse(
    fs.readFileSync(path.join(tempDir, 'confirmation-render-report.json'), 'utf8')
  );
  fs.writeFileSync(
    source,
    fs
      .readFileSync(source, 'utf8')
      .replace(sourceHash, report.sourceDocumentHash)
      .replace(implementationHash, report.implementationConfirmationHash),
    'utf8'
  );
  fs.mkdirSync(path.dirname(record), { recursive: true });
  fs.writeFileSync(
    record,
    `${JSON.stringify(
      {
        schemaVersion: 'requirement-record/v1',
        recordId: 'REQ-PREPARE',
        requirementSetId: 'REQ-PREPARE',
        status: 'user_confirmed',
        sourcePath: source,
        sourceDocumentHash: report.sourceDocumentHash,
        implementationConfirmationHash: report.implementationConfirmationHash,
        confirmationPageHash: report.confirmationPageHash,
        latestConfirmationProjectionHash: report.confirmationPageHash,
        confirmationHistory: createRecordedConfirmationHistory({
          recordId: 'REQ-PREPARE',
          sourcePath: source,
          sourceDocumentHash: report.sourceDocumentHash,
          implementationConfirmationHash: report.implementationConfirmationHash,
          confirmationPageHash: report.confirmationPageHash,
          confirmedAt: '2026-05-20T00:00:00.000Z',
          confirmedBy: 'tester',
          renderReportPath: path.join(tempDir, 'confirmation-render-report.json'),
          htmlPath: htmlOut,
        }),
        architectureConfirmationState: {
          status: 'active',
          currentArchitectureConfirmationRunId: 'old-arch',
          currentArchitectureConfirmationHash:
            'sha256:1111111111111111111111111111111111111111111111111111111111111111',
          resolvedRecipeHash:
            'sha256:2222222222222222222222222222222222222222222222222222222222222222',
          staleInputs: {
            sourceDocumentHash:
              'sha256:9999999999999999999999999999999999999999999999999999999999999999',
            implementationConfirmationHash: report.implementationConfirmationHash,
            targetPathsHash:
              'sha256:3333333333333333333333333333333333333333333333333333333333333333',
            consumerImpactScanHash:
              'sha256:4444444444444444444444444444444444444444444444444444444444444444',
            governanceImpactScanHash:
              'sha256:5555555555555555555555555555555555555555555555555555555555555555',
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

const targetPaths = JSON.stringify(['src/product/display_settings_widget.py']);
const consumerImpactScan = JSON.stringify([
  { category: 'data_model', status: 'triggered', summary: 'fixture' },
]);
const governanceImpactScan = JSON.stringify([
  {
    category: 'orchestration_hook_gate_ingest_rerun_closeout',
    status: 'triggered',
    summary: 'fixture',
  },
]);
const triggerMatrix = JSON.stringify([
  { trigger: 'shared_schema_or_contract_changed', decision: 'triggered', reason: 'fixture' },
]);
const requiredArchitectureDiagramTypes = [
  'system_architecture',
  'deployment',
  'class',
  'swimlane',
  'state_machine',
  'sequence',
  'activity',
];

function writeZhLocalizationBundle(): string {
  const file = path.join(tempDir, 'architecture-localization.zh-CN.json');
  const mermaidFor = (type: string, scope: 'business' | 'governance') => {
    const noun = scope === 'business' ? '业务' : '治理';
    if (type === 'class') return `classDiagram\n  class Component\n  %% ${noun}组件`;
    if (type === 'state_machine') {
      return `stateDiagram-v2\n  state "${noun}输入" as Input\n  Input --> Output: ${noun}输出`;
    }
    if (type === 'sequence') {
      return `sequenceDiagram\n  participant A as ${noun}输入\n  participant B as ${noun}输出\n  A->>B: 提交`;
    }
    return `flowchart LR\n  输入["${noun}输入"] --> 输出["${noun}输出"]`;
  };
  const diagramProjection = (scope: 'business' | 'governance') =>
    requiredArchitectureDiagramTypes.map((type) => ({
      id:
        scope === 'business'
          ? `BUS-ARCH-VIEW-${type === 'system_architecture' ? 'SYSTEM' : type.replace('state_machine', 'STATE').toUpperCase()}`
          : `ARCH-VIEW-${type === 'system_architecture' ? 'SYSTEM' : type.replace('state_machine', 'STATE').toUpperCase()}`,
      title: `${scope === 'business' ? '业务' : '治理'}${type}架构图`,
      description: '由 authoring agent 提供的架构中文说明。',
      mermaid: mermaidFor(type, scope),
    }));
  fs.writeFileSync(
    file,
    `${JSON.stringify(
      {
        language: 'zh-CN',
        projectionSource: 'authoring_agent',
        decision: '完整架构待确认',
        outcome: '确认后进入实施准备',
        riskStatement: '错误的架构边界可能导致共享契约冲突。',
        rollbackPlan: '拒绝确认并重新生成需求范围内的架构工件。',
        consumerImpactScan: [
          {
            sourceCategory: 'data_model',
            category: '数据模型',
            status: '已触发',
            summary: '数据模型变更需要架构确认。',
            description: '共享数据契约将受到影响。',
            requiredDecision: '确认数据模型所有权和兼容边界。',
          },
        ],
        governanceImpactScan: [
          {
            sourceCategory: 'orchestration_hook_gate_ingest_rerun_closeout',
            category: '编排、门禁与受控写入',
            status: '已触发',
            summary: '实施准备门禁和受控写入路径受到影响。',
            description: '架构确认必须保持需求范围和 hash 绑定。',
            requiredDecision: '确认治理推进仍由受控事件驱动。',
          },
        ],
        fullArchitectureTriggerMatrix: [
          {
            sourceTrigger: 'shared_schema_or_contract_changed',
            trigger: '共享模式或契约发生变更',
            decision: '已触发',
            reason: '需求记录模式受到影响。',
            requiredDecision: '确认共享契约的兼容和回滚边界。',
          },
        ],
        businessArchitectureDiagrams: diagramProjection('business'),
        governanceArchitectureDiagrams: diagramProjection('governance'),
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return file;
}

describe('prepare-architecture-confirmation-page', () => {
  it('resolves nested packaged bmad-speckit dist scripts from npm tarball installs', () => {
    const installRoot = path.join(tempDir, 'consumer-install');
    const prepare = copyPrepareScriptIntoInstallSurface(installRoot);
    const nestedIngest = path.join(
      installRoot,
      'node_modules',
      'bmad-speckit-sdd-flow',
      'node_modules',
      'bmad-speckit',
      'dist',
      'main-agent',
      'source-authority',
      'scripts',
      'ingest-architecture-confirmation.js'
    );
    fs.mkdirSync(path.dirname(nestedIngest), { recursive: true });
    fs.writeFileSync(nestedIngest, 'module.exports = {};', 'utf8');

    const result = spawnSync(process.execPath, [prepare, '--help'], {
      cwd: installRoot,
      encoding: 'utf8',
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('Usage: node prepare-architecture-confirmation-page.ts');
  });

  it('automatically checks stale state, generates the architecture artifact, and renders user-facing HTML', () => {
    const fixture = writeConfirmedFixture();
    const out = path.join(
      tempDir,
      '_bmad-output/runtime/requirement-records/REQ-PREPARE/architecture/architecture-confirmation-run-001.html'
    );
    const localization = writeZhLocalizationBundle();
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
      '--localization',
      localization,
      '--out',
      out,
      '--json',
    ]);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.userFacingNextStep).toBe(
      'open_architecture_confirmation_html_and_confirm_hashes'
    );
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
    expect(output.internalSteps[0].receiptPath).toMatch(
      /events\/receipts\/architecture_confirmation_state_checked_.*\.json$/u
    );
    const prepareReport = JSON.parse(fs.readFileSync(output.prepareReportPath, 'utf8'));
    expect(prepareReport.userFacingNextStep).toBe(
      'open_architecture_confirmation_html_and_confirm_hashes'
    );
    expect(prepareReport.internalSteps[0].label).toBe('architecture_confirmation_state_checked');

    const record = JSON.parse(fs.readFileSync(fixture.record, 'utf8'));
    expect(record.architectureConfirmationStateChecks).toHaveLength(1);
    expect(record.architectureConfirmationStateChecks[0]).toMatchObject({
      eventType: 'architecture_confirmation_state_checked',
      decision: output.internalSteps[0].decision,
    });
    expect(['pass', 'fail', 'blocked']).toContain(
      record.architectureConfirmationStateChecks[0].decision
    );
    expect(record.controlStore.lastEventId).toContain('architecture_confirmation_state_checked');
    expect(record.architectureConfirmations ?? []).toHaveLength(0);
  });

  it('canonicalizes legacy runtime refs and architecture state before persisting the state check', () => {
    const fixture = writeConfirmedFixture();
    const localization = writeZhLocalizationBundle();
    const runtimePolicySnapshot = path.join(tempDir, 'runtime-policy-snapshot.json');
    fs.writeFileSync(runtimePolicySnapshot, '{"schemaVersion":"runtime-policy-snapshot/v1"}\n', 'utf8');
    const legacyRecord = JSON.parse(fs.readFileSync(fixture.record, 'utf8'));
    legacyRecord.runtimePolicySnapshotRef = { path: runtimePolicySnapshot };
    legacyRecord.architectureConfirmationState.reasonCode = 'legacy_missing_reason';
    fs.writeFileSync(fixture.record, `${JSON.stringify(legacyRecord, null, 2)}\n`, 'utf8');

    const result = runNode(PREPARE, [
      '--source',
      fixture.source,
      '--requirement-record',
      fixture.record,
      '--run-id',
      'run-legacy-record',
      '--target-paths',
      targetPaths,
      '--consumer-impact-scan',
      consumerImpactScan,
      '--governance-impact-scan',
      governanceImpactScan,
      '--full-architecture-trigger-matrix',
      triggerMatrix,
      '--localization',
      localization,
      '--out',
      path.join(tempDir, 'architecture-confirmation-legacy.html'),
      '--json',
    ]);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const record = JSON.parse(fs.readFileSync(fixture.record, 'utf8'));
    expect(record.runtimePolicySnapshotRef.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(record.architectureConfirmationState).not.toHaveProperty('reasonCode');
    expect(record.architectureConfirmationStateChecks).toHaveLength(1);
  });

  it('fails closed instead of rendering when required architecture inputs are missing', () => {
    const fixture = writeConfirmedFixture();
    const localization = writeZhLocalizationBundle();
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
      '--localization',
      localization,
      '--out',
      out,
      '--json',
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('targetPaths must not be empty');
    expect(fs.existsSync(out)).toBe(false);
  });
});
