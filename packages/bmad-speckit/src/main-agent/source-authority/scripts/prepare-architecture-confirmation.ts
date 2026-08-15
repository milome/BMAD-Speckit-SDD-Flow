/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ArchitecturePremiseAuthorityBlock,
  isCanonicalArchitecturePath,
  resolveArchitecturePremiseAuthorities,
  type ResolvedArchitectureImpactRule,
  type ResolvedArchitectureTriggerRule,
} from './architecture-premise-authority';
import { atomicNoClobberPublish } from './requirements-contract-atomic-no-clobber-publisher';
import {
  validateRequirementsContractBuildManifest,
  validateRequirementsContractCheckpointManifest,
} from './requirements-contract-authoring-manifest';
import { validateRequirementsActiveAuthorityTuple } from './requirements-contract-authority-publication-committer';
import {
  artifactBytesHash,
  canonicalRequirementsJson,
  requirementsContractDomainHash,
} from './requirements-contract-hash-domains';
import { sha256Stable } from './requirements-contract-semantic-resolver';
import {
  validateRequirementsContractSemanticIr,
  type RequirementsContractSemanticIr,
  type RequirementsExecutionConstraint,
} from './requirements-contract-semantic-ir';
import {
  validateRequirementsContractSourceBindingCapsule,
  type RequirementsContractSourceBindingCapsule,
} from './requirements-contract-source-binding-capsule';
import { validateRuntimeStatusDecisionReceipt } from './requirements-contract-runtime-status-decision-receipt';

type JsonObject = Record<string, unknown>;

interface ParsedArgs {
  requestId?: string;
  json?: boolean;
  help?: boolean;
}

export interface ArchitectureConfirmationCandidate extends JsonObject {
  schemaVersion: 'ArchitectureConfirmationCandidate/v1';
  requestId: string;
  architectureConfirmationCandidateHash: string;
}

export interface ArchitectureConfirmationContext {
  projectRoot: string;
  recordRoot: string;
  recordPath: string;
  record: JsonObject;
  activeAuthority: JsonObject;
  semanticIr: RequirementsContractSemanticIr;
  sourceBinding: RequirementsContractSourceBindingCapsule;
  executionManifest: JsonObject;
  effectivePass: JsonObject;
  confirmationEvent: JsonObject;
  confirmationEventHash: string;
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const HASH = /^sha256:[a-f0-9]{64}$/u;
const ARCHITECTURE_CONFIRMATION_BLOCK_ISSUE_CODES = [
  'requirements_confirmation_record_missing',
  'requirements_confirmation_required',
  'requirements_successor_required:active_authority_tuple',
  'requirements_successor_required:semantic_authority',
  'requirements_successor_required:source_binding',
  'requirements_successor_required:build_manifest',
  'architecture_successor_required:execution_manifest',
  'architecture_successor_required:technical_execution_closure',
  'requirements_effective_pass_required',
  'requirements_confirmation_event_missing',
  'requirements_confirmation_event_stale',
  'architecture_successor_required:logical_target_paths',
  'architecture_successor_required:toolchain',
  'architecture_successor_required:artifacts',
  'architecture_successor_required:execution_structure',
  'architecture_successor_required:evidence_requirements',
  'architecture_successor_required:forbidden_scope',
  'architecture_successor_required:target_authority',
  'architecture_successor_required:consumer_impact',
  'architecture_successor_required:trigger_rules',
  'architecture_successor_required:ownership',
  'architecture_successor_required:isolation',
  'architecture_successor_required:governance_impact',
  'architecture_successor_required:repository_premise',
  'architecture_successor_required:policy_premise',
] as const;
type ArchitectureConfirmationErrorIssueCode =
  | 'request_id_missing'
  | 'caller_derived_input_forbidden'
  | 'architecture_confirmation_request_id_invalid'
  | 'architecture_confirmation_malformed_input'
  | 'architecture_confirmation_integrity_invalid'
  | 'architecture_confirmation_production_failure'
  | 'architecture_confirmation_domain_blocked';
type ArchitectureConfirmationIssueCode =
  | (typeof ARCHITECTURE_CONFIRMATION_BLOCK_ISSUE_CODES)[number]
  | ArchitectureConfirmationErrorIssueCode;
const ARCHITECTURE_CONFIRMATION_BLOCK_ISSUE_SET = new Set<string>(
  ARCHITECTURE_CONFIRMATION_BLOCK_ISSUE_CODES
);

export class ArchitectureConfirmationBlock extends Error {
  constructor(readonly issueCode: string) {
    super(issueCode);
  }
}

export function classifyArchitectureConfirmationError(error: unknown): {
  issueCode: ArchitectureConfirmationIssueCode;
  exitCode: 1 | 2;
} {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof ArchitectureConfirmationBlock) {
    return {
      issueCode: ARCHITECTURE_CONFIRMATION_BLOCK_ISSUE_SET.has(error.issueCode)
        ? (error.issueCode as ArchitectureConfirmationIssueCode)
        : 'architecture_confirmation_domain_blocked',
      exitCode: 1,
    };
  }
  if (message === 'request_id_missing') return { issueCode: 'request_id_missing', exitCode: 2 };
  if (message.startsWith('caller_derived_input_forbidden:')) {
    return { issueCode: 'caller_derived_input_forbidden', exitCode: 2 };
  }
  if (message === 'architecture_confirmation_request_id_invalid') {
    return { issueCode: 'architecture_confirmation_request_id_invalid', exitCode: 2 };
  }
  if (error instanceof SyntaxError) {
    return { issueCode: 'architecture_confirmation_malformed_input', exitCode: 2 };
  }
  if (
    /(?:architecture_confirmation_.*(?:invalid|mismatch)|requirements_effective_pass_v2_integrity_invalid|ENOENT|EISDIR)/u.test(
      message
    )
  ) {
    return { issueCode: 'architecture_confirmation_integrity_invalid', exitCode: 2 };
  }
  return { issueCode: 'architecture_confirmation_production_failure', exitCode: 2 };
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') {
      args.json = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token !== '--request-id') {
      const name = token.startsWith('--') ? token.slice(2) : token;
      throw new Error(`caller_derived_input_forbidden:${name}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error('request_id_missing');
    args.requestId = value;
    index += 1;
  }
  return args;
}

function readJson(file: string): JsonObject {
  const value = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`architecture_confirmation_json_object_required:${file}`);
  }
  return value as JsonObject;
}

function confinedArtifact(recordRoot: string, relativePath: string): string {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new Error('architecture_confirmation_artifact_path_invalid');
  }
  const root = path.resolve(recordRoot);
  const resolved = path.resolve(root, ...relativePath.replace(/\\/gu, '/').split('/'));
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('architecture_confirmation_artifact_path_escape');
  }
  return resolved;
}

function requireCurrent(value: boolean, issueCode: string): void {
  if (!value) throw new ArchitectureConfirmationBlock(issueCode);
}

function resolveBuildArtifactEntry(input: {
  recordRoot: string;
  buildManifest: JsonObject;
  role: string;
}): JsonObject {
  const directEntries = objects(input.buildManifest.artifactEntries).filter(
    (item) => text(item.role) === input.role
  );
  if (directEntries.length > 1) {
    throw new Error('architecture_confirmation_build_artifact_duplicate');
  }

  let checkpointRef = object(input.buildManifest.terminalCheckpointManifestRef);
  const visited = new Set<string>();
  while (text(checkpointRef.path)) {
    const checkpointPath = text(checkpointRef.path);
    if (visited.has(checkpointPath)) {
      throw new Error('architecture_confirmation_checkpoint_manifest_lineage_invalid');
    }
    visited.add(checkpointPath);
    const checkpoint = readJson(confinedArtifact(input.recordRoot, checkpointPath));
    const validation = validateRequirementsContractCheckpointManifest(checkpoint);
    if (validation.decision !== 'pass') {
      throw new Error(
        `architecture_confirmation_checkpoint_manifest_invalid:${validation.issueCodes[0]}`
      );
    }
    if (
      text(checkpoint.checkpointId) !== text(checkpointRef.checkpointId) ||
      checkpoint.checkpointOrdinal !== checkpointRef.checkpointOrdinal ||
      text(checkpoint.checkpointManifestHash) !== text(checkpointRef.hash) ||
      text(checkpoint.authoringRequestId) !== text(input.buildManifest.authoringRequestId) ||
      text(checkpoint.authoringAttemptId) !== text(input.buildManifest.authoringAttemptId) ||
      text(checkpoint.inputManifestHash) !== text(input.buildManifest.inputManifestHash)
    ) {
      throw new Error('architecture_confirmation_checkpoint_manifest_identity_mismatch');
    }
    const entries = objects(checkpoint.artifactEntries).filter(
      (item) => text(item.role) === input.role
    );
    if (entries.length > 1) {
      throw new Error('architecture_confirmation_checkpoint_artifact_duplicate');
    }
    if (text(checkpoint.checkpointId) !== 'cp06' && entries.length > 0) {
      throw new Error('architecture_confirmation_execution_manifest_stage_mismatch');
    }
    if (text(checkpoint.checkpointId) === 'cp06') {
      const previous = object(checkpoint.previousCheckpointManifestRef);
      if (
        checkpoint.checkpointOrdinal !== 6 ||
        text(checkpoint.status) !== 'passed' ||
        text(checkpoint.compilerIdentity) !==
          'requirements-contract-cp06-execution-projection/v1' ||
        text(previous.checkpointId) !== 'cp05' ||
        previous.checkpointOrdinal !== 5 ||
        text(checkpoint.latestValidPredecessorCheckpoint) !== 'cp05'
      ) {
        throw new Error('architecture_confirmation_execution_manifest_checkpoint_invalid');
      }
      const entry = entries[0];
      if (!entry) {
        throw new ArchitectureConfirmationBlock(`architecture_successor_required:${input.role}`);
      }
      const expectedPath = `authoring/staging/${text(
        input.buildManifest.authoringAttemptId
      )}/cp06/execution-manifest.json`;
      if (
        text(entry.schemaVersion) !== 'requirements-contract-execution-manifest/v1' ||
        text(entry.artifactId) !== 'execution-manifest' ||
        text(entry.recordRelativePath) !== expectedPath
      ) {
        throw new Error('architecture_confirmation_execution_manifest_entry_invalid');
      }
      if (
        directEntries[0] &&
        canonicalRequirementsJson(directEntries[0]) !== canonicalRequirementsJson(entry)
      ) {
        throw new Error('architecture_confirmation_execution_manifest_entry_mismatch');
      }
      return entry;
    }
    checkpointRef = object(checkpoint.previousCheckpointManifestRef);
  }
  throw new ArchitectureConfirmationBlock(`architecture_successor_required:${input.role}`);
}

function validateRequirementsEffectivePassV2(value: JsonObject): JsonObject {
  const { requirementsEffectivePassHash, ...payload } = value;
  const requiredHashes = [
    payload.scopeSemanticHash,
    payload.sourceBindingHash,
    payload.buildManifestHash,
    payload.providerSelectionHash,
    payload.judgeRequestHash,
    payload.judgeResponseHash,
    payload.requirementsAuditAggregateHash,
  ];
  if (
    payload.schemaVersion !== 'requirements-effective-pass-receipt/v2' ||
    payload.decision !== 'pass' ||
    payload.writer !== 'requirements-contract-requirements-effective-pass-gate.ts' ||
    !requiredHashes.every((item) => HASH.test(text(item))) ||
    !HASH.test(text(requirementsEffectivePassHash)) ||
    requirementsEffectivePassHash !==
      sha256Stable({ domain: 'requirements-effective-pass-receipt/v2', payload })
  ) {
    throw new Error('requirements_effective_pass_v2_integrity_invalid');
  }
  return value;
}

function readValidatedSourceBinding(
  recordRoot: string,
  bindingRevisionId: string
): RequirementsContractSourceBindingCapsule {
  const binding = readJson(
    confinedArtifact(
      recordRoot,
      `authoring/source-bindings/${bindingRevisionId}/source-binding.json`
    )
  ) as unknown as RequirementsContractSourceBindingCapsule;
  const validation = validateRequirementsContractSourceBindingCapsule(binding);
  if (validation.decision !== 'pass') {
    throw new Error(`architecture_confirmation_source_binding_invalid:${validation.issueCodes[0]}`);
  }
  return binding;
}

function validateBindingRefreshReceipt(value: JsonObject): JsonObject {
  const { receiptHash, ...payload } = value;
  if (
    payload.schemaVersion !== 'requirements-source-binding-refresh-receipt/v2' ||
    payload.resolverDisposition !== 'passed' ||
    payload.conservationDisposition !== 'passed' ||
    payload.citationProjectionRefreshDisposition !== 'passed' ||
    payload.pageReadbackDisposition !== 'passed' ||
    payload.pagePromotionDisposition !== 'promoted' ||
    !HASH.test(text(receiptHash)) ||
    receiptHash !==
      sha256Stable({ domain: 'requirements-source-binding-refresh-receipt/v2', payload })
  ) {
    throw new Error('requirements_binding_refresh_receipt_invalid');
  }
  return value;
}

function resolveCompatibleBindingAncestry(input: {
  recordRoot: string;
  semanticRevisionId: string;
  scopeSemanticHash: string;
  currentBinding: RequirementsContractSourceBindingCapsule;
  ancestorBindingRevisionId: string;
  ancestorSourceBindingHash: string;
  issueCode: string;
}): { latestRefreshReceipt: JsonObject | null } {
  let current = input.currentBinding;
  let latestRefreshReceipt: JsonObject | null = null;
  const visited = new Set<string>();
  while (current.bindingRevisionId !== input.ancestorBindingRevisionId) {
    if (visited.has(current.bindingRevisionId) || !current.parentBindingRevisionId) {
      throw new ArchitectureConfirmationBlock(input.issueCode);
    }
    visited.add(current.bindingRevisionId);
    const receipt = validateBindingRefreshReceipt(
      readJson(
        confinedArtifact(
          input.recordRoot,
          `authoring/source-bindings/${current.bindingRevisionId}/source-binding-refresh-receipt.json`
        )
      )
    );
    if (!latestRefreshReceipt) latestRefreshReceipt = receipt;
    const parent = readValidatedSourceBinding(input.recordRoot, current.parentBindingRevisionId);
    requireCurrent(
      text(receipt.semanticRevisionId) === input.semanticRevisionId &&
        text(receipt.scopeSemanticHash) === input.scopeSemanticHash &&
        text(receipt.fromBindingRevisionId) === parent.bindingRevisionId &&
        text(receipt.toBindingRevisionId) === current.bindingRevisionId &&
        text(receipt.fromSourceBindingHash) === parent.sourceBindingHash &&
        text(receipt.toSourceBindingHash) === current.sourceBindingHash &&
        text(receipt.fromSnapshotSetHash) === sha256Stable(parent.sourceArtifacts) &&
        text(receipt.toSnapshotSetHash) === sha256Stable(current.sourceArtifacts) &&
        text(receipt.fromSourceSpanRegistryHash) === parent.sourceSpanRegistryHash &&
        text(receipt.toSourceSpanRegistryHash) === current.sourceSpanRegistryHash &&
        text(receipt.evidenceClaimRegistryHash) === current.evidenceClaimBindingRegistryHash,
      input.issueCode
    );
    current = parent;
  }
  requireCurrent(current.sourceBindingHash === input.ancestorSourceBindingHash, input.issueCode);
  return { latestRefreshReceipt };
}

export function resolveArchitectureConfirmationContext(input: {
  projectRoot: string;
  requestId: string;
}): ArchitectureConfirmationContext {
  if (!SAFE_REQUEST_ID.test(input.requestId)) {
    throw new Error('architecture_confirmation_request_id_invalid');
  }
  const projectRoot = path.resolve(input.projectRoot);
  const recordRoot = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    input.requestId
  );
  const recordPath = path.join(recordRoot, 'record', 'requirement-record.json');
  if (!fs.existsSync(recordPath)) {
    throw new ArchitectureConfirmationBlock('requirements_confirmation_record_missing');
  }
  const record = readJson(recordPath);
  const activeAuthority = object(record.activeAuthority);
  requireCurrent(
    record.schemaVersion === 'requirements-contract-record/v1' &&
      text(record.recordId) === input.requestId &&
      text(record.lifecycle) === 'user_confirmed',
    'requirements_confirmation_required'
  );
  const activeAuthorityValidation = validateRequirementsActiveAuthorityTuple(activeAuthority);
  requireCurrent(
    activeAuthorityValidation.decision === 'pass',
    'requirements_successor_required:active_authority_tuple'
  );

  const semanticPath = confinedArtifact(recordRoot, text(activeAuthority.activeSemanticIrPath));
  const semanticIr = readJson(semanticPath) as unknown as RequirementsContractSemanticIr;
  const semanticValidation = validateRequirementsContractSemanticIr(semanticIr);
  if (semanticValidation.decision !== 'pass') {
    throw new Error(
      `architecture_confirmation_semantic_ir_invalid:${semanticValidation.issueCodes[0]}`
    );
  }
  requireCurrent(
    semanticIr.requestId === input.requestId &&
      semanticIr.semanticRevisionId === text(activeAuthority.activeSemanticRevisionId) &&
      semanticIr.scopeSemanticHash === text(activeAuthority.activeScopeSemanticHash) &&
      text(record.confirmedScopeSemanticHash) === semanticIr.scopeSemanticHash,
    'requirements_successor_required:semantic_authority'
  );

  const bindingPath = confinedArtifact(recordRoot, text(activeAuthority.activeSourceBindingPath));
  const sourceBinding = readJson(
    bindingPath
  ) as unknown as RequirementsContractSourceBindingCapsule;
  const bindingValidation = validateRequirementsContractSourceBindingCapsule(sourceBinding);
  if (bindingValidation.decision !== 'pass') {
    throw new Error(
      `architecture_confirmation_source_binding_invalid:${bindingValidation.issueCodes[0]}`
    );
  }
  requireCurrent(
    sourceBinding.semanticRevisionId === semanticIr.semanticRevisionId &&
      sourceBinding.scopeSemanticHash === semanticIr.scopeSemanticHash &&
      sourceBinding.bindingRevisionId === text(activeAuthority.activeBindingRevisionId) &&
      sourceBinding.sourceBindingHash === text(activeAuthority.activeSourceBindingHash),
    'requirements_successor_required:source_binding'
  );

  const buildPath = confinedArtifact(recordRoot, text(activeAuthority.activeBuildManifestPath));
  const buildManifest = readJson(buildPath);
  const buildValidation = validateRequirementsContractBuildManifest(buildManifest);
  if (buildValidation.decision !== 'pass') {
    throw new Error(
      `architecture_confirmation_build_manifest_invalid:${buildValidation.issueCodes[0]}`
    );
  }
  const buildBindingAuthority = object(buildManifest.bindingAuthorityRef);
  resolveCompatibleBindingAncestry({
    recordRoot,
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    currentBinding: sourceBinding,
    ancestorBindingRevisionId: text(buildBindingAuthority.bindingRevisionId),
    ancestorSourceBindingHash: text(buildBindingAuthority.hash),
    issueCode: 'requirements_successor_required:build_manifest',
  });
  requireCurrent(
    text(buildManifest.buildManifestHash) === text(activeAuthority.activeBuildManifestHash) &&
      text(buildManifest.authoringRequestId) === input.requestId &&
      text(buildManifest.authoringAttemptId) === text(activeAuthority.activeAuthoringAttemptId) &&
      text(object(buildManifest.semanticAuthorityRef).semanticRevisionId) ===
        semanticIr.semanticRevisionId &&
      text(object(buildManifest.semanticAuthorityRef).hash) === semanticIr.scopeSemanticHash,
    'requirements_successor_required:build_manifest'
  );

  const executionEntry = resolveBuildArtifactEntry({
    recordRoot,
    buildManifest,
    role: 'execution_manifest',
  });
  const executionManifest = readJson(
    confinedArtifact(recordRoot, text(executionEntry.recordRelativePath))
  );
  if (text(executionEntry.artifactHash) !== sha256Stable(executionManifest)) {
    throw new Error('architecture_confirmation_execution_manifest_hash_mismatch');
  }
  const executionConstraints = objects(executionManifest.constraints);
  const semanticConstraints = semanticIr.semanticPayload.executionConstraints;
  requireCurrent(
    executionManifest.schemaVersion === 'requirements-contract-execution-manifest/v1' &&
      text(executionManifest.semanticRevisionId) === semanticIr.semanticRevisionId &&
      text(executionManifest.scopeSemanticHash) === semanticIr.scopeSemanticHash &&
      canonicalRequirementsJson(executionConstraints) ===
        canonicalRequirementsJson(semanticConstraints) &&
      semanticConstraints.length > 0 &&
      semanticConstraints.every((constraint) => constraint.disposition === 'proven'),
    'architecture_successor_required:technical_execution_closure'
  );

  const effectivePassPath = path.join(
    recordRoot,
    'quality',
    'requirements-effective-pass-receipt.json'
  );
  if (!fs.existsSync(effectivePassPath)) {
    throw new ArchitectureConfirmationBlock('requirements_effective_pass_required');
  }
  let effectivePass: JsonObject;
  try {
    effectivePass = validateRequirementsEffectivePassV2(readJson(effectivePassPath));
  } catch (error) {
    throw new Error(
      `architecture_confirmation_effective_pass_invalid:${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  requireCurrent(
    text(effectivePass.decision) === 'pass' &&
      text(effectivePass.semanticRevisionId) === semanticIr.semanticRevisionId &&
      text(effectivePass.scopeSemanticHash) === semanticIr.scopeSemanticHash &&
      text(effectivePass.buildManifestHash) === text(activeAuthority.activeBuildManifestHash),
    'requirements_effective_pass_required'
  );

  const confirmationRef = object(record.confirmationEventRef);
  const confirmationPath = confinedArtifact(recordRoot, text(confirmationRef.path));
  if (!fs.existsSync(confirmationPath)) {
    throw new ArchitectureConfirmationBlock('requirements_confirmation_event_missing');
  }
  const confirmationBytes = fs.readFileSync(confirmationPath);
  const confirmationEventHash = artifactBytesHash({
    role: 'requirements_confirmation_event',
    mediaType: 'application/json',
    bytes: confirmationBytes,
  });
  const confirmationEvent = JSON.parse(confirmationBytes.toString('utf8')) as JsonObject;
  const effectivePassRef = object(confirmationEvent.requirementsEffectivePassRef);
  const promotionEvidenceRef = object(confirmationEvent.promotionEvidenceRef);
  const promotionRelativePath = text(promotionEvidenceRef.path);
  let promotionReceipt: JsonObject | null = null;
  let promotionArtifactBytesHash = '';
  if (promotionRelativePath) {
    const promotionPath = confinedArtifact(recordRoot, promotionRelativePath);
    if (fs.existsSync(promotionPath)) {
      const promotionBytes = fs.readFileSync(promotionPath);
      promotionReceipt = JSON.parse(promotionBytes.toString('utf8')) as JsonObject;
      promotionArtifactBytesHash = artifactBytesHash({
        role: 'promotion_receipt',
        mediaType: 'application/json',
        bytes: promotionBytes,
      });
    }
  }
  const promotion = promotionReceipt ?? {};
  requireCurrent(
    confirmationEventHash === text(confirmationRef.artifactBytesHash) &&
      confirmationEvent.schemaVersion === 'requirements-contract-confirmation-event/v1' &&
      text(confirmationEvent.requestId) === input.requestId &&
      text(confirmationEvent.semanticRevisionId) === semanticIr.semanticRevisionId &&
      text(confirmationEvent.scopeSemanticHash) === semanticIr.scopeSemanticHash &&
      Boolean(text(confirmationEvent.bindingRevisionId)) &&
      typeof confirmationEvent.exactConfirmationText === 'string' &&
      confirmationEvent.exactConfirmationText.length > 0 &&
      text(effectivePassRef.path) === 'quality/requirements-effective-pass-receipt.json' &&
      HASH.test(text(effectivePassRef.hash)) &&
      promotionReceipt !== null &&
      promotionReceipt.schemaVersion ===
        'requirements-contract-confirmation-promotion-receipt/v1' &&
      promotionArtifactBytesHash === text(promotionEvidenceRef.artifactBytesHash) &&
      text(promotion.requestId) === input.requestId &&
      text(promotion.semanticRevisionId) === semanticIr.semanticRevisionId &&
      text(promotion.scopeSemanticHash) === semanticIr.scopeSemanticHash &&
      text(promotion.bindingRevisionId) === text(confirmationEvent.bindingRevisionId) &&
      text(promotion.sourceBindingHash) === text(effectivePass.sourceBindingHash) &&
      text(promotion.buildManifestHash) === text(activeAuthority.activeBuildManifestHash) &&
      text(promotion.requirementsEffectivePassHash) ===
        text(effectivePass.requirementsEffectivePassHash) &&
      text(promotion.requirementsEffectivePassHash) === text(effectivePassRef.hash) &&
      promotion.exactConfirmationText === confirmationEvent.exactConfirmationText,
    'requirements_confirmation_event_stale'
  );
  const confirmationBindingAncestry = resolveCompatibleBindingAncestry({
    recordRoot,
    semanticRevisionId: semanticIr.semanticRevisionId,
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    currentBinding: sourceBinding,
    ancestorBindingRevisionId: text(promotion.bindingRevisionId),
    ancestorSourceBindingHash: text(promotion.sourceBindingHash),
    issueCode: 'requirements_confirmation_event_stale',
  });
  const currentPromotionEvidence = object(record.currentPromotionEvidence);
  const currentPromotionRelativePath = text(currentPromotionEvidence.path);
  requireCurrent(Boolean(currentPromotionRelativePath), 'requirements_confirmation_event_stale');
  const currentPromotionPath = confinedArtifact(recordRoot, currentPromotionRelativePath);
  requireCurrent(fs.existsSync(currentPromotionPath), 'requirements_confirmation_event_stale');
  const currentPromotionBytes = fs.readFileSync(currentPromotionPath);
  const currentPromotion = JSON.parse(currentPromotionBytes.toString('utf8')) as JsonObject;
  const currentPromotionRole = confirmationBindingAncestry.latestRefreshReceipt
    ? 'source-binding-refresh-receipt'
    : 'promotion_receipt';
  const currentPromotionHash = artifactBytesHash({
    role: currentPromotionRole,
    mediaType: 'application/json',
    bytes: currentPromotionBytes,
  });
  const expectedCurrentPromotionPath = confirmationBindingAncestry.latestRefreshReceipt
    ? `authoring/source-bindings/${sourceBinding.bindingRevisionId}/source-binding-refresh-receipt.json`
    : promotionRelativePath;
  const latestRefreshPromotionRef = object(
    confirmationBindingAncestry.latestRefreshReceipt?.confirmationPromotionReceiptRef
  );
  requireCurrent(
    text(record.confirmedScopeSemanticHash) === semanticIr.scopeSemanticHash &&
      currentPromotionRelativePath === expectedCurrentPromotionPath &&
      currentPromotionHash === text(currentPromotionEvidence.artifactBytesHash) &&
      (confirmationBindingAncestry.latestRefreshReceipt
        ? text(currentPromotion.receiptHash) ===
            text(confirmationBindingAncestry.latestRefreshReceipt.receiptHash) &&
          text(latestRefreshPromotionRef.path) === promotionRelativePath &&
          text(latestRefreshPromotionRef.hash) === promotionArtifactBytesHash
        : currentPromotionHash === promotionArtifactBytesHash),
    'requirements_confirmation_event_stale'
  );

  return {
    projectRoot,
    recordRoot,
    recordPath,
    record,
    activeAuthority,
    semanticIr,
    sourceBinding,
    executionManifest,
    effectivePass,
    confirmationEvent,
    confirmationEventHash,
  };
}

function constraintsOfKind(
  context: ArchitectureConfirmationContext,
  kind: RequirementsExecutionConstraint['kind']
): RequirementsExecutionConstraint[] {
  return context.semanticIr.semanticPayload.executionConstraints
    .filter((constraint) => constraint.kind === kind)
    .sort((left, right) => left.constraintId.localeCompare(right.constraintId));
}

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9._:-]+/gu, '-') || 'unknown';
}

function logicalPathScope(value: string): string {
  return value
    .replace(/\\/gu, '/')
    .replace(/\/\*\*$/u, '')
    .replace(/\/+$/u, '');
}

function logicalPathOverlapsForbidden(targetPath: string, forbiddenPath: string): boolean {
  const target = logicalPathScope(targetPath);
  const forbidden = logicalPathScope(forbiddenPath);
  return (
    target === forbidden || target.startsWith(`${forbidden}/`) || forbidden.startsWith(`${target}/`)
  );
}

function authorityPathCoversTarget(authorityPath: string, targetPath: string): boolean {
  const authorityScope = logicalPathScope(authorityPath);
  const targetScope = logicalPathScope(targetPath);
  return targetScope === authorityScope || targetScope.startsWith(`${authorityScope}/`);
}

function projectImpactRules(
  rules: ResolvedArchitectureImpactRule[],
  premiseRefs: string[],
  issueCode: ArchitectureConfirmationIssueCode
) {
  const byId = new Map<
    string,
    Pick<ResolvedArchitectureImpactRule, 'status' | 'predicateSignature'> & {
      matchedConstraintIds: string[];
    }
  >();
  for (const rule of rules) {
    const existing = byId.get(rule.impactId);
    if (
      existing &&
      (existing.status !== rule.status || existing.predicateSignature !== rule.predicateSignature)
    )
      throw new ArchitectureConfirmationBlock(issueCode);
    byId.set(rule.impactId, {
      status: rule.status,
      predicateSignature: rule.predicateSignature,
      matchedConstraintIds: sortedUnique([
        ...(existing?.matchedConstraintIds ?? []),
        ...rule.matchedConstraintIds,
      ]),
    });
  }
  return [...byId.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([impactId, rule]) => ({
      impactId,
      status: rule.status,
      basisRefs: sortedUnique([...premiseRefs, ...rule.matchedConstraintIds]),
    }));
}

function projectTriggerRules(
  entries: Array<{ rule: ResolvedArchitectureTriggerRule; premiseRefs: string[] }>
) {
  const byId = new Map<
    string,
    {
      triggered: boolean;
      predicateSignature: string;
      basisRefs: string[];
    }
  >();
  for (const { rule, premiseRefs } of entries) {
    const existing = byId.get(rule.triggerId);
    if (
      existing &&
      (existing.triggered !== rule.triggered ||
        existing.predicateSignature !== rule.predicateSignature)
    ) {
      throw new ArchitectureConfirmationBlock('architecture_successor_required:trigger_rules');
    }
    byId.set(rule.triggerId, {
      triggered: rule.triggered,
      predicateSignature: rule.predicateSignature,
      basisRefs: sortedUnique([
        ...(existing?.basisRefs ?? []),
        ...premiseRefs,
        ...rule.matchedConstraintIds,
      ]),
    });
  }
  return [...byId.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([triggerId, value]) => ({
      triggerId,
      triggered: value.triggered,
      basisRefs: value.basisRefs,
    }));
}

export function deriveArchitectureConfirmationCandidate(
  context: ArchitectureConfirmationContext
): ArchitectureConfirmationCandidate {
  const paths = constraintsOfKind(context, 'PATH');
  const commands = constraintsOfKind(context, 'CMD');
  const artifacts = constraintsOfKind(context, 'ART');
  const evidence = constraintsOfKind(context, 'EVDREQ');
  const structure = constraintsOfKind(context, 'CTM');
  if (
    paths.length === 0 ||
    paths.some((constraint) => !isCanonicalArchitecturePath(constraint.canonicalValue))
  ) {
    throw new ArchitectureConfirmationBlock('architecture_successor_required:logical_target_paths');
  }
  const requiredClosures: Array<
    [RequirementsExecutionConstraint[], ArchitectureConfirmationIssueCode]
  > = [
    [commands, 'architecture_successor_required:toolchain'],
    [artifacts, 'architecture_successor_required:artifacts'],
    [structure, 'architecture_successor_required:execution_structure'],
    [evidence, 'architecture_successor_required:evidence_requirements'],
  ];
  for (const [constraints, issueCode] of requiredClosures) {
    if (constraints.length === 0) throw new ArchitectureConfirmationBlock(issueCode);
  }

  let authorities: ReturnType<typeof resolveArchitecturePremiseAuthorities>;
  try {
    authorities = resolveArchitecturePremiseAuthorities({
      projectRoot: context.projectRoot,
      sourceArtifacts: context.sourceBinding.sourceArtifacts,
      constraints: context.semanticIr.semanticPayload.executionConstraints,
    });
  } catch (error) {
    if (error instanceof ArchitecturePremiseAuthorityBlock) {
      throw new ArchitectureConfirmationBlock(error.issueCode);
    }
    throw error;
  }
  const authorityPremises = [...authorities.repositoryArtifacts, ...authorities.policyArtifacts]
    .map((artifact) => ({
      premiseId: safeId(artifact.sourceArtifactId),
      authorityRole: safeId(artifact.role),
      mediaType: artifact.mediaType,
      sourceSnapshotHash: artifact.sourceSnapshotHash,
    }))
    .sort((left, right) => left.premiseId.localeCompare(right.premiseId));
  const repositoryPremises = authorityPremises.filter(
    (premise) => premise.authorityRole === 'repository_authority'
  );
  const policyPremises = authorityPremises.filter(
    (premise) => premise.authorityRole === 'policy_authority'
  );
  const pinnedPremises = [...repositoryPremises, ...policyPremises].sort((left, right) =>
    left.premiseId.localeCompare(right.premiseId)
  );
  const repositoryPremiseRefs = repositoryPremises.map((premise) => premise.premiseId);
  const policyPremiseRefs = policyPremises.map((premise) => premise.premiseId);
  const targetPaths = sortedUnique(paths.map((constraint) => constraint.canonicalValue));
  if (
    targetPaths.some(
      (targetPath) =>
        !authorities.repository.allowedTargetPaths.some((allowedPath) =>
          authorityPathCoversTarget(allowedPath, targetPath)
        )
    )
  ) {
    throw new ArchitectureConfirmationBlock('architecture_successor_required:target_authority');
  }
  const logicalScope = {
    targetPaths,
    forbiddenPaths: sortedUnique(authorities.policy.forbiddenScope.paths),
  };
  if (
    logicalScope.targetPaths.some((targetPath) =>
      logicalScope.forbiddenPaths.some((forbiddenPath) =>
        logicalPathOverlapsForbidden(targetPath, forbiddenPath)
      )
    )
  ) {
    throw new ArchitectureConfirmationBlock('architecture_successor_required:forbidden_scope');
  }
  const ownership = logicalScope.targetPaths.map((targetPath) => {
    const owners = sortedUnique(
      authorities.policy.ownershipRules
        .filter((rule) => authorityPathCoversTarget(rule.targetPath, targetPath))
        .map((rule) => rule.owner)
    );
    if (owners.length !== 1) {
      throw new ArchitectureConfirmationBlock('architecture_successor_required:ownership');
    }
    return {
      targetPath,
      owner: owners[0],
      basisRefs: sortedUnique([
        ...policyPremiseRefs,
        ...paths
          .filter((constraint) => constraint.canonicalValue === targetPath)
          .map((constraint) => constraint.constraintId),
      ]),
    };
  });
  const toolchain = {
    commands: commands.map((constraint) => ({
      commandId: constraint.constraintId,
      invocation: constraint.canonicalValue,
      basisRefs: [constraint.constraintId],
    })),
    artifacts: artifacts.map((constraint) => ({
      premiseId: constraint.constraintId,
      kind: 'ART' as const,
      value: constraint.canonicalValue,
      basisRefs: [constraint.constraintId],
    })),
    evidenceRequirements: evidence.map((constraint) => ({
      premiseId: constraint.constraintId,
      kind: 'EVDREQ' as const,
      value: constraint.canonicalValue,
      basisRefs: [constraint.constraintId],
    })),
  };
  const consumerImpact = projectImpactRules(
    authorities.repository.consumerImpactRules,
    repositoryPremiseRefs,
    'architecture_successor_required:consumer_impact'
  );
  const governanceImpact = projectImpactRules(
    authorities.policy.governanceImpactRules,
    policyPremiseRefs,
    'architecture_successor_required:governance_impact'
  );
  const triggerMatrix = projectTriggerRules([
    ...authorities.repository.triggerRules.map((rule) => ({
      rule,
      premiseRefs: repositoryPremiseRefs,
    })),
    ...authorities.policy.triggerRules.map((rule) => ({
      rule,
      premiseRefs: policyPremiseRefs,
    })),
  ]);
  const architectureDecisions = [
    ...ownership.map((item, index) => ({
      decisionId: `ARCH-OWNERSHIP-${index + 1}`,
      decisionType: 'ownership' as const,
      selection: `${item.owner}:${item.targetPath}`,
      basisRefs: item.basisRefs,
    })),
    ...commands.map((item, index) => ({
      decisionId: `ARCH-TOOLCHAIN-${index + 1}`,
      decisionType: 'toolchain' as const,
      selection: item.canonicalValue,
      basisRefs: [item.constraintId],
    })),
    {
      decisionId: 'ARCH-ISOLATION-1',
      decisionType: 'isolation' as const,
      selection: authorities.policy.isolationSelection,
      basisRefs: sortedUnique([...policyPremiseRefs, ...paths.map((item) => item.constraintId)]),
    },
    ...structure.map((item, index) => ({
      decisionId: `ARCH-STRUCTURE-${index + 1}`,
      decisionType: 'execution_structure' as const,
      selection: item.canonicalValue,
      basisRefs: [item.constraintId],
    })),
  ];
  const goalExecutionStructurePremises = structure.map((constraint) => ({
    premiseId: constraint.constraintId,
    kind: 'CTM' as const,
    value: constraint.canonicalValue,
    basisRefs: [constraint.constraintId],
  }));
  const requirementsLineage = {
    recordId: text(context.record.recordId),
    semanticRevisionId: context.semanticIr.semanticRevisionId,
    scopeSemanticHash: context.semanticIr.scopeSemanticHash,
    executionConstraintRegistryHash:
      context.semanticIr.semanticPayload.executionConstraintRegistryHash,
    technicalExecutionClosure: 'pass' as const,
  };
  const authorityPayload = {
    requirementsSemanticIdentity: {
      semanticRevisionId: requirementsLineage.semanticRevisionId,
      scopeSemanticHash: requirementsLineage.scopeSemanticHash,
      executionConstraintRegistryHash: requirementsLineage.executionConstraintRegistryHash,
    },
    pinnedPremises,
    logicalScope,
    ownership,
    toolchain,
    isolation: {
      mode: authorities.policy.isolationSelection,
      forbiddenPaths: logicalScope.forbiddenPaths,
      basisRefs: sortedUnique([...policyPremiseRefs, ...paths.map((item) => item.constraintId)]),
    },
    consumerImpact,
    governanceImpact,
    triggerMatrix,
    architectureDecisions,
    goalExecutionStructurePremises,
  };
  const architectureConfirmationCandidateHash = requirementsContractDomainHash(
    'architecture-confirmation-candidate/v1',
    authorityPayload
  );
  return {
    schemaVersion: 'ArchitectureConfirmationCandidate/v1',
    requestId: context.semanticIr.requestId,
    requirementsLineage,
    pinnedPremises,
    logicalScope,
    ownership,
    toolchain,
    isolation: authorityPayload.isolation,
    consumerImpact,
    governanceImpact,
    triggerMatrix,
    architectureDecisions,
    goalExecutionStructurePremises,
    architectureConfirmationCandidateHash,
  };
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function renderArchitectureConfirmationPage(
  candidate: ArchitectureConfirmationCandidate,
  exactConfirmationText: string
): string {
  const lineage = object(candidate.requirementsLineage);
  const scope = object(candidate.logicalScope);
  const toolchain = object(candidate.toolchain);
  const isolation = object(candidate.isolation);
  const decisions = objects(candidate.architectureDecisions);
  const list = (values: unknown[], projector: (value: unknown) => string) =>
    values.map((value) => `<li>${htmlEscape(projector(value))}</li>`).join('');
  const refs = (value: unknown) =>
    (Array.isArray(value) ? value : []).map((item) => String(item)).join(', ');
  const row = (fields: Array<[string, unknown]>) =>
    fields.map(([label, value]) => `${label}=${String(value)}`).join(' | ');
  const bindings = (values: unknown[]) =>
    list(objects(values), (value) => {
      const binding = object(value);
      return row([
        ['premiseId', binding.premiseId],
        ['kind', binding.kind],
        ['value', binding.value],
        ['basisRefs', refs(binding.basisRefs)],
      ]);
    });
  const impacts = (values: unknown[]) =>
    list(objects(values), (value) => {
      const impact = object(value);
      return row([
        ['impactId', impact.impactId],
        ['status', impact.status],
        ['basisRefs', refs(impact.basisRefs)],
      ]);
    });
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>Architecture confirmation</title>',
    '<style>body{font-family:Georgia,serif;margin:0;color:#17221b;background:#f4f5f1}main{max-width:960px;margin:auto;padding:32px 24px 64px}h1{font-size:2rem}section{border-top:1px solid #9ca69e;padding:20px 0}code,pre{font-family:Consolas,monospace;background:#e5e9e3;padding:2px 5px}pre{white-space:pre-wrap;padding:16px}li{margin:8px 0}</style></head>',
    '<body><main>',
    '<h1>Architecture confirmation</h1>',
    `<p>Request <code>${htmlEscape(candidate.requestId)}</code></p>`,
    `<p>Candidate <code>${htmlEscape(candidate.architectureConfirmationCandidateHash)}</code></p>`,
    '<section><h2>Requirements lineage</h2><ul>',
    list(
      [
        'recordId',
        'semanticRevisionId',
        'scopeSemanticHash',
        'executionConstraintRegistryHash',
        'technicalExecutionClosure',
      ],
      (key) => `${String(key)}: ${String(lineage[String(key)])}`
    ),
    '</ul></section>',
    '<section><h2>Pinned premises</h2><ul>',
    list(objects(candidate.pinnedPremises), (value) => {
      const premise = object(value);
      return row([
        ['premiseId', premise.premiseId],
        ['authorityRole', premise.authorityRole],
        ['mediaType', premise.mediaType],
        ['sourceSnapshotHash', premise.sourceSnapshotHash],
      ]);
    }),
    '</ul></section>',
    '<section><h2>Logical scope</h2><h3>Targets</h3><ul>',
    list(Array.isArray(scope.targetPaths) ? scope.targetPaths : [], String),
    '</ul><h3>Forbidden paths</h3><ul>',
    list(Array.isArray(scope.forbiddenPaths) ? scope.forbiddenPaths : [], String),
    '</ul></section>',
    '<section><h2>Ownership</h2><ul>',
    list(objects(candidate.ownership), (value) => {
      const ownership = object(value);
      return row([
        ['targetPath', ownership.targetPath],
        ['owner', ownership.owner],
        ['basisRefs', refs(ownership.basisRefs)],
      ]);
    }),
    '</ul></section>',
    '<section><h2>Toolchain</h2><h3>Commands</h3><ul>',
    list(objects(toolchain.commands), (value) => {
      const command = object(value);
      return row([
        ['commandId', command.commandId],
        ['invocation', command.invocation],
        ['basisRefs', refs(command.basisRefs)],
      ]);
    }),
    '</ul><h3>Artifacts</h3><ul>',
    bindings(Array.isArray(toolchain.artifacts) ? toolchain.artifacts : []),
    '</ul><h3>Evidence requirements</h3><ul>',
    bindings(Array.isArray(toolchain.evidenceRequirements) ? toolchain.evidenceRequirements : []),
    '</ul></section>',
    '<section><h2>Isolation</h2><ul>',
    list(
      [
        ['mode', isolation.mode],
        ['forbiddenPaths', refs(isolation.forbiddenPaths)],
        ['basisRefs', refs(isolation.basisRefs)],
      ],
      (value) => row([value as [string, unknown]])
    ),
    '</ul></section>',
    '<section><h2>Consumer impact</h2><ul>',
    impacts(Array.isArray(candidate.consumerImpact) ? candidate.consumerImpact : []),
    '</ul></section>',
    '<section><h2>Governance impact</h2><ul>',
    impacts(Array.isArray(candidate.governanceImpact) ? candidate.governanceImpact : []),
    '</ul></section>',
    '<section><h2>Trigger matrix</h2><ul>',
    list(objects(candidate.triggerMatrix), (value) => {
      const trigger = object(value);
      return row([
        ['triggerId', trigger.triggerId],
        ['triggered', trigger.triggered],
        ['basisRefs', refs(trigger.basisRefs)],
      ]);
    }),
    '</ul></section>',
    '<section><h2>Typed decisions</h2><ul>',
    list(decisions, (value) => {
      const decision = object(value);
      return row([
        ['decisionId', decision.decisionId],
        ['decisionType', decision.decisionType],
        ['selection', decision.selection],
        ['basisRefs', refs(decision.basisRefs)],
      ]);
    }),
    '</ul></section>',
    '<section><h2>Goal execution structure premises</h2><ul>',
    bindings(
      Array.isArray(candidate.goalExecutionStructurePremises)
        ? candidate.goalExecutionStructurePremises
        : []
    ),
    '</ul></section>',
    '<section><h2>Exact acceptance</h2>',
    `<pre>${htmlEscape(exactConfirmationText)}</pre></section>`,
    '</main></body></html>\n',
  ].join('');
}

function projectRelative(projectRoot: string, absolutePath: string): string {
  const relative = path.relative(projectRoot, absolutePath).replace(/\\/gu, '/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error('architecture_confirmation_projection_path_invalid');
  }
  return relative;
}

export function architectureConfirmationExactText(input: {
  requestId: string;
  semanticRevisionId: string;
  architectureConfirmationCandidateHash: string;
}): string {
  return [
    'CONFIRM ARCHITECTURE CANDIDATE',
    `requestId=${input.requestId}`,
    `semanticRevisionId=${input.semanticRevisionId}`,
    `architectureConfirmationCandidateHash=${input.architectureConfirmationCandidateHash}`,
  ].join('\n');
}

export function architectureConfirmationProjection(input: {
  context: ArchitectureConfirmationContext;
  candidate: ArchitectureConfirmationCandidate;
}) {
  const hashId = input.candidate.architectureConfirmationCandidateHash.slice('sha256:'.length);
  const exactConfirmationText = architectureConfirmationExactText({
    requestId: input.candidate.requestId,
    semanticRevisionId: input.context.semanticIr.semanticRevisionId,
    architectureConfirmationCandidateHash: input.candidate.architectureConfirmationCandidateHash,
  });
  const pageBytes = renderArchitectureConfirmationPage(input.candidate, exactConfirmationText);
  const pageArtifactBytesHash = artifactBytesHash({
    role: 'architecture_confirmation_page',
    mediaType: 'text/html',
    bytes: Buffer.from(pageBytes, 'utf8'),
  });
  const acceptanceDirectory = path.join(
    input.context.recordRoot,
    'architecture',
    'confirmations',
    hashId
  );
  return {
    exactConfirmationText,
    candidatePath: path.join(
      input.context.recordRoot,
      'architecture',
      'candidates',
      hashId,
      'architecture-confirmation-candidate.json'
    ),
    pagePath: path.join(
      input.context.recordRoot,
      'architecture',
      'confirmation-pages',
      hashId,
      input.context.sourceBinding.bindingRevisionId,
      pageArtifactBytesHash.slice('sha256:'.length),
      'architecture-confirmation.html'
    ),
    acceptanceDirectory,
    eventPath: path.join(acceptanceDirectory, 'architecture-confirmation-event.json'),
    runtimeReceiptPath: path.join(acceptanceDirectory, 'runtime-status-decision-receipt.json'),
    pageBytes,
  };
}

export function readCurrentArchitectureConfirmationAcceptance(input: {
  context: ArchitectureConfirmationContext;
  candidate: ArchitectureConfirmationCandidate;
}): {
  event: JsonObject;
  eventRef: { path: string; artifactBytesHash: string };
  runtimeStatusDecisionRef: { path: string; receiptHash: string };
} | null {
  const projection = architectureConfirmationProjection(input);
  if (!fs.existsSync(projection.eventPath)) return null;
  const eventBytes = fs.readFileSync(projection.eventPath);
  const event = JSON.parse(eventBytes.toString('utf8')) as JsonObject;
  const candidateRef = object(event.candidateRef);
  const pageRef = object(event.pageRef);
  const requirementsConfirmationEventRef = object(event.requirementsConfirmationEventRef);
  const requirementsEffectivePassRef = object(event.requirementsEffectivePassRef);
  const expectedCandidateRef = {
    path: projectRelative(input.context.recordRoot, projection.candidatePath),
    artifactBytesHash: artifactBytesHash({
      role: 'architecture_confirmation_candidate',
      mediaType: 'application/json',
      bytes: fs.readFileSync(projection.candidatePath),
    }),
  };
  const acceptedBindingRevisionId = text(event.requirementsBindingRevisionId);
  const acceptedSourceBindingHash = text(event.requirementsSourceBindingHash);
  let acceptedBindingIsCompatible = true;
  try {
    resolveCompatibleBindingAncestry({
      recordRoot: input.context.recordRoot,
      semanticRevisionId: input.context.semanticIr.semanticRevisionId,
      scopeSemanticHash: input.context.semanticIr.scopeSemanticHash,
      currentBinding: input.context.sourceBinding,
      ancestorBindingRevisionId: acceptedBindingRevisionId,
      ancestorSourceBindingHash: acceptedSourceBindingHash,
      issueCode: 'requirements_confirmation_event_stale',
    });
  } catch {
    acceptedBindingIsCompatible = false;
  }
  const expectedPageBytes = Buffer.from(projection.pageBytes, 'utf8');
  const candidateHashId = input.candidate.architectureConfirmationCandidateHash.slice(
    'sha256:'.length
  );
  const pageHashId = artifactBytesHash({
    role: 'architecture_confirmation_page',
    mediaType: 'text/html',
    bytes: expectedPageBytes,
  }).slice('sha256:'.length);
  const expectedPageRef = {
    path: `architecture/confirmation-pages/${candidateHashId}/${acceptedBindingRevisionId}/${pageHashId}/architecture-confirmation.html`,
    artifactBytesHash: artifactBytesHash({
      role: 'architecture_confirmation_page',
      mediaType: 'text/html',
      bytes: expectedPageBytes,
    }),
  };
  const exactConfirmationTextHash = requirementsContractDomainHash(
    'architecture-confirmation-exact-text/v1',
    projection.exactConfirmationText
  );
  const eventRef = {
    path: projectRelative(input.context.recordRoot, projection.eventPath),
    artifactBytesHash: artifactBytesHash({
      role: 'architecture_confirmation_event',
      mediaType: 'application/json',
      bytes: eventBytes,
    }),
  };
  const pagePath = confinedArtifact(input.context.recordRoot, text(pageRef.path));
  const pageBytes = fs.existsSync(pagePath) ? fs.readFileSync(pagePath) : null;
  const pageArtifactBytesHash = pageBytes
    ? artifactBytesHash({
        role: 'architecture_confirmation_page',
        mediaType: 'text/html',
        bytes: pageBytes,
      })
    : '';
  const attemptId = text(event.requirementsAuthoringAttemptId);
  const runtimeReceiptRelativePath = projectRelative(
    input.context.recordRoot,
    projection.runtimeReceiptPath
  );
  const runtimeReceiptPath = projection.runtimeReceiptPath;
  const runtimeReceipt = fs.existsSync(runtimeReceiptPath) ? readJson(runtimeReceiptPath) : null;
  const eventGateOutput = objects(runtimeReceipt?.deterministicGateOutputs).find(
    (item) => text(item.role) === 'architecture_confirmation_event'
  );
  const candidateStageInput = objects(runtimeReceipt?.stageInputs).find(
    (item) => text(item.role) === 'architecture_confirmation_candidate'
  );
  const requirementsConfirmationStageInput = objects(runtimeReceipt?.stageInputs).find(
    (item) => text(item.role) === 'requirements_confirmation_event'
  );
  const requirementsEffectivePassStageInput = objects(runtimeReceipt?.stageInputs).find(
    (item) => text(item.role) === 'requirements_effective_pass'
  );
  const currentRequirementsConfirmationRef = object(input.context.record.confirmationEventRef);
  const requirementsEffectivePassHash = text(
    input.context.effectivePass.requirementsEffectivePassHash
  );
  const valid =
    event.schemaVersion === 'architecture-confirmation-event/v1' &&
    event.eventType === 'architecture_confirmation_recorded' &&
    text(event.requestId) === input.candidate.requestId &&
    text(event.semanticRevisionId) === input.context.semanticIr.semanticRevisionId &&
    text(event.scopeSemanticHash) === input.context.semanticIr.scopeSemanticHash &&
    text(event.architectureConfirmationCandidateHash) ===
      input.candidate.architectureConfirmationCandidateHash &&
    Boolean(attemptId) &&
    Boolean(acceptedBindingRevisionId) &&
    Boolean(acceptedSourceBindingHash) &&
    acceptedBindingIsCompatible &&
    text(event.exactConfirmationTextHash) === exactConfirmationTextHash &&
    event.decision === 'pass' &&
    text(candidateRef.path) === expectedCandidateRef.path &&
    text(candidateRef.artifactBytesHash) === expectedCandidateRef.artifactBytesHash &&
    text(pageRef.path) === expectedPageRef.path &&
    text(pageRef.artifactBytesHash) === expectedPageRef.artifactBytesHash &&
    Boolean(pageBytes?.equals(expectedPageBytes)) &&
    text(requirementsConfirmationEventRef.path) === text(currentRequirementsConfirmationRef.path) &&
    text(requirementsConfirmationEventRef.artifactBytesHash) ===
      input.context.confirmationEventHash &&
    text(requirementsEffectivePassRef.path) ===
      'quality/requirements-effective-pass-receipt.json' &&
    text(requirementsEffectivePassRef.hash) === requirementsEffectivePassHash &&
    pageArtifactBytesHash === text(pageRef.artifactBytesHash) &&
    runtimeReceipt !== null &&
    validateRuntimeStatusDecisionReceipt(runtimeReceipt) &&
    runtimeReceipt.modelId === 'architecture_confirmation' &&
    runtimeReceipt.recordId === input.candidate.requestId &&
    runtimeReceipt.implementationAttemptId === attemptId &&
    runtimeReceipt.semanticModelHash === input.context.semanticIr.scopeSemanticHash &&
    runtimeReceipt.decision === 'pass' &&
    runtimeReceipt.effectiveStatus === 'pass' &&
    text(eventGateOutput?.path) === eventRef.path &&
    text(eventGateOutput?.hash) === eventRef.artifactBytesHash &&
    text(candidateStageInput?.path) === expectedCandidateRef.path &&
    text(candidateStageInput?.hash) === input.candidate.architectureConfirmationCandidateHash &&
    text(requirementsConfirmationStageInput?.path) ===
      text(currentRequirementsConfirmationRef.path) &&
    text(requirementsConfirmationStageInput?.hash) === input.context.confirmationEventHash &&
    text(requirementsEffectivePassStageInput?.path) ===
      'quality/requirements-effective-pass-receipt.json' &&
    text(requirementsEffectivePassStageInput?.hash) === requirementsEffectivePassHash;
  if (!valid) throw new Error('architecture_confirmation_acceptance_event_invalid');
  return {
    event,
    eventRef,
    runtimeStatusDecisionRef: {
      path: runtimeReceiptRelativePath,
      receiptHash: runtimeReceipt.receiptHash,
    },
  };
}

export function prepareArchitectureConfirmation(input: {
  projectRoot: string;
  requestId: string;
}): JsonObject {
  const context = resolveArchitectureConfirmationContext(input);
  const candidate = deriveArchitectureConfirmationCandidate(context);
  const projection = architectureConfirmationProjection({ context, candidate });
  const candidatePath = projection.candidatePath;
  const exactConfirmationText = projection.exactConfirmationText;
  const pagePath = projection.pagePath;
  const candidateBytes = Buffer.from(canonicalRequirementsJson(candidate), 'utf8');
  const pageBytes = Buffer.from(projection.pageBytes, 'utf8');
  const exactCandidateExists =
    fs.existsSync(candidatePath) && fs.readFileSync(candidatePath).equals(candidateBytes);
  const exactPageExists = fs.existsSync(pagePath) && fs.readFileSync(pagePath).equals(pageBytes);
  const candidateArtifactBytesHash = exactCandidateExists
    ? artifactBytesHash({
        role: 'architecture_confirmation_candidate',
        mediaType: 'application/json',
        bytes: candidateBytes,
      })
    : atomicNoClobberPublish({
        targetPath: candidatePath,
        value: candidate,
        role: 'architecture_confirmation_candidate',
        mediaType: 'application/json',
        validateReadback(value) {
          if (canonicalRequirementsJson(value) !== canonicalRequirementsJson(candidate)) {
            throw new Error('architecture_confirmation_candidate_readback_mismatch');
          }
        },
      }).artifactBytesHash;
  const pageArtifactBytesHash = exactPageExists
    ? artifactBytesHash({
        role: 'architecture_confirmation_page',
        mediaType: 'text/html',
        bytes: pageBytes,
      })
    : atomicNoClobberPublish({
        targetPath: pagePath,
        bytes: projection.pageBytes,
        role: 'architecture_confirmation_page',
        mediaType: 'text/html',
      }).artifactBytesHash;
  const reused = Boolean(readCurrentArchitectureConfirmationAcceptance({ context, candidate }));
  return {
    schemaVersion: 'architecture-confirmation-candidate-result/v1',
    status: reused ? 'architecture_confirmation_reused' : 'user_confirmable',
    requestId: input.requestId,
    requirementsLineage: {
      semanticRevisionId: context.semanticIr.semanticRevisionId,
      scopeSemanticHash: context.semanticIr.scopeSemanticHash,
    },
    architectureConfirmationCandidateHash: candidate.architectureConfirmationCandidateHash,
    candidateRef: {
      path: projectRelative(context.projectRoot, candidatePath),
      artifactBytesHash: candidateArtifactBytesHash,
    },
    pageRef: {
      path: projectRelative(context.projectRoot, pagePath),
      artifactBytesHash: pageArtifactBytesHash,
    },
    exactConfirmationText,
    issueCodes: [],
  };
}

function blockedResult(
  requestId: string,
  issueCode: ArchitectureConfirmationIssueCode
): JsonObject {
  return {
    schemaVersion: 'architecture-confirmation-candidate-result/v1',
    status: 'blocked',
    requestId: requestId || 'unknown',
    requirementsLineage: {
      semanticRevisionId: 'unknown',
      scopeSemanticHash: `sha256:${'0'.repeat(64)}`,
    },
    issueCodes: [issueCode],
  };
}

function emitJson(stream: NodeJS.WriteStream, value: unknown): void {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function mainPrepareArchitectureConfirmation(argv: string[]): number {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    const failure = classifyArchitectureConfirmationError(error);
    emitJson(process.stderr, blockedResult('unknown', failure.issueCode));
    return failure.exitCode;
  }
  if (args.help) {
    process.stdout.write(
      'Usage: bmad-speckit main-agent prepare-architecture-confirmation --request-id <requestId> --json\n'
    );
    return 0;
  }
  if (!args.requestId) {
    emitJson(process.stderr, blockedResult('unknown', 'request_id_missing'));
    return 2;
  }
  try {
    const result = prepareArchitectureConfirmation({
      projectRoot: process.cwd(),
      requestId: args.requestId,
    });
    emitJson(process.stdout, result);
    return 0;
  } catch (error) {
    const failure = classifyArchitectureConfirmationError(error);
    emitJson(process.stderr, blockedResult(args.requestId, failure.issueCode));
    return failure.exitCode;
  }
}

const entry = process.argv[1] ?? '';
if (/(^|[\\/])prepare-architecture-confirmation(\.[cm]?js|\.ts)?$/iu.test(entry)) {
  process.exitCode = mainPrepareArchitectureConfirmation(process.argv.slice(2));
}
