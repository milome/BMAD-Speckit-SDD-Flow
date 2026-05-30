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
  'generate-architecture-confirmation-artifact.ts'
);
const RENDERER = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'render-architecture-confirmation-html.ts'
);

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-confirm-producer-'));
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

function writeFixture() {
  const source = path.join(tempDir, 'source.md');
  const record = path.join(
    tempDir,
    '_bmad-output/runtime/requirement-records/REQ-FIXTURE/requirement-record.json'
  );
  const sourceHash = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const implementationHash =
    'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const block = `implementationConfirmation:
  contractSchemaVersion: 1
  status: user_confirmed
  recordId: REQ-FIXTURE
  requirementSetId: REQ-FIXTURE
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
    'REQ-FIXTURE',
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
  const updatedSource = fs
    .readFileSync(source, 'utf8')
    .replace(sourceHash, report.sourceDocumentHash)
    .replace(implementationHash, report.implementationConfirmationHash);
  fs.writeFileSync(source, updatedSource, 'utf8');
  fs.mkdirSync(path.dirname(record), { recursive: true });
  fs.writeFileSync(
    record,
    `${JSON.stringify(
      {
        recordId: 'REQ-FIXTURE',
        requirementSetId: 'REQ-FIXTURE',
        status: 'user_confirmed',
        sourceDocumentHash: report.sourceDocumentHash,
        implementationConfirmationHash: report.implementationConfirmationHash,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return { source, record };
}

const targetPaths = JSON.stringify(['scripts/main-agent-implementation-readiness-gate.ts']);
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

describe('generate-architecture-confirmation-artifact', () => {
  it('generates a requirement-scoped architecture confirmation JSON without mutating the requirement record', () => {
    const fixture = writeFixture();
    const beforeRecord = fs.readFileSync(fixture.record, 'utf8');
    const out = path.join(tempDir, 'architecture-confirmation.json');
    const result = runNode(SCRIPT, [
      '--source',
      fixture.source,
      '--requirement-record',
      fixture.record,
      '--out',
      out,
      '--run-id',
      'arch-fixture-001',
      '--target-paths',
      targetPaths,
      '--consumer-impact-scan',
      consumerImpactScan,
      '--governance-impact-scan',
      governanceImpactScan,
      '--full-architecture-trigger-matrix',
      triggerMatrix,
      '--json',
    ]);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(fs.readFileSync(fixture.record, 'utf8')).toBe(beforeRecord);
    const artifact = JSON.parse(fs.readFileSync(out, 'utf8'));
    const recipe = resolveArchitectureConfirmationHashRecipe();
    expect(artifact.recordId).toBe('REQ-FIXTURE');
    expect(artifact.architectureConfirmationArtifactHash).toBe(
      architectureConfirmationHashFor(artifact, recipe)
    );
    expect(artifact.confirmationPhrase).toContain('确认架构确认进入实施准备');

    const html = path.join(tempDir, 'architecture-confirmation.html');
    const render = runNode(RENDERER, [
      '--architecture-confirmation',
      out,
      '--out',
      html,
      '--language',
      'zh-CN',
      '--json',
    ]);
    expect(render.status, `${render.stdout}\n${render.stderr}`).toBe(0);
  });

  it('fails closed when impact scans or target paths are missing', () => {
    const fixture = writeFixture();
    const out = path.join(tempDir, 'architecture-confirmation.json');
    const result = runNode(SCRIPT, [
      '--source',
      fixture.source,
      '--requirement-record',
      fixture.record,
      '--out',
      out,
      '--run-id',
      'arch-fixture-002',
      '--target-paths',
      '[]',
      '--consumer-impact-scan',
      consumerImpactScan,
      '--governance-impact-scan',
      governanceImpactScan,
      '--full-architecture-trigger-matrix',
      triggerMatrix,
      '--json',
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('targetPaths must not be empty');
  });
});
