import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { sha256Stable } from '../scripts/requirements-contract-semantic-resolver';

export const REQUIREMENTS_CONTRACT_CONSUMER_REGISTRY_OWNER_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-consumer-registry.ts';

export const REQUIREMENTS_CONTRACT_VALIDATION_MODES = [
  'draft',
  'confirmation-ready',
  'execution',
  'closeout',
] as const;

const SCRIPT_ROOT = 'packages/bmad-speckit/src/main-agent/source-authority/scripts';
const DISCOVERY_RULES = [
  {
    ruleId: 'root_production_sources',
    root: 'scripts',
    fileNamePattern: '\\.(?:cjs|mjs|js|jsx|cts|mts|ts|tsx)$',
  },
  {
    ruleId: 'root_runtime_sources',
    root: 'src',
    fileNamePattern: '\\.(?:cjs|mjs|js|jsx|cts|mts|ts|tsx)$',
  },
  {
    ruleId: 'root_command_sources',
    root: 'bin',
    fileNamePattern: '\\.(?:cjs|mjs|js|jsx|cts|mts|ts|tsx)$',
  },
  {
    ruleId: 'shared_production_sources',
    root: '_bmad/shared',
    fileNamePattern: '\\.(?:cjs|mjs|js|jsx|cts|mts|ts|tsx)$',
  },
  {
    ruleId: 'package_and_generated_sources',
    root: 'packages',
    fileNamePattern: '\\.(?:cjs|mjs|js|jsx|cts|mts|ts|tsx)$',
  },
  {
    ruleId: 'generated_host_sources',
    root: '_bmad/codex',
    fileNamePattern: '\\.(?:cjs|mjs|js|jsx|cts|mts|ts|tsx)$',
  },
  {
    ruleId: 'installed_package_sources',
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

function isSemanticReaderSource(source: string): boolean {
  return SEMANTIC_READER_PATTERNS.some((pattern) => pattern.test(source));
}

function discoverConsumerPaths(root: string): string[] {
  const discovered = new Set<string>();
  for (const rule of DISCOVERY_RULES) {
    const pattern = new RegExp(rule.fileNamePattern, 'u');
    for (const filePath of filesBelow(path.resolve(root, rule.root))) {
      const relativePath = normalize(path.relative(root, filePath));
      if (
        relativePath === REQUIREMENTS_CONTRACT_CONSUMER_REGISTRY_OWNER_PATH ||
        /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(relativePath) ||
        !pattern.test(path.basename(filePath)) ||
        !isSemanticReaderSource(readFileSync(filePath, 'utf8'))
      ) {
        continue;
      }
      discovered.add(relativePath);
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
  return `sha256:${createHash('sha256')
    .update(readFileSync(path.resolve(root, relativePath)))
    .digest('hex')}`;
}

export function createRequirementsContractConsumerRegistry(root = process.cwd()) {
  const declaredPaths = [
    ...new Set(CONSUMER_DEFINITIONS.map((definition) => consumerPath(definition))),
  ].sort();
  const discoveredPaths = discoverConsumerPaths(root);
  const missingConsumerPaths = discoveredPaths.filter(
    (discoveredPath) => !declaredPaths.includes(discoveredPath)
  );
  if (missingConsumerPaths.length > 0) {
    throw new RequirementsContractConsumerScopeAmendmentError(
      discoveredPaths,
      missingConsumerPaths
    );
  }

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
  const discoveryRules = DISCOVERY_RULES.map((rule) => ({ ...rule }));
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
