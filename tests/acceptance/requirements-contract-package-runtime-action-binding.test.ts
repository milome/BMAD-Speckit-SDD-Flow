import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
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
  runtimeRefs?: Array<{
    role: string;
    packagePath: string;
    hash: string;
  }>;
  routingOnly: boolean;
};

type ActionBindingManifest = {
  schemaVersion: string;
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
const MANIFEST_GENERATOR_PATH = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority',
  'scripts',
  'requirements-contract-package-runtime-action-binding-manifest.ts'
);
const CONTRACT_ACTION_IDS = [
  'requirements-contract-six-model-projection-parity-verify',
  'requirements-contract-prompt-transaction-publish',
  'requirements-contract-recovery-bootstrap',
  'requirements-contract-recovery-finalize',
  'requirements-contract-finalization-safe-write',
  'requirements-contract-terminal-command-supervisor',
  'requirements-contract-command-execution-producer',
  'requirements-contract-clean-materialization',
  'requirements-contract-judge-credentials-init',
  'requirements-contract-judge-run',
  'requirements-contract-gap-closure-readonly-auditor-adapter',
  'requirements-contract-eval',
  'requirements-contract-candidate-package',
  'requirements-contract-changed-path-manifest',
  'requirements-contract-detached-test-rerun',
  'requirements-contract-reverse-audit',
  'requirements-contract-evidence-verify',
  'requirements-contract-bundle-publish',
  'requirements-contract-production-activate',
  'requirements-contract-production-bypass-evidence-materialize',
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

function gitNullList(args: string[]): string[] {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean)
    .map((entry) => entry.replace(/\\/gu, '/'));
}

function actionBindingTrackedHashInputPaths(manifest: ActionBindingManifest): string[] {
  const declaredPaths = [
    ...new Set(
      manifest.actions.flatMap((action) => [
        action.sourceHandlerRef.path,
        ...action.inputSchemaRefs.map((ref) => ref.path),
        ...action.outputSchemaRefs.map((ref) => ref.path),
        ...action.behaviorTestRefs.map((ref) => ref.path),
      ])
    ),
  ].sort();
  const trackedPaths = new Set(gitNullList(['ls-files', '-z', '--', ...declaredPaths]));
  return declaredPaths.filter((declaredPath) => trackedPaths.has(declaredPath));
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
  const directActionIds = [...cliSource.matchAll(/\.command\('(?<actionId>requirements-contract-[a-z0-9-]+)'\)/gu)]
    .map((match) => match.groups?.actionId ?? '')
    .filter(Boolean);
  if (
    /(?:const\s+)?judgePublicCommand\s*=\s*program\s*\.command\('judge'\)/u.test(cliSource) &&
    /judgePublicCommand\s*\.command\('run'\)/u.test(cliSource)
  ) {
    directActionIds.push('requirements-contract-judge-run');
  }
  return directActionIds.sort();
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
    expect(actionIds, 'manifest action universe must equal the frozen action set').toEqual(
      FROZEN_ACTION_IDS
    );
    expect(
      registeredRuntimeActionIds(),
      'CLI action universe must equal the frozen action set'
    ).toEqual(FROZEN_ACTION_IDS);
    expect(manifest.actionUniverseHash).toBe(actionUniverseHash(FROZEN_ACTION_IDS));
    expect(new Set(actionIds).size).toBe(actionIds.length);
  });

  it('keeps product action binding independent from Goal execution contracts', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, unknown>;
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as {
      required?: string[];
      properties?: {
        schemaVersion?: { const?: string };
        [key: string]: unknown;
      };
    };
    const generatorSource = readFileSync(MANIFEST_GENERATOR_PATH, 'utf8');

    expect(manifest.schemaVersion).toBe(
      'requirements-contract-package-runtime-action-binding-manifest/v2'
    );
    expect(schema.properties?.schemaVersion?.const).toBe(
      'requirements-contract-package-runtime-action-binding-manifest/v2'
    );
    expect(manifest).not.toHaveProperty('contractRef');
    expect(schema.required ?? []).not.toContain('contractRef');
    expect(schema.properties ?? {}).not.toHaveProperty('contractRef');
    expect(generatorSource).not.toContain('CONTRACT_RELATIVE_PATH');
    expect(generatorSource).not.toContain('CONTRACT_HASH');
    expect(generatorSource).not.toContain('docs/plans/');
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
      expect(
        action.installedSurfaceRefs.every((ref) => ref.hash === action.packageDistRef.hash)
      ).toBe(true);
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
        action.installedSurfaceRefs.every((ref) =>
          existsSync(path.resolve(ROOT, 'packages', 'bmad-speckit', ref.path))
        )
    ).length;
    const independentlyRecomputedCoverage =
      independentlyCompleteActionCount / FROZEN_ACTION_IDS.length;
    const independentlyRecomputedRoutingOnlyCount = manifest.actions.filter(
      (action) => action.routingOnly
    ).length;
    const independentlyRecomputedInstalledMismatchCount = manifest.actions.filter((action) =>
      action.installedSurfaceRefs.some((ref) => {
        const installedSurfacePath = path.resolve(ROOT, 'packages', 'bmad-speckit', ref.path);
        return !existsSync(installedSurfacePath) || fileHash(installedSurfacePath) !== ref.hash;
      })
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

  it('pins tracked action-binding hash inputs to LF across clean Windows worktrees', () => {
    const manifest = readManifest();
    if (!manifest) return;

    const trackedHashInputPaths = actionBindingTrackedHashInputPaths(manifest);
    expect(trackedHashInputPaths.length).toBeGreaterThan(0);

    const attributeOutput = gitNullList([
      'check-attr',
      '-z',
      'eol',
      '--',
      ...trackedHashInputPaths,
    ]);
    const attributeValues = new Map<string, string>();
    for (let index = 0; index + 2 < attributeOutput.length; index += 3) {
      attributeValues.set(attributeOutput[index], attributeOutput[index + 2]);
    }

    for (const trackedHashInputPath of trackedHashInputPaths) {
      expect(
        attributeValues.get(trackedHashInputPath),
        `${trackedHashInputPath} must use eol=lf because action-binding hashes bind raw bytes`
      ).toBe('lf');
    }
  });

  it('binds current Recovery and Judge runtime owners without legacy schema paths', () => {
    const manifest = readManifest();
    if (!manifest) return;

    const stageAudit = manifest.actions.find(
      (action) => action.actionId === 'requirements-contract-stage-five-star-audit'
    );
    const reverseAudit = manifest.actions.find(
      (action) => action.actionId === 'requirements-contract-reverse-audit'
    );
    const judgeRun = manifest.actions.find(
      (action) => action.actionId === 'requirements-contract-judge-run'
    );
    expect(stageAudit).toBeDefined();
    expect(reverseAudit).toBeDefined();
    expect(judgeRun).toBeDefined();
    expect(
      manifest.actions.find(
        (action) => action.actionId === 'requirements-contract-critical-auditor-judge-adapter'
      )
    ).toBeUndefined();
    if (!stageAudit || !reverseAudit || !judgeRun) return;

    const stageOutputPaths = stageAudit.outputSchemaRefs.map((ref) => ref.path);
    expect(stageOutputPaths).toContain(
      'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-stage-candidate-revocation-receipt.schema.json'
    );
    expect(stageOutputPaths).not.toContain(
      'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-stage-five-star-candidate-revocation-receipt.schema.json'
    );

    expect(reverseAudit.inputSchemaRefs.map((ref) => ref.path)).toEqual(
      expect.arrayContaining([
        'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-runtime.schema.json',
        'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-credentials.schema.json',
        'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-provider-registry.schema.json',
      ])
    );
    expect(reverseAudit.outputSchemaRefs.map((ref) => ref.path)).toContain(
      'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-normalized-judge-response.schema.json'
    );
    expect(judgeRun.sourceHandlerRef.path).toBe(
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-command.ts'
    );
    expect(judgeRun.semanticGate.sourceSymbol).toBe('requirementsContractJudgeRunCommand');
    expect(judgeRun.inputSchemaRefs.map((ref) => ref.path)).toEqual(
      expect.arrayContaining([
        'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-critical-auditor-judge-request.schema.json',
        'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-final-acceptance-judge-request.schema.json',
        'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-attempt-key.schema.json',
        'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-invocation-readiness-receipt.schema.json',
      ])
    );
    expect(judgeRun.outputSchemaRefs.map((ref) => ref.path)).toContain(
      'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-cli-judge-execution-receipt.schema.json'
    );
    expect(judgeRun.outputSchemaRefs.map((ref) => ref.path)).toContain(
      'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-invocation-receipt.schema.json'
    );
    expect(judgeRun.runtimeRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'legacy-critical-auditor-judge-adapter' }),
        expect.objectContaining({ role: 'claude-code-cli-judge-adapter' }),
        expect.objectContaining({ role: 'codex-cli-judge-adapter' }),
      ])
    );
    expect(reverseAudit.runtimeRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'judge-credential-resolver' }),
        expect.objectContaining({ role: 'judge-provider-registry' }),
        expect.objectContaining({ role: 'openai-compatible-judge-adapter' }),
        expect.objectContaining({ role: 'anthropic-compatible-judge-adapter' }),
        expect.objectContaining({ role: 'claude-code-cli-judge-adapter' }),
        expect.objectContaining({ role: 'codex-cli-judge-adapter' }),
        expect.objectContaining({ role: 'judge-provider-registry-projection' }),
      ])
    );
  });
});
