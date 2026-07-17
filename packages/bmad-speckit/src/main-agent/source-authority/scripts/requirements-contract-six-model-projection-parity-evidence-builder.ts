import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  canonicalSixModelParityJson,
  produceRequirementsContractSixModelProjectionParityObservation,
  SIX_MODEL_PARITY_AUTHORITY_SCHEMA_VERSION,
  SIX_MODEL_PARITY_CASE_PRODUCER,
  SIX_MODEL_PARITY_CASES,
  SIX_MODEL_PARITY_MODEL_ORDER,
  SIX_MODEL_PARITY_OBSERVATION_ACTION,
  SIX_MODEL_PARITY_OBSERVATION_PRODUCER,
  SIX_MODEL_PARITY_SURFACES,
  sixModelParityHash,
} from './requirements-contract-six-model-projection-parity-observation-producer';

type JsonRecord = Record<string, unknown>;
type ParitySurface = (typeof SIX_MODEL_PARITY_SURFACES)[number];

interface AttemptContext {
  transactionId: string;
  requirementSetId: string;
  implementationAttemptId: string;
  architectureAuditAttemptId: string;
  contractHash: string;
  sourcePath: string;
  createdAt: string;
}

interface CommandBinding {
  commandId: string;
  acceptanceRefs: string[];
  traceRefs: string[];
  argvPrefix: string[];
  cwd: string;
  executorIdentity: {
    class: 'goal_controlled_executor';
    id: string;
  };
}

interface SourceFileSet {
  artifactPath: string;
  runtimeCorePath: string;
  runtimeSchemaPath: string;
  readerPaths: string[];
  writerPaths: string[];
}

interface SurfaceSnapshot {
  surface: ParitySurface;
  runtimeCorePath: string;
  cell: JsonRecord;
}

export interface BuildRequirementsContractSixModelProjectionParityEvidenceOptions {
  evidenceRoot: string;
  repositoryRoot?: string;
  contractPath?: string;
  attemptContextPath?: string;
}

export interface BuildRequirementsContractSixModelProjectionParityEvidenceResult {
  authorityPath: string;
  authorityHash: string;
  runId: string;
  runRoot: string;
  transactionId: string;
  requirementSetId: string;
  implementationAttemptId: string;
  architectureAuditAttemptId: string;
  inputSnapshotHash: string;
  observationPaths: string[];
}

const CONTRACT_RELATIVE_PATH =
  'docs/plans/2026-07-11-loop-engineering-evidence-closure-remediation-goal-execution-plan.md';
const EVIDENCE_RELATIVE_PATH = 'docs/plans/evidence/loop-engineering-remediation';
const RUNTIME_STATUS_SCHEMA =
  'requirements-contract-runtime-status-decision-receipt.schema.json';
const MAX_BUFFER = 64 * 1024 * 1024;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const ID_PATTERNS = {
  transactionId: /^TX-[A-Za-z0-9._-]+$/u,
  implementationAttemptId: /^[A-Za-z0-9._-]+$/u,
  architectureAuditAttemptId: /^AUDIT-[A-Za-z0-9._-]+$/u,
};

function object(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sha256(value: Buffer | string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function slash(value: string): string {
  return value.replace(/\\/gu, '/');
}

function requireFile(target: string, label: string): string {
  const resolved = path.resolve(target);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`${label} is missing: ${resolved}`);
  }
  return resolved;
}

function readJson(target: string, label: string): JsonRecord {
  try {
    return object(JSON.parse(fs.readFileSync(target, 'utf8')));
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function writeBytesAtomic(target: string, bytes: Buffer, replace = false): string {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!replace && fs.existsSync(target)) throw new Error(`create-only target exists: ${target}`);
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
  );
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    if (replace && fs.existsSync(target)) {
      const backup = `${target}.backup-${process.pid}-${Date.now()}`;
      fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
    }
    fs.renameSync(temporary, target);
    const readback = fs.readFileSync(target);
    if (!readback.equals(bytes)) throw new Error(`atomic write readback mismatch: ${target}`);
    return sha256(readback);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

function writeJsonAtomic(target: string, value: unknown, replace = false): string {
  return writeBytesAtomic(target, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'), replace);
}

function relativePath(root: string, target: string): string {
  return slash(path.relative(path.resolve(root), path.resolve(target)));
}

function fileRef(root: string, target: string): JsonRecord {
  const bytes = fs.readFileSync(target);
  const hash = sha256(bytes);
  const readbackHash = sha256(fs.readFileSync(target));
  return {
    path: relativePath(root, target),
    hash,
    readbackHash,
    readbackVerified: hash === readbackHash,
  };
}

function walkFiles(root: string, fileName: string): string[] {
  if (!fs.existsSync(root)) return [];
  const results: string[] = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile() && entry.name === fileName) results.push(target);
    }
  }
  return results;
}

function validAttemptContext(
  value: JsonRecord,
  sourcePath: string,
  contractHash: string,
  contractPath: string,
  repositoryRoot: string
): AttemptContext | null {
  const transactionId = text(value.transactionId);
  const requirementSetId = text(value.requirementSetId);
  const implementationAttemptId = text(value.implementationAttemptId);
  const architectureAuditAttemptId =
    text(value.architectureAuditAttemptId) || text(value.auditAttemptId);
  const candidateContractHash = text(value.contractHash);
  const candidateContractPath = text(value.contractPath);
  const resolvedCandidateContractPath = path.isAbsolute(candidateContractPath)
    ? path.resolve(candidateContractPath)
    : path.resolve(repositoryRoot, candidateContractPath);
  const createdAt = text(value.createdAt);
  if (
    candidateContractHash !== contractHash ||
    resolvedCandidateContractPath !== path.resolve(contractPath) ||
    !ID_PATTERNS.transactionId.test(transactionId) ||
    !requirementSetId ||
    !ID_PATTERNS.implementationAttemptId.test(implementationAttemptId) ||
    !ID_PATTERNS.architectureAuditAttemptId.test(architectureAuditAttemptId) ||
    !Number.isFinite(new Date(createdAt).getTime())
  ) {
    return null;
  }
  return {
    transactionId,
    requirementSetId,
    implementationAttemptId,
    architectureAuditAttemptId,
    contractHash,
    sourcePath,
    createdAt,
  };
}

function resolveAttemptContext(input: {
  evidenceRoot: string;
  contractHash: string;
  contractPath: string;
  repositoryRoot: string;
  explicitPath?: string;
}): AttemptContext {
  const candidates = input.explicitPath
    ? [requireFile(input.explicitPath, 'attempt context')]
    : walkFiles(path.join(input.evidenceRoot, 'attempts'), 'pre-edit-attempt-context-receipt.json');
  const valid = candidates
    .map((candidate) =>
      validAttemptContext(
        readJson(candidate, 'attempt context'),
        candidate,
        input.contractHash,
        input.contractPath,
        input.repositoryRoot
      )
    )
    .filter((candidate): candidate is AttemptContext => candidate !== null)
    .sort((left, right) => {
      const timeDifference =
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      return timeDifference || right.sourcePath.localeCompare(left.sourcePath);
    });
  if (valid.length === 0) {
    throw new Error('current contract attempt context is missing');
  }
  return valid[0];
}

function commandCells(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function deriveCommandBinding(input: {
  contractPath: string;
  repositoryRoot: string;
  caseRunnerPath: string;
  executorId: string;
}): CommandBinding {
  const lines = fs.readFileSync(input.contractPath, 'utf8').split(/\r?\n/u);
  const commandLine = lines.find((line) => /^\| CMD-31 \|/u.test(line));
  if (!commandLine) throw new Error('CMD-31 contract row is missing');
  const cells = commandCells(commandLine);
  const acceptanceRefs = Array.from(new Set(cells.at(-1)?.match(/AC-\d+/gu) ?? []));
  const traceRefs = lines
    .filter(
      (line) =>
        /^\| TR-\d+ \|/u.test(line) &&
        line.includes('| CMD-31 |') &&
        line.includes('ARTIFACT-45')
    )
    .map((line) => commandCells(line)[0]);
  if (acceptanceRefs.length === 0 || traceRefs.length === 0) {
    throw new Error('CMD-31 acceptance or trace binding is missing');
  }
  return {
    commandId: 'CMD-31',
    acceptanceRefs,
    traceRefs,
    argvPrefix: [process.execPath, input.caseRunnerPath],
    cwd: input.repositoryRoot,
    executorIdentity: {
      class: 'goal_controlled_executor',
      id: input.executorId,
    },
  };
}

function runProcess(
  command: string,
  args: string[],
  options: {
    cwd: string;
    encoding?: BufferEncoding;
    shell?: boolean;
    timeout?: number;
    env?: NodeJS.ProcessEnv;
  },
  label: string
) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: options.encoding ?? 'utf8',
    shell: options.shell ?? false,
    timeout: options.timeout ?? 300_000,
    maxBuffer: MAX_BUFFER,
    env: options.env ?? process.env,
  });
  if (result.status !== 0) {
    const stdout = String(result.stdout ?? '').slice(-4000);
    const stderr = String(result.stderr ?? result.error?.message ?? '').slice(-4000);
    throw new Error(`${label} failed\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
  }
  return result;
}

function runGitBuffer(repositoryRoot: string, args: string[], label: string): Buffer {
  const result = spawnSync('git', args, {
    cwd: repositoryRoot,
    maxBuffer: MAX_BUFFER,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed: ${String(result.stderr ?? result.error?.message ?? '')}`);
  }
  return Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? '');
}

function currentInputSnapshot(repositoryRoot: string, contractHash: string): JsonRecord {
  const head = runGitBuffer(repositoryRoot, ['rev-parse', 'HEAD'], 'git rev-parse')
    .toString('utf8')
    .trim();
  const status = runGitBuffer(
    repositoryRoot,
    ['status', '--porcelain=v2', '-z', '--untracked-files=all'],
    'git status'
  );
  const unstagedDiff = runGitBuffer(
    repositoryRoot,
    ['diff', '--binary', '--no-ext-diff'],
    'git diff'
  );
  const stagedDiff = runGitBuffer(
    repositoryRoot,
    ['diff', '--cached', '--binary', '--no-ext-diff'],
    'git diff --cached'
  );
  const untracked = runGitBuffer(
    repositoryRoot,
    ['ls-files', '--others', '--exclude-standard', '-z'],
    'git untracked inventory'
  )
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .sort()
    .map((entry) => {
      const target = path.resolve(repositoryRoot, entry);
      if (!target.startsWith(`${path.resolve(repositoryRoot)}${path.sep}`)) {
        throw new Error(`untracked path escapes repository: ${entry}`);
      }
      const inspection = fs.lstatSync(target);
      const hash = inspection.isFile()
        ? sha256(fs.readFileSync(target))
        : inspection.isSymbolicLink()
          ? sha256(fs.readlinkSync(target))
          : 'directory';
      return { path: slash(entry), hash };
    });
  return {
    schemaVersion: 'requirements-contract-six-model-parity-input-snapshot/v1',
    contractHash,
    gitHead: head,
    gitStatusHash: sha256(status),
    unstagedDiffHash: sha256(unstagedDiff),
    stagedDiffHash: sha256(stagedDiff),
    untracked,
  };
}

function copySnapshot(
  evidenceRoot: string,
  surfaceRoot: string,
  category: string,
  index: number,
  sourcePath: string
): string {
  const source = requireFile(sourcePath, `${category} source`);
  const target = path.join(
    surfaceRoot,
    category,
    `${String(index).padStart(2, '0')}-${path.basename(source)}.snapshot`
  );
  writeBytesAtomic(target, fs.readFileSync(source));
  return relativePath(evidenceRoot, target);
}

function snapshotSurface(
  evidenceRoot: string,
  runRoot: string,
  surface: ParitySurface,
  files: SourceFileSet
): SurfaceSnapshot {
  const surfaceRoot = path.join(runRoot, 'surfaces', surface);
  const runtimeCoreTarget = path.join(
    surfaceRoot,
    'scripts',
    'requirements-contract-runtime-status-authority-core.cjs'
  );
  const runtimeSchemaTarget = path.join(surfaceRoot, 'schemas', RUNTIME_STATUS_SCHEMA);
  writeBytesAtomic(runtimeCoreTarget, fs.readFileSync(requireFile(files.runtimeCorePath, `${surface} runtime core`)));
  writeBytesAtomic(
    runtimeSchemaTarget,
    fs.readFileSync(requireFile(files.runtimeSchemaPath, `${surface} runtime schema`))
  );
  const artifactPath = copySnapshot(
    evidenceRoot,
    surfaceRoot,
    'artifact',
    0,
    files.artifactPath
  );
  const readerPaths = [
    relativePath(evidenceRoot, runtimeCoreTarget),
    ...files.readerPaths.map((entry, index) =>
      copySnapshot(evidenceRoot, surfaceRoot, 'readers', index, entry)
    ),
  ];
  const writerPaths = files.writerPaths.map((entry, index) =>
    copySnapshot(evidenceRoot, surfaceRoot, 'writers', index, entry)
  );
  return {
    surface,
    runtimeCorePath: runtimeCoreTarget,
    cell: {
      surface,
      applicability: { applicable: true, reason: null },
      artifactPath,
      readerPaths,
      writerPaths,
      proofRoot: relativePath(evidenceRoot, path.join(runRoot, 'proofs', surface)),
      controlledReceiptRoot: relativePath(
        evidenceRoot,
        path.join(runRoot, 'controlled-command-receipts', surface)
      ),
      behaviorObservationRoot: relativePath(
        evidenceRoot,
        path.join(runRoot, 'behavior-observations', surface)
      ),
    },
  };
}

function packageMaterialization(repositoryRoot: string): {
  temporaryRoot: string;
  packageRoot: string;
  installedRoot: string;
  extractedRoot: string;
  tarball: string;
} {
  const packageRoot = path.join(repositoryRoot, 'packages', 'bmad-speckit');
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'six-model-parity-package-'));
  const packRoot = path.join(temporaryRoot, 'pack');
  const consumerRoot = path.join(temporaryRoot, 'consumer');
  const extractedRoot = path.join(temporaryRoot, 'extracted', 'package');
  fs.mkdirSync(packRoot, { recursive: true });
  fs.mkdirSync(consumerRoot, { recursive: true });
  writeJsonAtomic(
    path.join(consumerRoot, 'package.json'),
    {
      name: 'six-model-parity-installed-observer',
      version: '1.0.0',
      private: true,
    }
  );
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const pack = runProcess(
    npmCommand,
    ['pack', '--ignore-scripts', '--json', '--pack-destination', packRoot],
    {
      cwd: packageRoot,
      shell: process.platform === 'win32',
      timeout: 180_000,
      env: { ...process.env, npm_config_loglevel: 'error' },
    },
    'six-model parity npm pack'
  );
  const packResult = JSON.parse(String(pack.stdout ?? '').trim()) as Array<{
    filename?: string;
  }>;
  const filename = packResult[0]?.filename;
  if (packResult.length !== 1 || !filename) throw new Error('npm pack filename is missing');
  const tarball = path.join(packRoot, filename);
  fs.mkdirSync(path.dirname(extractedRoot), { recursive: true });
  runProcess(
    process.platform === 'win32' ? 'tar.exe' : 'tar',
    ['-xzf', tarball, '-C', path.dirname(extractedRoot)],
    { cwd: repositoryRoot, timeout: 180_000 },
    'six-model parity tar extraction'
  );
  runProcess(
    npmCommand,
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      '--no-save',
      tarball,
    ],
    {
      cwd: consumerRoot,
      shell: process.platform === 'win32',
      timeout: 300_000,
      env: {
        ...process.env,
        npm_config_loglevel: 'error',
        BMAD_SKIP_CONSUMER_MCP_INSTALL: '1',
      },
    },
    'six-model parity npm install'
  );
  return {
    temporaryRoot,
    packageRoot,
    installedRoot: path.join(consumerRoot, 'node_modules', 'bmad-speckit'),
    extractedRoot,
    tarball,
  };
}

export function resolveSixModelProjectionParitySurfaceFileSets(input: {
  repositoryRoot: string;
  packageRoot: string;
  installedRoot: string;
  extractedRoot: string;
  tarball: string;
}): Record<ParitySurface, SourceFileSet> {
  const sourceRoot = path.join(input.packageRoot, 'src');
  const distRoot = path.join(input.packageRoot, 'dist');
  const generatedRoot = path.join(
    distRoot,
    'main-agent',
    'source-authority',
    'packages',
    'bmad-speckit',
    'src'
  );
  const installedDist = path.join(input.installedRoot, 'dist');
  const packedDist = path.join(input.extractedRoot, 'dist');
  const script = (...segments: string[]) =>
    path.join('main-agent', 'source-authority', 'scripts', ...segments);
  const schema = (...segments: string[]) =>
    path.join('main-agent', 'source-authority', 'schemas', ...segments);
  const coreName = 'requirements-contract-runtime-status-authority-core.cjs';
  const facadeSource = 'verified-six-model-status-facade.ts';
  const facadeDist = 'verified-six-model-status-facade.js';
  const writerSource = 'requirements-contract-runtime-status-decision-receipt.ts';
  const writerDist = 'requirements-contract-runtime-status-decision-receipt.js';
  const rendererSource = path.join('runtime', 'bmads-renderer.ts');
  const rendererDist = path.join('runtime', 'bmads-renderer.js');
  const distCore = path.join(distRoot, script(coreName));
  const distSchema = path.join(distRoot, schema(RUNTIME_STATUS_SCHEMA));
  const distFacade = path.join(distRoot, script(facadeDist));
  const distWriter = path.join(distRoot, script(writerDist));
  const distRenderer = path.join(distRoot, rendererDist);
  const hostFiles = {
    codex: path.join(input.repositoryRoot, '.codex', 'commands', 'bmads.md'),
    cursor: path.join(input.repositoryRoot, '.cursor', 'commands', 'bmads.md'),
    claude: path.join(input.repositoryRoot, '.claude', 'commands', 'bmads.md'),
  };
  return {
    source: {
      artifactPath: path.join(sourceRoot, rendererSource),
      runtimeCorePath: path.join(sourceRoot, script(coreName)),
      runtimeSchemaPath: path.join(sourceRoot, schema(RUNTIME_STATUS_SCHEMA)),
      readerPaths: [
        path.join(sourceRoot, script(facadeSource)),
        path.join(sourceRoot, rendererSource),
      ],
      writerPaths: [path.join(sourceRoot, script(writerSource))],
    },
    'package-dist': {
      artifactPath: distRenderer,
      runtimeCorePath: distCore,
      runtimeSchemaPath: distSchema,
      readerPaths: [distFacade, distRenderer],
      writerPaths: [distWriter],
    },
    codex: {
      artifactPath: hostFiles.codex,
      runtimeCorePath: distCore,
      runtimeSchemaPath: distSchema,
      readerPaths: [hostFiles.codex, distFacade, distRenderer],
      writerPaths: [distWriter],
    },
    cursor: {
      artifactPath: hostFiles.cursor,
      runtimeCorePath: distCore,
      runtimeSchemaPath: distSchema,
      readerPaths: [hostFiles.cursor, distFacade, distRenderer],
      writerPaths: [distWriter],
    },
    claude: {
      artifactPath: hostFiles.claude,
      runtimeCorePath: distCore,
      runtimeSchemaPath: distSchema,
      readerPaths: [hostFiles.claude, distFacade, distRenderer],
      writerPaths: [distWriter],
    },
    installed: {
      artifactPath: path.join(input.installedRoot, 'package.json'),
      runtimeCorePath: path.join(installedDist, script(coreName)),
      runtimeSchemaPath: path.join(installedDist, schema(RUNTIME_STATUS_SCHEMA)),
      readerPaths: [
        path.join(installedDist, script(facadeDist)),
        path.join(installedDist, rendererDist),
      ],
      writerPaths: [path.join(installedDist, script(writerDist))],
    },
    'generated-dist': {
      artifactPath: path.join(generatedRoot, rendererDist),
      runtimeCorePath: path.join(generatedRoot, script(coreName)),
      runtimeSchemaPath: path.join(generatedRoot, schema(RUNTIME_STATUS_SCHEMA)),
      readerPaths: [
        path.join(generatedRoot, script(facadeSource)),
        path.join(generatedRoot, rendererDist),
      ],
      writerPaths: [path.join(generatedRoot, script(writerSource))],
    },
    'packed-package': {
      artifactPath: input.tarball,
      runtimeCorePath: path.join(packedDist, script(coreName)),
      runtimeSchemaPath: path.join(packedDist, schema(RUNTIME_STATUS_SCHEMA)),
      readerPaths: [
        path.join(packedDist, script(facadeDist)),
        path.join(packedDist, rendererDist),
      ],
      writerPaths: [path.join(packedDist, script(writerDist))],
    },
    'root-host': {
      artifactPath: path.join(input.repositoryRoot, 'bin', 'bmad-speckit.js'),
      runtimeCorePath: distCore,
      runtimeSchemaPath: distSchema,
      readerPaths: [
        path.join(input.repositoryRoot, 'bin', 'bmad-speckit.js'),
        distFacade,
        distRenderer,
      ],
      writerPaths: [distWriter],
    },
  };
}

function executeCase(input: {
  evidenceRoot: string;
  repositoryRoot: string;
  runRoot: string;
  runToken: string;
  invocationSequence: number;
  snapshot: SurfaceSnapshot;
  caseId: (typeof SIX_MODEL_PARITY_CASES)[number];
  caseRunnerPath: string;
  commandBinding: CommandBinding;
  attempt: AttemptContext;
  inputSnapshotHash: string;
}): void {
  const behaviorPath = path.join(
    input.runRoot,
    'behavior-observations',
    input.snapshot.surface,
    `${input.caseId}.json`
  );
  const stderrPath = path.join(
    input.runRoot,
    'command-output',
    input.snapshot.surface,
    `${input.caseId}.stderr.txt`
  );
  const receiptPath = path.join(
    input.runRoot,
    'controlled-command-receipts',
    input.snapshot.surface,
    `${input.caseId}.json`
  );
  const proofPath = path.join(
    input.runRoot,
    'proofs',
    input.snapshot.surface,
    `${input.caseId}.json`
  );
  const childArgs = [
    input.caseRunnerPath,
    '--runtime-core',
    input.snapshot.runtimeCorePath,
    '--surface',
    input.snapshot.surface,
    '--case',
    input.caseId,
    '--contract-hash',
    input.attempt.contractHash,
    '--requirement-set-id',
    input.attempt.requirementSetId,
    '--implementation-attempt-id',
    input.attempt.implementationAttemptId,
  ];
  const childArgv = [process.execPath, ...childArgs];
  const startedAt = new Date().toISOString();
  const child = spawnSync(process.execPath, childArgs, {
    cwd: input.repositoryRoot,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: MAX_BUFFER,
    env: process.env,
  });
  const stdout = String(child.stdout ?? '');
  const stderr = String(child.stderr ?? child.error?.message ?? '');
  if (child.status !== 0) {
    throw new Error(
      `parity case failed: ${input.snapshot.surface}/${input.caseId}\n${stderr || stdout}`
    );
  }
  const observation = object(JSON.parse(stdout));
  const observedAt = text(observation.observedAt);
  if (!Number.isFinite(new Date(observedAt).getTime())) {
    throw new Error(`parity case observedAt is invalid: ${input.snapshot.surface}/${input.caseId}`);
  }
  writeBytesAtomic(behaviorPath, Buffer.from(stdout, 'utf8'));
  writeBytesAtomic(stderrPath, Buffer.from(stderr, 'utf8'));
  const stdoutHash = sha256(fs.readFileSync(behaviorPath));
  const stderrHash = sha256(fs.readFileSync(stderrPath));
  const receipt = {
    schemaVersion: 'requirements-contract-controlled-command-receipt/v1',
    commandRunId: `RUN-${input.runToken}-${input.snapshot.surface}-${input.caseId}`,
    invocationSequence: input.invocationSequence,
    commandId: input.commandBinding.commandId,
    argv: childArgv,
    argvHash: sixModelParityHash(canonicalSixModelParityJson(childArgv)),
    orderedChildren: [
      {
        argv: childArgv,
        argvHash: sixModelParityHash(canonicalSixModelParityJson(childArgv)),
        cwd: input.repositoryRoot,
        startedAt,
        endedAt: observedAt,
        exitCode: child.status,
        stdoutPath: relativePath(input.evidenceRoot, behaviorPath),
        stdoutHash,
        stderrPath: relativePath(input.evidenceRoot, stderrPath),
        stderrHash,
      },
    ],
    cwd: input.repositoryRoot,
    executorIdentity: input.commandBinding.executorIdentity,
    hostIdentity: {
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
    },
    transactionId: input.attempt.transactionId,
    implementationAttemptId: input.attempt.implementationAttemptId,
    architectureAuditAttemptId: input.attempt.architectureAuditAttemptId,
    activePhaseAuditAttemptId: input.attempt.architectureAuditAttemptId,
    contractHash: input.attempt.contractHash,
    inputSnapshotHash: input.inputSnapshotHash,
    startedAt,
    endedAt: observedAt,
    exitCode: child.status,
    signal: child.signal,
    stdoutPath: relativePath(input.evidenceRoot, behaviorPath),
    stdoutHash,
    stderrPath: relativePath(input.evidenceRoot, stderrPath),
    stderrHash,
    acceptanceRefs: input.commandBinding.acceptanceRefs,
    traceRefs: input.commandBinding.traceRefs,
    publication: {
      writer: 'goal-controlled-executor',
      targetPath: relativePath(input.evidenceRoot, receiptPath),
      publishedAt: observedAt,
      readbackAt: observedAt,
      explicitUtf8: true,
      createOnly: true,
      readbackVerified: true,
    },
    decision: 'pass',
    passAuthorityScope: 'command_only',
  };
  writeJsonAtomic(receiptPath, receipt);
  writeJsonAtomic(proofPath, {
    schemaVersion: 'requirements-contract-six-model-projection-parity-case-proof/v2',
    producer: SIX_MODEL_PARITY_CASE_PRODUCER,
    action: `run:${input.caseId}`,
    surface: input.snapshot.surface,
    caseId: input.caseId,
    contractHash: input.attempt.contractHash,
    requirementSetId: input.attempt.requirementSetId,
    implementationAttemptId: input.attempt.implementationAttemptId,
    observedAt,
    controlledCommandReceiptRef: fileRef(input.evidenceRoot, receiptPath),
    behaviorObservationRef: fileRef(input.evidenceRoot, behaviorPath),
  });
}

export function isCanonicalSixModelProjectionParityEvidenceRoot(
  evidenceRoot: string,
  repositoryRoot = process.cwd()
): boolean {
  return (
    path.resolve(evidenceRoot) === path.resolve(repositoryRoot, EVIDENCE_RELATIVE_PATH) &&
    fs.existsSync(path.resolve(repositoryRoot, CONTRACT_RELATIVE_PATH))
  );
}

export function buildRequirementsContractSixModelProjectionParityEvidence(
  options: BuildRequirementsContractSixModelProjectionParityEvidenceOptions
): BuildRequirementsContractSixModelProjectionParityEvidenceResult {
  const repositoryRoot = path.resolve(options.repositoryRoot ?? process.cwd());
  const evidenceRoot = path.resolve(options.evidenceRoot);
  const contractPath = requireFile(
    options.contractPath ?? path.join(repositoryRoot, CONTRACT_RELATIVE_PATH),
    'requirements contract'
  );
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const contractHash = sha256(fs.readFileSync(contractPath));
  if (!SHA256_PATTERN.test(contractHash)) throw new Error('contract hash is invalid');
  const attempt = resolveAttemptContext({
    evidenceRoot,
    contractHash,
    contractPath,
    repositoryRoot,
    explicitPath: options.attemptContextPath,
  });
  const inputSnapshot = currentInputSnapshot(repositoryRoot, contractHash);
  const runToken = `${new Date().toISOString().replace(/[^0-9]/gu, '').slice(0, 14)}-${sixModelParityHash(
    canonicalSixModelParityJson(inputSnapshot)
  ).slice('sha256:'.length, 'sha256:'.length + 16)}`;
  const runId = `six-model-parity-${runToken}`;
  const runRoot = path.join(evidenceRoot, 'six-model-parity-runs', runId);
  fs.mkdirSync(path.dirname(runRoot), { recursive: true });
  fs.mkdirSync(runRoot, { recursive: false });
  const inputSnapshotPath = path.join(runRoot, 'input-snapshot.json');
  const inputSnapshotHash = writeJsonAtomic(inputSnapshotPath, inputSnapshot);
  const caseRunnerPath = requireFile(
    path.join(__dirname, 'requirements-contract-six-model-projection-parity-case-runner.js'),
    'six-model parity case runner'
  );
  const commandBinding = deriveCommandBinding({
    contractPath,
    repositoryRoot,
    caseRunnerPath,
    executorId: `six-model-parity-executor/${runToken}`,
  });
  const packageState = packageMaterialization(repositoryRoot);
  try {
    const descriptors = resolveSixModelProjectionParitySurfaceFileSets({
      repositoryRoot,
      packageRoot: packageState.packageRoot,
      installedRoot: packageState.installedRoot,
      extractedRoot: packageState.extractedRoot,
      tarball: packageState.tarball,
    });
    const snapshots = SIX_MODEL_PARITY_SURFACES.map((surface) =>
      snapshotSurface(evidenceRoot, runRoot, surface, descriptors[surface])
    );
    const authority = {
      schemaVersion: SIX_MODEL_PARITY_AUTHORITY_SCHEMA_VERSION,
      contractHash,
      requirementSetId: attempt.requirementSetId,
      transactionId: attempt.transactionId,
      implementationAttemptId: attempt.implementationAttemptId,
      architectureAuditAttemptId: attempt.architectureAuditAttemptId,
      activePhaseAuditAttemptId: attempt.architectureAuditAttemptId,
      inputSnapshotHash,
      commandBinding,
      producer: SIX_MODEL_PARITY_OBSERVATION_PRODUCER,
      action: SIX_MODEL_PARITY_OBSERVATION_ACTION,
      caseProducer: SIX_MODEL_PARITY_CASE_PRODUCER,
      modelOrder: [...SIX_MODEL_PARITY_MODEL_ORDER],
      exactCases: [...SIX_MODEL_PARITY_CASES],
      surfaces: [...SIX_MODEL_PARITY_SURFACES],
      maxObservationAgeMs: 60 * 60 * 1000,
      maxClockSkewMs: 5 * 60 * 1000,
      cells: snapshots.map((snapshot) => snapshot.cell),
    };
    const authorityPath = path.join(evidenceRoot, 'parity-authority.json');
    const authorityHash = writeJsonAtomic(authorityPath, authority, true);
    let invocationSequence = 0;
    for (const snapshot of snapshots) {
      for (const caseId of SIX_MODEL_PARITY_CASES) {
        invocationSequence += 1;
        executeCase({
          evidenceRoot,
          repositoryRoot,
          runRoot,
          runToken,
          invocationSequence,
          snapshot,
          caseId,
          caseRunnerPath,
          commandBinding,
          attempt,
          inputSnapshotHash,
        });
      }
    }
    const observationPaths = snapshots.map((snapshot) => {
      produceRequirementsContractSixModelProjectionParityObservation({
        evidenceRoot,
        surface: snapshot.surface,
      });
      return path.join(evidenceRoot, 'observations', `${snapshot.surface}.json`);
    });
    return {
      authorityPath,
      authorityHash,
      runId,
      runRoot,
      transactionId: attempt.transactionId,
      requirementSetId: attempt.requirementSetId,
      implementationAttemptId: attempt.implementationAttemptId,
      architectureAuditAttemptId: attempt.architectureAuditAttemptId,
      inputSnapshotHash,
      observationPaths,
    };
  } finally {
    fs.rmSync(packageState.temporaryRoot, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  }
}
