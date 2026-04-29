#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

if (process.argv.includes('--pass')) {
  process.exit(0);
}

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(
  ROOT,
  '_bmad-output',
  'runtime',
  'gates',
  'ci-release-gate-fixtures'
);
const RUN_ID = 'ci-release-gate-fixture';
const STORY_KEY = 'S-release';
const EVIDENCE_BUNDLE_ID = 'ci-release-gate-fixture:bundle';
const FIXTURE_TIMESTAMP = '2026-04-30T00:00:00.000Z';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function shellQuote(value) {
  const text = String(value);
  if (process.platform === 'win32') {
    return `"${text.replace(/"/g, '\\"')}"`;
  }
  return `'${text.replace(/'/g, "'\\''")}'`;
}

function passCommand() {
  return `${shellQuote(process.execPath)} ${shellQuote(__filename)} --pass`;
}

function runNodeScript(scriptPath, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  const exitCode = result.status ?? (result.error ? 1 : 0);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

function writeReleaseGateFixtures() {
  const evidenceProvenance = {
    runId: RUN_ID,
    storyKey: STORY_KEY,
    evidenceBundleId: EVIDENCE_BUNDLE_ID,
    gateReportHash: 'ci-release-gate-fixture-hash',
  };
  const hostMatrixPath = path.join(OUTPUT_ROOT, 'host-matrix.json');
  const prTopologyPath = path.join(OUTPUT_ROOT, 'pr-topology.json');
  const qualityGatePath = path.join(OUTPUT_ROOT, 'quality-gate.json');
  const ledgerPath = path.join(OUTPUT_ROOT, 'ledger.json');
  const evidenceRef = path.join('evidence', 'T1.json');

  writeJson(hostMatrixPath, {
    journeyMode: 'real',
    journeyE2EPassed: true,
    hostsPassed: { claude: true, codex: true },
    hostMatrix: {
      matrixType: 'main_agent_multi_host_matrix',
      requiredHosts: ['cursor', 'claude', 'codex'],
      hostsPassed: { cursor: true, claude: true, codex: true },
      allRequiredHostsPassed: true,
      legacyDualHostPassed: true,
    },
    githubPrApi: { passed: true, prUrl: 'https://example.invalid/pull/ci-release-gate' },
    evidence_provenance: evidenceProvenance,
  });
  writeJson(prTopologyPath, {
    version: 1,
    batch_id: 'ci-release-gate-fixture',
    required_nodes: [
      {
        node_id: 'node-1',
        target_pr: 'https://example.invalid/pull/ci-release-gate',
        depends_on: '',
        state: 'merged',
      },
    ],
    all_affected_stories_passed: true,
    evidence_provenance: evidenceProvenance,
  });
  writeJson(qualityGatePath, {
    reportType: 'main_agent_quality_gate',
    critical_failures: 0,
    checks: [],
    evidence_provenance: evidenceProvenance,
  });
  writeJson(path.join(OUTPUT_ROOT, evidenceRef), { status: 'pass' });
  writeJson(ledgerPath, {
    version: 1,
    ledgerType: 'execution_audit',
    runId: RUN_ID,
    generatedAt: FIXTURE_TIMESTAMP,
    items: [
      {
        taskId: 'T1',
        status: 'pass',
        updatedAt: FIXTURE_TIMESTAMP,
        evidenceRefs: [evidenceRef],
      },
    ],
  });

  return { hostMatrixPath, prTopologyPath, qualityGatePath, ledgerPath };
}

function runReleaseGate(fixtures) {
  const tsNode = path.join(ROOT, 'node_modules', 'ts-node', 'dist', 'bin.js');
  const releaseGate = path.join(ROOT, 'scripts', 'main-agent-release-gate.ts');
  runNodeScript(tsNode, [
    '--project',
    'tsconfig.node.json',
    '--transpile-only',
    releaseGate,
    '--hostMatrixPath',
    fixtures.hostMatrixPath,
    '--prTopologyPath',
    fixtures.prTopologyPath,
    '--qualityGatePath',
    fixtures.qualityGatePath,
    '--ledgerPath',
    fixtures.ledgerPath,
    '--runId',
    RUN_ID,
    '--storyKey',
    STORY_KEY,
    '--evidenceBundleId',
    EVIDENCE_BUNDLE_ID,
    '--singleSourceCommand',
    passCommand(),
    '--rerunGateCommand',
    passCommand(),
    '--skipSprintStatusUpdate',
    'true',
  ]);
}

runNodeScript(path.join(ROOT, 'scripts', 'ensure-governance-user-story-mapping-fixture.js'));
runReleaseGate(writeReleaseGateFixtures());
