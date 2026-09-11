import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';
import { resolveExecutionDisciplineProfile } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/execution-discipline-profiles';
import {
  confirmationHashes,
  type MaterializedReqTraceFixture,
} from './requirement-fixture-runtime';

export const QUARTET = [
  'model_packet.json',
  'human_prompt.txt',
  'audit_receipt.json',
  'goal_execution.md',
];
export const REAL_SOURCE = path.resolve(
  'packages/bmad-speckit/tests/fixtures/standalone-goal/real-source-plan-20260904.md'
);
const EVIDENCE = path.resolve(
  '.artifacts/standalone-goal-full-repair/run-2026-09-05T11-17-06-349Z'
);
const SCRIPT = path.resolve(
  '_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js'
);
export function hash(bytes: string | Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export function artifactHashes(outDir: string): Record<string, string> {
  return Object.fromEntries(
    QUARTET.map((name) => [name, hash(fs.readFileSync(path.join(outDir, name)))])
  );
}

export function generatorTimeoutMs(sourceBytes: number): number {
  if (!Number.isFinite(sourceBytes) || sourceBytes < 0) {
    throw new Error('req_trace_source_bytes_invalid');
  }
  return Math.max(120_000, Math.ceil(sourceBytes / (1024 * 1024)) * 120_000);
}

export function growSyntheticConfirmation(
  fixture: MaterializedReqTraceFixture,
  paddingBytes = 650 * 1024
): void {
  fs.appendFileSync(
    fixture.sourcePath,
    `\n<!-- test-only non-authoritative presentation padding ${'x'.repeat(paddingBytes)} -->\n`,
    'utf8'
  );
  // Legacy fixtures carry the source hash in both the record and its latest event.
  // Keep that bookkeeping current while preserving the semantic confirmation hash.
  const record = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8')) as {
    schemaVersion?: string;
    sourceDocumentHash?: string;
    confirmationHistory?: Array<Record<string, unknown>>;
  };
  if (record.schemaVersion === 'requirement-record/v1') {
    const hashes = confirmationHashes(fs.readFileSync(fixture.sourcePath, 'utf8'));
    record.sourceDocumentHash = hashes.sourceDocumentHash;
    const latest = record.confirmationHistory?.at(-1);
    if (latest) latest.sourceDocumentHash = hashes.sourceDocumentHash;
    fs.writeFileSync(fixture.recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  }
}

export function runGenerator(input: {
  label: string;
  entry: string;
  outDir: string;
  fixture?: MaterializedReqTraceFixture;
  sourcePath?: string;
  preload?: string;
  crashPoint?: string;
  contender?: boolean;
}) {
  const sourcePath = input.sourcePath ?? input.fixture!.sourcePath;
  const sourceBytes = fs.statSync(sourcePath).size;
  const args = [
    ...(input.preload ? ['--require', input.preload] : []),
    ...(input.crashPoint
      ? ['--require', path.resolve('tests/helpers/req-trace-publication-crash-worker.cjs')]
      : []),
    SCRIPT,
    '--entry',
    input.entry,
    '--source-document',
    sourcePath,
    '--out-dir',
    input.outDir,
    '--execution-host',
    'codex',
    '--goal-command-available',
    'true',
    '--task-report-path',
    path.join(path.dirname(input.outDir), 'task-report.json'),
    '--json',
  ];
  if (input.fixture) {
    const profilePath = path.join(input.fixture.root, 'test-only-discipline-profile.json');
    fs.writeFileSync(
      profilePath,
      JSON.stringify(resolveExecutionDisciplineProfile('standalone_tasks')),
      'utf8'
    );
    args.push(
      '--requirement-record',
      input.fixture.recordPath,
      '--execution-discipline-profile-ref',
      profilePath
    );
  }
  const result = spawnSync(process.execPath, args, {
    cwd: input.fixture?.root ?? process.cwd(),
    encoding: 'utf8',
    timeout: generatorTimeoutMs(sourceBytes),
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
    env: {
      ...process.env,
      REQ_TRACE_CRASH_ROOT: input.outDir,
      REQ_TRACE_CRASH_POINT: input.crashPoint ?? '',
      REQ_TRACE_CRASH_CONTENDER: String(input.contender === true),
    },
  });
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const runId = process.env.REQ_TRACE_BUDGET_RUN_ID ?? `${Date.now()}-${process.pid}`;
  const prefix = path.join(EVIDENCE, `req-trace-budget-${runId}-${input.label}`);
  fs.writeFileSync(`${prefix}.stdout.log`, result.stdout ?? '', 'utf8');
  fs.writeFileSync(`${prefix}.stderr.log`, result.stderr ?? '', 'utf8');
  const artifacts = QUARTET.filter((name) => fs.existsSync(path.join(input.outDir, name))).map(
    (name) => {
      const bytes = fs.readFileSync(path.join(input.outDir, name));
      return { name, bytes: bytes.length, hash: hash(bytes) };
    }
  );
  const auditPath = path.join(input.outDir, 'audit_receipt.json');
  const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : null;
  fs.writeFileSync(
    `${prefix}.receipt.json`,
    JSON.stringify(
      {
        testOnly: true,
        command: [process.execPath, ...args],
        sourceHash: hash(fs.readFileSync(sourcePath)),
        sourceBytes: fs.statSync(sourcePath).size,
        exitCode: result.status,
        signal: result.signal,
        error: result.error?.message ?? null,
        artifacts,
        auditDiagnostic: audit
          ? {
              decision: audit.decision,
              blockingReasons: audit.blockingReasons?.slice(0, 12),
              message: String(audit.message ?? '').slice(0, 8000),
            }
          : null,
        publicationLock: fs.existsSync(path.join(input.outDir, '.compiler-publication.lock'))
          ? JSON.parse(
              fs.readFileSync(path.join(input.outDir, '.compiler-publication.lock'), 'utf8')
            )
          : null,
        publication: fs.existsSync(input.outDir)
          ? fs
              .readdirSync(input.outDir)
              .filter((name) => name.startsWith('.compiler-publication-'))
              .map((name) => {
                const journalPath = path.join(input.outDir, name, 'journal.json');
                let journal: unknown = null;
                if (fs.existsSync(journalPath)) {
                  try {
                    journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
                  } catch {
                    journal = { invalidJson: true, hash: hash(fs.readFileSync(journalPath)) };
                  }
                }
                return {
                  name,
                  journal,
                  files: fs.readdirSync(path.dirname(journalPath)).map((file) => {
                    const bytes = fs.readFileSync(path.join(path.dirname(journalPath), file));
                    return { file, bytes: bytes.length, hash: hash(bytes) };
                  }),
                };
              })
          : [],
      },
      null,
      2
    ),
    'utf8'
  );
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}
