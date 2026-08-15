import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { sha256Stable } from '../scripts/requirements-contract-semantic-resolver';
import { REQUIREMENTS_CONTRACT_VALIDATION_FACADE_ID } from '../scripts/requirements-contract-validation-facade';

export const REQUIREMENTS_CONTRACT_CONSUMER_VALIDATION_FACADE =
  REQUIREMENTS_CONTRACT_VALIDATION_FACADE_ID;

export const REQUIREMENTS_CONTRACT_CONSUMER_REGISTRY_OWNER_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-consumer-registry.ts';

export const REQUIREMENTS_CONTRACT_VALIDATION_MODES = [
  'draft',
  'confirmation-ready',
  'execution',
  'closeout',
] as const;

const SCRIPT_ROOT = 'packages/bmad-speckit/src/main-agent/source-authority/scripts';
const PRODUCTION_DISCOVERY_RULES = [
  { root: 'scripts', fileNamePattern: '\\.(?:cjs|mjs|js|jsx|cts|mts|ts|tsx)$' },
  { root: 'src', fileNamePattern: '\\.(?:cjs|mjs|js|jsx|cts|mts|ts|tsx)$' },
  { root: 'bin', fileNamePattern: '\\.(?:cjs|mjs|js|jsx|cts|mts|ts|tsx)$' },
  { root: '_bmad/shared', fileNamePattern: '\\.(?:cjs|mjs|js|jsx|cts|mts|ts|tsx)$' },
  { root: 'packages', fileNamePattern: '\\.(?:cjs|mjs|js|jsx|cts|mts|ts|tsx)$' },
  { root: '_bmad/codex', fileNamePattern: '\\.(?:cjs|mjs|js|jsx|cts|mts|ts|tsx)$' },
  {
    root: 'node_modules/bmad-speckit',
    fileNamePattern: '\\.(?:cjs|mjs|js|jsx|cts|mts|ts|tsx)$',
  },
] as const;

const NON_PRODUCTION_DIRECTORY_NAMES = new Set([
  '.git',
  '.worktrees',
  '__tests__',
  'coverage',
  'docs',
  'fixtures',
  'node_modules',
  'specs',
  'test',
  'test-results',
  'tests',
]);

const SEMANTIC_READER_PATTERNS = [
  /\bimplementationConfirmation\b/u,
  /\bcurrentTargetMap\b/u,
  /\bRequirementContractModelV(?:1|2)\b/u,
  /\brequirements-contract-read-facade\b/u,
  /(?:logicalModel|semanticModel|requirementContract)\s*(?:\.\s*(?:semanticBodies|nodes|edges)|\[\s*['"](?:semanticBodies|nodes|edges)['"]\s*\])/u,
  /(?:semantic-ir|trace-graph|target-bindings|task-graph|red-contracts|oracle-registry|acceptance-contracts|evidence-requirements|business-behavior-delta|implementation-impact-map)\.json/u,
] as const;
const GENERATED_HOST_RUNTIME_BUNDLE_PATH = 'generated-host-runtime-bundle';
const PRODUCTION_RUNTIME_BUNDLE_MIRROR_PATHS = new Set([
  'packages/runtime-emit/dist/emit-runtime-policy.cjs',
  'packages/runtime-emit/dist/resolve-for-session.cjs',
  'packages/bmad-speckit/dist/main-agent/source-authority/packages/runtime-emit/dist/emit-runtime-policy.cjs',
  'packages/bmad-speckit/dist/main-agent/source-authority/packages/runtime-emit/dist/resolve-for-session.cjs',
]);
const PRODUCTION_EXACT_MIRROR_PATHS = new Map([
  [
    'scripts/run-confirmed-trace-slice.js',
    'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-confirmed-trace-slice.ts',
  ],
]);

type ValidationMode = (typeof REQUIREMENTS_CONTRACT_VALIDATION_MODES)[number];

const CONFIRMATION_COMPOSITION = {
  codec: 'implementation_confirmation_codec',
  schema: 'implementation_confirmation_schema',
  validator: 'implementation_confirmation_validator',
  projector: 'implementation_confirmation_projector',
  renderInputSchema: 'confirmation_render_input_schema',
  renderInputProjector: 'confirmation_render_input_projector',
  renderer: 'confirmation_renderer',
  reference: 'implementation_confirmation_reference',
  rendererSpecification: 'confirmation_renderer_specification',
} as const;

const CLOSEOUT_COMPOSITION = {
  packetSchema: 'closeout_packet_schema',
  renderer: {
    assetId: 'closeout_renderer',
    symbolRef: 'renderRequirementsContractTerminalCloseout',
  },
  readbackReceiptSchema: 'closeout_readback_receipt_schema',
  finalResponseProjector: {
    assetId: 'closeout_final_response_projector',
    symbolRef: 'projectRequirementsContractTerminalCloseout',
  },
} as const;

interface ConsumerDefinition {
  consumerId: string;
  fileName?: string;
  path?: string;
  inputRole: string;
  supportedModes: readonly ValidationMode[];
  parserRef?: string;
  validatorRef?: string;
  readFacadeRef?: string;
  adapterRef?: string;
  sourceFormatVersion?: 'v1' | 'v2' | 'v1_or_v2' | 'discovery';
  legacyReadEligibility?: 'not_applicable' | 'registered_inventory_only';
}

const SIX_MODEL_DISCOVERY_ROOTS = [
  'scripts',
  'src',
  'bin',
  '_bmad/shared',
  'packages',
  'packages/bmad-speckit/src',
  'packages/bmad-speckit/dist',
  '_bmad/skills',
  '.codex/skills',
  '.cursor/skills',
  '.claude/skills',
  '.cursor/hooks',
  '.claude/hooks',
  'packages/runtime-emit/dist',
] as const;

const SIX_MODEL_SOURCE_PATTERN =
  /\bsixModelResults\b|\bresolveVerifiedSixModel(?:Status|Panorama)\b|\bcreateRuntimeStatusProjectionUpdate\b|\bruntimeStatusProjectionArtifactWrites\b/u;
const DIRECT_SIX_MODEL_PROJECTION_ACCESS_PATTERN =
  /(?:\?\.|\.)\s*sixModelResults\b|\[\s*['"]sixModelResults['"]\s*\]/u;
const VERIFIED_SIX_MODEL_FACADE_PATTERN = /\bresolveVerifiedSixModel(?:Status|Panorama)\b/u;

export const REQUIREMENTS_CONTRACT_SIX_MODEL_CONSUMER_ROLES = [
  'verified_status_reader',
  'status_facade',
  'authority_core',
  'projection_reader',
  'projection_writer',
  'projection_reducer',
  'runtime_bridge',
  'panorama_renderer',
  'field_guard',
  'verification_harness',
  'generated_runtime_bundle',
] as const;

export type SixModelConsumerRole = (typeof REQUIREMENTS_CONTRACT_SIX_MODEL_CONSUMER_ROLES)[number];

export const REQUIREMENTS_CONTRACT_SIX_MODEL_READER_ROLES = [
  'verified_status_reader',
  'status_facade',
  'projection_reader',
  'projection_reducer',
  'runtime_bridge',
  'panorama_renderer',
  'field_guard',
  'verification_harness',
  'generated_runtime_bundle',
] as const satisfies readonly SixModelConsumerRole[];

export const REQUIREMENTS_CONTRACT_SIX_MODEL_WRITER_ROLES = [
  'projection_writer',
  'projection_reducer',
  'runtime_bridge',
  'generated_runtime_bundle',
] as const satisfies readonly SixModelConsumerRole[];

interface SixModelConsumerDefinition {
  consumerId: string;
  canonicalPath: string;
  roles: readonly SixModelConsumerRole[];
  verifiedFacadeRequired?: boolean;
}

export const REQUIREMENTS_CONTRACT_SIX_MODEL_CONSUMER_DEFINITIONS: readonly SixModelConsumerDefinition[] =
  [
    {
      consumerId: 'six-model-prompt-generator',
      canonicalPath: '_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.js',
      roles: ['verified_status_reader'],
      verifiedFacadeRequired: true,
    },
    {
      consumerId: 'six-model-confirmation-event-ingest',
      canonicalPath:
        '_bmad/skills/requirements-contract-authoring/scripts/ingest-confirmation-event.js',
      roles: ['projection_reader', 'projection_writer'],
    },
    {
      consumerId: 'six-model-generated-runtime-bundle',
      canonicalPath: 'generated-host-runtime-bundle',
      roles: ['generated_runtime_bundle'],
    },
    {
      consumerId: 'six-model-main-runtime-guard',
      canonicalPath: 'packages/bmad-speckit/src/main-agent/runtime/supervised-worker-runtime.ts',
      roles: ['field_guard'],
    },
    {
      consumerId: 'six-model-dispatch-plan',
      canonicalPath: 'packages/bmad-speckit/src/main-agent/actions/dispatch-plan.ts',
      roles: ['verified_status_reader'],
      verifiedFacadeRequired: true,
    },
    {
      consumerId: 'six-model-runtime-policy-bridge',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/emit-runtime-policy.ts',
      roles: ['projection_writer', 'runtime_bridge'],
    },
    {
      consumerId: 'six-model-architecture-ingest',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/ingest-architecture-confirmation.ts',
      roles: ['verified_status_reader', 'projection_reader', 'projection_writer'],
      verifiedFacadeRequired: true,
    },
    {
      consumerId: 'six-model-confirmation-initializer',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/initialize-six-model-requirement-confirmation.ts',
      roles: ['projection_reader', 'projection_writer'],
    },
    {
      consumerId: 'six-model-audit-review',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-audit-review-gate.ts',
      roles: ['verified_status_reader', 'projection_writer'],
      verifiedFacadeRequired: true,
    },
    {
      consumerId: 'six-model-delivery-closeout',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-delivery-closeout-gate.ts',
      roles: ['verified_status_reader', 'projection_writer'],
      verifiedFacadeRequired: true,
    },
    {
      consumerId: 'six-model-controlled-closeout-confirmation',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-controlled-closeout-confirmation.ts',
      roles: ['projection_reader', 'projection_writer'],
    },
    {
      consumerId: 'six-model-execution-closure',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-execution-closure-gate.ts',
      roles: ['projection_writer'],
    },
    {
      consumerId: 'six-model-implementation-readiness',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-gate.ts',
      roles: ['projection_writer'],
    },
    {
      consumerId: 'six-model-main-orchestration',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
      roles: ['verified_status_reader'],
      verifiedFacadeRequired: true,
    },
    {
      consumerId: 'six-model-control-store',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirement-record-control-store.ts',
      roles: ['projection_reader', 'projection_writer', 'projection_reducer'],
    },
    {
      consumerId: 'six-model-confirmation-acceptance',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-acceptance.ts',
      roles: ['projection_writer'],
    },
    {
      consumerId: 'six-model-runtime-status-authority-core',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-status-authority-core.cjs',
      roles: ['authority_core'],
    },
    {
      consumerId: 'six-model-runtime-status-authority-declaration',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-status-authority-core.d.cts',
      roles: ['status_facade'],
    },
    {
      consumerId: 'six-model-runtime-status-projection-reducer',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-status-decision-receipt.ts',
      roles: ['projection_reader', 'projection_writer', 'projection_reducer'],
    },
    {
      consumerId: 'six-model-prompt-transaction-authority',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-prompt-transaction-authority.ts',
      roles: ['verified_status_reader', 'projection_reader'],
      verifiedFacadeRequired: true,
    },
    {
      consumerId: 'six-model-projection-parity-case-runner',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-six-model-projection-parity-case-runner.ts',
      roles: ['verification_harness'],
    },
    {
      consumerId: 'six-model-required-command-resolution',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
      roles: ['verified_status_reader'],
      verifiedFacadeRequired: true,
    },
    {
      consumerId: 'six-model-runtime-decision',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/six-model-runtime-decision.ts',
      roles: ['verified_status_reader'],
      verifiedFacadeRequired: true,
    },
    {
      consumerId: 'six-model-source-authority-runtime-guard',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/supervised-worker-runtime.ts',
      roles: ['field_guard'],
    },
    {
      consumerId: 'six-model-target-artifact-guard',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/target-artifact-realization-gate.ts',
      roles: ['field_guard'],
    },
    {
      consumerId: 'six-model-verified-status-facade',
      canonicalPath:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/verified-six-model-status-facade.ts',
      roles: ['status_facade'],
    },
    {
      consumerId: 'six-model-ai-tdd-runtime-decision',
      canonicalPath: 'packages/bmad-speckit/src/runtime/ai-tdd/runtime-decision.ts',
      roles: ['verified_status_reader'],
      verifiedFacadeRequired: true,
    },
    {
      consumerId: 'six-model-bmads-renderer',
      canonicalPath: 'packages/bmad-speckit/src/runtime/bmads-renderer.ts',
      roles: ['panorama_renderer'],
    },
  ] as const;

const CONSUMER_DEFINITIONS: readonly ConsumerDefinition[] = [
  {
    consumerId: 'canonical-markdown-parser',
    path: '_bmad/shared/requirements-contract/markdown-source-parser.js',
    inputRole: 'source_markdown',
    supportedModes: ['draft', 'confirmation-ready'],
    parserRef: 'self',
    readFacadeRef: 'not_applicable',
    adapterRef: 'not_applicable',
    sourceFormatVersion: 'v1_or_v2',
  },
  {
    consumerId: 'direct-main-session-requirement-authoring',
    fileName: 'main-agent-orchestration.ts',
    inputRole: 'authoring_request',
    supportedModes: ['draft', 'confirmation-ready'],
  },
  {
    consumerId: 'artifact-role-classification',
    fileName: 'requirements-contract-artifact-role-classifier.ts',
    inputRole: 'artifact_role_authority',
    supportedModes: ['draft'],
    sourceFormatVersion: 'discovery',
  },
  {
    consumerId: 'bmad-create-prd-source-authoring',
    fileName: 'requirements-contract-bmad-consumer-orchestrator.ts',
    inputRole: 'discovery_session',
    supportedModes: ['draft', 'confirmation-ready'],
    sourceFormatVersion: 'discovery',
  },
  {
    consumerId: 'bmad-advanced-elicitation-requirements',
    fileName: 'requirements-contract-bmad-consumer-orchestrator.ts',
    inputRole: 'semantic_candidate_batch',
    supportedModes: ['draft'],
    sourceFormatVersion: 'discovery',
  },
  {
    consumerId: 'intake-receipt-producer',
    fileName: 'requirements-contract-intake-receipt.ts',
    inputRole: 'entry_source_session',
    supportedModes: ['draft'],
  },
  {
    consumerId: 'file-intake-receipt-producer',
    fileName: 'requirements-contract-file-intake-receipt.ts',
    inputRole: 'source_file',
    supportedModes: ['draft'],
  },
  {
    consumerId: 'intent-lineage-producer',
    fileName: 'requirements-contract-intent-lineage.ts',
    inputRole: 'intake_receipt',
    supportedModes: ['draft'],
  },
  {
    consumerId: 'semantic-conservation-producer',
    fileName: 'requirements-contract-semantic-conservation-manifest.ts',
    inputRole: 'semantic_source_roots',
    supportedModes: ['draft', 'confirmation-ready'],
  },
  {
    consumerId: 'source-template-linter',
    fileName: 'lint-requirements-contract-source-template.ts',
    inputRole: 'source_prd_template',
    supportedModes: ['draft', 'confirmation-ready'],
  },
  {
    consumerId: 'source-instance-linter',
    fileName: 'lint-requirements-contract-source-prd.ts',
    inputRole: 'requirement_source_prd',
    supportedModes: ['draft', 'confirmation-ready'],
  },
  {
    consumerId: 'validation-facade',
    fileName: 'requirements-contract-validation-facade.ts',
    inputRole: 'logical_requirement_model',
    supportedModes: REQUIREMENTS_CONTRACT_VALIDATION_MODES,
    validatorRef: 'self',
  },
  {
    consumerId: 'read-facade',
    fileName: 'requirements-contract-read-facade.ts',
    inputRole: 'registered_requirement_source',
    supportedModes: REQUIREMENTS_CONTRACT_VALIDATION_MODES,
    readFacadeRef: 'self',
  },
  {
    consumerId: 'ai-tdd-contract-gate',
    fileName: 'ai-tdd-contract-gate.ts',
    inputRole: 'canonical_red_contracts',
    supportedModes: ['execution', 'closeout'],
  },
  {
    consumerId: 'run-confirmed-trace-slice',
    fileName: 'run-confirmed-trace-slice.ts',
    inputRole: 'canonical_trace_graph',
    supportedModes: ['execution'],
  },
  {
    consumerId: 'main-agent-functional-resume-check',
    fileName: 'main-agent-functional-resume-check.ts',
    inputRole: 'canonical_execution_resume',
    supportedModes: ['execution', 'closeout'],
  },
  {
    consumerId: 'main-agent-compiled-prompt-runner',
    fileName: 'main-agent-compiled-prompt-runner.ts',
    inputRole: 'canonical_prompt_transaction',
    supportedModes: ['execution'],
  },
  {
    consumerId: 'architecture-confirmation-artifact',
    path: '_bmad/skills/requirements-contract-authoring/scripts/generate-architecture-confirmation-artifact.ts',
    inputRole: 'canonical_architecture_interaction',
    supportedModes: ['confirmation-ready'],
  },
  {
    consumerId: 'requirements-contract-reverse-audit',
    fileName: 'requirements-contract-reverse-audit.ts',
    inputRole: 'canonical_reverse_audit',
    supportedModes: ['closeout'],
  },
  {
    consumerId: 'main-agent-delivery-closeout-gate',
    fileName: 'main-agent-delivery-closeout-gate.ts',
    inputRole: 'canonical_delivery_closeout',
    supportedModes: ['closeout'],
  },
  {
    consumerId: 'strict-closeout-proof-gate',
    fileName: 'strict-closeout-proof-gate.ts',
    inputRole: 'canonical_closeout_proof',
    supportedModes: ['closeout'],
  },
  {
    consumerId: 'v1-read-adapter',
    fileName: 'requirements-contract-v1-read-adapter.ts',
    inputRole: 'registered_v1_source',
    supportedModes: REQUIREMENTS_CONTRACT_VALIDATION_MODES,
    adapterRef: 'self',
    sourceFormatVersion: 'v1',
    legacyReadEligibility: 'registered_inventory_only',
  },
  {
    consumerId: 'v1-legacy-inventory-writer',
    fileName: 'requirements-contract-v1-legacy-inventory.ts',
    inputRole: 'g00_baseline_source_prd_inventory',
    supportedModes: ['draft', 'confirmation-ready'],
    sourceFormatVersion: 'v1',
  },
  {
    consumerId: 'v2-read-adapter',
    fileName: 'requirements-contract-v2-read-adapter.ts',
    inputRole: 'normalized_contract_bundle',
    supportedModes: REQUIREMENTS_CONTRACT_VALIDATION_MODES,
    adapterRef: 'self',
  },
  {
    consumerId: 'product-and-source-prd-renderer',
    fileName: 'requirements-contract-prd-render-write-seam.ts',
    inputRole: 'validated_render_request',
    supportedModes: ['draft', 'confirmation-ready'],
  },
  {
    consumerId: 'normalized-package-renderer',
    fileName: 'requirements-contract-normalized-package-renderer.ts',
    inputRole: 'semantic_ir',
    supportedModes: ['confirmation-ready', 'execution'],
  },
  {
    consumerId: 'judge-credential-resolver',
    fileName: 'requirements-contract-judge-credential-resolver.ts',
    inputRole: 'judge_runtime_public_configuration',
    supportedModes: ['execution', 'closeout'],
    validatorRef: 'requirements-contract-judge-runtime.schema.json',
  },
  {
    consumerId: 'judge-provider-registry',
    fileName: 'requirements-contract-judge-provider-registry.ts',
    inputRole: 'validated_judge_runtime',
    supportedModes: ['execution', 'closeout'],
    validatorRef: 'requirements-contract-judge-provider-registry.schema.json',
  },
  {
    consumerId: 'openai-compatible-judge-adapter',
    fileName: 'requirements-contract-openai-compatible-judge-adapter.ts',
    inputRole: 'judge_provider_request',
    supportedModes: ['execution', 'closeout'],
    validatorRef: 'requirements-contract-normalized-judge-response.schema.json',
  },
  {
    consumerId: 'anthropic-compatible-judge-adapter',
    fileName: 'requirements-contract-anthropic-compatible-judge-adapter.ts',
    inputRole: 'judge_provider_request',
    supportedModes: ['execution', 'closeout'],
    validatorRef: 'requirements-contract-normalized-judge-response.schema.json',
  },
  {
    consumerId: 'claude-code-cli-judge-adapter',
    fileName: 'requirements-contract-claude-code-cli-judge-adapter.ts',
    inputRole: 'frozen_local_judge_evidence_snapshot',
    supportedModes: ['execution', 'closeout'],
    validatorRef: 'requirements-contract-normalized-judge-response.schema.json',
  },
  {
    consumerId: 'codex-cli-judge-adapter',
    fileName: 'requirements-contract-codex-cli-judge-adapter.ts',
    inputRole: 'frozen_local_judge_evidence_snapshot',
    supportedModes: ['execution', 'closeout'],
    validatorRef: 'requirements-contract-normalized-judge-response.schema.json',
  },
  {
    consumerId: 'judge-provider-smoke',
    fileName: 'requirements-contract-judge-provider-smoke.ts',
    inputRole: 'audit_phase_context',
    supportedModes: ['execution', 'closeout'],
    validatorRef: 'requirements-contract-judge-capability-receipt.schema.json',
  },
  {
    consumerId: 'render-roundtrip-gate',
    fileName: 'requirements-contract-render-roundtrip-gate.ts',
    inputRole: 'rendered_source_prd',
    supportedModes: ['confirmation-ready'],
  },
  {
    consumerId: 'finalization-safe-writer',
    fileName: 'requirements-contract-finalization-safe-writer.ts',
    inputRole: 'validated_finalization_artifact',
    supportedModes: ['closeout'],
  },
  {
    consumerId: 'evidence-artifact-readback',
    fileName: 'requirements-contract-evidence-artifact-readback.ts',
    inputRole: 'promoted_evidence_artifact',
    supportedModes: ['execution', 'closeout'],
  },
  {
    consumerId: 'requirement-record-registration',
    fileName: 'requirement-record-control-store.ts',
    inputRole: 'validated_requirement_record',
    supportedModes: ['confirmation-ready', 'execution', 'closeout'],
  },
  {
    consumerId: 'bundle-proof-publisher',
    fileName: 'requirements-contract-bundle-publish.ts',
    inputRole: 'normalized_contract_bundle',
    supportedModes: ['execution'],
  },
  {
    consumerId: 'prompt-transaction-publisher',
    fileName: 'requirements-contract-prompt-transaction-publisher.ts',
    inputRole: 'prompt_transaction',
    supportedModes: ['execution'],
  },
  {
    consumerId: 'production-activation-gate',
    fileName: 'requirements-contract-production-activate.ts',
    inputRole: 'activation_plan',
    supportedModes: ['execution'],
  },
  {
    consumerId: 'evidence-verification-ingest',
    fileName: 'requirements-contract-evidence-verify.ts',
    inputRole: 'implementation_evidence',
    supportedModes: ['execution', 'closeout'],
  },
  {
    consumerId: 'target-artifact-realization-gate',
    fileName: 'target-artifact-realization-gate.ts',
    inputRole: 'target_bindings',
    supportedModes: ['execution'],
  },
  {
    consumerId: 'subagent-surface-inventory',
    fileName: 'subagent-surface-inventory.ts',
    inputRole: 'runtime_surface_inventory',
    supportedModes: ['execution', 'closeout'],
  },
  {
    consumerId: 'acceptance-root-proof-gate',
    fileName: 'requirements-contract-acceptance-root-proof.ts',
    inputRole: 'acceptance_contracts',
    supportedModes: ['execution', 'closeout'],
  },
  {
    consumerId: 'reverse-audit-gate',
    fileName: 'requirements-contract-reverse-audit.ts',
    inputRole: 'candidate_evidence_bundle',
    supportedModes: ['closeout'],
  },
  {
    consumerId: 'terminal-command-supervisor',
    fileName: 'requirements-contract-terminal-command-supervisor.ts',
    inputRole: 'terminal_closeout_inputs',
    supportedModes: ['closeout'],
  },
  {
    consumerId: 'terminal-closeout-gate',
    fileName: 'requirements-contract-terminal-closeout.ts',
    inputRole: 'verified_closeout_bundle',
    supportedModes: ['closeout'],
  },
] as const;

export const REQUIREMENTS_CONTRACT_PRODUCTION_SEMANTIC_SOURCE_PATHS = [
  '_bmad/shared/contract-execution-manifest/build-contract-execution-manifest.js',
  '_bmad/shared/contract-execution-manifest/hash-contract-execution-manifest.js',
  '_bmad/shared/contract-execution-manifest/normalize-contract-execution-manifest.js',
  '_bmad/skills/req-trace-matrix-prompt-generator/references/contract-execution-manifest/build-contract-execution-manifest.js',
  '_bmad/skills/req-trace-matrix-prompt-generator/references/contract-execution-manifest/hash-contract-execution-manifest.js',
  '_bmad/skills/req-trace-matrix-prompt-generator/references/contract-execution-manifest/normalize-contract-execution-manifest.js',
  '_bmad/skills/requirements-contract-authoring/scripts/assess_contract_authoring_scale.js',
  '_bmad/skills/requirements-contract-authoring/scripts/confirm-requirements-scope.js',
  '_bmad/skills/requirements-contract-authoring/scripts/generate-draft-manifest.js',
  '_bmad/skills/requirements-contract-authoring/scripts/normalize-draft-markdown.js',
  '_bmad/skills/requirements-contract-authoring/scripts/pre_render_definition_drilldown_lib.js',
  '_bmad/skills/requirements-contract-authoring/scripts/pre_render_must_decomposition_gate.js',
  '_bmad/skills/requirements-contract-authoring/scripts/prepare-current-source-promotion.js',
  '_bmad/skills/requirements-contract-authoring/scripts/projection_quality_gate.js',
  '_bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts',
  '_bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js',
  '_bmad/skills/requirements-contract-authoring/scripts/run_semantic_checkpoints.js',
  '_bmad/skills/requirements-contract-authoring/scripts/target_modification_path_coverage.js',
  'packages/bmad-speckit/src/main-agent/actions/source-authority-orchestration.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-discovery-envelope-registry.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-safe-write-target-registry.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-source-prd-rules.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-entryflow-traceability-check.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-trace-status-policy-check.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/record-main-agent-inspect-readiness-closure.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authority-publication-committer.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-canonical-compiler-input.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-projection-facade.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-direct-confirmation-read-bypass-audit.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-direct-parser-bypass-audit.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-confirmation-codec.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-confirmation-projector.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-audit-unit-projector.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model-packet-parity.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-bypass-verifier.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-semantic-pipeline.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-real-consumer-adapter.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-root-registry.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/resolve-active-requirement.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/strict-command-resolution-preflight.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/trace-closure-matrix.ts',
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/verify-requirements-contract-source-writes.ts',
  'packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-authoring-judge.ts',
  'packages/bmad-speckit/src/utils/goal-contract/control-plane/standalone-goal-authority.ts',
  'packages/bmad-speckit/dist/utils/goal-contract/control-plane/standalone-goal-authoring-judge.js',
  'packages/bmad-speckit/dist/utils/goal-contract/control-plane/standalone-goal-authority.js',
] as const;

interface ConsumerDiscoveryRule {
  ruleId: string;
  root: string;
  fileNamePattern: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function consumerDiscoveryRuleId(root: string, index: number): string {
  if (root === '_bmad/shared/requirements-contract') return 'canonical_parser';
  if (root === SCRIPT_ROOT) return 'requirements_contract_runtime_entries';
  if (root === '_bmad/skills/requirements-contract-authoring/scripts') {
    return 'requirements_contract_authoring_entries';
  }
  return `requirements_contract_declared_entries_${index + 1}`;
}

function createConsumerDiscoveryRules(): ConsumerDiscoveryRule[] {
  const filesByRoot = new Map<string, Set<string>>();
  for (const definition of CONSUMER_DEFINITIONS) {
    const declaredPath = consumerPath(definition);
    const root = normalize(path.posix.dirname(declaredPath));
    const fileNames = filesByRoot.get(root) ?? new Set<string>();
    fileNames.add(path.posix.basename(declaredPath));
    filesByRoot.set(root, fileNames);
  }
  return [...filesByRoot.entries()].map(([root, fileNames], index) => ({
    ruleId: consumerDiscoveryRuleId(root, index),
    root,
    fileNamePattern: `^(?:${[...fileNames].sort().map(escapeRegExp).join('|')})$`,
  }));
}

function normalize(value: string): string {
  return value.replace(/\\/gu, '/');
}

function filesBelow(root: string): string[] {
  if (!existsSync(root)) return [];
  const result: string[] = [];
  for (const entry of readdirSync(root)) {
    const candidate = path.join(root, entry);
    if (statSync(candidate).isDirectory()) {
      if (!entry.startsWith('.') && !NON_PRODUCTION_DIRECTORY_NAMES.has(entry)) {
        result.push(...filesBelow(candidate));
      }
    } else result.push(candidate);
  }
  return result;
}

function sourceCanonicalPath(root: string, candidate: string): string {
  if (candidate.endsWith('.cjs') || candidate.endsWith('.mjs') || candidate.endsWith('.d.cts')) {
    return candidate;
  }
  const typescriptCandidate = candidate.replace(/\.js$/u, '.ts');
  return existsSync(path.resolve(root, typescriptCandidate)) ? typescriptCandidate : candidate;
}

function canonicalSixModelConsumerPath(root: string, relativePath: string): string {
  const normalizedPath = normalize(relativePath);
  if (
    /^(?:\.cursor|\.claude)\/hooks\/.+\.cjs$/u.test(normalizedPath) ||
    /^packages\/runtime-emit\/dist\/.+\.cjs$/u.test(normalizedPath) ||
    /^packages\/bmad-speckit\/dist\/main-agent\/source-authority\/packages\/runtime-emit\/dist\/.+\.cjs$/u.test(
      normalizedPath
    )
  ) {
    return 'generated-host-runtime-bundle';
  }

  const mappings: readonly [string, (remainder: string) => string][] = [
    ['packages/bmad-speckit/_bmad/skills/', (remainder) => `_bmad/skills/${remainder}`],
    [
      'packages/bmad-speckit/dist/main-agent/source-authority/scripts/',
      (remainder) =>
        sourceCanonicalPath(
          root,
          `packages/bmad-speckit/src/main-agent/source-authority/scripts/${remainder}`
        ),
    ],
    [
      'packages/bmad-speckit/dist/main-agent/source-authority/',
      (remainder) =>
        sourceCanonicalPath(
          root,
          `packages/bmad-speckit/src/main-agent/source-authority/${remainder}`
        ),
    ],
    [
      'packages/bmad-speckit/dist/main-agent/actions/',
      (remainder) =>
        sourceCanonicalPath(root, `packages/bmad-speckit/src/main-agent/actions/${remainder}`),
    ],
    [
      'packages/bmad-speckit/dist/main-agent/runtime/',
      (remainder) =>
        sourceCanonicalPath(root, `packages/bmad-speckit/src/main-agent/runtime/${remainder}`),
    ],
    [
      'packages/bmad-speckit/dist/runtime/',
      (remainder) => sourceCanonicalPath(root, `packages/bmad-speckit/src/runtime/${remainder}`),
    ],
    ['.codex/skills/', (remainder) => `_bmad/skills/${remainder}`],
    ['.cursor/skills/', (remainder) => `_bmad/skills/${remainder}`],
    ['.claude/skills/', (remainder) => `_bmad/skills/${remainder}`],
  ];
  for (const [prefix, map] of mappings) {
    if (normalizedPath.startsWith(prefix)) {
      return normalize(map(normalizedPath.slice(prefix.length)));
    }
  }
  return normalize(sourceCanonicalPath(root, normalizedPath));
}

function sixModelSurface(relativePath: string): string {
  if (relativePath.startsWith('packages/bmad-speckit/src/')) return 'source';
  if (relativePath.startsWith('packages/bmad-speckit/dist/')) return 'package-dist';
  if (relativePath.startsWith('.codex/')) return 'codex';
  if (relativePath.startsWith('.cursor/')) return 'cursor';
  if (relativePath.startsWith('.claude/')) return 'claude';
  if (relativePath.startsWith('_bmad/skills/')) return 'source-skill';
  if (relativePath.startsWith('packages/runtime-emit/dist/')) return 'host-runtime-dist';
  return 'repository';
}

export interface RequirementsContractSixModelConsumerInventoryEntry {
  path: string;
  canonicalPath: string;
  consumerId: string;
  roles: SixModelConsumerRole[];
  surface: string;
  pathHash: string;
  verifiedFacadePresent: boolean;
  directProjectionAccess: boolean;
}

export interface RequirementsContractSixModelConsumerInventory {
  schemaVersion: 'requirements-contract-six-model-consumer-inventory/v1';
  discoveryRoots: string[];
  discoveredPaths: string[];
  registeredPaths: string[];
  missingConsumerPaths: string[];
  directAuthorityReadPaths: string[];
  unregisteredConsumerCount: number;
  directAuthorityReadCount: number;
  entries: RequirementsContractSixModelConsumerInventoryEntry[];
}

export class RequirementsContractSixModelScopeAmendmentError extends Error {
  readonly code = 'scope_amendment_required';
  readonly discoveredConsumerPaths: string[];
  readonly missingConsumerPaths: string[];
  readonly directAuthorityReadPaths: string[];
  readonly unregisteredConsumerCount: number;
  readonly directAuthorityReadCount: number;

  constructor(input: {
    discoveredConsumerPaths: string[];
    missingConsumerPaths: string[];
    directAuthorityReadPaths: string[];
  }) {
    const blockers = [
      ...input.missingConsumerPaths.map((entry) => `unregistered:${entry}`),
      ...input.directAuthorityReadPaths.map((entry) => `direct_authority_read:${entry}`),
    ];
    super(`scope_amendment_required:${blockers.join(',')}`);
    this.name = 'RequirementsContractSixModelScopeAmendmentError';
    this.discoveredConsumerPaths = [...input.discoveredConsumerPaths];
    this.missingConsumerPaths = [...input.missingConsumerPaths];
    this.directAuthorityReadPaths = [...input.directAuthorityReadPaths];
    this.unregisteredConsumerCount = input.missingConsumerPaths.length;
    this.directAuthorityReadCount = input.directAuthorityReadPaths.length;
  }
}

export function createRequirementsContractSixModelConsumerInventory(
  root = process.cwd()
): RequirementsContractSixModelConsumerInventory {
  const definitions = new Map(
    REQUIREMENTS_CONTRACT_SIX_MODEL_CONSUMER_DEFINITIONS.map((definition) => [
      definition.canonicalPath,
      definition,
    ])
  );
  const discovered = new Map<
    string,
    {
      path: string;
      source: string;
      canonicalPath: string;
      definition: SixModelConsumerDefinition | undefined;
    }
  >();

  for (const discoveryRoot of SIX_MODEL_DISCOVERY_ROOTS) {
    for (const filePath of filesBelow(path.resolve(root, discoveryRoot))) {
      const relativePath = normalize(path.relative(root, filePath));
      if (
        relativePath === REQUIREMENTS_CONTRACT_CONSUMER_REGISTRY_OWNER_PATH ||
        /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(relativePath) ||
        !/\.(?:cjs|mjs|js|jsx|cts|mts|ts|tsx)$/u.test(relativePath)
      ) {
        continue;
      }
      const source = readFileSync(filePath, 'utf8');
      if (!SIX_MODEL_SOURCE_PATTERN.test(source)) continue;
      const canonicalPath = canonicalSixModelConsumerPath(root, relativePath);
      if (canonicalPath === REQUIREMENTS_CONTRACT_CONSUMER_REGISTRY_OWNER_PATH) {
        continue;
      }
      discovered.set(relativePath, {
        path: relativePath,
        source,
        canonicalPath,
        definition: definitions.get(canonicalPath),
      });
    }
  }

  const discoveredPaths = [...discovered.keys()].sort();
  const missingConsumerPaths = [...discovered.values()]
    .filter((entry) => !entry.definition)
    .map((entry) => entry.path)
    .sort();
  const directAuthorityReadPaths = [...discovered.values()]
    .filter((entry) => {
      if (!entry.definition?.verifiedFacadeRequired) return false;
      const verifiedFacadePresent = VERIFIED_SIX_MODEL_FACADE_PATTERN.test(entry.source);
      const directProjectionAccess = DIRECT_SIX_MODEL_PROJECTION_ACCESS_PATTERN.test(entry.source);
      const roles = entry.definition.roles;
      const projectionAccessAllowed =
        roles.includes('projection_reader') ||
        roles.includes('projection_writer') ||
        roles.includes('projection_reducer') ||
        roles.includes('authority_core') ||
        roles.includes('verification_harness');
      return !verifiedFacadePresent || (directProjectionAccess && !projectionAccessAllowed);
    })
    .map((entry) => entry.path)
    .sort();
  if (missingConsumerPaths.length > 0 || directAuthorityReadPaths.length > 0) {
    throw new RequirementsContractSixModelScopeAmendmentError({
      discoveredConsumerPaths: discoveredPaths,
      missingConsumerPaths,
      directAuthorityReadPaths,
    });
  }

  const entries = discoveredPaths.map(
    (discoveredPath): RequirementsContractSixModelConsumerInventoryEntry => {
      const entry = discovered.get(discoveredPath)!;
      const definition = entry.definition!;
      return {
        path: entry.path,
        canonicalPath: entry.canonicalPath,
        consumerId: definition.consumerId,
        roles: [...definition.roles],
        surface: sixModelSurface(entry.path),
        pathHash: fileHash(root, entry.path),
        verifiedFacadePresent: VERIFIED_SIX_MODEL_FACADE_PATTERN.test(entry.source),
        directProjectionAccess: DIRECT_SIX_MODEL_PROJECTION_ACCESS_PATTERN.test(entry.source),
      };
    }
  );
  return {
    schemaVersion: 'requirements-contract-six-model-consumer-inventory/v1',
    discoveryRoots: [...SIX_MODEL_DISCOVERY_ROOTS],
    discoveredPaths,
    registeredPaths: entries.map((entry) => entry.path),
    missingConsumerPaths: [],
    directAuthorityReadPaths: [],
    unregisteredConsumerCount: 0,
    directAuthorityReadCount: 0,
    entries,
  };
}

function discoverConsumerPaths(root: string, rules: readonly ConsumerDiscoveryRule[]): string[] {
  const discovered = new Set<string>();
  for (const rule of rules) {
    const pattern = new RegExp(rule.fileNamePattern, 'u');
    for (const filePath of filesBelow(path.resolve(root, rule.root))) {
      const relativePath = normalize(path.relative(root, filePath));
      if (
        relativePath === REQUIREMENTS_CONTRACT_CONSUMER_REGISTRY_OWNER_PATH ||
        /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(relativePath) ||
        !pattern.test(path.basename(filePath))
      ) {
        continue;
      }
      discovered.add(relativePath);
    }
  }
  return [...discovered].sort();
}

function isSemanticReaderSource(source: string): boolean {
  return SEMANTIC_READER_PATTERNS.some((pattern) => pattern.test(source));
}

function canonicalDeclaredConsumerPath(
  root: string,
  relativePath: string,
  declaredPaths: readonly string[]
): string {
  const normalizedPath = normalize(relativePath);
  const installedPackagePrefix = 'node_modules/bmad-speckit/';
  const packagePath = normalizedPath.startsWith(installedPackagePrefix)
    ? `packages/bmad-speckit/${normalizedPath.slice(installedPackagePrefix.length)}`
    : normalizedPath;
  if (
    PRODUCTION_RUNTIME_BUNDLE_MIRROR_PATHS.has(normalizedPath) ||
    PRODUCTION_RUNTIME_BUNDLE_MIRROR_PATHS.has(packagePath)
  ) {
    return GENERATED_HOST_RUNTIME_BUNDLE_PATH;
  }
  const exactMirrorPath = PRODUCTION_EXACT_MIRROR_PATHS.get(normalizedPath);
  if (exactMirrorPath && declaredPaths.includes(exactMirrorPath)) return exactMirrorPath;

  const mappings: readonly [string, (remainder: string) => string][] = [
    [
      'packages/bmad-speckit/src/main-agent/source-authority/_bmad/',
      (remainder) => `_bmad/${remainder}`,
    ],
    [
      'packages/bmad-speckit/dist/main-agent/source-authority/_bmad/',
      (remainder) => `_bmad/${remainder}`,
    ],
    ['packages/bmad-speckit/_bmad/', (remainder) => `_bmad/${remainder}`],
    [
      'packages/bmad-speckit/dist/main-agent/source-authority/',
      (remainder) =>
        sourceCanonicalPath(
          root,
          `packages/bmad-speckit/src/main-agent/source-authority/${remainder}`
        ),
    ],
    [
      'packages/bmad-speckit/dist/main-agent/actions/',
      (remainder) =>
        sourceCanonicalPath(root, `packages/bmad-speckit/src/main-agent/actions/${remainder}`),
    ],
    [
      'packages/bmad-speckit/dist/main-agent/runtime/',
      (remainder) =>
        sourceCanonicalPath(root, `packages/bmad-speckit/src/main-agent/runtime/${remainder}`),
    ],
    [
      'packages/bmad-speckit/dist/runtime/',
      (remainder) => sourceCanonicalPath(root, `packages/bmad-speckit/src/runtime/${remainder}`),
    ],
  ];
  for (const [prefix, map] of mappings) {
    if (!packagePath.startsWith(prefix)) continue;
    const candidate = normalize(map(packagePath.slice(prefix.length)));
    if (declaredPaths.includes(candidate) || existsSync(path.resolve(root, candidate))) {
      return candidate;
    }
  }

  if (normalizedPath.startsWith(installedPackagePrefix)) {
    if (
      declaredPaths.includes(packagePath) ||
      existsSync(path.resolve(root, sourceCanonicalPath(root, packagePath)))
    ) {
      return normalize(sourceCanonicalPath(root, packagePath));
    }
  }
  return normalizedPath;
}

function discoverProductionConsumerPaths(
  root: string,
  declaredPaths: readonly string[]
): string[] {
  const discovered = new Set<string>();
  for (const rule of PRODUCTION_DISCOVERY_RULES) {
    const pattern = new RegExp(rule.fileNamePattern, 'u');
    for (const filePath of filesBelow(path.resolve(root, rule.root))) {
      const relativePath = normalize(path.relative(root, filePath));
      if (
        relativePath === REQUIREMENTS_CONTRACT_CONSUMER_REGISTRY_OWNER_PATH ||
        /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(relativePath) ||
        !pattern.test(path.basename(filePath))
      ) {
        continue;
      }
      const source = readFileSync(filePath, 'utf8');
      if (!isSemanticReaderSource(source)) continue;
      const canonicalPath = canonicalDeclaredConsumerPath(root, relativePath, declaredPaths);
      if (canonicalPath === REQUIREMENTS_CONTRACT_CONSUMER_REGISTRY_OWNER_PATH) continue;
      discovered.add(canonicalPath);
    }
  }
  return [...discovered].sort();
}

export class RequirementsContractConsumerScopeAmendmentError extends Error {
  readonly code = 'scope_amendment_required';
  readonly discoveredConsumerPaths: string[];
  readonly missingConsumerPaths: string[];
  readonly unregisteredConsumerCount: number;

  constructor(discoveredConsumerPaths: string[], missingConsumerPaths: string[]) {
    super(`scope_amendment_required:${missingConsumerPaths.join(',')}`);
    this.name = 'RequirementsContractConsumerScopeAmendmentError';
    this.discoveredConsumerPaths = [...discoveredConsumerPaths];
    this.missingConsumerPaths = [...missingConsumerPaths];
    this.unregisteredConsumerCount = missingConsumerPaths.length;
  }
}

function consumerPath(definition: ConsumerDefinition): string {
  return normalize(definition.path ?? path.posix.join(SCRIPT_ROOT, definition.fileName ?? ''));
}

function fileHash(root: string, relativePath: string): string {
  const bytes = readFileSync(path.resolve(root, relativePath));
  if (bytes.includes(0x0d)) {
    throw new Error(`requirements_contract_projection_hash_input_not_lf:${relativePath}`);
  }
  return `sha256:${createHash('sha256')
    .update(bytes)
    .digest('hex')}`;
}

export function createRequirementsContractConsumerRegistry(root = process.cwd()) {
  const declaredPaths = [
    ...new Set(CONSUMER_DEFINITIONS.map((definition) => consumerPath(definition))),
  ].sort();
  const productionDeclaredPaths = [
    ...new Set([
      ...declaredPaths,
      ...REQUIREMENTS_CONTRACT_PRODUCTION_SEMANTIC_SOURCE_PATHS,
      ...REQUIREMENTS_CONTRACT_SIX_MODEL_CONSUMER_DEFINITIONS.map(
        (definition) => definition.canonicalPath
      ),
    ]),
  ].sort();
  const productionDiscoveredPaths = discoverProductionConsumerPaths(root, [
    REQUIREMENTS_CONTRACT_CONSUMER_REGISTRY_OWNER_PATH,
    ...productionDeclaredPaths,
  ]);
  const missingConsumerPaths = productionDiscoveredPaths.filter(
    (discoveredPath) => !productionDeclaredPaths.includes(discoveredPath)
  );
  if (missingConsumerPaths.length > 0) {
    throw new RequirementsContractConsumerScopeAmendmentError(
      productionDiscoveredPaths,
      missingConsumerPaths
    );
  }
  const discoveryRules = createConsumerDiscoveryRules();
  const discoveredPaths = discoverConsumerPaths(root, discoveryRules);

  const consumers = CONSUMER_DEFINITIONS.map((definition) => {
    const consumerFilePath = consumerPath(definition);
    return {
      consumerId: definition.consumerId,
      path: consumerFilePath,
      pathHash: fileHash(root, consumerFilePath),
      inputRole: definition.inputRole,
      parserRef: definition.parserRef ?? 'canonical_parser',
      schemaRef: 'typed_semantic_ir_schema',
      validatorRef: definition.validatorRef ?? 'validation_facade',
      projectionRef: 'projection_registry',
      supportedModes: [...definition.supportedModes],
      readFacadeRef: definition.readFacadeRef ?? 'requirements-contract-read-facade',
      adapterRef: definition.adapterRef ?? 'requirements-contract-v2-read-adapter',
      sourceFormatVersion: definition.sourceFormatVersion ?? 'v2',
      legacyReadEligibility: definition.legacyReadEligibility ?? 'not_applicable',
      ...(definition.supportedModes.includes('confirmation-ready')
        ? { confirmationComposition: { ...CONFIRMATION_COMPOSITION } }
        : {}),
      ...(definition.supportedModes.includes('closeout')
        ? {
            closeoutComposition: {
              ...CLOSEOUT_COMPOSITION,
              renderer: { ...CLOSEOUT_COMPOSITION.renderer },
              finalResponseProjector: {
                ...CLOSEOUT_COMPOSITION.finalResponseProjector,
              },
            },
          }
        : {}),
      directConfirmationFieldRead: false,
      authority: 'none',
    };
  });
  const discovery = {
    discoveredPaths,
    declaredPaths,
    unregisteredConsumerCount: 0,
  };
  const schemaVersion = 'requirements-contract-consumer-registry/v2';
  const validationModes = [...REQUIREMENTS_CONTRACT_VALIDATION_MODES];
  return {
    schemaVersion,
    owner: {
      path: REQUIREMENTS_CONTRACT_CONSUMER_REGISTRY_OWNER_PATH,
      hash: fileHash(root, REQUIREMENTS_CONTRACT_CONSUMER_REGISTRY_OWNER_PATH),
    },
    registryHash: sha256Stable({
      schemaVersion,
      validationModes,
      discoveryRules,
      consumers,
      discovery,
    }),
    validationModes,
    discoveryRules,
    consumers,
    discovery,
    authority: 'none',
  } as const;
}

export const REQUIREMENTS_CONTRACT_CONSUMER_DEFINITIONS = CONSUMER_DEFINITIONS;
