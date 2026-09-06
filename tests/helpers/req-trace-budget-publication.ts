import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { resolveExecutionDisciplineProfile } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/execution-discipline-profiles';
import { extractRequirementsContractImplementationConfirmation, implementationConfirmationHashFor,
  sourceDocumentHashFor } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-confirmation-codec';
import type { MaterializedReqTraceFixture } from './requirement-fixture-runtime';

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
const BOOKKEEPING = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

export function hash(bytes: string | Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stable(object[key])}`)
    .join(',')}}`;
}

export function artifactHashes(outDir: string): Record<string, string> {
  return Object.fromEntries(
    QUARTET.map((name) => [name, hash(fs.readFileSync(path.join(outDir, name)))])
  );
}

export function growSyntheticConfirmation(
  fixture: MaterializedReqTraceFixture, paddingBytes = 650 * 1024
): void {
  rewriteSyntheticConfirmation(fixture, (confirmation) => {
    const must = confirmation.must as Array<{ text: string }>;
    must[0].text = `TEST-ONLY BUDGET PADDING ${'x'.repeat(paddingBytes)}`;
  });
}

export function rewriteSyntheticConfirmation(
  fixture: MaterializedReqTraceFixture,
  mutate: (confirmation: Record<string, unknown>) => void
): void {
  const source = fs.readFileSync(fixture.sourcePath, 'utf8');
  const fencedBlock = source.match(/```yaml\r?\n([\s\S]*?)\r?\n```/u);
  const originalBlock = fencedBlock?.[1];
  if (!originalBlock) throw new Error('test_only_confirmation_fixture_missing');
  const parsed = yaml.load(originalBlock) as {
    implementationConfirmation: Record<string, unknown>;
  };
  const confirmation = parsed.implementationConfirmation;
  // This isolated test record is never evidence of human confirmation.
  mutate(confirmation);
  const block = yaml.dump(parsed, { lineWidth: -1 }).trimEnd();
  const nextSource = source.replace(confirmation.typedSourceAuthority ? fencedBlock![0] : originalBlock, block);
  const semantic = Object.fromEntries(
    Object.entries(confirmation).filter(([key]) => !BOOKKEEPING.has(key))
  );
  const canonical = confirmation.typedSourceAuthority
    ? extractRequirementsContractImplementationConfirmation(nextSource) : null;
  const hashes = canonical ? {
    sourceDocumentHash: sourceDocumentHashFor(nextSource, canonical.blockText, canonical.value),
    implementationConfirmationHash: implementationConfirmationHashFor(canonical.value),
  } : {
    sourceDocumentHash: hash(
      nextSource.replace(block, `implementationConfirmation:${stable(semantic)}`)
    ),
    implementationConfirmationHash: hash(stable(semantic)),
  };
  const record = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8'));
  Object.assign(record, hashes);
  record.confirmationHistory = record.confirmationHistory.map((event: Record<string, unknown>) => ({
    ...event,
    ...hashes,
  }));
  fs.writeFileSync(fixture.sourcePath, nextSource, 'utf8');
  fs.writeFileSync(fixture.recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
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
  const args = [
    ...(input.preload ? ['--require', input.preload] : []),
    ...(input.crashPoint ? ['--require', path.resolve('tests/helpers/req-trace-publication-crash-worker.cjs')] : []),
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
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, REQ_TRACE_CRASH_ROOT: input.outDir,
      REQ_TRACE_CRASH_POINT: input.crashPoint ?? '',
      REQ_TRACE_CRASH_CONTENDER: String(input.contender === true) },
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
        auditDiagnostic: audit ? { decision: audit.decision,
          blockingReasons: audit.blockingReasons?.slice(0, 12),
          message: String(audit.message ?? '').slice(0, 8000) } : null,
        publicationLock: fs.existsSync(path.join(input.outDir, '.compiler-publication.lock'))
          ? JSON.parse(fs.readFileSync(path.join(input.outDir, '.compiler-publication.lock'), 'utf8')) : null,
        publication: fs.existsSync(input.outDir) ? fs.readdirSync(input.outDir)
          .filter((name) => name.startsWith('.compiler-publication-'))
          .map((name) => {
            const journalPath = path.join(input.outDir, name, 'journal.json');
            let journal: unknown = null;
            if (fs.existsSync(journalPath)) {
              try { journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')); }
              catch { journal = { invalidJson: true, hash: hash(fs.readFileSync(journalPath)) }; }
            }
            return { name, journal, files: fs.readdirSync(path.dirname(journalPath)).map((file) => {
              const bytes = fs.readFileSync(path.join(path.dirname(journalPath), file));
              return { file, bytes: bytes.length, hash: hash(bytes) };
            }) };
          }) : [],
      },
      null,
      2
    ),
    'utf8'
  );
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}
