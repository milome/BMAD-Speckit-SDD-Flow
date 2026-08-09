import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import type { PromptPublicationAuthority } from './requirements-contract-prompt-transaction-authority';
import { fileHash, slash } from './requirements-contract-governed-write';
import { sourceBytesHash } from './requirements-contract-hash-domains';

type JsonRecord = Record<string, unknown>;
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
const SCHEMA_ROOT = 'packages/bmad-speckit/src/main-agent/source-authority/schemas';
const SCRIPT_ROOT = 'packages/bmad-speckit/src/main-agent/source-authority/scripts';
const DIST_SCRIPT_ROOT = 'packages/bmad-speckit/dist/main-agent/source-authority/scripts';
const FROZEN_ACTION_IDS = [
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
  'requirements-contract-consumer-cli-capability-observe',
].sort();
const ACTION_UNIVERSE_HASH =
  'sha256:54316a5458e7f1afd1ef94c3725a067960c82ab38b8eab44d1074b816f028bdf';

const ACTION_BINDING_SPECS: ActionBindingSpec[] = [
  {
    actionId: 'requirements-contract-finalization-safe-write',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-finalization-safe-writer.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-finalization-safe-writer.js`,
    gateSymbol: 'requirementsContractFinalizationSafeWriteCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-finalization-safe-write-input.schema.json`,
    ],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-finalization-safe-write-receipt.schema.json`,
    ],
    behaviorTests: ['tests/acceptance/requirements-contract-finalization-safe-writer.test.ts'],
  },
  {
    actionId: 'requirements-contract-bundle-publish',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-bundle-publish.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-bundle-publish.js`,
    gateSymbol: 'requirementsContractBundlePublishCommand',
    inputSchemas: [`${SCHEMA_ROOT}/requirements-contract-bundle-publish-input.schema.json`],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-runtime-bundle-manifest.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-bundle-publication-receipt.schema.json`,
    ],
    behaviorTests: ['tests/acceptance/requirements-contract-bundle-publish-command.test.ts'],
  },
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
    behaviorTests: ['tests/acceptance/requirements-contract-six-model-consumer-migration.test.ts'],
  },
  {
    actionId: 'requirements-contract-terminal-command-supervisor',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-terminal-command-supervisor.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-terminal-command-supervisor.js`,
    gateSymbol: 'requirementsContractTerminalCommandSupervisorCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-terminal-command-supervisor-input.schema.json`,
    ],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-terminal-command-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-terminal-closeout-packet.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-artifact-readback-receipt.schema.json`,
    ],
    behaviorTests: [
      'tests/acceptance/requirements-contract-terminal-command-supervisor.test.ts',
      'tests/acceptance/requirements-contract-terminal-command-receipt-schema.test.ts',
      'tests/acceptance/requirements-contract-terminal-closeout-packet.test.ts',
      'tests/acceptance/requirements-contract-terminal-closeout-projection.test.ts',
    ],
    runtimeRefs: [
      {
        role: 'terminal-closeout-producer',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-terminal-closeout.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-terminal-closeout.js',
      },
    ],
  },
  {
    actionId: 'requirements-contract-command-execution-producer',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-command-execution-receipt.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-command-execution-receipt.js`,
    gateSymbol: 'requirementsContractCommandExecutionProducerCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-command-execution-producer-input.schema.json`,
    ],
    outputSchemas: [`${SCHEMA_ROOT}/requirements-contract-command-execution-receipt.schema.json`],
    behaviorTests: ['tests/acceptance/requirements-contract-command-execution-producer.test.ts'],
  },
  {
    actionId: 'requirements-contract-clean-materialization',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-clean-materialization.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-clean-materialization.js`,
    gateSymbol: 'requirementsContractCleanMaterializationCommand',
    inputSchemas: [`${SCHEMA_ROOT}/requirements-contract-clean-materialization-input.schema.json`],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-clean-materialization-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-command-execution-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-runtime-build-authority-receipt.schema.json`,
    ],
    behaviorTests: ['tests/acceptance/requirements-contract-clean-materialization.test.ts'],
    runtimeRefs: [
      {
        role: 'controlled-command-producer',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-command-execution-receipt.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-command-execution-receipt.js',
      },
      {
        role: 'runtime-build-authority-validator',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-runtime-build-authority.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-runtime-build-authority.js',
      },
      {
        role: 'package-runtime-index',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-package-runtime-index.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-package-runtime-index.js',
      },
    ],
  },
  {
    actionId: 'requirements-contract-consumer-cli-capability-observe',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-consumer-cli-capability.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-consumer-cli-capability.js`,
    gateSymbol: 'requirementsContractConsumerCliCapabilityObserveCommand',
    inputSchemas: [`${SCHEMA_ROOT}/requirements-contract-consumer-project-profile.schema.json`],
    outputSchemas: [`${SCHEMA_ROOT}/requirements-contract-consumer-cli-capability.schema.json`],
    behaviorTests: [
      'tests/acceptance/requirements-contract-prompt-transaction-production-publication.test.ts',
    ],
  },
  {
    actionId: 'requirements-contract-changed-path-manifest',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-changed-path-manifest.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-changed-path-manifest.js`,
    gateSymbol: 'requirementsContractChangedPathManifestCommand',
    inputSchemas: [`${SCHEMA_ROOT}/requirements-contract-changed-path-manifest-input.schema.json`],
    outputSchemas: [`${SCHEMA_ROOT}/requirements-contract-changed-path-manifest.schema.json`],
    behaviorTests: ['tests/acceptance/requirements-contract-changed-path-manifest.test.ts'],
  },
  {
    actionId: 'requirements-contract-candidate-package',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-candidate-package.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-candidate-package.js`,
    gateSymbol: 'requirementsContractCandidatePackageCommand',
    inputSchemas: [`${SCHEMA_ROOT}/requirements-contract-candidate-package-input.schema.json`],
    outputSchemas: [`${SCHEMA_ROOT}/requirements-contract-candidate-package-receipt.schema.json`],
    behaviorTests: ['tests/acceptance/requirements-contract-candidate-package-provenance.test.ts'],
  },
  {
    actionId: 'requirements-contract-detached-test-rerun',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-detached-test-runner.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-detached-test-runner.js`,
    gateSymbol: 'requirementsContractDetachedTestRerunCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-detached-test-rerun-input.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-changed-path-manifest.schema.json`,
    ],
    outputSchemas: [`${SCHEMA_ROOT}/requirements-contract-detached-test-rerun.schema.json`],
    behaviorTests: ['tests/acceptance/requirements-contract-detached-test-rerun.test.ts'],
  },
  {
    actionId: 'requirements-contract-eval',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-evaluation.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-evaluation.js`,
    gateSymbol: 'requirementsContractEvalCommand',
    inputSchemas: [`${SCHEMA_ROOT}/requirements-contract-evaluation-input.schema.json`],
    outputSchemas: [`${SCHEMA_ROOT}/requirements-contract-evaluation-report.schema.json`],
    behaviorTests: ['tests/acceptance/requirements-contract-eval-command.test.ts'],
  },
  {
    actionId: 'requirements-contract-evidence-verify',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-evidence-verify.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-evidence-verify.js`,
    gateSymbol: 'requirementsContractEvidenceVerifyCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-evidence-verify-input.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-completion-evidence.schema.json`,
    ],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-evidence-verification-receipt.schema.json`,
    ],
    behaviorTests: ['tests/acceptance/requirements-contract-evidence-verify-command.test.ts'],
  },
  {
    actionId: 'requirements-contract-judge-run',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-judge-command.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-judge-command.js`,
    gateSymbol: 'requirementsContractJudgeRunCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-critical-auditor-judge-request.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-final-acceptance-judge-request.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-judge-attempt-key.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-judge-invocation-readiness-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-judge-runtime.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-judge-credentials.schema.json`,
    ],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-normalized-judge-response.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-cli-judge-execution-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-judge-invocation-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-critical-auditor-judge-assessment.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-final-acceptance-judge-assessment.schema.json`,
    ],
    behaviorTests: ['tests/acceptance/requirements-contract-judge-command.test.ts'],
    runtimeRefs: [
      {
        role: 'legacy-critical-auditor-judge-adapter',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-critical-auditor-judge-adapter.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-critical-auditor-judge-adapter.js',
      },
      {
        role: 'judge-credential-resolver',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-judge-credential-resolver.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-judge-credential-resolver.js',
      },
      {
        role: 'judge-provider-registry',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-judge-provider-registry.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-judge-provider-registry.js',
      },
      {
        role: 'openai-compatible-judge-adapter',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-openai-compatible-judge-adapter.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-openai-compatible-judge-adapter.js',
      },
      {
        role: 'anthropic-compatible-judge-adapter',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-anthropic-compatible-judge-adapter.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-anthropic-compatible-judge-adapter.js',
      },
      {
        role: 'claude-code-cli-judge-adapter',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-claude-code-cli-judge-adapter.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-claude-code-cli-judge-adapter.js',
      },
      {
        role: 'codex-cli-judge-adapter',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-codex-cli-judge-adapter.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-codex-cli-judge-adapter.js',
      },
    ],
  },
  {
    actionId: 'requirements-contract-gap-closure-readonly-auditor-adapter',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-gap-closure-readonly-auditor-adapter.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-gap-closure-readonly-auditor-adapter.js`,
    gateSymbol: 'requirementsContractGapClosureReadonlyAuditorAdapterCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-gap-closure-readonly-auditor-adapter-input.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-gap-closure-independent-audit-request.schema.json`,
    ],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-gap-closure-independent-audit-assessment.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-gap-closure-independent-audit-result.schema.json`,
    ],
    behaviorTests: [
      'tests/acceptance/requirements-contract-gap-closure-readonly-auditor-adapter.test.ts',
      'tests/acceptance/main-agent-gap-closure-evidence-gate.test.ts',
    ],
  },
  {
    actionId: 'requirements-contract-judge-credentials-init',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-judge-credential-initializer.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-judge-credential-initializer.js`,
    gateSymbol: 'requirementsContractJudgeCredentialsInitCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-judge-credential-initialization-input.schema.json`,
    ],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-judge-credential-initialization-receipt.schema.json`,
    ],
    behaviorTests: ['tests/acceptance/requirements-contract-judge-credential-initializer.test.ts'],
  },
  {
    actionId: 'requirements-contract-judge-provider-smoke',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-judge-provider-smoke.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-judge-provider-smoke.js`,
    gateSymbol: 'requirementsContractJudgeProviderSmokeCommand',
    inputSchemas: [`${SCHEMA_ROOT}/requirements-contract-judge-provider-smoke-input.schema.json`],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-judge-capability-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-judge-selection-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-judge-runtime-security-parity.schema.json`,
    ],
    behaviorTests: ['tests/acceptance/requirements-contract-judge-provider-smoke.test.ts'],
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
          'packages/bmad-speckit/_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js',
        packagePath: '_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js',
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
    actionId: 'requirements-contract-production-bypass-evidence-materialize',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-production-bypass-evidence-materializer.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-production-bypass-evidence-materializer.js`,
    gateSymbol: 'requirementsContractProductionBypassEvidenceMaterializeCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-production-bypass-evidence-materializer-input.schema.json`,
    ],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-production-bypass-evidence-materializer-report.schema.json`,
    ],
    behaviorTests: [
      'tests/acceptance/requirements-contract-production-bypass-evidence-materializer.test.ts',
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
    actionId: 'requirements-contract-production-activate',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-production-activate.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-production-activate.js`,
    gateSymbol: 'requirementsContractProductionActivateCommand',
    inputSchemas: [`${SCHEMA_ROOT}/requirements-contract-production-activate-input.schema.json`],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-production-activation-plan.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-production-activation-receipt.schema.json`,
    ],
    behaviorTests: [
      'tests/acceptance/requirements-contract-production-activate-command.test.ts',
      'tests/acceptance/requirements-contract-production-activation-plan-receipt-schema.test.ts',
      'tests/acceptance/requirements-contract-production-activation-receipt-schema.test.ts',
    ],
  },
  {
    actionId: 'requirements-contract-recovery-bootstrap',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-recovery-bootstrap.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-recovery-bootstrap.js`,
    gateSymbol: 'requirementsContractRecoveryBootstrapCommand',
    inputSchemas: [`${SCHEMA_ROOT}/requirements-contract-controlled-command-receipt.schema.json`],
    outputSchemas: [`${SCHEMA_ROOT}/requirements-contract-recovery-lineage-receipt.schema.json`],
    behaviorTests: ['tests/acceptance/requirements-contract-recovery-bootstrap.test.ts'],
  },
  {
    actionId: 'requirements-contract-reverse-audit',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-reverse-audit.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-reverse-audit.js`,
    gateSymbol: 'requirementsContractReverseAuditCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-reverse-audit-input.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-judge-capability-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-judge-selection-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-judge-runtime.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-judge-credentials.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-judge-provider-registry.schema.json`,
    ],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-normalized-judge-response.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-judge-response.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-judge-challenge-tests.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-test-source-audit.schema.json`,
    ],
    behaviorTests: ['tests/acceptance/requirements-contract-reverse-audit.test.ts'],
    runtimeRefs: [
      {
        role: 'judge-credential-resolver',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-judge-credential-resolver.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-judge-credential-resolver.js',
      },
      {
        role: 'judge-provider-registry',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-judge-provider-registry.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-judge-provider-registry.js',
      },
      {
        role: 'openai-compatible-judge-adapter',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-openai-compatible-judge-adapter.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-openai-compatible-judge-adapter.js',
      },
      {
        role: 'anthropic-compatible-judge-adapter',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-anthropic-compatible-judge-adapter.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-anthropic-compatible-judge-adapter.js',
      },
      {
        role: 'claude-code-cli-judge-adapter',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-claude-code-cli-judge-adapter.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-claude-code-cli-judge-adapter.js',
      },
      {
        role: 'codex-cli-judge-adapter',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-codex-cli-judge-adapter.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-codex-cli-judge-adapter.js',
      },
      {
        role: 'judge-provider-registry-projection',
        repositoryPath:
          'packages/bmad-speckit/_bmad/shared/requirements-contract/requirements-contract-judge-provider-registry.json',
        packagePath:
          '_bmad/shared/requirements-contract/requirements-contract-judge-provider-registry.json',
      },
    ],
  },
  {
    actionId: 'requirements-contract-stage-five-star-audit',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-stage-five-star-auditor.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-stage-five-star-auditor.js`,
    gateSymbol: 'requirementsContractStageFiveStarAuditCommand',
    inputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-stage-five-star-audit-input.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-stage-audit-context.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-recovery-lineage-receipt.schema.json`,
    ],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-stage-five-star-audit-matrix.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-stage-gap-ledger.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-stage-final-gate-report.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-stage-five-star-candidate-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-stage-candidate-revocation-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-stage-downstream-invalidation-set.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-stage-five-star-audit-command-receipt.schema.json`,
    ],
    behaviorTests: [
      'tests/acceptance/requirements-contract-stage-five-star-audit-architecture-wave-gate.test.ts',
    ],
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
  {
    actionId: 'requirements-contract-real-consumer-journey',
    sourcePath: `${SCRIPT_ROOT}/requirements-contract-real-consumer-journey.ts`,
    distPath: `${DIST_SCRIPT_ROOT}/requirements-contract-real-consumer-journey.js`,
    gateSymbol: 'requirementsContractRealConsumerJourneyCommand',
    inputSchemas: [`${SCHEMA_ROOT}/requirements-contract-real-consumer-journey-input.schema.json`],
    outputSchemas: [
      `${SCHEMA_ROOT}/requirements-contract-candidate-package-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-real-consumer-pre-confirmation-snapshot.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-real-consumer-confirmation-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-real-consumer-boundary-observer-receipt.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-real-consumer-journey-evidence.schema.json`,
      `${SCHEMA_ROOT}/requirements-contract-real-consumer-journey-command-receipt.schema.json`,
    ],
    behaviorTests: ['tests/acceptance/requirements-contract-real-consumer-journey.test.ts'],
    runtimeRefs: [
      {
        role: 'installed-adapter',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-real-consumer-adapter.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-real-consumer-adapter.js',
      },
      {
        role: 'installed-boundary-observer',
        repositoryPath: `${DIST_SCRIPT_ROOT}/requirements-contract-real-consumer-boundary-observer.js`,
        packagePath:
          'dist/main-agent/source-authority/scripts/requirements-contract-real-consumer-boundary-observer.js',
      },
    ],
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

function runtimeFileHash(filePath: string, packagePath: string): string {
  const bytes = fs.readFileSync(filePath);
  if (
    !packagePath.startsWith('bin/') ||
    bytes.length < 3 ||
    bytes[0] !== 0x23 ||
    bytes[1] !== 0x21
  ) {
    return sourceBytesHash(bytes);
  }
  const lineFeedIndex = bytes.indexOf(0x0a);
  if (lineFeedIndex <= 0 || bytes[lineFeedIndex - 1] !== 0x0d) {
    return sourceBytesHash(bytes);
  }
  return sourceBytesHash(
    Buffer.concat([bytes.subarray(0, lineFeedIndex - 1), bytes.subarray(lineFeedIndex)])
  );
}

function registeredActionIds(root: string): string[] {
  const cliPath = path.join(root, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');
  const cliSource = fs.readFileSync(cliPath, 'utf8');
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
  return [...new Set(directActionIds)].sort();
}

export function buildPackageRuntimeActionBindingManifest(root: string): JsonRecord {
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
      inputSchemaRefs: spec.inputSchemas.map((schemaPath) => repositoryFileRef(root, schemaPath)),
      outputSchemaRefs: spec.outputSchemas.map((schemaPath) => repositoryFileRef(root, schemaPath)),
      behaviorTestRefs: spec.behaviorTests.map((testPath) => repositoryFileRef(root, testPath)),
      packageDistRef: { path: packagePath, hash: distHandlerRef.hash },
      installedSurfaceRefs: [{ path: packagePath, hash: distHandlerRef.hash }],
      runtimeRefs: (spec.runtimeRefs ?? []).map((runtimeRef) => ({
        role: runtimeRef.role,
        packagePath: slash(runtimeRef.packagePath),
        hash: runtimeFileHash(
          path.resolve(root, runtimeRef.repositoryPath),
          runtimeRef.packagePath
        ),
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
    schemaVersion: 'requirements-contract-package-runtime-action-binding-manifest/v2',
    actionUniverseHash: ACTION_UNIVERSE_HASH,
    actions,
    packageRuntimeRoutingOnlyActionCount: actions.filter((action) => action.routingOnly).length,
    installedPackageActionBehaviorMismatchCount: actions.filter((action) =>
      action.installedSurfaceRefs.some((ref) => ref.hash !== action.packageDistRef.hash)
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
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(readJson(schemaPath));
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

function assertRef(
  ref: JsonRecord,
  expectedPath: string,
  label: string,
  hashForPath: (filePath: string) => string = fileHash
) {
  const resolved = path.resolve(String(ref.path ?? ''));
  if (!samePath(resolved, expectedPath)) throw new Error(`${label}_path_mismatch`);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`${label}_missing`);
  }
  const hash = hashForPath(resolved);
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
  const packagePath = String(matches[0].packagePath ?? '');
  return assertRef(
    {
      path: path.join(installedPackageRoot, packagePath),
      hash: matches[0].hash,
    },
    path.join(installedPackageRoot, packagePath),
    role.replace(/-/gu, '_'),
    (filePath) => runtimeFileHash(filePath, packagePath)
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
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(readJson(schemaPath));
  const manifest = readJson(manifestPath);
  if (!validate(manifest)) {
    throw new Error(
      `package_runtime_action_binding_manifest_schema_invalid:${JSON.stringify(validate.errors ?? [])}`
    );
  }
  const matches = manifest.actions.filter(
    (entry: JsonRecord) => entry.actionId === 'requirements-contract-prompt-transaction-publish'
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
  const installedRunnerRef = installedRuntimeRef(binding, installedPackageRoot, 'installed-runner');
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
