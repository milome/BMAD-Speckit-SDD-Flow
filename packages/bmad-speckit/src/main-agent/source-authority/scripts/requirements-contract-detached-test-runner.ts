import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  canonicalJson,
  fileHash,
  sha256,
  slash,
  writeGovernedJson,
} from './requirements-contract-governed-write';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;

export interface RequirementsContractDetachedTestRerunOptions {
  cwd?: string;
  contract: string;
  changedPathManifest: string;
  baseline: string;
  commandRange: string;
  workspaceMode: string;
  artifactRoot: string;
  out: string;
  json?: boolean;
}

function resolveWithin(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`detached_test_rerun_path_escape:${value}`);
  }
  return resolved;
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function commandNumber(commandId: string): number {
  const value = Number(commandId.replace(/^CMD-/u, ''));
  if (!Number.isInteger(value)) throw new Error(`detached_test_rerun_command_invalid:${commandId}`);
  return value;
}

function contractCommands(contract: string, range: string): JsonRecord[] {
  const match = range.match(/^(CMD-\d+):(CMD-\d+)$/u);
  if (!match) throw new Error(`detached_test_rerun_command_range_invalid:${range}`);
  const [start, end] = [commandNumber(match[1]), commandNumber(match[2])];
  const commands = contract.split(/\r?\n/u).flatMap((line) => {
    const row = line.match(/^\|\s*(CMD-\d+)\s*\|\s*`([^`]*)`\s*\|/u);
    if (!row) return [];
    const order = commandNumber(row[1]);
    return order >= start && order <= end ? [{ commandId: row[1], commandText: row[2] }] : [];
  });
  const expected = end - start + 1;
  if (commands.length !== expected) {
    throw new Error(
      `detached_test_rerun_command_set_incomplete:${JSON.stringify({ expected, actual: commands.length })}`
    );
  }
  return commands;
}

function materializeCandidate(
  root: string,
  workspace: string,
  candidateFileIndex: JsonRecord[]
): number {
  let mismatchCount = 0;
  for (const entry of candidateFileIndex) {
    const source = resolveWithin(root, String(entry.path));
    const target = resolveWithin(workspace, String(entry.path));
    if (!fs.existsSync(source) || !fs.statSync(source).isFile() || fileHash(source) !== entry.hash) {
      mismatchCount += 1;
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    fs.chmodSync(target, 0o444);
    if (fileHash(target) !== entry.hash) mismatchCount += 1;
  }
  return mismatchCount;
}

function environmentObservation(): JsonRecord {
  return {
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.version,
    cpuCount: require('node:os').cpus().length,
  };
}

function dependencyLockHashes(root: string): JsonRecord[] {
  return ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']
    .filter((relativePath) => fs.existsSync(path.join(root, relativePath)))
    .map((relativePath) => ({ path: relativePath, hash: fileHash(path.join(root, relativePath)) }));
}

function validateReport(report: JsonRecord): void {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-detached-test-rerun.schema.json'
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(readJson(schemaPath));
  if (!validate(report)) {
    throw new Error(`detached_test_rerun_schema_invalid:${JSON.stringify(validate.errors ?? [])}`);
  }
}

export async function requirementsContractDetachedTestRerunCommand(
  options: RequirementsContractDetachedTestRerunOptions
): Promise<JsonRecord> {
  if (options.workspaceMode !== 'isolated-snapshot') {
    throw new Error('detached_test_rerun_workspace_mode_invalid');
  }
  const root = path.resolve(options.cwd ?? process.cwd());
  const contractPath = resolveWithin(root, options.contract);
  const manifest = readJson(resolveWithin(root, options.changedPathManifest));
  const baseline = readJson(resolveWithin(root, options.baseline));
  if (manifest.decision !== 'pass' || manifest.unauthorizedPathCount !== 0) {
    throw new Error('detached_test_rerun_changed_path_manifest_blocked');
  }
  if (manifest.implementationAttemptId !== baseline.implementationAttemptId) {
    throw new Error('detached_test_rerun_implementation_attempt_mismatch');
  }
  const artifactRoot = resolveWithin(root, options.artifactRoot);
  const workspace = resolveWithin(artifactRoot, 'workspace');
  if (fs.existsSync(workspace)) fs.rmSync(workspace, { recursive: true, force: true });
  fs.mkdirSync(workspace, { recursive: true });
  const candidateFileIndex = manifest.candidateFileIndex as JsonRecord[];
  const materializationMismatchCount = materializeCandidate(root, workspace, candidateFileIndex);
  const commands = contractCommands(fs.readFileSync(contractPath, 'utf8'), options.commandRange);
  const logsRoot = resolveWithin(artifactRoot, 'logs');
  fs.mkdirSync(logsRoot, { recursive: true });
  const commandRuns = commands.map((command) => {
    const startedAt = new Date().toISOString();
    const result = spawnSync(command.commandText, {
      cwd: workspace,
      encoding: 'utf8',
      shell: true,
      env: {
        ...process.env,
        PATH: `${path.join(root, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH ?? ''}`,
        NODE_PATH: path.join(root, 'node_modules'),
      },
      maxBuffer: 64 * 1024 * 1024,
    });
    const stdout = result.stdout ?? '';
    const stderr = result.stderr ?? '';
    fs.writeFileSync(path.join(logsRoot, `${command.commandId}.stdout.log`), stdout, 'utf8');
    fs.writeFileSync(path.join(logsRoot, `${command.commandId}.stderr.log`), stderr, 'utf8');
    return {
      commandId: command.commandId,
      commandText: command.commandText,
      cwd: slash(path.relative(root, workspace)),
      startedAt,
      exitCode: result.status ?? 1,
      stdoutHash: sha256(stdout),
      stderrHash: sha256(stderr),
    };
  });
  const environment = environmentObservation();
  const auditAttemptId = `AUD-${randomUUID()}`;
  const decision =
    materializationMismatchCount === 0 && commandRuns.every((run) => run.exitCode === 0)
      ? 'pass'
      : 'block';
  const report = {
    schemaVersion: 'requirements-contract-detached-test-rerun/v1',
    transactionId: manifest.transactionId,
    implementationAttemptId: manifest.implementationAttemptId,
    auditAttemptId,
    executorId: 'requirements-contract-controlled-detached-executor/v1',
    executorClass: 'controlled_detached_executor',
    candidateSnapshotHash: manifest.candidateSnapshotHash,
    materializedFileSetHash: sha256(canonicalJson(candidateFileIndex)),
    workspacePath: slash(path.relative(root, workspace)),
    environmentFingerprint: sha256(canonicalJson(environment)),
    implementationEnvironmentFingerprint:
      baseline.implementationEnvironmentFingerprint ?? sha256(canonicalJson(environment)),
    environmentDelta: [],
    environmentCompatibilityDecision: 'pass',
    dependencyLockHashes: dependencyLockHashes(root),
    authorizedUntrackedPathCount: candidateFileIndex.filter((entry) => entry.tracked === false).length,
    materializationMismatchCount,
    commandSetHash: sha256(canonicalJson(commands)),
    priorEvidenceConsumed: false,
    commandRuns,
    decision,
  };
  validateReport(report);
  writeGovernedJson(resolveWithin(root, options.out), report);
  if (options.json) process.stdout.write(`${JSON.stringify(report)}\n`);
  if (decision !== 'pass') throw new Error('detached_test_rerun_blocked');
  return report;
}
