import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { hashControlPlaneValue, stableControlPlaneStringify } from './canonical-hash';
import { validateGoalContractSchema } from './schema-registry';

const ADAPTER_SCHEMA = 'goal-run-execution-adapter-authority.schema.json';
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export const GOAL_RUN_EXECUTION_ADAPTER_SOURCE_PATH =
  'goal/execution-adapter/authority.json' as const;
export const PACKAGED_GOAL_RUN_EXECUTION_ADAPTER_PATH = 'adapter/authority.json' as const;

export interface GoalRunExecutionAdapterAuthority {
  schemaVersion: 'GoalRunExecutionAdapterAuthority/v1';
  adapterId: string;
  protocol: 'GoalRunMutationProtocol/v1';
  executableRef: { path: string; hash: string };
  args: string[];
  timeoutMs: number;
  adapterAuthorityHash: string;
}

export interface ResolvedGoalRunExecutionAdapterAuthority {
  authority: GoalRunExecutionAdapterAuthority;
  authorityPath: string;
  executablePath: string;
  authorityBytes: Buffer;
  executableBytes: Buffer;
}

function fail(details: Record<string, unknown> = {}): never {
  throw Object.assign(new Error('goal_run_execution_adapter_authority_invalid'), {
    failureClass: 'goal_run_execution_adapter_authority_invalid',
    ...details,
  });
}

function sha256(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(`${stableControlPlaneStringify(value)}\n`, 'utf8');
}

function normalizedRelativePath(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\\')) {
    fail({ field });
  }
  if (
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value === '..' ||
    value.startsWith('../')
  ) {
    fail({ field });
  }
  return value;
}

function confinedRegularFile(root: string, relativePath: string, field: string): string {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...relativePath.split('/'));
  const relative = path.relative(resolvedRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail({ field });
  try {
    const rootStat = fs.lstatSync(resolvedRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail({ field });
    const realRoot = fs.realpathSync.native(resolvedRoot);
    let current = resolvedRoot;
    for (const segment of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) fail({ field });
      const realCurrent = fs.realpathSync.native(current);
      if (realCurrent !== realRoot && !realCurrent.startsWith(`${realRoot}${path.sep}`)) {
        fail({ field });
      }
    }
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink()) fail({ field });
  } catch {
    fail({ field });
  }
  return target;
}

function readAuthority(
  authorityPath: string,
  confinementRoot = path.dirname(path.resolve(authorityPath))
): ResolvedGoalRunExecutionAdapterAuthority {
  const resolvedAuthorityPath = path.resolve(authorityPath);
  const authorityRoot = path.dirname(resolvedAuthorityPath);
  const authorityRelativePath = normalizedRelativePath(
    path.relative(path.resolve(confinementRoot), resolvedAuthorityPath).replace(/\\/gu, '/'),
    'authority'
  );
  const authorityFile = confinedRegularFile(confinementRoot, authorityRelativePath, 'authority');
  const authorityBytes = fs.readFileSync(authorityFile);
  let authority: GoalRunExecutionAdapterAuthority;
  try {
    authority = JSON.parse(authorityBytes.toString('utf8')) as GoalRunExecutionAdapterAuthority;
    validateGoalContractSchema(ADAPTER_SCHEMA, authority);
  } catch {
    fail({ field: 'authority' });
  }
  const payload = { ...authority };
  delete (payload as Partial<GoalRunExecutionAdapterAuthority>).adapterAuthorityHash;
  if (
    !HASH_PATTERN.test(authority.adapterAuthorityHash) ||
    hashControlPlaneValue(payload) !== authority.adapterAuthorityHash ||
    !authorityBytes.equals(canonicalBytes(authority))
  ) {
    fail({ field: 'adapterAuthorityHash' });
  }
  const executableRelativePath = normalizedRelativePath(
    authority.executableRef.path,
    'executableRef.path'
  );
  const executablePath = confinedRegularFile(
    confinementRoot,
    normalizedRelativePath(
      path
        .relative(
          path.resolve(confinementRoot),
          path.resolve(authorityRoot, ...executableRelativePath.split('/'))
        )
        .replace(/\\/gu, '/'),
      'executableRef.path'
    ),
    'executableRef.path'
  );
  const executableBytes = fs.readFileSync(executablePath);
  if (
    !HASH_PATTERN.test(authority.executableRef.hash) ||
    sha256(executableBytes) !== authority.executableRef.hash
  ) {
    fail({ field: 'executableRef.hash' });
  }
  return Object.freeze({
    authority: Object.freeze({
      ...authority,
      executableRef: Object.freeze({ ...authority.executableRef }),
      args: Object.freeze([...authority.args]) as unknown as string[],
    }),
    authorityPath: resolvedAuthorityPath,
    executablePath,
    authorityBytes,
    executableBytes,
  });
}

export function resolveGoalRunExecutionAdapterAuthority(input: {
  authorityPath: string;
}): ResolvedGoalRunExecutionAdapterAuthority {
  return readAuthority(input.authorityPath);
}

export function freezeGoalRunExecutionAdapterAuthority(input: { outRoot: string }): {
  authority: GoalRunExecutionAdapterAuthority;
  executionAdapterRef: { path: string; hash: string };
  files: Map<string, Buffer>;
} {
  const outRoot = path.resolve(input.outRoot);
  const source = readAuthority(
    path.join(outRoot, ...GOAL_RUN_EXECUTION_ADAPTER_SOURCE_PATH.split('/')),
    outRoot
  );
  const executableRelativePath = normalizedRelativePath(
    source.authority.executableRef.path,
    'executableRef.path'
  );
  return Object.freeze({
    authority: source.authority,
    executionAdapterRef: Object.freeze({
      path: PACKAGED_GOAL_RUN_EXECUTION_ADAPTER_PATH,
      hash: source.authority.adapterAuthorityHash,
    }),
    files: new Map([
      [PACKAGED_GOAL_RUN_EXECUTION_ADAPTER_PATH, source.authorityBytes],
      [`adapter/${executableRelativePath}`, source.executableBytes],
    ]),
  });
}

export function resolvePackagedGoalRunExecutionAdapterAuthority(input: {
  runRoot: string;
  executionAdapterRef: { path?: unknown; hash?: unknown };
}): ResolvedGoalRunExecutionAdapterAuthority {
  if (
    input.executionAdapterRef.path !== PACKAGED_GOAL_RUN_EXECUTION_ADAPTER_PATH ||
    typeof input.executionAdapterRef.hash !== 'string' ||
    !HASH_PATTERN.test(input.executionAdapterRef.hash)
  ) {
    fail({ field: 'executionAdapterRef' });
  }
  const resolved = readAuthority(
    path.join(path.resolve(input.runRoot), ...PACKAGED_GOAL_RUN_EXECUTION_ADAPTER_PATH.split('/')),
    input.runRoot
  );
  if (resolved.authority.adapterAuthorityHash !== input.executionAdapterRef.hash) {
    fail({ field: 'executionAdapterRef.hash' });
  }
  return resolved;
}
