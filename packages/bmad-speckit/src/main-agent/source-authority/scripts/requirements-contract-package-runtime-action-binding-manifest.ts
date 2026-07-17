import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import type { PromptPublicationAuthority } from './requirements-contract-prompt-transaction-authority';
import { fileHash, slash } from './requirements-contract-governed-write';

type JsonRecord = Record<string, any>;
type FileRef = { path: string; hash: string };

type RuntimeRefSpec = {
  role: string;
  repositoryPath: string;
  packagePath: string;
};

type ActionBindingSpec = {
  actionId: string;
  capabilityActionId?: string;
  sourcePath: string;
  distPath: string;
  gateSymbol: string;
  inputSchemas: string[];
  outputSchemas: string[];
  behaviorTests: string[];
  runtimeRefs?: RuntimeRefSpec[];
};

const MANIFEST_RELATIVE_PATH = path.join(
  'shared',
  'requirements-contract',
  'requirements-contract-package-runtime-action-binding-manifest.json'
);
const SCHEMA_ROOT =
  'packages/bmad-speckit/src/main-agent/source-authority/schemas';
const SCRIPT_ROOT =
  'packages/bmad-speckit/src/main-agent/source-authority/scripts';
const DIST_SCRIPT_ROOT =
  'packages/bmad-speckit/dist/main-agent/source-authority/scripts';
const CONTRACT_RELATIVE_PATH =
  'docs/plans/2026-07-11-loop-engineering-evidence-closure-remediation-goal-execution-plan.md';
const CONTRACT_HASH =
  'sha256:d6f39af7a0995a16496913b2e224445a2a440e5ecf285e54f66b1fdaa46652c4';
const FROZEN_ACTION_IDS = [
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
  'requirements-contract-consumer-cli-capability-observe',
].sort();
const ACTION_UNIVERSE_HASH =
  'sha256:8adf1492096c0b29ba43ba7295b5c11c1ef88d9375ab77b3de5b167a3e0e54a6';

const ACTION_BINDING_SPECS: ActionBindingSpec[] = [
  {
    actionId: 'requirements-contract-six-model-projection-parity-verify',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-six-model-projection-parity-verifier.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-six-model-projection-parity-verifier.js`,
    gateSymbol: 'requirementsContractSixModelProjectionParityVerifyCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-six-model-projection-parity-observation.schema.json`,
    ],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-six-model-projection-parity-report.schema.json`,
    ],
    behaviorTests: [
      'tests/acceptance/requirements-contract-six-model-consumer-migration.test.ts',
    ],
  },
  {
    actionId: 'requirements-contract-consumer-cli-capability-observe',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-consumer-cli-capability.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-consumer-cli-capability.js`,
    gateSymbol: 'requirementsContractConsumerCliCapabilityObserveCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-consumer-project-profile.schema.json`,
    ],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-consumer-cli-capability.schema.json`,
    ],
    behaviorTests: [
      'tests/acceptance/requirements-contract-prompt-transaction-production-publication.test.ts',
    ],
  },
  {
    actionId: 'requirements-contract-prompt-transaction-publish',
    capabilityActionId: 'requirements-contract-consumer-cli-capability-observe',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-prompt-transaction-publisher.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-prompt-transaction-publisher.js`,
    gateSymbol: 'requirementsContractPromptTransactionPublishCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-consumer-project-profile.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-confirmation-receipt-bundle.schema.json`,
    ],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-prompt-transaction-manifest.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-current-dispatch-pointer.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-g09-prompt-transaction-evidence.schema.json`,
    ],
    behaviorTests: [
      'tests/acceptance/requirements-contract-prompt-transaction-production-publication.test.ts',
    ],
    runtimeRefs: [
      {
        role: 'installed-cli',
        repositoryPath: 'packages/bmad-speckit/bin/bmad-speckit.js',
        packagePath: 'bin/bmad-speckit.js',
      },
      {
        role: 'installed-generator',
        repositoryPath:
          'packages/bmad-speckit/dist/main-agent/source-authority/_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js',
        packagePath:
          'dist/main-agent/source-authority/_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js',
      },
      {
        role: 'installed-stage-registry',
        repositoryPath:
          'packages/bmad-speckit/dist/main-agent/source-authority/scripts/requirements-contract-stage-registry.js',
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-stage-registry.js',
      },
      {
        role: 'installed-runner',
        repositoryPath:
          'packages/bmad-speckit/dist/main-agent/source-authority/scripts/main-agent-compiled-prompt-runner.js',
        packagePath:
          'dist/main-agent/source-authority/scripts/main-agent-compiled-prompt-runner.js',
      },
    ],
  },
  {
    actionId: 'requirements-contract-production-bypass-verify',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-production-bypass-verifier.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-production-bypass-verifier.js`,
    gateSymbol: 'requirementsContractProductionBypassVerifyCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-production-bypass-verification-input.schema.json`,
    ],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-production-bypass-closure-report.schema.json`,
    ],
    behaviorTests: [
      'tests/acceptance/requirements-contract-production-bypass-attack-corpus.test.ts',
      'tests/acceptance/requirements-contract-production-bypass-closure-eval.test.ts',
    ],
  },
  {
    actionId: 'requirements-contract-recovery-bootstrap',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-recovery-bootstrap.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-recovery-bootstrap.js`,
    gateSymbol: 'requirementsContractRecoveryBootstrapCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-controlled-command-receipt.schema.json`,
    ],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-recovery-lineage-receipt.schema.json`,
    ],
    behaviorTests: ['tests/acceptance/requirements-contract-recovery-bootstrap.test.ts'],
  },
  {
    actionId: 'requirements-contract-recovery-finalize',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-recovery-bootstrap.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-recovery-bootstrap.js`,
    gateSymbol: 'requirementsContractRecoveryFinalizeCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-controlled-command-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-recovery-lineage-receipt.schema.json`,
    ],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-recovery-finalization-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-recovery-finalization-state-decision-receipt.schema.json`,
    ],
    behaviorTests: ['tests/acceptance/requirements-contract-recovery-finalization.test.ts'],
  },
].sort((left, right) => left.actionId.localeCompare(right.actionId));

export interface PromptPublicationRuntimeBindings {
  manifestRef: { path: string; hash: string };
  installedCliRef: { path: string; hash: string };
  installedGeneratorRef: { path: string; hash: string };
  installedStageRegistryRef: { path: string; hash: string };
  installedRunnerRef: { path: string; hash: string };
  capabilityActionId: 'requirements-contract-consumer-cli-capability-observe';
  capabilityProbeArgv: string[];
  reqTraceSkillDir: string;
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function repositoryFileRef(root: string, relativePath: string): FileRef {
  const resolved = path.resolve(root, relativePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`package_runtime_action_binding_file_missing:${slash(relativePath)}`);
  }
  return { path: slash(relativePath), hash: fileHash(resolved) };
}

function registeredActionIds(root: string): string[] {
  const cliPath = path.join(root, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');
  const cliSource = fs.readFileSync(cliPath, 'utf8');
  return [
    ...cliSource.matchAll(
      /\.command\('(?<actionId>requirements-contract-[a-z0-9-]+)'\)/gu
    ),
  ]
    .map((match) => match.groups?.actionId ?? '')
    .filter(Boolean)
    .sort();
}

export function buildPackageRuntimeActionBindingManifest(root: string): JsonRecord {
  const contractRef = repositoryFileRef(root, CONTRACT_RELATIVE_PATH);
  if (contractRef.hash !== CONTRACT_HASH) {
    throw new Error(
      `package_runtime_action_binding_contract_hash_mismatch:${JSON.stringify({
        expected: CONTRACT_HASH,
        actual: contractRef.hash,
      })}`
    );
  }
  const specActionIds = ACTION_BINDING_SPECS.map((spec) => spec.actionId);
  if (JSON.stringify(specActionIds) !== JSON.stringify(FROZEN_ACTION_IDS)) {
    throw new Error(
      `package_runtime_action_binding_spec_universe_mismatch:${JSON.stringify({
        expectedActionIds: FROZEN_ACTION_IDS,
        actualActionIds: specActionIds,
      })}`
    );
  }
  const actualActionIds = registeredActionIds(root);
  if (JSON.stringify(actualActionIds) !== JSON.stringify(FROZEN_ACTION_IDS)) {
    throw new Error(
      `package_runtime_action_registry_mismatch:${JSON.stringify({
        expectedActionIds: FROZEN_ACTION_IDS,
        actualActionIds,
      })}`
    );
  }
  const actions = ACTION_BINDING_SPECS.map((spec) => {
    const sourceHandlerRef = repositoryFileRef(root, spec.sourcePath);
    const distHandlerRef = repositoryFileRef(root, spec.distPath);
    const packagePath = slash(
      path.relative(path.join(root, 'packages', 'bmad-speckit'), path.join(root, spec.distPath))
    );
    return {
      actionId: spec.actionId,
      ...(spec.capabilityActionId ? { capabilityActionId: spec.capabilityActionId } : {}),
      sourceHandlerRef,
      distHandlerRef,
      semanticGate: {
        gateId: `${spec.actionId}:semantic-gate`,
        sourceSymbol: spec.gateSymbol,
        distSymbol: spec.gateSymbol,
      },
      inputSchemaRefs: spec.inputSchemas.map((schemaPath) =>
        repositoryFileRef(root, schemaPath)
      ),
      outputSchemaRefs: spec.outputSchemas.map((schemaPath) =>
        repositoryFileRef(root, schemaPath)
      ),
      behaviorTestRefs: spec.behaviorTests.map((testPath) =>
        repositoryFileRef(root, testPath)
      ),
      packageDistRef: { path: packagePath, hash: distHandlerRef.hash },
      installedSurfaceRefs: [{ path: packagePath, hash: distHandlerRef.hash }],
      runtimeRefs: (spec.runtimeRefs ?? []).map((runtimeRef) => ({
        role: runtimeRef.role,
        packagePath: slash(runtimeRef.packagePath),
        hash: repositoryFileRef(root, runtimeRef.repositoryPath).hash,
      })),
      routingOnly: false,
    };
  });
  const completeActionCount = actions.filter(
    (action) =>
      action.sourceHandlerRef.hash &&
      action.distHandlerRef.hash &&
      action.semanticGate.sourceSymbol &&
      action.inputSchemaRefs.length > 0 &&
      action.outputSchemaRefs.length > 0 &&
      action.behaviorTestRefs.length > 0 &&
      action.packageDistRef.hash &&
      action.installedSurfaceRefs.length > 0
  ).length;
  return {
    schemaVersion: 'requirements-contract-package-runtime-action-binding-manifest/v1',
    contractRef,
    actionUniverseHash: ACTION_UNIVERSE_HASH,
    actions,
    packageRuntimeRoutingOnlyActionCount: actions.filter((action) => action.routingOnly).length,
    installedPackageActionBehaviorMismatchCount: actions.filter(
      (action) =>
        action.installedSurfaceRefs.some(
          (ref) => ref.hash !== action.packageDistRef.hash
        )
    ).length,
    packageActionSemanticBindingCoverage:
      actions.length === 0 ? 0 : completeActionCount / actions.length,
    decision: completeActionCount === actions.length ? 'pass' : 'block',
  };
}

export function publishPackageRuntimeActionBindingManifest(root: string): {
  manifest: JsonRecord;
  targets: FileRef[];
} {
  const manifest = buildPackageRuntimeActionBindingManifest(root);
  const schemaPath = path.join(
    root,
    SCHEMA_ROOT,
    'requirements-contract-package-runtime-action-binding-manifest.schema.json'
  );
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
    readJson(schemaPath)
  );
  if (!validate(manifest)) {
    throw new Error(
      `package_runtime_action_binding_manifest_schema_invalid:${JSON.stringify(validate.errors ?? [])}`
    );
  }
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  const relativeTargets = [
    path.join('_bmad', MANIFEST_RELATIVE_PATH),
    path.join('.codex', MANIFEST_RELATIVE_PATH),
    path.join('.cursor', MANIFEST_RELATIVE_PATH),
    path.join('.claude', MANIFEST_RELATIVE_PATH),
    path.join('packages', 'bmad-speckit', '_bmad', MANIFEST_RELATIVE_PATH),
    path.join('packages', 'bmad-speckit', 'dist', '_bmad', MANIFEST_RELATIVE_PATH),
    path.join(
      'packages',
      'bmad-speckit',
      'dist',
      'main-agent',
      'source-authority',
      '_bmad',
      MANIFEST_RELATIVE_PATH
    ),
  ];
  const targets = relativeTargets.map((relativePath) => {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, serialized, 'utf8');
    return repositoryFileRef(root, relativePath);
  });
  const targetHashes = new Set(targets.map((target) => target.hash));
  if (targetHashes.size !== 1) {
    throw new Error('package_runtime_action_binding_surface_hash_mismatch');
  }
  return { manifest, targets };
}

function normalized(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function samePath(left: string, right: string): boolean {
  return normalized(left) === normalized(right);
}

function assertRef(ref: JsonRecord, expectedPath: string, label: string) {
  const resolved = path.resolve(String(ref.path ?? ''));
  if (!samePath(resolved, expectedPath)) throw new Error(`${label}_path_mismatch`);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`${label}_missing`);
  }
  const hash = fileHash(resolved);
  if (hash !== ref.hash) throw new Error(`${label}_hash_mismatch`);
  return { path: slash(resolved), hash };
}

function installedRuntimeRef(
  binding: JsonRecord,
  installedPackageRoot: string,
  role: string
): { path: string; hash: string } {
  const matches = Array.isArray(binding.runtimeRefs)
    ? binding.runtimeRefs.filter((entry: JsonRecord) => entry.role === role)
    : [];
  if (matches.length !== 1) throw new Error(`${role}_binding_not_unique`);
  return assertRef(
    {
      path: path.join(installedPackageRoot, String(matches[0].packagePath ?? '')),
      hash: matches[0].hash,
    },
    path.join(installedPackageRoot, String(matches[0].packagePath ?? '')),
    role.replace(/-/gu, '_')
  );
}

export function resolvePromptPublicationRuntimeBindings(
  authority: PromptPublicationAuthority
): PromptPublicationRuntimeBindings {
  const manifestPath = authority.refs.packageRuntimeActionBindingManifest.path;
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-package-runtime-action-binding-manifest.schema.json'
  );
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
    readJson(schemaPath)
  );
  const manifest = readJson(manifestPath);
  if (!validate(manifest)) {
    throw new Error(`package_runtime_action_binding_manifest_schema_invalid:${JSON.stringify(validate.errors ?? [])}`);
  }
  const matches = manifest.actions.filter(
    (entry: JsonRecord) =>
      entry.actionId === 'requirements-contract-prompt-transaction-publish'
  );
  if (matches.length !== 1) throw new Error('prompt_publication_action_binding_not_unique');
  const binding = matches[0];
  const installedPackageRoot = path.join(
    authority.paths.consumerRoot,
    'node_modules',
    'bmad-speckit'
  );
  const installedCliRef = installedRuntimeRef(binding, installedPackageRoot, 'installed-cli');
  const installedGeneratorRef = installedRuntimeRef(
    binding,
    installedPackageRoot,
    'installed-generator'
  );
  const installedStageRegistryRef = installedRuntimeRef(
    binding,
    installedPackageRoot,
    'installed-stage-registry'
  );
  const installedRunnerRef = installedRuntimeRef(
    binding,
    installedPackageRoot,
    'installed-runner'
  );
  const capabilityProbeArgv = [
    process.execPath,
    installedCliRef.path,
    binding.capabilityActionId,
    '--json',
  ];
  const profileProbeArgv = authority.consumerProfile.capabilityProbeArgv;
  if (
    !Array.isArray(profileProbeArgv) ||
    profileProbeArgv.length !== 4 ||
    !samePath(profileProbeArgv[0], process.execPath) ||
    !samePath(profileProbeArgv[1], installedCliRef.path) ||
    profileProbeArgv[2] !== binding.capabilityActionId ||
    profileProbeArgv[3] !== '--json' ||
    !samePath(authority.consumerProfile.capabilityProbeArtifactRef.path, installedCliRef.path) ||
    authority.consumerProfile.capabilityProbeArtifactRef.hash !== installedCliRef.hash
  ) {
    throw new Error('consumer_capability_probe_binding_mismatch');
  }
  return {
    manifestRef: authority.refs.packageRuntimeActionBindingManifest,
    installedCliRef,
    installedGeneratorRef,
    installedStageRegistryRef,
    installedRunnerRef,
    capabilityActionId: binding.capabilityActionId,
    capabilityProbeArgv,
    reqTraceSkillDir: path.resolve(path.dirname(path.dirname(installedGeneratorRef.path))),
  };
}
