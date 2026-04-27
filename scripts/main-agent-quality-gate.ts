import fs from 'node:fs';
import path from 'node:path';

type Thresholds = {
  version: number;
  gateId: string;
  maxTodoStubs: number;
  maxForbiddenTodoMarkers: number;
  maxMissingKeyPaths: number;
  requiredKeyPaths: string[];
  requiredAcceptanceTests: string[];
  forbiddenTodoMarkers: string[];
};

type Check = {
  id: string;
  passed: boolean;
  summary: string;
};

const ROOT = process.cwd();
const THRESHOLDS_PATH = '_bmad/_config/main-agent-quality-gate.thresholds.json';
const EXPECTED_VERSION = 1;

function readThresholds(): Thresholds {
  const fullPath = path.join(ROOT, THRESHOLDS_PATH);
  const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as Thresholds;
  return parsed;
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function readIfExists(relativePath: string): string {
  const fullPath = path.join(ROOT, relativePath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
}

function buildChecks(thresholds: Thresholds): Check[] {
  const missingKeyPaths = thresholds.requiredKeyPaths.filter((item) => !exists(item));
  const missingAcceptanceTests = thresholds.requiredAcceptanceTests.filter((item) => !exists(item));
  const gateSource = readIfExists('scripts/main-agent-quality-gate.ts');
  const forbiddenMarkers = thresholds.forbiddenTodoMarkers.filter((marker) =>
    gateSource.includes(marker)
  );

  return [
    {
      id: 'threshold-version',
      passed: thresholds.version === EXPECTED_VERSION && thresholds.gateId === 'main-agent-quality-gate',
      summary: `threshold version=${thresholds.version}, gateId=${thresholds.gateId}`,
    },
    {
      id: 'missing-key-paths',
      passed: missingKeyPaths.length <= thresholds.maxMissingKeyPaths,
      summary:
        missingKeyPaths.length === 0
          ? 'all required key paths exist'
          : `missing key paths: ${missingKeyPaths.join(', ')}`,
    },
    {
      id: 'acceptance-coverage',
      passed: missingAcceptanceTests.length === 0,
      summary:
        missingAcceptanceTests.length === 0
          ? 'all required acceptance tests exist'
          : `missing acceptance tests: ${missingAcceptanceTests.join(', ')}`,
    },
    {
      id: 'todo-stub-markers',
      passed:
        forbiddenMarkers.length <= thresholds.maxForbiddenTodoMarkers &&
        forbiddenMarkers.length <= thresholds.maxTodoStubs,
      summary:
        forbiddenMarkers.length === 0
          ? 'no forbidden TODO stub markers found'
          : `forbidden markers: ${forbiddenMarkers.join(', ')}`,
    },
  ];
}

function main(): number {
  const thresholds = readThresholds();
  const checks = buildChecks(thresholds);
  const failed = checks.filter((check) => !check.passed);
  const report = {
    reportType: 'main_agent_quality_gate',
    thresholdsPath: THRESHOLDS_PATH,
    critical_failures: failed.length,
    checks,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failed.length > 0) {
    console.error('[main-agent-quality-gate] BLOCKED: quality thresholds failed');
    for (const check of failed) {
      console.error(`- ${check.id}: ${check.summary}`);
    }
    return 1;
  }
  return 0;
}

if (require.main === module) {
  process.exit(main());
}
