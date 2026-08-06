import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const REPO_ROOT = process.cwd();
export const SKILL_ROOT = path.join(
  REPO_ROOT,
  '_bmad',
  'skills',
  'goal-subcontract-execution-package-generator'
);
const roots: string[] = [];

type FixtureChild = {
  partitionId: string;
  title: string;
  ownedPath: string;
  path: string;
  hash: string;
};

type SchemaBindings = {
  evidenceSchemaPath: string;
  closureSchemaPath: string;
};

export function sha256(bytes: string | Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export function hashFile(filePath: string): string {
  return sha256(fs.readFileSync(filePath));
}

function write(root: string, relativePath: string, content: string): string {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  return target;
}

function writeJson(root: string, relativePath: string, value: unknown): string {
  return write(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function git(root: string, args: string[]): string {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function createChildren(root: string): FixtureChild[] {
  const childSpecs = [
    ['AUTH-01', 'Refresh expired access tokens', 'src/auth/refresh.ts'],
    ['AUTH-02', 'Revoke rotated refresh tokens', 'src/auth/revoke.ts'],
  ] as const;
  return childSpecs.map(([partitionId, title, ownedPath], index) => {
    const relativePath = `contracts/${partitionId}.md`;
    const childPath = write(root, relativePath, `# ${title}\n`);
    write(root, ownedPath, `export const version = ${index};\n`);
    return { partitionId, title, ownedPath, path: relativePath, hash: hashFile(childPath) };
  });
}

function createSchemas(root: string): SchemaBindings {
  const evidenceSchemaPath = writeJson(root, 'schemas/evidence.json', {
    type: 'object',
    required: ['decision'],
    properties: {
      partitionId: { type: 'string', minLength: 1 },
      decision: { const: 'pass' },
    },
    additionalProperties: false,
  });
  const closureSchemaPath = writeJson(root, 'schemas/closure.json', {
    type: 'object',
    required: ['partitionId', 'contractHash', 'status'],
    properties: {
      partitionId: { type: 'string', minLength: 1 },
      contractHash: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
      status: { const: 'closed' },
    },
    additionalProperties: false,
  });
  return { evidenceSchemaPath, closureSchemaPath };
}

export function buildPartitionManifest(children: FixtureChild[]) {
  return {
    schemaVersion: 'goal-contract-partition-manifest/v2',
    manifestAuthorityMode: 'final_child_membership',
    partitionManifestHash: `sha256:${'1'.repeat(64)}`,
    partitionCount: children.length,
    topologicalOrder: children.map(({ partitionId }) => partitionId),
    orderedChildContractHashes: children.map(({ hash }) => hash),
    partitions: children.map((child, index) => ({
      partitionId: child.partitionId,
      displayTitle: child.title,
      childContractPath: child.path,
      childContractHash: child.hash,
      dependencyPartitionIds: index === 0 ? [] : [children[index - 1].partitionId],
      ownedArtifactPaths: [child.ownedPath],
      commandIds: [`CMD-${child.partitionId}`],
    })),
    coverage: {
      uncoveredObligationIds: [],
      duplicateObligationIds: [],
      unmappedObligationIds: [],
      scopeEscapeObligationIds: [],
    },
  };
}

export function buildCompileRequest({
  root,
  goalPath,
  manifestPath,
  children,
  evidenceSchemaPath,
  closureSchemaPath,
  requirementRecordBinding,
}: {
  root: string;
  goalPath: string;
  manifestPath: string;
  children: FixtureChild[];
  evidenceSchemaPath: string;
  closureSchemaPath: string;
  requirementRecordBinding?: object;
}) {
  return {
    schemaVersion: 'goal-subcontract-execution-package-request/v1',
    repositoryRoot: root,
    goalContract: { path: 'goal.md', hash: hashFile(goalPath) },
    partitionManifest: {
      path: 'partition-manifest.json',
      hash: hashFile(manifestPath),
    },
    children: children.map(({ partitionId, path: childPath, hash }) => ({
      partitionId,
      path: childPath,
      hash,
    })),
    evidenceSchema: { path: 'schemas/evidence.json', hash: hashFile(evidenceSchemaPath) },
    closureSchema: { path: 'schemas/closure.json', hash: hashFile(closureSchemaPath) },
    collectionVerificationCommands: [
      { id: 'CMD-COLLECTION', command: 'npm test -- auth-campaign' },
    ],
    ...(requirementRecordBinding ? { requirementRecordBinding } : {}),
  };
}

function initializeRepository(root: string): void {
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.email', 'fixture@example.test']);
  git(root, ['config', 'user.name', 'Fixture']);
}

export function createFixture(requirementRecordBinding?: object) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-subcontract-package-'));
  roots.push(root);
  initializeRepository(root);
  const goalPath = write(
    root,
    'goal.md',
    '# Frozen Goal\n\ncontractMode: frozen\nrewritePolicy: forbidden\n'
  );
  const children = createChildren(root);
  const unownedPath = 'src/shared/unowned.ts';
  write(root, unownedPath, "export const source = 'unowned';\n");
  const schemas = createSchemas(root);
  const manifestPath = writeJson(root, 'partition-manifest.json', buildPartitionManifest(children));
  const request = buildCompileRequest({
    root,
    goalPath,
    manifestPath,
    children,
    ...schemas,
    requirementRecordBinding,
  });
  const requestPath = writeJson(root, 'request.json', request);
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', 'test(fixture): create campaign baseline']);
  return {
    root,
    requestPath,
    packageA: path.join(root, 'package-a'),
    packageB: path.join(root, 'package-b'),
    children,
    unownedPath,
  };
}

export function runScript(
  scriptName: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv } = {}
) {
  return spawnSync(process.execPath, [path.join(SKILL_ROOT, 'scripts', scriptName), ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: options.env,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
}

export function cleanupFixtures(): void {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
}

export function directoryDigest(root: string): string {
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(path.relative(root, full).replace(/\\/g, '/'));
    }
  };
  walk(root);
  return sha256(
    files
      .sort()
      .map((file) => `${file}\0${hashFile(path.join(root, file))}`)
      .join('\n')
  );
}
