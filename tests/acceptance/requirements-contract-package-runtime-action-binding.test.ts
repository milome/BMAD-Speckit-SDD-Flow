import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

type FileRef = {
  path: string;
  hash: string;
};

type ActionBinding = {
  actionId: string;
  sourceHandlerRef: FileRef;
  distHandlerRef: FileRef;
  semanticGate: {
    gateId: string;
    sourceSymbol: string;
    distSymbol: string;
  };
  inputSchemaRefs: FileRef[];
  outputSchemaRefs: FileRef[];
  behaviorTestRefs: FileRef[];
  packageDistRef: FileRef;
  installedSurfaceRefs: FileRef[];
  routingOnly: boolean;
};

type ActionBindingManifest = {
  schemaVersion: string;
  contractRef: FileRef;
  actionUniverseHash: string;
  actions: ActionBinding[];
  packageRuntimeRoutingOnlyActionCount: number;
  installedPackageActionBehaviorMismatchCount: number;
  packageActionSemanticBindingCoverage: number;
  decision: 'pass' | 'block';
};

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(
  ROOT,
  '_bmad',
  'shared',
  'requirements-contract',
  'requirements-contract-package-runtime-action-binding-manifest.json'
);
const SCHEMA_PATH = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority',
  'schemas',
  'requirements-contract-package-runtime-action-binding-manifest.schema.json'
);
const CLI_PATH = path.join(ROOT, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');
const CONTRACT_PATH = path.join(
  ROOT,
  'docs',
  'plans',
  '2026-07-11-loop-engineering-evidence-closure-remediation-goal-execution-plan.md'
);
const CONTRACT_RELATIVE_PATH =
  'docs/plans/2026-07-11-loop-engineering-evidence-closure-remediation-goal-execution-plan.md';
const CONTRACT_HASH =
  'sha256:d6f39af7a0995a16496913b2e224445a2a440e5ecf285e54f66b1fdaa46652c4';
const CONTRACT_ACTION_IDS = [
  'requirements-contract-six-model-projection-parity-verify',
  'requirements-contract-prompt-transaction-publish',
  'requirements-contract-recovery-bootstrap',
  'requirements-contract-recovery-finalize',
  'requirements-contract-finalization-safe-write',
  'requirements-contract-terminal-command-supervisor',
  'requirements-contract-judge-credentials-init',
  'requirements-contract-eval',
  'requirements-contract-candidate-package',
  'requirements-contract-changed-path-manifest',
  'requirements-contract-detached-test-rerun',
  'requirements-contract-reverse-audit',
  'requirements-contract-evidence-verify',
  'requirements-contract-bundle-publish',
  'requirements-contract-production-activate',
  'requirements-contract-production-bypass-verify',
  'requirements-contract-judge-provider-smoke',
  'requirements-contract-stage-five-star-audit',
  'requirements-contract-real-consumer-journey',
] as const;
const INTERNAL_CAPABILITY_ACTION_IDS = [
  'requirements-contract-consumer-cli-capability-observe',
] as const;
const FROZEN_ACTION_IDS = [...CONTRACT_ACTION_IDS, ...INTERNAL_CAPABILITY_ACTION_IDS].sort();

function fileHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function actionUniverseHash(actionIds: string[]): string {
  return `sha256:${createHash('sha256')
    .update(
      `requirements-contract-package-runtime-action-universe/v1\n${JSON.stringify(
        [...actionIds].sort()
      )}\n`,
      'utf8'
    )
    .digest('hex')}`;
}

function readManifest(): ActionBindingManifest | null {
  expect(existsSync(MANIFEST_PATH), 'canonical package runtime action manifest is missing').toBe(
    true
  );
  return existsSync(MANIFEST_PATH)
    ? (JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ActionBindingManifest)
    : null;
}

function expectRepositoryFileRef(ref: FileRef): void {
  const resolved = path.resolve(ROOT, ref.path);
  expect(existsSync(resolved), `bound repository file is missing: ${ref.path}`).toBe(true);
  if (existsSync(resolved)) expect(ref.hash).toBe(fileHash(resolved));
}

function registeredRuntimeActionIds(): string[] {
  const cliSource = readFileSync(CLI_PATH, 'utf8');
  return [
    ...cliSource.matchAll(/\.command\('(?<actionId>requirements-contract-[a-z0-9-]+)'\)/gu),
  ]
    .map((match) => match.groups?.actionId ?? '')
    .filter(Boolean)
    .sort();
}

describe('requirements contract package runtime action binding', () => {
  it('publishes one schema-valid canonical manifest', () => {
    const manifest = readManifest();
    if (!manifest) return;

    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(validate(manifest), JSON.stringify(validate.errors ?? [])).toBe(true);
  });

  it('binds every registered package runtime action exactly once', () => {
    const manifest = readManifest();
    if (!manifest) return;

    const actionIds = manifest.actions.map((action) => action.actionId).sort();
    expect(fileHash(CONTRACT_PATH)).toBe(CONTRACT_HASH);
    expect(actionIds, 'manifest action universe must equal the frozen 20-action set').toEqual(
      FROZEN_ACTION_IDS
    );
    expect(
      registeredRuntimeActionIds(),
      'CLI action universe must equal the frozen 20-action set'
    ).toEqual(FROZEN_ACTION_IDS);
    expect(manifest.contractRef).toEqual({
      path: CONTRACT_RELATIVE_PATH,
      hash: CONTRACT_HASH,
    });
    expect(manifest.actionUniverseHash).toBe(actionUniverseHash(FROZEN_ACTION_IDS));
    expect(new Set(actionIds).size).toBe(actionIds.length);
  });

  it('binds semantic gates, schemas, behavior tests, and hashes instead of routing success', () => {
    const manifest = readManifest();
    if (!manifest) return;

    for (const action of manifest.actions) {
      expectRepositoryFileRef(action.sourceHandlerRef);
      expectRepositoryFileRef(action.distHandlerRef);
      expect(action.semanticGate.gateId).not.toBe('');
      expect(action.semanticGate.sourceSymbol).not.toBe('');
      expect(action.semanticGate.distSymbol).not.toBe('');
      expect(action.inputSchemaRefs.length).toBeGreaterThan(0);
      expect(action.outputSchemaRefs.length).toBeGreaterThan(0);
      expect(action.behaviorTestRefs.length).toBeGreaterThan(0);
      action.inputSchemaRefs.forEach(expectRepositoryFileRef);
      action.outputSchemaRefs.forEach(expectRepositoryFileRef);
      action.behaviorTestRefs.forEach(expectRepositoryFileRef);
      expect(action.packageDistRef.hash).toBe(action.distHandlerRef.hash);
      expect(action.installedSurfaceRefs.length).toBeGreaterThan(0);
      expect(action.installedSurfaceRefs.every((ref) => ref.hash === action.packageDistRef.hash)).toBe(
        true
      );
      expect(action.routingOnly).toBe(false);
    }

    const independentlyCompleteActionCount = manifest.actions.filter(
      (action) =>
        existsSync(path.resolve(ROOT, action.sourceHandlerRef.path)) &&
        existsSync(path.resolve(ROOT, action.distHandlerRef.path)) &&
        action.semanticGate.sourceSymbol.length > 0 &&
        action.semanticGate.distSymbol.length > 0 &&
        action.inputSchemaRefs.every((ref) => existsSync(path.resolve(ROOT, ref.path))) &&
        action.outputSchemaRefs.every((ref) => existsSync(path.resolve(ROOT, ref.path))) &&
        action.behaviorTestRefs.every((ref) => existsSync(path.resolve(ROOT, ref.path))) &&
        existsSync(path.resolve(ROOT, 'packages', 'bmad-speckit', action.packageDistRef.path)) &&
        action.installedSurfaceRefs.every((ref) => existsSync(path.resolve(ref.path)))
    ).length;
    const independentlyRecomputedCoverage =
      independentlyCompleteActionCount / FROZEN_ACTION_IDS.length;
    const independentlyRecomputedRoutingOnlyCount = manifest.actions.filter(
      (action) => action.routingOnly
    ).length;
    const independentlyRecomputedInstalledMismatchCount = manifest.actions.filter((action) =>
      action.installedSurfaceRefs.some(
        (ref) => !existsSync(path.resolve(ref.path)) || fileHash(path.resolve(ref.path)) !== ref.hash
      )
    ).length;

    expect(manifest.packageRuntimeRoutingOnlyActionCount).toBe(
      independentlyRecomputedRoutingOnlyCount
    );
    expect(manifest.installedPackageActionBehaviorMismatchCount).toBe(
      independentlyRecomputedInstalledMismatchCount
    );
    expect(manifest.packageActionSemanticBindingCoverage).toBe(independentlyRecomputedCoverage);
    expect(manifest.decision).toBe(
      independentlyRecomputedCoverage === 1 &&
        independentlyRecomputedRoutingOnlyCount === 0 &&
        independentlyRecomputedInstalledMismatchCount === 0
        ? 'pass'
        : 'block'
    );
  });
});
