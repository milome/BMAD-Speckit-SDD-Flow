import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { x as extractTarball } from 'tar';
import { describe, expect, it } from 'vitest';
import { REQUIREMENTS_CONTRACT_PROJECTION_SURFACE_ROOTS } from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-projection-registry';

type MatrixColumn =
  | 'sourceOwner'
  | 'generatedDist'
  | 'packedPackage'
  | 'rootHost'
  | 'installedConsumer';

type MatrixRow = Record<MatrixColumn, string> & {
  owner: string;
  producerVerification: string;
};

type FileRef = {
  path: string;
  hash: string;
};

type ActionBinding = {
  actionId: string;
  sourceHandlerRef: FileRef;
  distHandlerRef: FileRef;
  inputSchemaRefs: FileRef[];
  outputSchemaRefs: FileRef[];
  behaviorTestRefs: FileRef[];
  packageDistRef: FileRef;
  installedSurfaceRefs: FileRef[];
  runtimeRefs?: Array<{ role: string; packagePath: string; hash: string }>;
  semanticGate: {
    gateId: string;
    sourceSymbol: string;
    distSymbol: string;
  };
  routingOnly: boolean;
};

type ActionBindingManifest = {
  actions: ActionBinding[];
};

const ROOT = process.cwd();
const CONTRACT_PATH = path.join(
  ROOT,
  'docs',
  'plans',
  '2026-07-18-loop-engineering-evidence-closure-remediation-amend13-goal-execution-plan.md'
);
const INTERNAL_PACKAGE_ROOT = path.join(ROOT, 'packages', 'bmad-speckit');
const ACTION_MANIFEST_PATH = path.join(
  ROOT,
  '_bmad',
  'shared',
  'requirements-contract',
  'requirements-contract-package-runtime-action-binding-manifest.json'
);
const FIXED_CONSUMER_ROOT = 'D:\\Dev\\BMAD-Speckit-Consumer-Evidence-Closure';
const MATRIX_COLUMNS: MatrixColumn[] = [
  'sourceOwner',
  'generatedDist',
  'packedPackage',
  'rootHost',
  'installedConsumer',
];
const RECOVERY_MATRIX_OWNERS = new Set([
  'Recovery bootstrap and finalizer',
  'Controlled-command Receipt schema',
  'Recovery-finalization Receipt schema',
  'Recovery state-decision schema',
  'Recovery-lineage schema',
  'Package runtime action-binding manifest',
  'Safe-write target registry',
]);
const RECOVERY_PROJECTION_FILES = new Map<string, string>([
  [
    'Package runtime action-binding manifest',
    'requirements-contract-package-runtime-action-binding-manifest.json',
  ],
  ['Safe-write target registry', 'requirements-contract-safe-write-target-registry.json'],
]);
const MANUAL_BEHAVIOR_TESTS = new Map<string, string[]>([
  [
    'Package runtime action-binding manifest',
    [
      'tests/acceptance/requirements-contract-package-runtime-action-binding.test.ts',
      'tests/acceptance/requirements-contract-package-runtime-action-binding-surface-parity.test.ts',
    ],
  ],
  [
    'Safe-write target registry',
    [
      'tests/acceptance/requirements-contract-safe-write-target-registry.test.ts',
      'tests/acceptance/requirements-contract-safe-write-target-registry-surface-parity.test.ts',
    ],
  ],
]);

function slash(value: string): string {
  return value.replace(/\\/gu, '/');
}

function fileHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function npmCliPath(): string {
  return (
    process.env.npm_execpath ??
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  );
}

function runNode(args: string[], cwd: string): string {
  return execFileSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_update_notifier: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parsePackOutput(stdout: string): { filename: string } {
  const output = JSON.parse(stdout) as Array<{ filename?: string }>;
  expect(output).toHaveLength(1);
  expect(output[0]?.filename).toEqual(expect.any(String));
  return { filename: output[0]!.filename! };
}

async function materializePackageSurfaces(): Promise<{
  root: string;
  extractedRoot: string;
  consumerRoot: string;
  cleanup(): void;
}> {
  const root = mkdtempSync(path.join(tmpdir(), 'recovery-finalization-parity-'));
  const packRoot = path.join(root, 'pack');
  const extractedRoot = path.join(root, 'extracted');
  const consumerRoot = path.join(root, 'consumer');
  mkdirSync(packRoot);
  mkdirSync(extractedRoot);
  mkdirSync(consumerRoot);

  const rootPack = parsePackOutput(
    runNode(
      [npmCliPath(), 'pack', '--json', '--ignore-scripts', '--pack-destination', packRoot],
      ROOT
    )
  );
  const internalPack = parsePackOutput(
    runNode(
      [npmCliPath(), 'pack', '--json', '--ignore-scripts', '--pack-destination', packRoot],
      INTERNAL_PACKAGE_ROOT
    )
  );
  const rootTarball = path.join(packRoot, rootPack.filename);
  const internalTarball = path.join(packRoot, internalPack.filename);
  await extractTarball({ cwd: extractedRoot, file: rootTarball });

  writeJson(path.join(consumerRoot, 'package.json'), {
    name: 'recovery-finalization-parity-consumer',
    private: true,
  });
  runNode(
    [
      npmCliPath(),
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      rootTarball,
      internalTarball,
    ],
    consumerRoot
  );

  const installedRootPackage = path.join(consumerRoot, 'node_modules', 'bmad-speckit-sdd-flow');
  const initScript = path.join(installedRootPackage, 'scripts', 'init-to-root.js');
  for (const agent of ['codex', 'cursor', 'claude-code']) {
    runNode([initScript, '--agent', agent, consumerRoot], consumerRoot);
  }

  const installedPackage = path.join(consumerRoot, 'node_modules', 'bmad-speckit');
  expect(lstatSync(installedRootPackage).isSymbolicLink()).toBe(false);
  expect(lstatSync(installedPackage).isSymbolicLink()).toBe(false);
  expect(realpathSync(installedPackage)).toBe(installedPackage);

  return {
    root,
    extractedRoot,
    consumerRoot,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function splitMarkdownRow(line: string): string[] {
  return line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function readMatrix(): MatrixRow[] {
  const contract = readFileSync(CONTRACT_PATH, 'utf8');
  const headingMatch = contract.match(/^### [A-Z]+-\d+ exact parity matrix$/mu);
  const heading = headingMatch?.[0] ?? '';
  const start = headingMatch?.index ?? -1;
  expect(start, 'successor contract is missing the exact parity matrix').toBeGreaterThanOrEqual(0);
  const remainder = contract.slice(start + heading.length);
  const end = remainder.indexOf('\n### ');
  const section = end >= 0 ? remainder.slice(0, end) : remainder;
  const tableLines = section.split(/\r?\n/u).filter((line) => line.startsWith('|'));
  const dataLines = tableLines.slice(2);

  return dataLines
    .map((line) => {
      const cells = splitMarkdownRow(line);
      expect(cells, `invalid exact parity matrix row: ${line}`).toHaveLength(7);
      return {
        owner: cells[0]!,
        sourceOwner: cells[1]!,
        generatedDist: cells[2]!,
        packedPackage: cells[3]!,
        rootHost: cells[4]!,
        installedConsumer: cells[5]!,
        producerVerification: cells[6]!,
      };
    })
    .filter((row) => RECOVERY_MATRIX_OWNERS.has(row.owner));
}

function codePaths(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/gu)].map((match) => match[1]!);
}

function canonicalMatrixPath(exactPath: string): string {
  return slash(exactPath)
    .replace(
      '/dist/main-agent/source-authority/packages/bmad-speckit/src/main-agent/source-authority/schemas/',
      '/dist/main-agent/source-authority/schemas/'
    )
    .replaceAll(
      'requirements-contract-amend05-safe-write-target-registry',
      'requirements-contract-safe-write-target-registry'
    );
}

function matrixPaths(row: MatrixRow, column: MatrixColumn): string[] {
  if (column === 'rootHost') {
    const projectionFile = RECOVERY_PROJECTION_FILES.get(row.owner);
    if (projectionFile) {
      return REQUIREMENTS_CONTRACT_PROJECTION_SURFACE_ROOTS.map((surfaceRoot) =>
        path.posix.join(surfaceRoot, projectionFile)
      );
    }
  }
  return codePaths(row[column]).map(canonicalMatrixPath);
}

function exactnessViolations(rows: MatrixRow[]): string[] {
  const violations: string[] = [];
  const shorthand =
    /\b(?:matching|under|plus|enumerated|directory[- ]family|basename|wildcard|source fallback|routing-only)\b/iu;

  for (const row of rows) {
    for (const column of MATRIX_COLUMNS) {
      const cell = row[column];
      if (cell.startsWith('N/A:')) {
        if (cell.slice('N/A:'.length).trim().length === 0) {
          violations.push(`${row.owner}/${column}: N/A reason is empty`);
        }
        if (codePaths(cell).length > 0) {
          violations.push(`${row.owner}/${column}: N/A cell contains path evidence`);
        }
        continue;
      }
      const paths = codePaths(cell);
      if (paths.length === 0) {
        violations.push(`${row.owner}/${column}: applicable cell has no exact path`);
      }
      if (shorthand.test(cell)) {
        violations.push(`${row.owner}/${column}: shorthand path proof is forbidden`);
      }
      for (const exactPath of paths) {
        if (/[*?[\]]/u.test(exactPath)) {
          violations.push(`${row.owner}/${column}: wildcard path ${exactPath}`);
        }
        if (exactPath.endsWith('/') || exactPath.endsWith('\\')) {
          violations.push(`${row.owner}/${column}: directory-family path ${exactPath}`);
        }
      }
    }
  }
  return violations;
}

function resolveInstalledPath(consumerRoot: string, exactPath: string): string {
  const relative = path.win32.relative(FIXED_CONSUMER_ROOT, exactPath);
  if (relative === '' || relative.startsWith('..') || path.win32.isAbsolute(relative)) {
    throw new Error(`installed path is outside the contract Consumer root: ${exactPath}`);
  }
  return path.join(consumerRoot, ...relative.split(/[\\/]/u));
}

function resolveSurfacePath(
  column: MatrixColumn,
  exactPath: string,
  surfaces: { extractedRoot: string; consumerRoot: string }
): string {
  if (column === 'packedPackage') {
    if (!exactPath.startsWith('package/')) {
      throw new Error(`packed path lacks exact package root: ${exactPath}`);
    }
    return path.join(surfaces.extractedRoot, ...exactPath.split('/'));
  }
  if (column === 'installedConsumer') {
    return resolveInstalledPath(surfaces.consumerRoot, exactPath);
  }
  return path.resolve(ROOT, exactPath);
}

function projectionKey(row: MatrixRow, column: MatrixColumn, exactPath: string): string | null {
  const normalized = slash(exactPath);
  const installedRelative =
    column === 'installedConsumer'
      ? slash(path.win32.relative(FIXED_CONSUMER_ROOT, exactPath))
      : null;
  const comparablePath = installedRelative ?? normalized;
  for (const schemaPrefix of [
    'packages/bmad-speckit/src/main-agent/source-authority/schemas/',
    'packages/bmad-speckit/dist/main-agent/source-authority/schemas/',
    'package/node_modules/bmad-speckit/dist/main-agent/source-authority/schemas/',
    'node_modules/bmad-speckit/dist/main-agent/source-authority/schemas/',
  ]) {
    if (comparablePath.startsWith(schemaPrefix)) {
      return `schema:${comparablePath.slice(schemaPrefix.length)}`;
    }
  }
  if (column === 'packedPackage') {
    if (normalized.startsWith('package/node_modules/bmad-speckit/')) {
      return `package:${normalized.slice('package/node_modules/bmad-speckit/'.length)}`;
    }
    if (normalized.startsWith('package/_bmad/')) {
      return `host:${normalized.slice('package/'.length)}`;
    }
  }
  if (column === 'installedConsumer') {
    const relative = installedRelative!;
    if (relative.startsWith('node_modules/bmad-speckit/')) {
      return `package:${relative.slice('node_modules/bmad-speckit/'.length)}`;
    }
    if (relative.startsWith('_bmad/')) return `host:${relative}`;
  }
  if (normalized.startsWith('packages/bmad-speckit/dist/')) {
    return `package:${normalized.slice('packages/bmad-speckit/'.length)}`;
  }
  if (normalized.startsWith('packages/bmad-speckit/bin/')) {
    return `package:${normalized.slice('packages/bmad-speckit/'.length)}`;
  }
  if (normalized.startsWith('packages/bmad-speckit/_bmad/')) {
    return `host:${normalized.slice('packages/bmad-speckit/'.length)}`;
  }
  if (
    row.owner === 'Candidate package producer and Receipt schema' &&
    normalized === 'packages/bmad-speckit/package.json'
  ) {
    return 'package:package.json';
  }
  if (normalized.startsWith('_bmad/')) return `host:${normalized}`;
  for (const hostRoot of ['.codex/', '.cursor/', '.claude/']) {
    if (normalized.startsWith(hostRoot)) {
      return `host:_bmad/${normalized.slice(hostRoot.length)}`;
    }
  }
  return null;
}

function allActionPaths(action: ActionBinding): string[] {
  const repositoryRefs = [
    action.sourceHandlerRef,
    action.distHandlerRef,
    ...action.inputSchemaRefs,
    ...action.outputSchemaRefs,
    ...action.behaviorTestRefs,
    action.packageDistRef,
    ...action.installedSurfaceRefs,
  ].map((ref) => ref.path);
  const runtimeRefs = (action.runtimeRefs ?? []).map(
    (ref) => `packages/bmad-speckit/${slash(ref.packagePath)}`
  );
  return [...repositoryRefs, ...runtimeRefs];
}

function expectFileRef(ref: FileRef): void {
  const resolved = path.resolve(ROOT, ref.path);
  expect(existsSync(resolved), `bound file is missing: ${ref.path}`).toBe(true);
  if (existsSync(resolved)) expect(fileHash(resolved)).toBe(ref.hash);
}

function compileSchema(schemaPath: string): string | null {
  const resolved = path.resolve(ROOT, schemaPath);
  if (!existsSync(resolved) || !lstatSync(resolved).isFile()) {
    return `${schemaPath}: schema file is missing`;
  }
  const schema = JSON.parse(readFileSync(resolved, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  validate({});
  expect(validate.errors).toEqual(expect.any(Array));
  return null;
}

describe('requirements contract recovery finalization surface parity', () => {
  it('requires exact applicable cells and reasoned non-applicable cells', () => {
    const rows = readMatrix();
    expect(rows).toHaveLength(RECOVERY_MATRIX_OWNERS.size);
    expect(new Set(rows.map((row) => row.owner))).toEqual(RECOVERY_MATRIX_OWNERS);
    expect(new Set(rows.map((row) => row.owner)).size).toBe(rows.length);
    expect(exactnessViolations(rows)).toEqual([]);
  });

  it('hashes every canonical recovery source, dist, packed, host, and installed path', async () => {
    const rows = readMatrix();
    const surfaces = await materializePackageSurfaces();
    try {
      const missing: string[] = [];
      const groups = new Map<string, Array<{ path: string; hash: string }>>();

      for (const row of rows) {
        for (const column of MATRIX_COLUMNS) {
          const cell = row[column];
          if (cell.startsWith('N/A:')) continue;
          for (const exactPath of matrixPaths(row, column)) {
            const resolved = resolveSurfacePath(column, exactPath, surfaces);
            if (!existsSync(resolved) || !lstatSync(resolved).isFile()) {
              missing.push(`${row.owner}/${column}: exact file is missing: ${exactPath}`);
              continue;
            }
            const hash = fileHash(resolved);
            expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/u);
            const key = projectionKey(row, column, exactPath);
            if (key) {
              groups.set(key, [...(groups.get(key) ?? []), { path: exactPath, hash }]);
            }
          }
        }
      }

      const mismatches = [...groups.entries()].flatMap(([key, refs]) => {
        if (refs.length < 2) return [`${key}: no exact parity counterpart`];
        const hashes = new Set(refs.map((ref) => ref.hash));
        return hashes.size === 1
          ? []
          : [`${key}: ${refs.map((ref) => `${ref.path}=${ref.hash}`).join(', ')}`];
      });
      expect({ missing, mismatches }).toEqual({ missing: [], mismatches: [] });
    } finally {
      surfaces.cleanup();
    }
  }, 300_000);

  it('binds every row to schema or executable semantic behavior', () => {
    const rows = readMatrix();
    const manifest = JSON.parse(
      readFileSync(ACTION_MANIFEST_PATH, 'utf8')
    ) as ActionBindingManifest;
    const uncovered: string[] = [];

    for (const row of rows) {
      const rowPaths = new Set([
        ...matrixPaths(row, 'sourceOwner'),
        ...matrixPaths(row, 'generatedDist'),
      ]);
      const actions = manifest.actions.filter((action) =>
        allActionPaths(action).some((refPath) => rowPaths.has(refPath))
      );
      for (const action of actions) {
        expect(action.routingOnly, `${action.actionId} cannot prove routing only`).toBe(false);
        expect(action.semanticGate.sourceSymbol).not.toBe('');
        expect(action.semanticGate.distSymbol).not.toBe('');
        action.behaviorTestRefs.forEach(expectFileRef);
        for (const runtimeRef of action.runtimeRefs ?? []) {
          const runtimePath = path.resolve(INTERNAL_PACKAGE_ROOT, runtimeRef.packagePath);
          expect(
            existsSync(runtimePath),
            `${action.actionId} runtime file is missing: ${runtimeRef.packagePath}`
          ).toBe(true);
          if (existsSync(runtimePath)) expect(fileHash(runtimePath)).toBe(runtimeRef.hash);
        }
      }

      const sourceSchemas = matrixPaths(row, 'sourceOwner').filter((sourcePath) =>
        sourcePath.endsWith('.schema.json')
      );
      for (const sourceSchema of sourceSchemas) {
        const schemaGap = compileSchema(sourceSchema);
        if (schemaGap) uncovered.push(`${row.owner}: ${schemaGap}`);
      }

      const manualTests = MANUAL_BEHAVIOR_TESTS.get(row.owner) ?? [];
      for (const testPath of manualTests) {
        expectFileRef({ path: testPath, hash: fileHash(path.resolve(ROOT, testPath)) });
      }

      if (row.owner === 'Consumer-test runner boundary') {
        const rootPackage = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
          scripts?: Record<string, string>;
        };
        const scripts = Object.values(rootPackage.scripts ?? {});
        const sourceTests = codePaths(row.sourceOwner).filter((entry) =>
          entry.endsWith('.test.ts')
        );
        const runnerCovered = sourceTests.every((testPath) =>
          scripts.some((script) => script.includes(testPath))
        );
        if (!runnerCovered) uncovered.push(`${row.owner}: runner omits an exact test path`);
        continue;
      }

      if (actions.length === 0 && sourceSchemas.length === 0 && manualTests.length === 0) {
        uncovered.push(`${row.owner}: no semantic action, schema, or behavior test binding`);
      }
    }

    expect(uncovered).toEqual([]);
  });
});
