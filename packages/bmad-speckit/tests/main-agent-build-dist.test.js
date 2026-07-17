const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const BUILD_SCRIPT = path.join(PACKAGE_ROOT, 'scripts', 'build-main-agent-dist.cjs');
const PACKAGE_JSON = path.join(PACKAGE_ROOT, 'package.json');
const RELEASE_WORKFLOW = path.join(REPO_ROOT, '.github', 'workflows', 'release.yml');
const SRC_JS_ALLOWLIST = path.join(PACKAGE_ROOT, 'scripts', 'src-js-allowlist.json');
const PACKAGE_DIST_ROOT = path.join(PACKAGE_ROOT, 'dist');
const DIST_ROOT = path.join(PACKAGE_ROOT, 'dist', 'main-agent');
const CHECKPOINT_SEMANTIC_VALIDATION_SCRIPT =
  'source-authority/scripts/requirements-contract-checkpoint-semantic-validation.js';
const CHECKPOINT_SEMANTIC_VALIDATION_SCHEMA =
  'source-authority/schemas/requirements-contract-checkpoint-semantic-validation-receipt.schema.json';
const RENDER_ROUNDTRIP_GATE_SCRIPT =
  'source-authority/scripts/requirements-contract-render-roundtrip-gate.js';
const TYPE_SCRIPT_FAMILY_SOURCE_RE = /\.(?:ts|tsx|cts|mts)$/u;
const TYPE_SCRIPT_DECLARATION_SOURCE_RE = /\.d\.(?:ts|cts|mts)$/u;
const EXPECTED_PACKAGE_RUNTIME_TYPESCRIPT_FILES = [
  'runtime/host-runtime-mode.ts',
  'runtime/supervised-worker-runtime.ts',
  'actions/native-goal-command.ts',
  'actions/native-goal-invoker.ts',
];
const EXPECTED_PACKAGE_RUNTIME_ASSETS = [
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
  'actions/compiled-prompt-runner.js',
  'actions/confirm-scope.js',
  'actions/delivery-closeout-gate.js',
  'actions/delivery-evidence-run.js',
  'actions/dispatch-plan.js',
  'actions/dual-host-pr-orchestrator.js',
  'actions/full-orchestration.js',
  'actions/implementation-readiness-gate.js',
  'actions/run-loop.js',
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
    required: '../_bmad/shared/critical-auditor-profile',
    runtimeTarget: 'source-authority/_bmad/shared/critical-auditor-profile/load-critical-auditor-profile.js',
  },
  {
    file: 'source-authority/scripts/query-validate.js',
    forbidden: '../packages/scoring/query',
    required: '../packages/scoring/dist/query',
    runtimeTarget: 'source-authority/packages/scoring/dist/query/index.js',
  },
  {
    file: 'source-authority/scripts/bmad-help-routing-state.js',
    forbidden: '../packages/runtime-context/src/context',
    required: '../packages/runtime-context/dist/context',
    runtimeTarget: 'source-authority/packages/runtime-context/dist/context.js',
  },
  {
    file: 'source-authority/scripts/ralph-method/schema.js',
    forbidden: '../../packages/ralph-method/src/schema',
    required: '../../packages/ralph-method/dist/schema',
    runtimeTarget: 'source-authority/packages/ralph-method/dist/schema.js',
  },
];
const EXPECTED_SOURCE_AUTHORITY_ASSETS = [
  '.specify/templates/agent-file-template.md',
  'packages/bmad-speckit/src/main-agent/source-authority/templates/requirements-contract-source-prd-template.md',
  'packages/bmad-speckit/src/main-agent/source-authority/templates/requirements-contract-source-prd-template.schema.json',
  '_bmad-output/runtime/requirement-records/index.json',
  '_bmad-output/runtime/requirement-records/REQ-CI-GOVERNANCE-MAPPING-FIXTURE/requirement-record.json',
];
const GENERATED_SOURCE_AUTHORITY_ASSETS = EXPECTED_SOURCE_AUTHORITY_ASSETS.filter((relativePath) =>
  relativePath.startsWith('_bmad-output/')
);

function runtimeTargetBasePath(base) {
  if (base === 'package') return PACKAGE_ROOT;
  if (base === 'packageDist') return PACKAGE_DIST_ROOT;
  if (base === undefined || base === 'dist') return DIST_ROOT;
  throw new Error(`unknown runtimeTargetBase: ${base}`);
}

function isTypeScriptRuntimeSourcePath(relativePath) {
  return TYPE_SCRIPT_FAMILY_SOURCE_RE.test(relativePath) && !TYPE_SCRIPT_DECLARATION_SOURCE_RE.test(relativePath);
}

function sourceAuthorityRelativeToDistRelativePath(relativePath) {
  if (relativePath === 'scripts/deferred-gap-governance-d-cts-source.ts') {
    return 'source-authority/scripts/deferred-gap-governance.d.cts.js';
  }
  const distPath = `source-authority/${relativePath}`;
  if (TYPE_SCRIPT_DECLARATION_SOURCE_RE.test(distPath)) return distPath;
  if (/\.source\.(?:ts|tsx)$/u.test(distPath)) return distPath.replace(/\.source\.(?:ts|tsx)$/u, '.js');
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
      collected.push(...collectSourceAuthorityTypeScriptFiles(fullPath, base));
      continue;
    }
    if (!entry.isFile() || !isTypeScriptRuntimeSourcePath(entry.name)) continue;
    collected.push(path.relative(base, fullPath).replace(/\\/g, '/'));
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

function collectTrackedPackageSourceFiles() {
  return execFileSync('git', ['ls-files', 'packages/bmad-speckit/src'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((relativePath) => relativePath.replace(/\\/g, '/'));
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
  });

  it('builds main-agent dist before release CI-equivalent tests', () => {
    const workflow = fs.readFileSync(RELEASE_WORKFLOW, 'utf8');
    const buildIndex = workflow.indexOf('npm run build:main-agent-dist');
    const testIndex = workflow.indexOf('npm run test:ci');

    assert.notEqual(buildIndex, -1, 'release workflow must build main-agent dist');
    assert.notEqual(testIndex, -1, 'release workflow must run CI-equivalent tests');
    assert.ok(
      buildIndex < testIndex,
      'release workflow must build main-agent dist before tests invoke package CLI'
    );
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
      path.join(PACKAGE_DIST_ROOT, '_bmad', actionBindingManifestRelativePath),
      path.join(
        DIST_ROOT,
        'source-authority',
        '_bmad',
        actionBindingManifestRelativePath
      ),
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
    assert.deepEqual(
      actionBindingManifest.actions.map((action) => action.actionId),
      [
        'requirements-contract-bundle-publish',
        'requirements-contract-candidate-package',
        'requirements-contract-changed-path-manifest',
        'requirements-contract-consumer-cli-capability-observe',
        'requirements-contract-detached-test-rerun',
        'requirements-contract-eval',
        'requirements-contract-evidence-verify',
        'requirements-contract-finalization-safe-write',
        'requirements-contract-judge-credentials-init',
        'requirements-contract-judge-provider-smoke',
        'requirements-contract-production-activate',
        'requirements-contract-production-bypass-verify',
        'requirements-contract-prompt-transaction-publish',
        'requirements-contract-real-consumer-journey',
        'requirements-contract-recovery-bootstrap',
        'requirements-contract-recovery-finalize',
        'requirements-contract-reverse-audit',
        'requirements-contract-six-model-projection-parity-verify',
        'requirements-contract-stage-five-star-audit',
        'requirements-contract-terminal-command-supervisor',
      ],
      'build must project every registered package runtime action exactly once'
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

    for (const relativePath of EXPECTED_DIST_FILES) {
      const distFile = path.join(DIST_ROOT, relativePath);
      assert.equal(fs.existsSync(distFile), true, `missing ${relativePath}`);
      const source = fs.readFileSync(distFile, 'utf8');
      assert.doesNotMatch(source, /scripts[\\/]main-agent-orchestration\.ts/);
      assert.doesNotMatch(source, /compiled[\\/]main-agent-orchestration\.cjs/);
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
      assert.equal(fs.existsSync(distFile), true, `package TS source was not compiled: ${relativePath}`);
      assert.equal(
        fs.existsSync(sourceAuthorityDistFile),
        true,
        `package TS source was not compiled inside source-authority dist mirror: ${relativePath}`
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
    const sourceAuthorityTypeScriptFiles = collectSourceAuthorityTypeScriptFiles(sourceAuthorityRoot);
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
        fs.existsSync(path.join(runtimeTargetBasePath(expectedImport.runtimeTargetBase), expectedImport.runtimeTarget)),
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
      'packages',
      'bmad-speckit',
      'src',
      'main-agent',
      'source-authority',
      'templates',
      'requirements-contract-source-prd-template.schema.json'
    );
    assert.equal(fs.existsSync(sourcePrdRuleRegistry), true, 'dist missing source PRD rule registry');
    assert.equal(fs.existsSync(sourcePrdInstanceLint), true, 'dist missing source PRD instance lint CLI');
    assert.equal(fs.existsSync(sourcePrdTemplateLint), true, 'dist missing source PRD template lint CLI');
    assert.equal(fs.existsSync(sourcePrdTemplateSchema), true, 'dist missing source PRD template schema');
    const instanceLintSource = fs.readFileSync(sourcePrdInstanceLint, 'utf8');
    assert.match(instanceLintSource, /requirements-contract-source-prd-rules/u);

    const sourceAuthorityDistRoot = path.join(DIST_ROOT, 'source-authority');
    const sourceAuthorityPackageJsonFiles = collectPackageJsonFiles(sourceAuthorityDistRoot);
    assert.ok(
      sourceAuthorityPackageJsonFiles.length > 0,
      'source-authority package manifest inventory must not be empty'
    );
    for (const relativePath of sourceAuthorityPackageJsonFiles) {
      const manifestText = fs.readFileSync(path.join(sourceAuthorityDistRoot, relativePath), 'utf8');
      const manifest = JSON.parse(manifestText);
      assert.equal(manifest.scripts, undefined, `${relativePath} must not expose package scripts`);
      assert.equal(manifest.bin, undefined, `${relativePath} must not expose package bins`);
      assert.equal(manifest.devDependencies, undefined, `${relativePath} must not expose dev dependencies`);
      assert.equal(manifest.dependencies?.tsx, undefined, `${relativePath} must not depend on tsx`);
      assert.equal(manifest.dependencies?.['ts-node'], undefined, `${relativePath} must not depend on ts-node`);
      assert.doesNotMatch(
        manifestText,
        /\b(?:tsx|ts-node)\b/i,
        `${relativePath} must not contain runtime fallback tokens`
      );
    }

    for (const relativePath of EXPECTED_SOURCE_AUTHORITY_ASSETS) {
      const distAsset = path.join(DIST_ROOT, 'source-authority', relativePath);
      const repoAsset = path.join(REPO_ROOT, relativePath);
      assert.equal(fs.existsSync(distAsset), true, `missing source-authority asset ${relativePath}`);
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

      assert.equal(fs.existsSync(packageAsset), true, `missing package runtime asset ${relativePath}`);
      assert.equal(
        fs.existsSync(packageDistAsset),
        true,
        `missing package dist runtime asset ${relativePath}`
      );
      assert.equal(
        fs.readFileSync(packageAsset, 'utf8'),
        fs.readFileSync(repoAsset, 'utf8'),
        `package runtime asset drifted from canonical source: ${relativePath}`
      );
      assert.equal(
        fs.readFileSync(packageDistAsset, 'utf8'),
        fs.readFileSync(repoAsset, 'utf8'),
        `package dist runtime asset drifted from canonical source: ${relativePath}`
      );
    }

    const criticalAuditorProfileRuntime = require(path.join(
      DIST_ROOT,
      'source-authority',
      'scripts',
      'critical-auditor-profile.js'
    ));
    const profile = criticalAuditorProfileRuntime.resolveCriticalAuditorProfile(REPO_ROOT);
    assert.equal(profile.schemaVersion, 'critical-auditor-profile/v1');
  });

  it('auto-provisions source-authority governance fixture for clean dist builds', () => {
    withTemporarilyMovedFiles(GENERATED_SOURCE_AUTHORITY_ASSETS, () => {
      execFileSync(process.execPath, [BUILD_SCRIPT], {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        stdio: 'pipe',
      });

      for (const relativePath of GENERATED_SOURCE_AUTHORITY_ASSETS) {
        const repoAsset = path.join(REPO_ROOT, relativePath);
        const distAsset = path.join(DIST_ROOT, 'source-authority', relativePath);
        assert.equal(fs.existsSync(repoAsset), true, `build did not generate ${relativePath}`);
        assert.equal(fs.existsSync(distAsset), true, `dist missing generated ${relativePath}`);
        assert.equal(
          fs.readFileSync(distAsset, 'utf8'),
          fs.readFileSync(repoAsset, 'utf8'),
          `dist generated fixture drifted from build input: ${relativePath}`
        );
      }
    });
  });

  it('builds package _bmad mirror before source-authority import rewriting', () => {
    const packageRuntimeAsset = 'packages/bmad-speckit/_bmad/runtime/hooks/deferred-gap-governance.cjs';
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
});
