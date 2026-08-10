const { after, before, describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { load } = require('js-yaml');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
let packageTestSession;

function acquirePackageTestSessionLock(packageRoot) {
  const lockDir = path.join(packageRoot, 'node_modules', '.package-test-session.lock');
  fs.mkdirSync(path.dirname(lockDir), { recursive: true });
  const startedAt = Date.now();
  while (Date.now() - startedAt < 900_000) {
    try {
      fs.mkdirSync(lockDir);
      return {
        release() {
          fs.rmSync(lockDir, { recursive: true, force: true });
        },
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (fs.existsSync(lockDir) && Date.now() - fs.statSync(lockDir).mtimeMs > 7_200_000) {
        fs.rmSync(lockDir, { recursive: true, force: true });
        continue;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
  throw new Error(`timed out acquiring package test session lock: ${lockDir}`);
}

before(
  () => {
    packageTestSession = acquirePackageTestSessionLock(PACKAGE_ROOT);
  },
  { timeout: 900_000 }
);

after(() => {
  packageTestSession?.release();
});

const BUILD_SCRIPT = path.join(PACKAGE_ROOT, 'scripts', 'build-main-agent-dist.cjs');
const PACKAGE_JSON = path.join(PACKAGE_ROOT, 'package.json');
const CLI_PATH = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');
const RELEASE_WORKFLOW = path.join(REPO_ROOT, '.github', 'workflows', 'release.yml');
const SRC_JS_ALLOWLIST = path.join(PACKAGE_ROOT, 'scripts', 'src-js-allowlist.json');
const PACKAGE_DIST_ROOT = path.join(PACKAGE_ROOT, 'dist');
const DIST_ROOT = path.join(PACKAGE_ROOT, 'dist', 'main-agent');
const RUNTIME_ASSET_MANIFEST = path.join(DIST_ROOT, 'runtime-asset-manifest.json');
const RUNTIME_BUILD_AUTHORITY_RECEIPT = path.join(
  DIST_ROOT,
  'runtime-build-authority-receipt.json'
);
const ARTIFACT_ROLE_OWNER = path.join(
  PACKAGE_ROOT,
  'src',
  'main-agent',
  'source-authority',
  'scripts',
  'requirements-contract-artifact-role-classifier.ts'
);
const ARTIFACT_ROLE_REGISTRY_RELATIVE_PATH = path.join(
  'shared',
  'requirements-contract',
  'requirements-contract-artifact-role-registry.json'
);
const PROJECTION_REGISTRY_RELATIVE_PATH = path.join(
  'shared',
  'requirements-contract',
  'requirements-contract-projection-registry.json'
);
const CHECKPOINT_SEMANTIC_VALIDATION_SCRIPT =
  'source-authority/scripts/requirements-contract-checkpoint-semantic-validation.js';
const CHECKPOINT_SEMANTIC_VALIDATION_SCHEMA =
  'source-authority/schemas/requirements-contract-checkpoint-semantic-validation-receipt.schema.json';
const RENDER_ROUNDTRIP_GATE_SCRIPT =
  'source-authority/scripts/requirements-contract-render-roundtrip-gate.js';
const TYPE_SCRIPT_FAMILY_SOURCE_RE = /\.(?:ts|tsx|cts|mts)$/u;
const TYPE_SCRIPT_DECLARATION_SOURCE_RE = /\.d\.(?:ts|cts|mts)$/u;
const SOURCE_AUTHORITY_TYPE_ONLY_FILES = new Set([
  'scripts/governance-hook-types.ts',
  'scripts/i18n/field-meta-types.ts',
]);
const EXPECTED_PACKAGE_RUNTIME_TYPESCRIPT_FILES = [
  'runtime/host-runtime-mode.ts',
  'runtime/supervised-worker-runtime.ts',
  'actions/native-goal-command.ts',
  'actions/native-goal-invoker.ts',
];
const PARTITION_PACKAGE_ASSETS = [
  'shared/goal-contract/goal-contract-partition-methodology-profile.json',
  'shared/goal-contract/goal-contract-partition-methodology-profile.schema.json',
  'shared/goal-contract/goal-contract-sequence-applicability-receipt.schema.json',
  'shared/goal-contract/goal-contract-semantic-provider-registry.json',
  'shared/goal-contract/goal-contract-semantic-provider-registry.schema.json',
  'shared/goal-contract/goal-contract-execution-projection.schema.json',
  'shared/goal-contract/goal-contract-partition-policy.json',
  'shared/goal-contract/goal-contract-partition-policy.schema.json',
  'shared/goal-contract/goal-contract-partition-impact-policy.json',
  'shared/goal-contract/goal-contract-partition-impact-policy.schema.json',
  'shared/goal-contract/goal-contract-partition-impact-graph.schema.json',
  'shared/goal-contract/goal-contract-partition-closure-feasibility-receipt.schema.json',
  'shared/goal-contract/goal-contract-partition-impact-drift-receipt.schema.json',
  'shared/goal-contract/goal-contract-partition-manifest.schema.json',
  'shared/goal-contract/goal-contract-partition-output-authority.schema.json',
  'shared/goal-contract/goal-contract-lifecycle-authority-binding.schema.json',
  'shared/goal-contract/goal-contract-partition-analysis-receipt.schema.json',
  'shared/goal-contract/goal-contract-partition-global-coverage-receipt.schema.json',
  'shared/goal-contract/goal-contract-partition-selection-receipt.schema.json',
  'shared/goal-contract/goal-contract-dependency-compatibility-receipt.schema.json',
  'shared/goal-contract/goal-contract-partition-child-coverage-receipt.schema.json',
  'shared/goal-contract/goal-contract-partition-child-generation-receipt.schema.json',
  'shared/goal-contract/goal-contract-partition-release-gate-receipt.schema.json',
];
const EXPECTED_PACKAGE_RUNTIME_ASSETS = [
  ...PARTITION_PACKAGE_ASSETS.map((relativePath) => `_bmad/${relativePath}`),
  '_bmad/runtime/hooks/deferred-gap-governance.cjs',
  '_bmad/core/agents/code-reviewer/base-prompt.md',
  '_bmad/core/agents/code-reviewer/metadata.json',
  '_bmad/core/agents/code-reviewer/profiles.json',
  '_bmad/core/skills/bmad-party-mode/workflow.md',
  '_bmad/core/skills/bmad-party-mode/steps/step-01-agent-loading.md',
  '_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md',
  '_bmad/core/skills/bmad-party-mode/steps/step-03-graceful-exit.md',
  '_bmad/shared/contract-execution-manifest/build-contract-execution-manifest.js',
  '_bmad/shared/contract-execution-manifest/schema/contract-execution-manifest.schema.json',
  '_bmad/shared/critical-auditor-profile/load-critical-auditor-profile.js',
  '_bmad/shared/critical-auditor-profile/validate-critical-auditor-profile.js',
  '_bmad/shared/critical-auditor-profile/critical-auditor-profile.schema.json',
  '_bmad/shared/critical-auditor-profile/critical-auditor-profile.json',
];
const EXPECTED_DIST_FILES = [
  'index.js',
  'runtime.js',
  'runtime/host-runtime-mode.js',
  'runtime/supervised-worker-runtime.js',
  'runtime/diagnose-bmad-state.js',
  'runtime/parallel-mission-control.js',
  'actions/inspect.js',
  'actions/chaos-scenarios.js',
  'actions/prompt-transaction-publish.js',
  'actions/confirm-scope.js',
  'actions/delivery-closeout-gate.js',
  'actions/delivery-evidence-run.js',
  'actions/dispatch-plan.js',
  'actions/dual-host-pr-orchestrator.js',
  'actions/full-orchestration.js',
  'actions/implementation-readiness-gate.js',
  'actions/native-goal-invoker.js',
  'actions/release-gate.js',
  'actions/quality-gate.js',
  'actions/delivery-truth-gate.js',
  'actions/soak-runner.js',
  'actions/unified-ingress.js',
  'auditor-host/run-auditor-host.cjs',
  'helpers/bmad-state-reader.js',
  'helpers/e2e-verify-paths.js',
  'helpers/query-validate.js',
  'helpers/runtime-step-state.js',
  'helpers/verify-agent-files.js',
  'helpers/write-runtime-context.cjs',
];
const EXPECTED_SOURCE_AUTHORITY_RUNTIME_IMPORTS = [
  {
    file: 'source-authority/scripts/critical-auditor-profile.js',
    forbidden: '../../../../../../_bmad/shared/critical-auditor-profile',
    required: '../../../../_bmad/shared/critical-auditor-profile',
    runtimeTarget: '_bmad/shared/critical-auditor-profile/load-critical-auditor-profile.js',
    runtimeTargetBase: 'package',
  },
  {
    file: 'source-authority/scripts/query-validate.js',
    forbidden: '../packages/scoring/query',
    required: '@bmad-speckit/scoring/query',
    runtimeTarget: 'node_modules/@bmad-speckit/scoring/dist/query/index.js',
    runtimeTargetBase: 'package',
  },
  {
    file: 'source-authority/scripts/bmad-help-routing-state.js',
    forbidden: '../packages/runtime-context/src/context',
    required: '@bmad-speckit/runtime-context/context',
    runtimeTarget: 'node_modules/@bmad-speckit/runtime-context/dist/context.js',
    runtimeTargetBase: 'package',
  },
  {
    file: 'source-authority/scripts/ralph-method/schema.js',
    forbidden: '../../packages/ralph-method/src/schema',
    required: '@bmad-speckit/ralph-method/schema',
    runtimeTarget: 'node_modules/@bmad-speckit/ralph-method/dist/schema.js',
    runtimeTargetBase: 'package',
  },
];
const EXPECTED_SOURCE_AUTHORITY_ASSETS = [
  'templates/requirements-contract-source-prd-template.md',
  'templates/requirements-contract-source-prd-template.schema.json',
];

function runtimeTargetBasePath(base) {
  if (base === 'package') return PACKAGE_ROOT;
  if (base === 'repo') return REPO_ROOT;
  if (base === 'packageDist') return PACKAGE_DIST_ROOT;
  if (base === undefined || base === 'dist') return DIST_ROOT;
  throw new Error(`unknown runtimeTargetBase: ${base}`);
}

function isTypeScriptRuntimeSourcePath(relativePath) {
  return (
    TYPE_SCRIPT_FAMILY_SOURCE_RE.test(relativePath) &&
    !TYPE_SCRIPT_DECLARATION_SOURCE_RE.test(relativePath)
  );
}

function sourceAuthorityRelativeToDistRelativePath(relativePath) {
  if (relativePath === 'scripts/deferred-gap-governance-d-cts-source.ts') {
    return 'source-authority/scripts/deferred-gap-governance.d.cts.js';
  }
  const distPath = `source-authority/${relativePath}`;
  if (TYPE_SCRIPT_DECLARATION_SOURCE_RE.test(distPath)) return distPath;
  if (/\.source\.(?:ts|tsx)$/u.test(distPath))
    return distPath.replace(/\.source\.(?:ts|tsx)$/u, '.js');
  if (/\.(?:ts|tsx)$/u.test(distPath)) return distPath.replace(/\.(?:ts|tsx)$/u, '.js');
  if (/\.cts$/u.test(distPath)) return distPath.replace(/\.cts$/u, '.cjs');
  if (/\.mts$/u.test(distPath)) return distPath.replace(/\.mts$/u, '.mjs');
  throw new Error(`unsupported source-authority TypeScript path: ${relativePath}`);
}

function collectSourceAuthorityTypeScriptFiles(dir, base = dir) {
  const collected = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['tests', 'packages', '_bmad', '_bmad-output'].includes(entry.name)) continue;
      collected.push(...collectSourceAuthorityTypeScriptFiles(fullPath, base));
      continue;
    }
    if (!entry.isFile() || !isTypeScriptRuntimeSourcePath(entry.name)) continue;
    const relativePath = path.relative(base, fullPath).replace(/\\/g, '/');
    if (!SOURCE_AUTHORITY_TYPE_ONLY_FILES.has(relativePath)) collected.push(relativePath);
  }
  return collected.sort();
}

function collectPackageJsonFiles(dir, base = dir) {
  const collected = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectPackageJsonFiles(fullPath, base));
      continue;
    }
    if (!entry.isFile() || entry.name !== 'package.json') continue;
    collected.push(path.relative(base, fullPath).replace(/\\/g, '/'));
  }
  return collected.sort();
}

function collectFiles(dir) {
  const collected = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectFiles(fullPath));
      continue;
    }
    if (entry.isFile()) collected.push(fullPath);
  }
  return collected.sort();
}

function collectTrackedPackageSourceFiles() {
  return execFileSync('git', ['ls-files', 'packages/bmad-speckit/src'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((relativePath) => relativePath.replace(/\\/g, '/'));
}

function registeredRuntimeActionIds() {
  const cliSource = fs.readFileSync(CLI_PATH, 'utf8');
  const directActionIds = [
    ...cliSource.matchAll(/\.command\('(?<actionId>requirements-contract-[a-z0-9-]+)'\)/gu),
  ]
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

function collectSourceAuthorityGeneratedJavaScriptTwins() {
  const sourceAuthorityScriptsRoot = path.join(
    PACKAGE_ROOT,
    'src',
    'main-agent',
    'source-authority',
    'scripts'
  );
  const twins = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
      const withoutExtension = fullPath.replace(/\.js$/u, '');
      if (fs.existsSync(`${withoutExtension}.ts`) || fs.existsSync(`${withoutExtension}.tsx`)) {
        twins.push(
          `packages/bmad-speckit/src/main-agent/source-authority/scripts/${path.relative(sourceAuthorityScriptsRoot, fullPath).replace(/\\/g, '/')}`
        );
      }
    }
  };
  visit(sourceAuthorityScriptsRoot);
  return twins.sort();
}

function packageRuntimeTypeScriptDistRelativePath(relativePath) {
  if (/\.(?:ts|tsx)$/u.test(relativePath)) return relativePath.replace(/\.(?:ts|tsx)$/u, '.js');
  if (/\.cts$/u.test(relativePath)) return relativePath.replace(/\.cts$/u, '.cjs');
  if (/\.mts$/u.test(relativePath)) return relativePath.replace(/\.mts$/u, '.mjs');
  throw new Error(`unsupported package runtime TypeScript source: ${relativePath}`);
}

function withTemporarilyMovedFiles(relativePaths, callback) {
  const stamp = `test-backup-${process.pid}-${Date.now()}`;
  const moved = [];

  try {
    for (const relativePath of relativePaths) {
      const filePath = path.join(REPO_ROOT, relativePath);
      const backupPath = `${filePath}.${stamp}`;
      if (!fs.existsSync(filePath)) {
        moved.push({ filePath, backupPath, existed: false });
        continue;
      }
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.renameSync(filePath, backupPath);
      moved.push({ filePath, backupPath, existed: true });
    }
    callback();
  } finally {
    for (const { filePath, backupPath, existed } of moved.reverse()) {
      if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
      if (existed && fs.existsSync(backupPath)) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.renameSync(backupPath, filePath);
      }
    }
  }
}

describe('main-agent dist build', () => {
  it('declares package build and pack surface for main-agent dist', () => {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    assert.equal(typeof pkg.scripts['build:main-agent-dist'], 'string');
    assert.match(pkg.scripts.prepack, /build:main-agent-dist/);
    assert.ok(pkg.files.includes('dist/'));
    assert.ok(pkg.files.includes('_bmad/'));
    assert.ok(pkg.files.includes('node_modules/@bmad-speckit/'));
    assert.equal(
      pkg.files.includes('src/'),
      false,
      'npm package must not publish source snapshots'
    );
    assert.equal(pkg.files.includes('tests/'), false, 'npm package must not publish package tests');
    assert.equal(
      pkg.files.includes('test-nonempty/'),
      false,
      'npm package must not publish test-only sentinel assets'
    );
  });

  it('separates matrix full-suite evidence from governed package preparation', () => {
    const workflow = load(fs.readFileSync(RELEASE_WORKFLOW, 'utf8'));
    const fallback = workflow.jobs['release-full-fallback'];
    const releaseRuns = workflow.jobs.release.steps.map((step) => String(step.run || ''));

    assert.equal(fallback.uses, './.github/workflows/ci.yml');
    assert.equal(fallback.with.requested_profile, 'release-full');
    assert.ok(
      releaseRuns.some((command) => command.includes('npm run ci:prepare-package')),
      'release workflow must prepare the canonical package in a governed detached worktree'
    );
    assert.equal(
      releaseRuns.some((command) => command.includes('npm run ci:release-full')),
      false,
      'release job must not rerun full-suite shards serially'
    );
    const descriptorIndex = releaseRuns.findIndex((command) =>
      command.includes('prepublish-check.js --verify-descriptor')
    );
    const buildIndex = releaseRuns.findIndex((command) => command === 'npm run build');
    const gatesIndex = workflow.jobs.release.steps.findIndex((step) =>
      String(step.name || '').includes('protected release gates')
    );
    assert.ok(descriptorIndex >= 0, 'release workflow must verify package reproducibility');
    assert.ok(
      buildIndex > descriptorIndex,
      'release runtime build must follow package verification'
    );
    assert.ok(buildIndex < gatesIndex, 'release runtime build must precede protected gates');
  });

  it('fails closed when package source JavaScript is not explicitly allowlisted', () => {
    const manifest = JSON.parse(fs.readFileSync(SRC_JS_ALLOWLIST, 'utf8'));
    assert.equal(manifest.schemaVersion, 'bmad-speckit-src-js-allowlist/v1');
    assert.deepEqual(
      [...manifest.allowedPaths].sort(),
      manifest.allowedPaths,
      'src JS allowlist must stay sorted for reviewability'
    );
    assert.equal(
      new Set(manifest.allowedPaths).size,
      manifest.allowedPaths.length,
      'src JS allowlist must not contain duplicate paths'
    );

    const allowed = new Set(manifest.allowedPaths);
    const tracked = new Set(collectTrackedPackageSourceFiles());
    const actual = [...tracked]
      .filter((relativePath) => relativePath.endsWith('.js'))
      .sort((a, b) => a.localeCompare(b));
    const unexpected = actual.filter((relativePath) => !allowed.has(relativePath));
    const stale = manifest.allowedPaths.filter(
      (relativePath) => !fs.existsSync(path.join(REPO_ROOT, relativePath))
    );
    const untracked = manifest.allowedPaths.filter((relativePath) => !tracked.has(relativePath));

    assert.deepEqual(unexpected, [], 'non-allowlisted package source JS files must fail closed');
    assert.deepEqual(stale, [], 'src JS allowlist must not contain stale deleted files');
    assert.deepEqual(
      untracked,
      [],
      'src JS allowlist must not contain ignored or generated files outside git source control'
    );
    assert.equal(
      allowed.has('packages/bmad-speckit/src/main-agent/actions/native-goal-invoker.ts'),
      false,
      'native-goal-invoker source authority must be TypeScript only'
    );
    assert.equal(
      allowed.has('packages/bmad-speckit/src/main-agent/actions/native-goal-command.ts'),
      false,
      'native-goal-command source authority must be TypeScript only'
    );
    assert.equal(
      allowed.has('packages/bmad-speckit/src/main-agent/runtime/host-runtime-mode.ts'),
      false,
      'host-runtime-mode source authority must be TypeScript only'
    );
    assert.equal(
      allowed.has('packages/bmad-speckit/src/main-agent/runtime/supervised-worker-runtime.ts'),
      false,
      'supervised-worker-runtime source authority must be TypeScript only'
    );
  });

  it('does not retain generated JavaScript twins for source-authority TypeScript scripts', () => {
    assert.deepEqual(
      collectSourceAuthorityGeneratedJavaScriptTwins(),
      [],
      'source-authority/scripts must keep TS source only when an equivalent TS file exists'
    );
  });

  it('generates required dist runtime files from package source', () => {
    execFileSync(process.execPath, [BUILD_SCRIPT], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const actionBindingManifestRelativePath = path.join(
      'shared',
      'requirements-contract',
      'requirements-contract-package-runtime-action-binding-manifest.json'
    );
    const actionBindingManifestPaths = [
      path.join(REPO_ROOT, '_bmad', actionBindingManifestRelativePath),
      path.join(REPO_ROOT, '.codex', actionBindingManifestRelativePath),
      path.join(REPO_ROOT, '.cursor', actionBindingManifestRelativePath),
      path.join(REPO_ROOT, '.claude', actionBindingManifestRelativePath),
      path.join(PACKAGE_ROOT, '_bmad', actionBindingManifestRelativePath),
    ];
    for (const manifestPath of actionBindingManifestPaths) {
      assert.equal(fs.existsSync(manifestPath), true, `missing ${manifestPath}`);
    }
    const actionBindingManifestBytes = fs.readFileSync(actionBindingManifestPaths[0]);
    const actionBindingManifestHash = createHash('sha256')
      .update(actionBindingManifestBytes)
      .digest('hex');
    for (const manifestPath of actionBindingManifestPaths.slice(1)) {
      assert.equal(
        createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex'),
        actionBindingManifestHash,
        `package runtime action-binding manifest drifted: ${manifestPath}`
      );
    }
    const actionBindingManifest = JSON.parse(actionBindingManifestBytes.toString('utf8'));
    const manifestActionIds = actionBindingManifest.actions.map((action) => action.actionId).sort();
    assert.deepEqual(
      manifestActionIds,
      registeredRuntimeActionIds(),
      'build must project every registered package runtime action exactly once'
    );
    assert.equal(
      new Set(manifestActionIds).size,
      manifestActionIds.length,
      'build must not project duplicate package runtime actions'
    );
    const finalizerBindings = actionBindingManifest.actions.filter(
      (action) => action.actionId === 'requirements-contract-recovery-finalize'
    );
    assert.equal(finalizerBindings.length, 1, 'recovery finalizer binding must be unique');
    assert.equal(
      finalizerBindings[0].semanticGate.sourceSymbol,
      'requirementsContractRecoveryFinalizeCommand'
    );
    assert.equal(actionBindingManifest.packageRuntimeRoutingOnlyActionCount, 0);
    assert.equal(actionBindingManifest.installedPackageActionBehaviorMismatchCount, 0);
    assert.equal(actionBindingManifest.packageActionSemanticBindingCoverage, 1);
    assert.equal(actionBindingManifest.decision, 'pass');

    const requirementsContractSurfaceRoots = [
      path.join(REPO_ROOT, '_bmad'),
      path.join(REPO_ROOT, '.codex'),
      path.join(REPO_ROOT, '.cursor'),
      path.join(REPO_ROOT, '.claude'),
      path.join(PACKAGE_ROOT, '_bmad'),
    ];
    const artifactRoleRegistryPaths = requirementsContractSurfaceRoots.map((surfaceRoot) =>
      path.join(surfaceRoot, ARTIFACT_ROLE_REGISTRY_RELATIVE_PATH)
    );
    const artifactRoleOwnerHash = `sha256:${createHash('sha256')
      .update(fs.readFileSync(ARTIFACT_ROLE_OWNER))
      .digest('hex')}`;
    const artifactRoleRegistryBytes = fs.readFileSync(artifactRoleRegistryPaths[0]);
    const artifactRoleRegistryHash = `sha256:${createHash('sha256')
      .update(artifactRoleRegistryBytes)
      .digest('hex')}`;
    const artifactRoleRegistry = JSON.parse(artifactRoleRegistryBytes.toString('utf8'));
    assert.equal(
      artifactRoleRegistry.owner.hash,
      artifactRoleOwnerHash,
      'build must refresh the artifact-role registry from its classifier owner'
    );
    for (const registryPath of artifactRoleRegistryPaths.slice(1)) {
      assert.deepEqual(
        fs.readFileSync(registryPath),
        artifactRoleRegistryBytes,
        `artifact-role registry surface drifted: ${registryPath}`
      );
    }
    const projectionRegistry = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, '_bmad', PROJECTION_REGISTRY_RELATIVE_PATH), 'utf8')
    );
    const artifactRoleProjection = projectionRegistry.projections.find(
      (projection) => projection.projectionId === 'artifact_role_registry'
    );
    assert.equal(
      artifactRoleProjection?.canonicalHash,
      artifactRoleRegistryHash,
      'projection registry must hash the artifact-role registry generated in the same build'
    );

    for (const relativePath of EXPECTED_DIST_FILES) {
      const distFile = path.join(DIST_ROOT, relativePath);
      assert.equal(fs.existsSync(distFile), true, `missing ${relativePath}`);
      const source = fs.readFileSync(distFile, 'utf8');
      assert.doesNotMatch(source, /scripts[\\/]main-agent-orchestration\.ts/);
      assert.doesNotMatch(source, /compiled[\\/]main-agent-orchestration\.cjs/);
    }

    assert.equal(fs.existsSync(RUNTIME_ASSET_MANIFEST), true);
    assert.equal(fs.existsSync(RUNTIME_BUILD_AUTHORITY_RECEIPT), true);
    const runtimeManifest = JSON.parse(fs.readFileSync(RUNTIME_ASSET_MANIFEST, 'utf8'));
    assert.equal(runtimeManifest.schemaVersion, 'bmad-speckit-main-agent-runtime-assets/v2');
    assert.equal(
      runtimeManifest.hashDomainRegistry.schemaVersion,
      'requirements-contract-hash-domains/v2'
    );
    for (const entry of runtimeManifest.entries) {
      assert.match(entry.sourceBytesHash, /^sha256:[a-f0-9]{64}$/u);
      if (entry.materialization !== 'build_metadata') {
        assert.match(entry.targetBytesHash, /^sha256:[a-f0-9]{64}$/u);
      }
    }
    const buildAuthority = JSON.parse(fs.readFileSync(RUNTIME_BUILD_AUTHORITY_RECEIPT, 'utf8'));
    assert.equal(buildAuthority.schemaVersion, 'bmad-speckit-runtime-build-authority/v1');
    assert.equal(
      buildAuthority.hashDomainRegistry.schemaVersion,
      'requirements-contract-hash-domains/v2'
    );
    for (const field of [
      'sourceInputManifestHash',
      'buildScriptHash',
      'dependencyLockHash',
      'runtimeAssetManifestHash',
      'distRuntimeHash',
      'packageRuntimeHash',
      'distBuildHash',
    ]) {
      assert.match(buildAuthority[field], /^sha256:[a-f0-9]{64}$/u, `${field} is required`);
    }
    assert.equal(buildAuthority.decision, 'pass');
    for (const packageId of JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8')).bundleDependencies) {
      const packageName = packageId.slice('@bmad-speckit/'.length);
      const bundledRoot = path.join(PACKAGE_ROOT, 'node_modules', '@bmad-speckit', packageName);
      assert.equal(
        fs.existsSync(path.join(bundledRoot, 'package.json')),
        true,
        `bundled runtime package missing: ${packageId}`
      );
      assert.equal(
        fs.existsSync(path.join(bundledRoot, 'src')),
        false,
        `bundled runtime package must not include source snapshots: ${packageId}`
      );
      assert.equal(
        fs.existsSync(path.join(bundledRoot, 'tests')),
        false,
        `bundled runtime package must not include tests: ${packageId}`
      );
    }

    for (const relativePath of EXPECTED_PACKAGE_RUNTIME_TYPESCRIPT_FILES) {
      const sourceFile = path.join(PACKAGE_ROOT, 'src', 'main-agent', relativePath);
      const forbiddenSourceJs = sourceFile.replace(/\.(?:ts|tsx)$/u, '.js');
      const distRelativePath = packageRuntimeTypeScriptDistRelativePath(relativePath);
      const distFile = path.join(DIST_ROOT, distRelativePath);
      const sourceAuthorityDistFile = path.join(
        DIST_ROOT,
        'source-authority',
        'packages',
        'bmad-speckit',
        'src',
        'main-agent',
        distRelativePath
      );

      assert.equal(fs.existsSync(sourceFile), true, `missing package TS source ${relativePath}`);
      assert.equal(
        fs.existsSync(forbiddenSourceJs),
        false,
        `package source JS must not coexist with TS source authority: ${relativePath}`
      );
      assert.equal(
        fs.existsSync(distFile),
        true,
        `package TS source was not compiled: ${relativePath}`
      );
      assert.equal(
        fs.existsSync(sourceAuthorityDistFile),
        false,
        `package TS source must not be mirrored inside source-authority dist: ${relativePath}`
      );
      const distSource = fs.readFileSync(distFile, 'utf8');
      assert.doesNotMatch(distSource, /\b(?:tsx|ts-node)\b/i);
      assert.doesNotMatch(distSource, /packages[\\/]bmad-speckit[\\/]src[\\/]main-agent/u);
    }

    assert.equal(
      fs.existsSync(path.join(DIST_ROOT, 'compiled', 'main-agent-orchestration.cjs')),
      false,
      'compiled orchestration fallback must not be emitted to dist'
    );

    const sourceAuthorityRoot = path.join(PACKAGE_ROOT, 'src', 'main-agent', 'source-authority');
    const sourceAuthorityTypeScriptFiles =
      collectSourceAuthorityTypeScriptFiles(sourceAuthorityRoot);
    assert.ok(
      sourceAuthorityTypeScriptFiles.length > 0,
      'source-authority TypeScript inventory must not be empty'
    );
    for (const relativePath of sourceAuthorityTypeScriptFiles) {
      const distRelativePath = sourceAuthorityRelativeToDistRelativePath(relativePath);
      const distFile = path.join(DIST_ROOT, distRelativePath);
      assert.equal(
        fs.existsSync(distFile),
        true,
        `source-authority TypeScript file was not compiled to dist JS: ${relativePath}`
      );
    }

    const checkpointSemanticValidationScript = path.join(
      DIST_ROOT,
      CHECKPOINT_SEMANTIC_VALIDATION_SCRIPT
    );
    const checkpointSemanticValidationSchema = path.join(
      DIST_ROOT,
      CHECKPOINT_SEMANTIC_VALIDATION_SCHEMA
    );
    const checkpointSemanticValidationSourceSchema = path.join(
      PACKAGE_ROOT,
      'src',
      'main-agent',
      CHECKPOINT_SEMANTIC_VALIDATION_SCHEMA
    );
    assert.equal(
      fs.existsSync(checkpointSemanticValidationScript),
      true,
      'dist missing checkpoint semantic-validation runtime'
    );
    assert.equal(
      fs.existsSync(checkpointSemanticValidationSchema),
      true,
      'dist missing checkpoint semantic-validation schema'
    );
    assert.equal(
      fs.readFileSync(checkpointSemanticValidationSchema, 'utf8'),
      fs.readFileSync(checkpointSemanticValidationSourceSchema, 'utf8'),
      'checkpoint semantic-validation schema drifted from source'
    );

    const checkpointSemanticValidationRuntime = require(checkpointSemanticValidationScript);
    const hash = `sha256:${'a'.repeat(64)}`;
    const receipt = checkpointSemanticValidationRuntime.createCheckpointSemanticValidationReceipt({
      checkpointId: 'cp-00-semantic-kernel',
      validatorIdentity: 'dist-checkpoint-semantic-validator',
      validatorVersion: '1.0.0',
      validatorHash: hash,
      recordId: 'REQ-DIST-CHECKPOINT',
      requirementSetId: 'dist-checkpoint-set',
      implementationAttemptId: 'IMPL-ATTEMPT-DIST-CHECKPOINT',
      sourceDocumentHash: hash,
      implementationConfirmationHash: hash,
      semanticModelHash: hash,
      semanticConservationManifestHash: hash,
      persistenceStatus: 'committed',
      semanticValidationStatus: 'pass',
      validatedInputs: [
        {
          role: 'source',
          path: 'docs/requirements/dist-checkpoint.md',
          hash,
        },
      ],
      blockers: [],
      decision: 'pass',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(
      checkpointSemanticValidationRuntime.validateCheckpointSemanticValidationReceipt(receipt),
      true,
      'dist checkpoint semantic-validation runtime must load and validate against its schema'
    );

    const renderRoundTripGateScript = path.join(DIST_ROOT, RENDER_ROUNDTRIP_GATE_SCRIPT);
    assert.equal(
      fs.existsSync(renderRoundTripGateScript),
      true,
      'dist missing requirements-contract render round-trip gate'
    );
    const renderRoundTripGateRuntime = require(renderRoundTripGateScript);
    assert.equal(
      typeof renderRoundTripGateRuntime.evaluateRequirementsContractRenderRoundTrip,
      'function',
      'dist render round-trip gate must expose its evaluator'
    );
    assert.equal(
      typeof renderRoundTripGateRuntime.validateRequirementsContractRenderRoundTripReport,
      'function',
      'dist render round-trip gate must expose its strict report validator'
    );

    const distOrchestration = require(
      path.join(DIST_ROOT, 'source-authority', 'scripts', 'main-agent-orchestration.js')
    );
    assert.equal(
      typeof distOrchestration.refreshCurrentSourceCheckpointPersistence,
      'function',
      'dist orchestration must export the current-source checkpoint refresh Facade'
    );

    for (const expectedImport of EXPECTED_SOURCE_AUTHORITY_RUNTIME_IMPORTS) {
      const distFile = path.join(DIST_ROOT, expectedImport.file);
      const source = fs.readFileSync(distFile, 'utf8');
      assert.doesNotMatch(
        source,
        new RegExp(expectedImport.forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        `${expectedImport.file} must not require TS-only workspace package source`
      );
      assert.match(
        source,
        new RegExp(expectedImport.required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        `${expectedImport.file} must require package dist JS`
      );
      assert.equal(
        fs.existsSync(
          path.join(
            runtimeTargetBasePath(expectedImport.runtimeTargetBase),
            expectedImport.runtimeTarget
          )
        ),
        true,
        `missing rewritten runtime target ${expectedImport.runtimeTarget}`
      );
    }

    const releaseGateFixture = fs.readFileSync(
      path.join(DIST_ROOT, 'source-authority/scripts/run-ci-release-gate-fixture.js'),
      'utf8'
    );
    assert.doesNotMatch(releaseGateFixture, /ts-node/);
    assert.doesNotMatch(releaseGateFixture, /main-agent-release-gate\.ts/);
    assert.match(releaseGateFixture, /main-agent-release-gate\.js/);

    const freshRegressionMatrix = fs.readFileSync(
      path.join(DIST_ROOT, 'source-authority/scripts/run-fresh-regression-matrix.js'),
      'utf8'
    );
    assert.match(freshRegressionMatrix, /process\.cwd\(\)/);

    const sourcePrdRuleRegistry = path.join(
      DIST_ROOT,
      'source-authority',
      'rules',
      'requirements-contract-source-prd-rules.js'
    );
    const sourcePrdInstanceLint = path.join(
      DIST_ROOT,
      'source-authority',
      'scripts',
      'lint-requirements-contract-source-prd.js'
    );
    const sourcePrdTemplateLint = path.join(
      DIST_ROOT,
      'source-authority',
      'scripts',
      'lint-requirements-contract-source-template.js'
    );
    const sourcePrdTemplateSchema = path.join(
      DIST_ROOT,
      'source-authority',
      'templates',
      'requirements-contract-source-prd-template.schema.json'
    );
    assert.equal(
      fs.existsSync(sourcePrdRuleRegistry),
      true,
      'dist missing source PRD rule registry'
    );
    assert.equal(
      fs.existsSync(sourcePrdInstanceLint),
      true,
      'dist missing source PRD instance lint CLI'
    );
    assert.equal(
      fs.existsSync(sourcePrdTemplateLint),
      true,
      'dist missing source PRD template lint CLI'
    );
    assert.equal(
      fs.existsSync(sourcePrdTemplateSchema),
      true,
      'dist missing source PRD template schema'
    );
    const instanceLintSource = fs.readFileSync(sourcePrdInstanceLint, 'utf8');
    assert.match(instanceLintSource, /requirements-contract-source-prd-rules/u);

    const sourceAuthorityDistRoot = path.join(DIST_ROOT, 'source-authority');
    assert.deepEqual(
      collectPackageJsonFiles(sourceAuthorityDistRoot),
      [],
      'source-authority dist must not contain workspace package manifests'
    );

    for (const relativePath of EXPECTED_SOURCE_AUTHORITY_ASSETS) {
      const distAsset = path.join(DIST_ROOT, 'source-authority', relativePath);
      const repoAsset = path.join(
        PACKAGE_ROOT,
        'src',
        'main-agent',
        'source-authority',
        relativePath
      );
      assert.equal(
        fs.existsSync(distAsset),
        true,
        `missing source-authority asset ${relativePath}`
      );
      assert.equal(
        fs.readFileSync(distAsset, 'utf8'),
        fs.readFileSync(repoAsset, 'utf8'),
        `source-authority asset drifted from canonical source: ${relativePath}`
      );
    }

    for (const relativePath of EXPECTED_PACKAGE_RUNTIME_ASSETS) {
      const packageAsset = path.join(PACKAGE_ROOT, relativePath);
      const packageDistAsset = path.join(PACKAGE_DIST_ROOT, relativePath);
      const repoAsset = path.join(REPO_ROOT, relativePath);

      assert.equal(
        fs.existsSync(packageAsset),
        true,
        `missing package runtime asset ${relativePath}`
      );
      assert.equal(
        fs.existsSync(packageDistAsset),
        false,
        `package runtime asset must not be duplicated under dist: ${relativePath}`
      );
      assert.equal(
        fs.readFileSync(packageAsset, 'utf8'),
        fs.readFileSync(repoAsset, 'utf8'),
        `package runtime asset drifted from canonical source: ${relativePath}`
      );
    }

    const criticalAuditorProfileRuntime = require(
      path.join(DIST_ROOT, 'source-authority', 'scripts', 'critical-auditor-profile.js')
    );
    const profile = criticalAuditorProfileRuntime.resolveCriticalAuditorProfile(REPO_ROOT);
    assert.equal(profile.schemaVersion, 'critical-auditor-profile/v1');
  });

  it('declares every partition package asset exactly once', () => {
    const buildSource = fs.readFileSync(BUILD_SCRIPT, 'utf8');
    const requiredFilesBlock = buildSource.match(
      /const packageBmadRequiredFiles = \[([\s\S]*?)\n\];/u
    )?.[1];
    assert.ok(requiredFilesBlock, 'packageBmadRequiredFiles declaration is missing');

    for (const relativePath of PARTITION_PACKAGE_ASSETS) {
      assert.equal(
        requiredFilesBlock.split(relativePath).length - 1,
        1,
        `partition package asset must be declared exactly once: ${relativePath}`
      );
    }
  });

  it('fails closed when the repository _bmad source set cannot be enumerated', () => {
    const buildSource = fs.readFileSync(BUILD_SCRIPT, 'utf8');
    assert.match(buildSource, /repository _bmad source enumeration failed/u);
    assert.doesNotMatch(
      buildSource,
      /sourceFiles === null[\s\S]*?fs\.cpSync\(repoBmadRoot,\s*packageBmadRoot/u
    );
  });

  it('keeps the compiled goal-contract command on package dist modules and owned assets', () => {
    execFileSync(process.execPath, [BUILD_SCRIPT], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const compiled = fs.readFileSync(
      path.join(PACKAGE_DIST_ROOT, 'commands', 'goal-contract.js'),
      'utf8'
    );
    assert.doesNotMatch(compiled, /sourceRepositoryMode/u);
    assert.match(compiled, /const SOURCE_ROOT = path\.resolve\(PACKAGE_ROOT, '\.\.', '\.\.'\);/u);
    assert.match(compiled, /\[PACKAGE_ROOT, SOURCE_ROOT\]\.find/u);
    assert.match(compiled, /'_bmad', 'shared', 'goal-contract'/u);
    assert.doesNotMatch(compiled, /const PARTITION_ASSET_ROOT = SOURCE_ROOT;/u);
    assert.doesNotMatch(compiled, /`\$\{sourceBase\}\.ts`/u);
  });

  it('publishes Sequence mode runtime without legacy prose matching', () => {
    const requiredRuntimePaths = [
      path.join(PACKAGE_DIST_ROOT, 'utils', 'goal-contract', 'sequence-mode.js'),
      path.join(PACKAGE_DIST_ROOT, 'utils', 'goal-contract', 'sequence-applicability-adapter.js'),
    ];
    for (const runtimePath of requiredRuntimePaths) {
      assert.equal(fs.existsSync(runtimePath), true, `missing Sequence runtime: ${runtimePath}`);
    }

    const compiledCommand = fs.readFileSync(
      path.join(PACKAGE_DIST_ROOT, 'commands', 'goal-contract.js'),
      'utf8'
    );
    assert.match(compiledCommand, /--sequence-mode/u);

    const legacyMatcherOffenders = collectFiles(PACKAGE_DIST_ROOT)
      .filter((filePath) => filePath.endsWith('.js'))
      .filter((filePath) => {
        const text = fs.readFileSync(filePath, 'utf8');
        return (
          text.includes('cross[- ]participant') ||
          text.includes('sequence applicability is unresolved.')
        );
      })
      .map((filePath) => path.relative(PACKAGE_DIST_ROOT, filePath).replace(/\\/g, '/'));
    assert.deepEqual(legacyMatcherOffenders, []);
  });

  it('records partition package assets without adding them to dist', () => {
    execFileSync(process.execPath, [BUILD_SCRIPT], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const buildAuthority = JSON.parse(fs.readFileSync(RUNTIME_BUILD_AUTHORITY_RECEIPT, 'utf8'));
    assert.equal(buildAuthority.packageAssetCount, buildAuthority.packageAssetEntries.length);
    assert.deepEqual(
      buildAuthority.packageAssetEntries.map((entry) => entry.target),
      [...buildAuthority.packageAssetEntries]
        .map((entry) => entry.target)
        .sort((left, right) => left.localeCompare(right))
    );
    assert.equal(
      buildAuthority.packageAssetSetHash,
      `sha256:${createHash('sha256')
        .update(JSON.stringify(buildAuthority.packageAssetEntries))
        .digest('hex')}`
    );

    const entries = new Map(
      buildAuthority.packageAssetEntries.map((entry) => [entry.target, entry])
    );
    for (const relativePath of PARTITION_PACKAGE_ASSETS) {
      const target = `_bmad/${relativePath}`;
      const entry = entries.get(target);
      assert.deepEqual(entry, {
        source: target,
        target,
        sourceHash: createHash('sha256')
          .update(fs.readFileSync(path.join(REPO_ROOT, target)))
          .digest('hex'),
        targetHash: createHash('sha256')
          .update(fs.readFileSync(path.join(PACKAGE_ROOT, target)))
          .digest('hex'),
        owner: 'package-root-_bmad',
      });
      assert.equal(
        fs.existsSync(path.join(PACKAGE_DIST_ROOT, relativePath)),
        false,
        `partition package asset must not be duplicated under dist: ${relativePath}`
      );
      assert.equal(
        fs.existsSync(path.join(DIST_ROOT, 'source-authority', '_bmad', relativePath)),
        false,
        `partition package asset must not be nested under source-authority dist: ${relativePath}`
      );
    }

    const runtimeManifest = JSON.parse(fs.readFileSync(RUNTIME_ASSET_MANIFEST, 'utf8'));
    assert.equal(
      runtimeManifest.entries.every((entry) => entry.target.startsWith('dist/')),
      true,
      'dist runtime manifest must not own package-root _bmad assets'
    );
    for (const forbiddenPath of [
      path.join(PACKAGE_DIST_ROOT, '_bmad'),
      path.join(DIST_ROOT, 'source-authority', '_bmad'),
      path.join(DIST_ROOT, 'source-authority', 'packages'),
      path.join(DIST_ROOT, 'source-authority', 'tests'),
    ]) {
      assert.equal(
        fs.existsSync(forbiddenPath),
        false,
        `forbidden dist path exists: ${forbiddenPath}`
      );
    }
  });

  it('binds the compiled execution projection schema to package-first _bmad assets', () => {
    execFileSync(process.execPath, [BUILD_SCRIPT], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const compiled = fs.readFileSync(
      path.join(PACKAGE_DIST_ROOT, 'utils', 'goal-contract', 'execution-projection.js'),
      'utf8'
    );

    assert.match(compiled, /path\.resolve\(__dirname,\s*'\.\.',\s*'\.\.',\s*'\.\.'\)/u);
    assert.match(
      compiled,
      /path\.resolve\(__dirname,\s*'\.\.',\s*'\.\.',\s*'\.\.',\s*'\.\.',\s*'\.\.'\)/u
    );
    assert.match(compiled, /\.find\(\(candidate\) =>/u);
    assert.match(compiled, /'_bmad', 'shared', 'goal-contract'/u);
  });

  it('fails closed when source changes without rebuilding dist', () => {
    execFileSync(process.execPath, [BUILD_SCRIPT], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-contract-stale-dist-'));
    try {
      const cloneRoot = path.join(root, 'packages', 'bmad-speckit');
      fs.mkdirSync(cloneRoot, { recursive: true });
      for (const relativePath of [
        'package.json',
        'bin',
        'dist',
        '_bmad',
        path.join('node_modules', '@bmad-speckit'),
        'scripts',
        'src',
      ]) {
        fs.cpSync(path.join(PACKAGE_ROOT, relativePath), path.join(cloneRoot, relativePath), {
          recursive: true,
        });
      }
      fs.copyFileSync(
        path.join(REPO_ROOT, 'package-lock.json'),
        path.join(root, 'package-lock.json')
      );
      const runtimeAuthority = require(
        path.join(
          cloneRoot,
          'dist',
          'main-agent',
          'source-authority',
          'scripts',
          'requirements-contract-runtime-build-authority.js'
        )
      );
      const receipt = JSON.parse(
        fs.readFileSync(
          path.join(cloneRoot, 'dist', 'main-agent', 'runtime-build-authority-receipt.json'),
          'utf8'
        )
      );
      const baseReceipt = Object.fromEntries(
        [
          'schemaVersion',
          'hashDomainRegistry',
          'sourceInputManifestHash',
          'buildScriptHash',
          'dependencyLockHash',
          'runtimeAssetManifestHash',
          'distRuntimeHash',
          'packageRuntimeHash',
          'decision',
          'distBuildHash',
        ].map((key) => [key, receipt[key]])
      );
      const input = {
        receipt: baseReceipt,
        packageRoot: cloneRoot,
        runtimeAssetManifestPath: path.join(
          cloneRoot,
          'dist',
          'main-agent',
          'runtime-asset-manifest.json'
        ),
        buildScriptPath: path.join(cloneRoot, 'scripts', 'build-main-agent-dist.cjs'),
        dependencyLockPath: path.join(root, 'package-lock.json'),
      };
      assert.doesNotThrow(() => runtimeAuthority.assertRuntimeBuildAuthorityCurrent(input));
      fs.appendFileSync(
        path.join(cloneRoot, 'src', 'commands', 'goal-contract.ts'),
        '\n// stale-dist-probe\n',
        'utf8'
      );
      assert.throws(
        () => {
          try {
            runtimeAuthority.assertRuntimeBuildAuthorityCurrent(input);
          } catch {
            throw Object.assign(new Error('goal_contract_dist_stale'), {
              failureClass: 'goal_contract_dist_stale',
            });
          }
        },
        (error) => error.failureClass === 'goal_contract_dist_stale'
      );
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  });

  it('does not mirror generated consumer fixtures into source-authority dist', () => {
    execFileSync(process.execPath, [BUILD_SCRIPT], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    assert.equal(fs.existsSync(path.join(DIST_ROOT, 'source-authority', '_bmad-output')), false);
  });

  it('builds package _bmad mirror before source-authority import rewriting', () => {
    const packageRuntimeAsset =
      'packages/bmad-speckit/_bmad/runtime/hooks/deferred-gap-governance.cjs';
    withTemporarilyMovedFiles([packageRuntimeAsset], () => {
      execFileSync(process.execPath, [BUILD_SCRIPT], {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const packageAsset = path.join(REPO_ROOT, packageRuntimeAsset);
      const repoAsset = path.join(REPO_ROOT, '_bmad/runtime/hooks/deferred-gap-governance.cjs');
      assert.equal(fs.existsSync(packageAsset), true, 'build did not restore package _bmad mirror');
      assert.equal(
        fs.readFileSync(packageAsset, 'utf8'),
        fs.readFileSync(repoAsset, 'utf8'),
        'package _bmad mirror drifted from canonical runtime hook'
      );
    });
  });

  it('excludes ignored repository _bmad artifacts from the package runtime owner', () => {
    const ignoredSourcePath = path.join(
      REPO_ROOT,
      '_bmad',
      'skills',
      'bmads-auto',
      `.package-runtime-owner-ignore-${process.pid}.sentinel`
    );
    const repositoryRelativePath = path.relative(REPO_ROOT, ignoredSourcePath).replace(/\\/gu, '/');
    const packageRelativePath = path.relative(path.join(REPO_ROOT, '_bmad'), ignoredSourcePath);
    fs.mkdirSync(path.dirname(ignoredSourcePath), { recursive: true });
    fs.writeFileSync(ignoredSourcePath, 'ignored package runtime sentinel\n', 'utf8');
    try {
      execFileSync('git', ['check-ignore', '-q', '--', repositoryRelativePath], {
        cwd: REPO_ROOT,
        stdio: 'ignore',
      });
      execFileSync(process.execPath, [BUILD_SCRIPT], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });
      assert.equal(
        fs.existsSync(path.join(PACKAGE_ROOT, '_bmad', packageRelativePath)),
        false,
        `ignored repository artifact leaked into package runtime: ${repositoryRelativePath}`
      );
    } finally {
      fs.rmSync(ignoredSourcePath, { force: true });
    }
  });

  it('excludes test-only directories from bundled workspace runtime packages', () => {
    execFileSync(process.execPath, [BUILD_SCRIPT], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    const bundledRuntimeRoot = path.join(PACKAGE_ROOT, 'node_modules', '@bmad-speckit');
    const testOnlyPaths = collectFiles(bundledRuntimeRoot)
      .map((filePath) => path.relative(bundledRuntimeRoot, filePath).replace(/\\/g, '/'))
      .filter((filePath) =>
        filePath
          .split('/')
          .some(
            (segment) =>
              ['__tests__', 'tests', 'test-nonempty'].includes(segment) ||
              segment.startsWith('__fixtures')
          )
      );

    assert.deepEqual(testOnlyPaths, []);
  });
});
