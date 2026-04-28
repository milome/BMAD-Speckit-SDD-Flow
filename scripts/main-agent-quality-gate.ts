import fs from 'node:fs';
import path from 'node:path';
import { buildEvidenceProvenance, sha256 } from './evidence-provenance';

type Thresholds = {
  version: number;
  gateId: string;
  maxTodoStubs: number;
  maxForbiddenTodoMarkers: number;
  maxMissingKeyPaths: number;
  requiredKeyPaths: string[];
  requiredAcceptanceTests: string[];
  requiredCodexProofPaths?: string[];
  forbiddenTodoMarkers: string[];
};

interface QualityGateCliOptions {
  runId?: string;
  storyKey?: string;
  evidenceBundleId?: string;
  codexProofPath?: string;
}

type Check = {
  id: string;
  passed: boolean;
  summary: string;
};

const ROOT = process.cwd();
const SOURCE_ROOT = path.resolve(__dirname, '..');
const THRESHOLDS_PATH = '_bmad/_config/main-agent-quality-gate.thresholds.json';
const EXPECTED_VERSION = 1;

function parseArgs(argv: string[]): QualityGateCliOptions {
  const out: QualityGateCliOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith('--') && argv[index + 1]) {
      out[token.slice(2) as keyof QualityGateCliOptions] = argv[++index];
    }
  }
  return out;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function readThresholds(): Thresholds {
  const fullPath = path.join(SOURCE_ROOT, THRESHOLDS_PATH);
  const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as Thresholds;
  return parsed;
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(SOURCE_ROOT, relativePath));
}

function readIfExists(relativePath: string): string {
  const fullPath = path.join(SOURCE_ROOT, relativePath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function resolvePath(raw: string | undefined): string | null {
  const normalized = normalizeText(raw);
  if (!normalized) {
    return null;
  }
  return path.isAbsolute(normalized) ? normalized : path.resolve(ROOT, normalized);
}

function buildRunScopedCodexProofCheck(args: QualityGateCliOptions): Check | null {
  const runId = normalizeText(args.runId);
  const storyKey = normalizeText(args.storyKey);
  const evidenceBundleId = normalizeText(args.evidenceBundleId);
  const proofPath = resolvePath(args.codexProofPath);
  if (!runId && !storyKey && !evidenceBundleId && !proofPath) {
    return null;
  }
  if (!runId || !storyKey || !evidenceBundleId || !proofPath) {
    return {
      id: 'codex-run-scoped-proof',
      passed: false,
      summary:
        'run-scoped Codex proof requires --runId, --storyKey, --evidenceBundleId, and --codexProofPath',
    };
  }
  if (!fs.existsSync(proofPath)) {
    return {
      id: 'codex-run-scoped-proof',
      passed: false,
      summary: `missing Codex run-scoped proof: ${proofPath}`,
    };
  }
  try {
    const proof = readJsonFile<{
      reportType?: string;
      evidence_provenance?: {
        runId?: string;
        storyKey?: string;
        evidenceBundleId?: string;
      };
      codex?: {
        hostKind?: string;
        mode?: string;
        taskReportStatus?: string;
        validationsRun?: string[];
      };
    }>(proofPath);
    const provenance = proof.evidence_provenance;
    const mismatches = [
      provenance?.runId === runId ? null : `runId=${provenance?.runId ?? 'missing'}`,
      provenance?.storyKey === storyKey ? null : `storyKey=${provenance?.storyKey ?? 'missing'}`,
      provenance?.evidenceBundleId === evidenceBundleId
        ? null
        : `evidenceBundleId=${provenance?.evidenceBundleId ?? 'missing'}`,
      proof.codex?.hostKind === 'codex' ? null : `hostKind=${proof.codex?.hostKind ?? 'missing'}`,
      proof.codex?.mode === 'codex_exec' ? null : `mode=${proof.codex?.mode ?? 'missing'}`,
      proof.codex?.taskReportStatus === 'done'
        ? null
        : `taskReportStatus=${proof.codex?.taskReportStatus ?? 'missing'}`,
    ].filter((item): item is string => item !== null);
    return {
      id: 'codex-run-scoped-proof',
      passed: mismatches.length === 0,
      summary:
        mismatches.length === 0
          ? `runId=${runId}, storyKey=${storyKey}, evidenceBundleId=${evidenceBundleId}, proof=${path.relative(ROOT, proofPath)}`
          : `Codex run-scoped proof mismatch: ${mismatches.join(', ')}`,
    };
  } catch (error) {
    return {
      id: 'codex-run-scoped-proof',
      passed: false,
      summary: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildChecks(thresholds: Thresholds, args: QualityGateCliOptions): Check[] {
  const missingKeyPaths = thresholds.requiredKeyPaths.filter((item) => !exists(item));
  const missingAcceptanceTests = thresholds.requiredAcceptanceTests.filter((item) => !exists(item));
  const missingCodexProofs = (thresholds.requiredCodexProofPaths ?? []).filter((item) => !exists(item));
  const gateSource = readIfExists('scripts/main-agent-quality-gate.ts');
  const forbiddenMarkers = thresholds.forbiddenTodoMarkers.filter((marker) =>
    gateSource.includes(marker)
  );

  const checks: Check[] = [
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
      id: 'codex-parity-proof-artifacts',
      passed: missingCodexProofs.length === 0,
      summary:
        missingCodexProofs.length === 0
          ? 'all required Codex proof artifacts exist'
          : `missing Codex proof artifacts: ${missingCodexProofs.join(', ')}`,
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
  const runScopedCodexProof = buildRunScopedCodexProofCheck(args);
  if (runScopedCodexProof) {
    checks.push(runScopedCodexProof);
  }
  return checks;
}

function main(argv = process.argv.slice(2)): number {
  const args = parseArgs(argv);
  const thresholds = readThresholds();
  const checks = buildChecks(thresholds, args);
  const failed = checks.filter((check) => !check.passed);
  const evidence_provenance = buildEvidenceProvenance({
    root: SOURCE_ROOT,
    runId: args.runId,
    storyKey: args.storyKey,
    evidenceBundleId: args.evidenceBundleId,
    prefix: 'quality-gate',
  });
  const report = {
    reportType: 'main_agent_quality_gate',
    thresholdsPath: THRESHOLDS_PATH,
    evidence_provenance,
    critical_failures: failed.length,
    checks,
  };
  report.evidence_provenance = {
    ...report.evidence_provenance,
    gateReportHash: sha256(
      JSON.stringify({
        thresholdsPath: report.thresholdsPath,
        critical_failures: report.critical_failures,
        checks: report.checks,
      })
    ),
  };
  const reportPath = path.join(
    ROOT,
    '_bmad-output',
    'runtime',
    'gates',
    'main-agent-quality-gate-report.json'
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

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
