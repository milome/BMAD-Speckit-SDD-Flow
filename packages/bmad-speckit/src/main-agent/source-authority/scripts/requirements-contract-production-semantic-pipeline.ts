import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { writeJsonAtomic } from './requirement-record-control-store';
import { createSameVolumeBoundedTempDirectory } from './requirements-contract-same-volume-bounded-temp';
import {
  resolveInteractionCandidates,
  type InteractionResolutionCandidate,
} from './requirements-contract-interaction-resolver';
import { extractProductionInteractionCandidates } from './requirements-contract-production-interaction-candidate-extractor';
import {
  createRequirementsContractSemanticConservationManifest,
  validateRequirementsContractSemanticConservationManifest,
  type RequirementsContractSemanticConservationManifest,
} from './requirements-contract-semantic-conservation-manifest';
import {
  applySemanticFieldValue,
  resolveSemanticField,
  sha256Stable,
  sha256Text,
  validateSemanticResolutionReceipt,
  type SemanticResolutionReceipt,
  type TrustedSourceExtraction,
  type TrustedSourceSnapshot,
} from './requirements-contract-semantic-resolver';
import { semanticModelHash as semanticModelHashForContract } from './requirements-contract-hash-domains';
import {
  requirementsContractInvocationAuthorityBindingHash,
  type RequirementsContractInvocationAuthorityReceipt,
  validateRequirementsContractInvocationAuthorityReceipt,
} from './requirements-contract-invocation-authority-receipt';
import { SOURCE_ROOT_CLASS_REGISTRY_HASH } from './requirements-contract-source-root-class-registry';
import { validateRequirementsContractIntakeReceipt } from './requirements-contract-intake-receipt';
import { validateRequirementsContractFileIntakeReceipt } from './requirements-contract-file-intake-receipt';
import { validateRequirementsContractIntentLineageLedger } from './requirements-contract-intent-lineage';
import {
  validateRequirementContractModelV2,
  type RequirementContractModelV2,
  type RequirementContractSemanticNodeType,
} from './requirements-contract-model';
import { requirementsContractTraceEdgeTypeRegistryHash } from '../rules/requirements-contract-trace-edge-type-registry';
import {
  createRequirementsContractLifecycleValidationReport,
  validateRequirementsContractLifecycleValidationReport,
  type RequirementsContractLifecycleValidationReport,
} from './requirements-contract-validation-facade';

export type ProductionSemanticNodeType = RequirementContractSemanticNodeType;

export interface ProductionSemanticSourceRoot {
  sourceRootId: string;
  rootClass: string;
  nodeType: ProductionSemanticNodeType;
  bodySchemaVersion: string;
  semanticBody: Record<string, unknown>;
  sourcePath: string;
  sourceContent: string;
  sourceSpan: {
    startLine: number;
    endLine: number;
  };
  authorityClass: string;
  relatedRequirementRefs?: string[];
}

export interface ProductionSemanticSourceRootCandidate
  extends Omit<ProductionSemanticSourceRoot, 'authorityClass'> {
  proposedAuthorityClass: string;
}

export interface ProductionSemanticPipelineResult {
  sourceRoots: ProductionSemanticSourceRoot[];
  semanticIr: RequirementContractModelV2;
  lifecycleValidationReport: RequirementsContractLifecycleValidationReport;
  semanticResolutionReceipts: SemanticResolutionReceipt[];
  interactionResolution: Record<string, unknown>;
  semanticConservationManifest: RequirementsContractSemanticConservationManifest;
}

const CANONICAL_MODEL_SCHEMA = 'requirement-contract-model-v2.schema.json';
const SEMANTIC_RESOLUTION_SCHEMA = 'requirements-contract-semantic-resolution-receipt.schema.json';
const SEMANTIC_CONSERVATION_SCHEMA =
  'requirements-contract-semantic-conservation-manifest.schema.json';
const SESSION_INTAKE_SCHEMA = 'requirements-contract-intake-receipt.schema.json';
const FILE_INTAKE_SCHEMA = 'requirements-contract-file-intake-receipt.schema.json';
const INVOCATION_AUTHORITY_SCHEMA =
  'requirements-contract-invocation-authority-receipt.schema.json';
const REFERENCE_ID = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/u;

function schemaPath(fileName: string): string {
  return path.resolve(__dirname, '..', 'schemas', fileName);
}

function canonicalModulePath(moduleName: string): string {
  let current = path.resolve(__dirname);
  for (;;) {
    const candidate = path.join(
      current,
      'src',
      'main-agent',
      'source-authority',
      'scripts',
      `${moduleName}.ts`
    );
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`Canonical source module is unavailable: ${moduleName}`);
}

function fileIdentity(id: string, filePath: string): { id: string; hash: string } {
  return {
    id,
    hash: sha256Text(readFileSync(filePath, 'utf8')),
  };
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
}

function persistValidatedJson<T>(
  filePath: string,
  value: T,
  validate: (candidate: unknown) => boolean
): T {
  writeJsonAtomic(filePath, value);
  const readback = readJson(filePath);
  if (!validate(readback) || sha256Stable(readback) !== sha256Stable(value)) {
    throw new Error(`Semantic pipeline artifact validation failed: ${filePath}`);
  }
  return readback as T;
}

interface SemanticBundleStaging {
  root: string;
  semanticIrPath: string;
  semanticResolutionDir: string;
  interactionResolutionPath: string;
  lifecycleValidationReportPath: string;
  semanticConservationManifestPath: string;
}

interface SemanticBundleEntry {
  kind: 'file' | 'directory';
  stagedPath: string;
  targetPath: string;
}

function relativeBundlePath(bundleRoot: string, targetPath: string, label: string): string {
  const resolvedTarget = path.resolve(targetPath);
  const relative = path.relative(bundleRoot, resolvedTarget);
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error(`${label} must remain inside the Semantic pipeline bundle root`);
  }
  return relative;
}

function createSemanticBundleStaging(input: {
  semanticIrPath: string;
  semanticResolutionDir: string;
  interactionResolutionPath: string;
  lifecycleValidationReportPath: string;
  semanticConservationManifestPath: string;
}): SemanticBundleStaging {
  const bundleRoot = path.resolve(path.dirname(input.semanticIrPath));
  const relativePaths = {
    semanticIrPath: relativeBundlePath(
      bundleRoot,
      input.semanticIrPath,
      'Canonical Semantic IR path'
    ),
    semanticResolutionDir: relativeBundlePath(
      bundleRoot,
      input.semanticResolutionDir,
      'Semantic Resolution Receipt directory'
    ),
    interactionResolutionPath: relativeBundlePath(
      bundleRoot,
      input.interactionResolutionPath,
      'Interaction Resolution path'
    ),
    lifecycleValidationReportPath: relativeBundlePath(
      bundleRoot,
      input.lifecycleValidationReportPath,
      'Lifecycle Validation Report path'
    ),
    semanticConservationManifestPath: relativeBundlePath(
      bundleRoot,
      input.semanticConservationManifestPath,
      'Semantic Conservation Manifest path'
    ),
  };
  const root = createSameVolumeBoundedTempDirectory({
    anchorDirectory: path.dirname(bundleRoot),
    prefix: 'r-',
    projectedRelativePaths: Object.values(relativePaths),
  });
  return {
    root,
    semanticIrPath: path.join(root, relativePaths.semanticIrPath),
    semanticResolutionDir: path.join(root, relativePaths.semanticResolutionDir),
    interactionResolutionPath: path.join(root, relativePaths.interactionResolutionPath),
    lifecycleValidationReportPath: path.join(root, relativePaths.lifecycleValidationReportPath),
    semanticConservationManifestPath: path.join(
      root,
      relativePaths.semanticConservationManifestPath
    ),
  };
}

function removeBundlePath(targetPath: string): void {
  if (!existsSync(targetPath)) return;
  if (statSync(targetPath).isDirectory()) {
    rmSync(targetPath, { recursive: true, force: true });
    return;
  }
  rmSync(targetPath, { force: true });
}

function renameBundlePathWithRetry(sourcePath: string, targetPath: string): void {
  const waitBuffer = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      renameSync(sourcePath, targetPath);
      return;
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      if (!['EPERM', 'EBUSY'].includes(code) || attempt === 19) {
        throw error;
      }
      Atomics.wait(waitBuffer, 0, 0, Math.min(50 * 1.5 ** attempt, 1000));
    }
  }
}

function promoteSemanticBundle(input: {
  stagingRoot: string;
  entries: SemanticBundleEntry[];
  validatePublished: () => void;
}): void {
  const rollbackRoot = path.join(input.stagingRoot, '.rollback');
  const states = input.entries.map((entry, index) => ({
    ...entry,
    backupPath: path.join(rollbackRoot, String(index).padStart(2, '0')),
    backedUp: false,
    promoted: false,
  }));
  for (const state of states) {
    if (!existsSync(state.stagedPath)) {
      throw new Error(`Semantic bundle staged artifact is missing: ${state.stagedPath}`);
    }
    const stagedIsDirectory = statSync(state.stagedPath).isDirectory();
    if ((state.kind === 'directory') !== stagedIsDirectory) {
      throw new Error(`Semantic bundle staged artifact type is invalid: ${state.stagedPath}`);
    }
  }

  try {
    mkdirSync(rollbackRoot, { recursive: true });
    for (const state of states) {
      mkdirSync(path.dirname(state.targetPath), { recursive: true });
      if (existsSync(state.targetPath)) {
        mkdirSync(path.dirname(state.backupPath), { recursive: true });
        renameBundlePathWithRetry(state.targetPath, state.backupPath);
        state.backedUp = true;
      }
      renameBundlePathWithRetry(state.stagedPath, state.targetPath);
      state.promoted = true;
    }
    input.validatePublished();
    for (const state of states) {
      if (state.backedUp) removeBundlePath(state.backupPath);
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const state of [...states].reverse()) {
      try {
        if (state.promoted) removeBundlePath(state.targetPath);
        if (state.backedUp && existsSync(state.backupPath)) {
          mkdirSync(path.dirname(state.targetPath), { recursive: true });
          renameBundlePathWithRetry(state.backupPath, state.targetPath);
        }
      } catch (rollbackError) {
        rollbackErrors.push(
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        );
      }
    }
    if (rollbackErrors.length > 0) {
      throw new Error(
        `Semantic bundle publication failed and rollback was incomplete: ${
          error instanceof Error ? error.message : String(error)
        }; rollback=${rollbackErrors.join(' | ')}`
      );
    }
    throw error;
  }
}

function cleanupSemanticBundleStaging(stagingRoot: string): void {
  removeBundlePath(stagingRoot);
  try {
    rmdirSync(path.dirname(stagingRoot));
  } catch {
    // A concurrent or interrupted run may still own another staging directory.
  }
}

function exactSourceExcerpt(content: string, span: { startLine: number; endLine: number }): string {
  const lines = content.replace(/\r\n/gu, '\n').split('\n');
  if (
    !Number.isSafeInteger(span.startLine) ||
    !Number.isSafeInteger(span.endLine) ||
    span.startLine < 1 ||
    span.endLine < span.startLine ||
    span.endLine > lines.length
  ) {
    throw new Error('Semantic Source Root span is outside the source document');
  }
  return lines.slice(span.startLine - 1, span.endLine).join('\n');
}

function jsonPointerSegment(value: string): string {
  return value.replace(/~/gu, '~0').replace(/\//gu, '~1');
}

function sourceSpanRef(index: number): string {
  return `SOURCE-SPAN-${String(index + 1).padStart(3, '0')}`;
}

function edgeTypeFor(nodeType: ProductionSemanticNodeType): string {
  if (nodeType === 'target') return 'implemented_in';
  if (nodeType === 'oracle') return 'verified_by';
  return 'bounded_by';
}

function canonicalModelPreimage(
  value: Omit<RequirementContractModelV2, 'semanticModelHash'>
): unknown {
  return value;
}

function intakeAuthorityBindingHash(receipt: Record<string, unknown>): string {
  const { capturedAt: _capturedAt, receiptHash: _receiptHash, ...stableAuthority } = receipt;
  return sha256Stable(stableAuthority);
}

function intentLineageAuthorityBindingHash(
  ledger: Record<string, unknown>,
  intakeBindingHash: string
): string {
  const {
    intakeReceiptHash: _intakeReceiptHash,
    ledgerHash: _ledgerHash,
    ...stableAuthority
  } = ledger;
  return sha256Stable({
    ...stableAuthority,
    intakeAuthorityBindingHash: intakeBindingHash,
  });
}

function semanticResolutionAuthorityBindingHash(receipt: SemanticResolutionReceipt): string {
  if (!validateSemanticResolutionReceipt(receipt)) {
    throw new Error('Invalid Semantic Resolution Receipt');
  }
  return sha256Stable({
    schemaVersion: receipt.schemaVersion,
    resolutionId: receipt.resolutionId,
    fieldRef: receipt.fieldRef,
    valueHash: receipt.valueHash,
    resolutionAuthorityClass: receipt.resolutionAuthorityClass,
    derivationRule: receipt.derivationRule,
    applicabilityProof: receipt.applicabilityProof,
    conflictingCandidates: [...receipt.conflictingCandidates].sort(),
    sourceModelHashBefore: receipt.sourceModelHashBefore,
    sourceModelHashAfter: receipt.sourceModelHashAfter,
    resolverId: receipt.resolverId,
    resolutionRunId: receipt.resolutionRunId,
  });
}

function validateSourceRoots(sourceRoots: ProductionSemanticSourceRoot[]): void {
  if (sourceRoots.length === 0) throw new Error('Semantic pipeline requires Source Roots');
  const ids = new Set<string>();
  for (const root of sourceRoots) {
    if (!REFERENCE_ID.test(root.sourceRootId) || ids.has(root.sourceRootId)) {
      throw new Error(`Invalid or duplicate Semantic Source Root ID: ${root.sourceRootId}`);
    }
    ids.add(root.sourceRootId);
    if (!root.rootClass.trim() || !root.authorityClass.trim()) {
      throw new Error(`Semantic Source Root authority is incomplete: ${root.sourceRootId}`);
    }
    if (!/^[a-z][a-z0-9-]*\/v[0-9]+$/u.test(root.bodySchemaVersion)) {
      throw new Error(`Invalid semantic body schema version: ${root.bodySchemaVersion}`);
    }
    try {
      exactSourceExcerpt(root.sourceContent, root.sourceSpan);
    } catch (error) {
      throw new Error(
        `Semantic Source Root span is invalid: ${root.sourceRootId}:${root.sourceSpan.startLine}-${root.sourceSpan.endLine}:${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

function validateSourceRootCandidates(
  sourceRootCandidates: ProductionSemanticSourceRootCandidate[]
): void {
  if (sourceRootCandidates.length === 0) {
    throw new Error('Semantic pipeline requires Source Root candidates');
  }
  const ids = new Set<string>();
  for (const candidate of sourceRootCandidates) {
    if (!REFERENCE_ID.test(candidate.sourceRootId) || ids.has(candidate.sourceRootId)) {
      throw new Error(`Invalid or duplicate Semantic Source Root candidate ID: ${candidate.sourceRootId}`);
    }
    ids.add(candidate.sourceRootId);
    if (!candidate.rootClass.trim() || !candidate.proposedAuthorityClass.trim()) {
      throw new Error(
        `Semantic Source Root candidate authority is incomplete: ${candidate.sourceRootId}`
      );
    }
    if (!/^[a-z][a-z0-9-]*\/v[0-9]+$/u.test(candidate.bodySchemaVersion)) {
      throw new Error(`Invalid semantic body schema version: ${candidate.bodySchemaVersion}`);
    }
    try {
      exactSourceExcerpt(candidate.sourceContent, candidate.sourceSpan);
    } catch (error) {
      throw new Error(
        `Semantic Source Root candidate span is invalid: ${candidate.sourceRootId}:${candidate.sourceSpan.startLine}-${candidate.sourceSpan.endLine}:${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

type LineageSourceRootDescriptor = {
  sourceRootId: string;
  sourcePath: string;
  sourceSpan: {
    startLine: number;
    endLine: number;
  };
  authorityClass?: string;
  proposedAuthorityClass?: string;
};

function lineageAuthorityClass(root: LineageSourceRootDescriptor): string {
  return String(root.authorityClass ?? root.proposedAuthorityClass ?? '');
}

function validateLineageRootSet(input: {
  requirementSetId: string;
  intakeReceipt: Record<string, unknown>;
  intentLineageLedger: Record<string, unknown>;
  sourceRoots: LineageSourceRootDescriptor[];
}): void {
  if (
    input.intakeReceipt.requirementSetId !== input.requirementSetId ||
    input.intentLineageLedger.requirementSetId !== input.requirementSetId ||
    input.intentLineageLedger.intakeReceiptHash !== input.intakeReceipt.receiptHash
  ) {
    throw new Error('Intent Lineage identity does not match the current Intake Receipt');
  }
  const classifications = Array.isArray(input.intentLineageLedger.classifications)
    ? input.intentLineageLedger.classifications
    : [];
  const lineageRootRefs = new Set<string>();
  for (const classification of classifications) {
    if (
      !classification ||
      typeof classification !== 'object' ||
      Array.isArray(classification) ||
      (classification as Record<string, unknown>).disposition !== 'source_root'
    ) {
      continue;
    }
    const refs = (classification as Record<string, unknown>).sourceRootRefs;
    if (!Array.isArray(refs) || refs.some((ref) => typeof ref !== 'string')) {
      throw new Error('Intent Lineage Source Root refs are malformed');
    }
    for (const ref of refs as string[]) lineageRootRefs.add(ref);
  }
  const expectedRootRefs = new Set(
    input.sourceRoots
      .filter((root) => lineageAuthorityClass(root) !== 'invocation_bound')
      .map((root) => root.sourceRootId)
  );
  if (
    lineageRootRefs.size !== expectedRootRefs.size ||
    [...lineageRootRefs].some((ref) => !expectedRootRefs.has(ref))
  ) {
    throw new Error('Intent Lineage Source Root refs do not match the source-derived root set');
  }
  if (
    input.intakeReceipt.schemaVersion === 'requirements-contract-file-intake-receipt/v1' &&
    Array.isArray(input.intakeReceipt.excerpts)
  ) {
    const classificationBySpanId = new Map(
      classifications
        .filter((classification) => isRecord(classification))
        .map((classification) => [String(classification.spanId), classification])
    );
    for (const excerpt of input.intakeReceipt.excerpts) {
      if (!isRecord(excerpt) || !isRecord(excerpt.boundary)) {
        throw new Error('File Intake excerpt boundary is malformed');
      }
      const sourcePath = String(excerpt.boundary.sourcePath ?? '').replace(/\\/gu, '/');
      const startLine = Number(excerpt.boundary.startLine);
      const endLine = Number(excerpt.boundary.endLine);
      const expectedSpanRootRefs = input.sourceRoots
        .filter(
          (root) =>
            lineageAuthorityClass(root) !== 'invocation_bound' &&
            root.sourcePath.replace(/\\/gu, '/') === sourcePath &&
            root.sourceSpan.startLine <= startLine &&
            root.sourceSpan.endLine >= endLine
        )
        .map((root) => root.sourceRootId)
        .sort();
      const classification = classificationBySpanId.get(String(excerpt.excerptId));
      if (!classification) {
        throw new Error(`Intent Lineage is missing File Intake span ${String(excerpt.excerptId)}`);
      }
      if (expectedSpanRootRefs.length === 0) {
        if (classification.disposition !== 'excluded') {
          throw new Error(
            `Intent Lineage non-semantic span must be excluded: ${String(excerpt.excerptId)}`
          );
        }
        continue;
      }
      const actualSpanRootRefs = Array.isArray(classification.sourceRootRefs)
        ? classification.sourceRootRefs.map(String).sort()
        : [];
      if (
        classification.disposition !== 'source_root' ||
        actualSpanRootRefs.length !== expectedSpanRootRefs.length ||
        expectedSpanRootRefs.some(
          (sourceRootId, index) => sourceRootId !== actualSpanRootRefs[index]
        )
      ) {
        throw new Error(
          `Intent Lineage span Source Root refs do not match the exact source span: ${String(
            excerpt.excerptId
          )}`
        );
      }
    }
  }
  if (
    input.intakeReceipt.schemaVersion === 'requirements-contract-intake-receipt/v1' &&
    Array.isArray(input.intakeReceipt.excerpts)
  ) {
    const classificationBySpanId = new Map(
      classifications
        .filter((classification) => isRecord(classification))
        .map((classification) => [String(classification.spanId), classification])
    );
    for (const excerpt of input.intakeReceipt.excerpts) {
      if (!isRecord(excerpt)) {
        throw new Error('Session Intake excerpt is malformed');
      }
      const order = Number(excerpt.order);
      if (!Number.isInteger(order) || order < 1) {
        throw new Error('Session Intake excerpt order is malformed');
      }
      const expectedSpanRootRefs = input.sourceRoots
        .filter(
          (root) =>
            lineageAuthorityClass(root) !== 'invocation_bound' &&
            root.sourceSpan.startLine <= order &&
            root.sourceSpan.endLine >= order
        )
        .map((root) => root.sourceRootId)
        .sort();
      const classification = classificationBySpanId.get(String(excerpt.excerptId));
      if (!classification) {
        throw new Error(`Intent Lineage is missing Session Intake span ${String(excerpt.excerptId)}`);
      }
      if (expectedSpanRootRefs.length === 0) {
        if (classification.disposition !== 'excluded') {
          throw new Error(
            `Intent Lineage non-semantic span must be excluded: ${String(excerpt.excerptId)}`
          );
        }
        continue;
      }
      const actualSpanRootRefs = Array.isArray(classification.sourceRootRefs)
        ? classification.sourceRootRefs.map(String).sort()
        : [];
      if (
        classification.disposition !== 'source_root' ||
        actualSpanRootRefs.length !== expectedSpanRootRefs.length ||
        expectedSpanRootRefs.some(
          (sourceRootId, index) => sourceRootId !== actualSpanRootRefs[index]
        )
      ) {
        throw new Error(
          `Intent Lineage span Source Root refs do not match the exact source span: ${String(
            excerpt.excerptId
          )}`
        );
      }
    }
  }
}

export function materializeProductionSemanticSourceRoots(input: {
  requirementSetId: string;
  intakeReceipt: unknown;
  intentLineageLedger: unknown;
  sourceRootCandidates: ProductionSemanticSourceRootCandidate[];
}): ProductionSemanticSourceRoot[] {
  const intakeReceipt = input.intakeReceipt;
  const intentLineageLedger = input.intentLineageLedger;
  const validIntakeReceipt =
    validateRequirementsContractIntakeReceipt(intakeReceipt) ||
    validateRequirementsContractFileIntakeReceipt(intakeReceipt);
  if (
    !validIntakeReceipt ||
    !validateRequirementsContractIntentLineageLedger(intentLineageLedger)
  ) {
    throw new Error(
      'Source Root materialization requires a valid Intake Receipt and Intent Lineage'
    );
  }
  validateSourceRootCandidates(input.sourceRootCandidates);
  validateLineageRootSet({
    requirementSetId: input.requirementSetId,
    intakeReceipt: intakeReceipt as Record<string, unknown>,
    intentLineageLedger: intentLineageLedger as Record<string, unknown>,
    sourceRoots: input.sourceRootCandidates,
  });
  const sourceRoots = input.sourceRootCandidates.map(
    ({ proposedAuthorityClass, ...candidate }) => ({
      ...candidate,
      authorityClass: proposedAuthorityClass,
    })
  );
  validateSourceRoots(sourceRoots);
  return sourceRoots;
}

function semanticResolutionReceipts(input: {
  sourceRoots: ProductionSemanticSourceRoot[];
  semanticResolutionDir: string;
  parserIdentity: { id: string; hash: string };
  resolutionRunId: string;
}): {
  receipts: SemanticResolutionReceipt[];
  receiptFileNames: string[];
  resolvedSourceRoots: Record<string, unknown>;
} {
  const extractionsByPath = new Map<string, TrustedSourceExtraction[]>();
  const contentByPath = new Map<string, string>();
  const candidateFacts = input.sourceRoots.map((root) => {
    const fieldRef = `/resolvedSourceRoots/${jsonPointerSegment(root.sourceRootId)}`;
    const excerpt = exactSourceExcerpt(root.sourceContent, root.sourceSpan);
    const extractionPayload = {
      fieldRef,
      sourceSpan: root.sourceSpan,
      excerptHash: sha256Text(excerpt),
      valueHash: sha256Stable(root.semanticBody),
      parserId: input.parserIdentity.id,
      parserHash: input.parserIdentity.hash,
    };
    const extraction = {
      ...extractionPayload,
      observationHash: sha256Stable(extractionPayload),
    };
    const existingContent = contentByPath.get(root.sourcePath);
    if (existingContent !== undefined && existingContent !== root.sourceContent) {
      throw new Error(`Semantic source path has conflicting content: ${root.sourcePath}`);
    }
    contentByPath.set(root.sourcePath, root.sourceContent);
    extractionsByPath.set(root.sourcePath, [
      ...(extractionsByPath.get(root.sourcePath) ?? []),
      extraction,
    ]);
    return { root, fieldRef, excerpt };
  });
  const trustedSourceSnapshots: Record<string, TrustedSourceSnapshot> = {};
  for (const [sourcePathValue, content] of contentByPath) {
    trustedSourceSnapshots[sourcePathValue] = {
      content,
      hash: sha256Text(content),
      extractions: extractionsByPath.get(sourcePathValue) ?? [],
    };
  }

  let sourceModelBefore: Record<string, unknown> = { resolvedSourceRoots: {} };
  const receipts: SemanticResolutionReceipt[] = [];
  const receiptFileNames: string[] = [];
  for (const [index, fact] of candidateFacts.entries()) {
    const result = resolveSemanticField(
      {
        resolutionId: `SOURCE-RESOLUTION-${String(index + 1).padStart(3, '0')}`,
        fieldRef: fact.fieldRef,
        value: fact.root.semanticBody,
        semanticKind: fact.root.rootClass,
        resolutionAuthorityClass: 'source_extracted',
        premises: [
          {
            kind: 'source',
            sourcePath: fact.root.sourcePath,
            sourceSpan: fact.root.sourceSpan,
            excerpt: fact.excerpt,
            hash: sha256Text(fact.root.sourceContent),
          },
        ],
        derivationRule: null,
        applicabilityProof: null,
        conflictingCandidates: [],
      },
      {
        trustedSourceSnapshots,
        trustedInvocationContext: {
          resolverId: 'requirements-contract-production-semantic-resolver',
          resolutionRunId: input.resolutionRunId,
          sourceModelBefore,
        },
      }
    );
    if (result.status !== 'authorized' || !result.receipt) {
      throw new Error(
        `Semantic Source Root resolution blocked: ${fact.root.sourceRootId}:${result.reasonCode}`
      );
    }
    const nextModel = applySemanticFieldValue(
      sourceModelBefore,
      fact.fieldRef,
      fact.root.semanticBody
    );
    if (!nextModel || typeof nextModel !== 'object' || Array.isArray(nextModel)) {
      throw new Error(`Semantic Source Root application failed: ${fact.root.sourceRootId}`);
    }
    sourceModelBefore = nextModel as Record<string, unknown>;
    receipts.push(result.receipt);
    const receiptFileName = `${String(index + 1).padStart(
      3,
      '0'
    )}-${fact.root.sourceRootId.toLowerCase()}.receipt.json`;
    receiptFileNames.push(receiptFileName);
    persistValidatedJson(
      path.join(input.semanticResolutionDir, receiptFileName),
      result.receipt,
      validateSemanticResolutionReceipt
    );
  }
  return {
    receipts,
    receiptFileNames,
    resolvedSourceRoots:
      (sourceModelBefore.resolvedSourceRoots as Record<string, unknown> | undefined) ?? {},
  };
}

function validateSemanticResolutionReceiptInventory(input: {
  semanticResolutionDir: string;
  receiptFileNames: string[];
  receipts: SemanticResolutionReceipt[];
}): void {
  if (input.receiptFileNames.length !== input.receipts.length) {
    throw new Error('Semantic resolution Receipt filename and payload counts do not match');
  }
  const expectedFileNames = [...input.receiptFileNames].sort();
  const actualFileNames = readdirSync(input.semanticResolutionDir).sort();
  if (
    actualFileNames.length !== expectedFileNames.length ||
    expectedFileNames.some((fileName, index) => fileName !== actualFileNames[index])
  ) {
    throw new Error('Semantic resolution receipt inventory mismatch');
  }
  for (const [index, fileName] of input.receiptFileNames.entries()) {
    const readback = readJson(path.join(input.semanticResolutionDir, fileName));
    if (
      !validateSemanticResolutionReceipt(readback) ||
      sha256Stable(readback) !== sha256Stable(input.receipts[index])
    ) {
      throw new Error(`Semantic resolution Receipt readback mismatch: ${fileName}`);
    }
  }
}

function validateSemanticBundleReadback(input: {
  semanticIrPath: string;
  semanticResolutionDir: string;
  interactionResolutionPath: string;
  lifecycleValidationReportPath: string;
  semanticConservationManifestPath: string;
  semanticIr: RequirementContractModelV2;
  lifecycleValidationReport: RequirementsContractLifecycleValidationReport;
  receiptFileNames: string[];
  receipts: SemanticResolutionReceipt[];
  interactionResolution: Record<string, unknown>;
  manifest: RequirementsContractSemanticConservationManifest;
}): void {
  validateSemanticResolutionReceiptInventory(input);
  const semanticIrReadback = readJson(input.semanticIrPath);
  if (
    !validateRequirementContractModelV2(semanticIrReadback).ok ||
    sha256Stable(semanticIrReadback) !== sha256Stable(input.semanticIr)
  ) {
    throw new Error('Canonical Semantic IR readback mismatch');
  }
  const interactionResolutionReadback = readJson(input.interactionResolutionPath);
  if (sha256Stable(interactionResolutionReadback) !== sha256Stable(input.interactionResolution)) {
    throw new Error('Interaction Resolution readback mismatch');
  }
  const lifecycleValidationReadback = readJson(input.lifecycleValidationReportPath);
  if (
    !validateRequirementsContractLifecycleValidationReport(lifecycleValidationReadback) ||
    sha256Stable(lifecycleValidationReadback) !== sha256Stable(input.lifecycleValidationReport)
  ) {
    throw new Error('Lifecycle Validation Report readback mismatch');
  }
  const manifestReadback = readJson(input.semanticConservationManifestPath);
  if (
    !validateRequirementsContractSemanticConservationManifest(manifestReadback) ||
    sha256Stable(manifestReadback) !== sha256Stable(input.manifest)
  ) {
    throw new Error('Semantic Conservation Manifest readback mismatch');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function resolvedSourceRootsFromSemanticModel(input: {
  sourceRoots: ProductionSemanticSourceRoot[];
  resolvedSourceRoots: Record<string, unknown>;
}): ProductionSemanticSourceRoot[] {
  const expectedIds = [...input.sourceRoots.map((root) => root.sourceRootId)].sort();
  const actualIds = Object.keys(input.resolvedSourceRoots).sort();
  if (
    expectedIds.length !== actualIds.length ||
    expectedIds.some((sourceRootId, index) => sourceRootId !== actualIds[index])
  ) {
    throw new Error('Semantic resolution did not produce the exact Source Root set');
  }
  return input.sourceRoots.map((root) => {
    const semanticBody = input.resolvedSourceRoots[root.sourceRootId];
    if (!isRecord(semanticBody)) {
      throw new Error(`Resolved Semantic Source Root is malformed: ${root.sourceRootId}`);
    }
    return {
      ...root,
      semanticBody,
    };
  });
}

function jsonPointerValue(model: Record<string, unknown>, fieldRef: string): unknown {
  const segments = fieldRef
    .split('/')
    .slice(1)
    .map((segment) => segment.replace(/~1/gu, '/').replace(/~0/gu, '~'));
  let current: unknown = model;
  for (const segment of segments) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function resolvedInteractionFieldRefs(sequenceModel: Record<string, unknown>): string[] {
  const resolvedInteractions = sequenceModel.resolvedInteractions;
  if (!isRecord(resolvedInteractions)) return [];
  const fieldRefs: string[] = [];
  for (const [interactionKind, rawEntries] of Object.entries(resolvedInteractions)) {
    if (!isRecord(rawEntries)) {
      throw new Error(`Resolved interaction kind is malformed: ${interactionKind}`);
    }
    for (const sourceRootId of Object.keys(rawEntries)) {
      fieldRefs.push(
        `/resolvedInteractions/${jsonPointerSegment(interactionKind)}/${jsonPointerSegment(
          sourceRootId
        )}`
      );
    }
  }
  return fieldRefs.sort();
}

function sourceRootsFromInteractionResolution(input: {
  sourceRoots: ProductionSemanticSourceRoot[];
  extractedCandidates: InteractionResolutionCandidate[];
  interactionResult: ReturnType<typeof resolveInteractionCandidates>;
}): ProductionSemanticSourceRoot[] {
  const expectedFieldRefs = input.extractedCandidates.map((candidate) => candidate.fieldRef).sort();
  const authorizedFieldRefs = input.interactionResult.authorized
    .map((candidate) => candidate.fieldRef)
    .sort();
  const actualFieldRefs = resolvedInteractionFieldRefs(input.interactionResult.sequenceModelAfter);
  if (
    expectedFieldRefs.length !== authorizedFieldRefs.length ||
    expectedFieldRefs.some((fieldRef, index) => fieldRef !== authorizedFieldRefs[index]) ||
    expectedFieldRefs.length !== actualFieldRefs.length ||
    expectedFieldRefs.some((fieldRef, index) => fieldRef !== actualFieldRefs[index])
  ) {
    throw new Error('Interaction resolution did not produce the exact source-derived field set');
  }
  const candidateBySourceRootId = new Map<string, InteractionResolutionCandidate>();
  for (const candidate of input.extractedCandidates) {
    if (!isRecord(candidate.value) || typeof candidate.value.id !== 'string') {
      throw new Error(
        `Resolved interaction candidate has no Source Root ID: ${candidate.fieldRef}`
      );
    }
    candidateBySourceRootId.set(candidate.value.id, candidate);
  }
  return input.sourceRoots.map((root) => {
    const candidate = candidateBySourceRootId.get(root.sourceRootId);
    if (!candidate) return root;
    const semanticBody = jsonPointerValue(
      input.interactionResult.sequenceModelAfter,
      candidate.fieldRef
    );
    if (!isRecord(semanticBody)) {
      throw new Error(`Resolved interaction Source Root is malformed: ${root.sourceRootId}`);
    }
    return {
      ...root,
      semanticBody,
    };
  });
}

function resolvedSourceRootProjection(sourceRoots: ProductionSemanticSourceRoot[]): Array<{
  sourceRootId: string;
  rootClass: string;
  nodeType: ProductionSemanticNodeType;
  bodySchemaVersion: string;
  bodyHash: string;
  authorityClass: string;
  relatedRequirementRefs: string[];
}> {
  return sourceRoots
    .map((root) => ({
      sourceRootId: root.sourceRootId,
      rootClass: root.rootClass,
      nodeType: root.nodeType,
      bodySchemaVersion: root.bodySchemaVersion,
      bodyHash: sha256Stable(root.semanticBody),
      authorityClass: root.authorityClass,
      relatedRequirementRefs: [...(root.relatedRequirementRefs ?? [])].sort(),
    }))
    .sort((left, right) => left.sourceRootId.localeCompare(right.sourceRootId));
}

function buildCanonicalSemanticIr(input: {
  recordId: string;
  requirementSetId: string;
  sourceAuthorityHash: string;
  sourceRoots: ProductionSemanticSourceRoot[];
}): RequirementContractModelV2 {
  const semanticBodies: Record<string, Record<string, unknown>> = {};
  const nodes: RequirementContractModelV2['nodes'] = {};
  const proofRefByRootId = new Map<string, string>();
  input.sourceRoots.forEach((root, index) => {
    const bodyHash = sha256Stable(root.semanticBody);
    const proofRef = sourceSpanRef(index);
    semanticBodies[bodyHash] = root.semanticBody;
    proofRefByRootId.set(root.sourceRootId, proofRef);
    nodes[root.sourceRootId] = {
      nodeType: root.nodeType,
      bodySchemaVersion: root.bodySchemaVersion,
      bodyHash,
      applicability: {
        decision: 'applicable',
        reasonCode: 'source_authorized',
        proofRefs: [proofRef],
      },
      proofBindings: [proofRef],
    };
  });

  const edges: RequirementContractModelV2['edges'] = {};
  let edgeIndex = 0;
  for (const root of input.sourceRoots) {
    for (const requirementRef of root.relatedRequirementRefs ?? []) {
      if (!nodes[requirementRef] || requirementRef === root.sourceRootId) continue;
      const fromRef = requirementRef;
      const toRef = root.sourceRootId;
      const proofBindings = [proofRefByRootId.get(fromRef), proofRefByRootId.get(toRef)].filter(
        (value): value is string => Boolean(value)
      );
      const edgePreimage = {
        edgeType: edgeTypeFor(root.nodeType),
        fromRef,
        fromHash: nodes[fromRef].bodyHash,
        toRef,
        toHash: nodes[toRef].bodyHash,
        applicability: {
          decision: 'applicable' as const,
          reasonCode: 'source_authorized' as const,
          proofRefs: proofBindings,
        },
        proofBindings,
      };
      edgeIndex += 1;
      edges[`EDGE-${String(edgeIndex).padStart(3, '0')}`] = {
        ...edgePreimage,
        edgeHash: sha256Stable(edgePreimage),
      };
    }
  }

  const preimage = {
    schemaVersion: 'requirement-contract-model/v2' as const,
    activationState: 'inactive_schema_boundary' as const,
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    sourceAuthorityHash: input.sourceAuthorityHash,
    edgeTypeRegistryHash: requirementsContractTraceEdgeTypeRegistryHash(),
    authority: 'none' as const,
    semanticBodies,
    nodes,
    edges,
  };
  const semanticIr = {
    ...preimage,
    semanticModelHash: semanticModelHashForContract(canonicalModelPreimage(preimage)),
  };
  const validation = validateRequirementContractModelV2(semanticIr);
  if (!validation.ok) {
    throw new Error(
      `Generated Canonical Semantic IR failed schema or hash validation: ${JSON.stringify(
        validation.issues
      )}`
    );
  }
  return semanticIr;
}

export function runRequirementsContractProductionSemanticPipeline(input: {
  projectRoot: string;
  recordId: string;
  requirementSetId: string;
  intakeReceiptPath: string;
  intakeReceipt: Record<string, unknown>;
  intentLineageLedgerPath: string;
  intentLineageLedger: Record<string, unknown>;
  invocationAuthorityReceiptPath?: string;
  invocationAuthorityReceipt?: RequirementsContractInvocationAuthorityReceipt;
  sourceRootCandidates: ProductionSemanticSourceRootCandidate[];
  semanticIrPath: string;
  semanticResolutionDir: string;
  interactionResolutionPath: string;
  semanticConservationManifestPath: string;
  interactionCandidates?: InteractionResolutionCandidate[];
}): ProductionSemanticPipelineResult {
  const lifecycleValidationReportPath = path.join(
    path.dirname(input.semanticConservationManifestPath),
    'confirmation-ready-validation-report.json'
  );
  if (
    !statSync(input.intakeReceiptPath).isFile() ||
    !statSync(input.intentLineageLedgerPath).isFile()
  ) {
    throw new Error('Semantic pipeline requires Intake Receipt and Intent Lineage files');
  }
  const hasInvocationReceiptPath = Boolean(input.invocationAuthorityReceiptPath);
  const hasInvocationReceipt = Boolean(input.invocationAuthorityReceipt);
  if (hasInvocationReceiptPath !== hasInvocationReceipt) {
    throw new Error('Invocation Authority Receipt path and payload must be provided together');
  }
  if (
    input.invocationAuthorityReceiptPath &&
    input.invocationAuthorityReceipt &&
    (!statSync(input.invocationAuthorityReceiptPath).isFile() ||
      !validateRequirementsContractInvocationAuthorityReceipt(input.invocationAuthorityReceipt))
  ) {
    throw new Error('Semantic pipeline requires a valid Invocation Authority Receipt');
  }
  const sourceRoots = materializeProductionSemanticSourceRoots({
    requirementSetId: input.requirementSetId,
    intakeReceipt: input.intakeReceipt,
    intentLineageLedger: input.intentLineageLedger,
    sourceRootCandidates: input.sourceRootCandidates,
  });
  const parserIdentity = fileIdentity(
    'requirements-contract-production-source-root-parser',
    canonicalModulePath('requirements-contract-production-semantic-pipeline')
  );
  const intakeBindingHash = intakeAuthorityBindingHash(input.intakeReceipt);
  const lineageBindingHash = intentLineageAuthorityBindingHash(
    input.intentLineageLedger,
    intakeBindingHash
  );
  const inputSourceAuthorityHash = sha256Stable({
    requirementSetId: input.requirementSetId,
    intakeAuthorityBindingHash: intakeBindingHash,
    intentLineageAuthorityBindingHash: lineageBindingHash,
    invocationAuthorityBindingHash: input.invocationAuthorityReceipt
      ? requirementsContractInvocationAuthorityBindingHash(input.invocationAuthorityReceipt)
      : null,
    sourceRoots: sourceRoots.map((root) => ({
      sourceRootId: root.sourceRootId,
      rootClass: root.rootClass,
      sourcePath: root.sourcePath,
      sourceSpan: root.sourceSpan,
      payloadHash: sha256Stable(root.semanticBody),
      authorityClass: root.authorityClass,
    })),
  });
  const resolutionRunId = `semantic-resolution-${sha256Stable({
    requirementSetId: input.requirementSetId,
    sourceAuthorityHash: inputSourceAuthorityHash,
  }).slice('sha256:'.length, 'sha256:'.length + 24)}`;
  const staging = createSemanticBundleStaging({
    semanticIrPath: input.semanticIrPath,
    semanticResolutionDir: input.semanticResolutionDir,
    interactionResolutionPath: input.interactionResolutionPath,
    lifecycleValidationReportPath,
    semanticConservationManifestPath: input.semanticConservationManifestPath,
  });
  try {
    const resolution = semanticResolutionReceipts({
      sourceRoots,
      semanticResolutionDir: staging.semanticResolutionDir,
      parserIdentity,
      resolutionRunId,
    });
    if (Object.keys(resolution.resolvedSourceRoots).length !== sourceRoots.length) {
      throw new Error('Semantic resolution did not conserve the complete Source Root inventory');
    }
    const sourceResolvedRoots = resolvedSourceRootsFromSemanticModel({
      sourceRoots,
      resolvedSourceRoots: resolution.resolvedSourceRoots,
    });

    const interactionExtraction = extractProductionInteractionCandidates({
      sourceRoots: sourceResolvedRoots,
    });
    const interactionResult = resolveInteractionCandidates({
      sequenceModelBefore: {
        schemaVersion: 'requirements-contract-sequence-contract/v1',
        resolvedInteractions: {},
      },
      candidates: [...interactionExtraction.candidates, ...(input.interactionCandidates ?? [])],
      trustedInvocationContext: {
        resolverId: 'requirements-contract-interaction-resolver',
        resolutionRunId,
      },
      trustedSourceSnapshots: interactionExtraction.trustedSourceSnapshots,
    });
    const interactionResolutionBase = {
      resolverId: 'requirements-contract-interaction-resolver',
      resolutionRunId,
      candidateExtractor: interactionExtraction.extractor,
      extractedCandidateCount: interactionExtraction.candidates.length,
      ...interactionResult,
      unresolved: [...interactionExtraction.unresolved, ...interactionResult.unresolved],
    };
    if (interactionResolutionBase.unresolved.length > 0) {
      persistValidatedJson(
        staging.interactionResolutionPath,
        interactionResolutionBase,
        (candidate) => sha256Stable(candidate) === sha256Stable(interactionResolutionBase)
      );
      const reasonCodes = [
        ...new Set(interactionResolutionBase.unresolved.map((item) => item.reasonCode)),
      ].sort();
      throw new Error(`Interaction semantic resolution blocked: ${reasonCodes.join(', ')}`);
    }
    const resolvedSourceRoots = sourceRootsFromInteractionResolution({
      sourceRoots: sourceResolvedRoots,
      extractedCandidates: interactionExtraction.candidates,
      interactionResult,
    });
    const semanticResolutionReceiptSetHash = sha256Stable(
      resolution.receipts.map((receipt) => receipt.receiptHash).sort()
    );
    const semanticResolutionBindingSetHash = sha256Stable(
      resolution.receipts.map(semanticResolutionAuthorityBindingHash).sort()
    );
    const interactionReceiptHashes = interactionResult.authorized.map((authorized) => {
      const receiptHash =
        authorized.semanticResolutionReceipt?.receiptHash ??
        authorized.decisionReceipt?.receiptHash;
      if (!receiptHash) {
        throw new Error(`Authorized interaction has no authority Receipt: ${authorized.fieldRef}`);
      }
      return receiptHash;
    });
    const interactionResolutionReceiptSetHash = sha256Stable(interactionReceiptHashes.sort());
    const resolvedSourceRootSetHash = sha256Stable(
      resolvedSourceRootProjection(resolvedSourceRoots)
    );
    const canonicalSemanticAuthorityBindingPreimage = {
      inputSourceAuthorityHash,
      semanticResolutionBindingSetHash,
      interactionResolutionReceiptSetHash,
      sequenceModelHashAfter: interactionResult.sequenceModelHashAfter,
      resolvedSourceRootSetHash,
    };
    const canonicalSemanticAuthority = {
      inputSourceAuthorityHash,
      semanticResolutionReceiptSetHash,
      semanticResolutionBindingSetHash,
      interactionResolutionReceiptSetHash,
      sequenceModelHashAfter: interactionResult.sequenceModelHashAfter,
      resolvedSourceRootSetHash,
      authorityHash: sha256Stable(canonicalSemanticAuthorityBindingPreimage),
    };
    const interactionResolution = {
      ...interactionResolutionBase,
      canonicalSemanticAuthority,
    };
    persistValidatedJson(
      staging.interactionResolutionPath,
      interactionResolution,
      (candidate) => sha256Stable(candidate) === sha256Stable(interactionResolution)
    );
    const sourceAuthorityHash = canonicalSemanticAuthority.authorityHash;

    const semanticIr = buildCanonicalSemanticIr({
      recordId: input.recordId,
      requirementSetId: input.requirementSetId,
      sourceAuthorityHash,
      sourceRoots: resolvedSourceRoots,
    });
    persistValidatedJson(
      staging.semanticIrPath,
      semanticIr,
      (candidate) => validateRequirementContractModelV2(candidate).ok
    );
    const validationFacadeIdentity = fileIdentity(
      'requirements-contract-validation-facade',
      canonicalModulePath('requirements-contract-validation-facade')
    );
    const lifecycleValidationReport =
      createRequirementsContractLifecycleValidationReport({
        candidate: semanticIr,
        mode: 'confirmation-ready',
        requirementSetId: input.requirementSetId,
        semanticModelHash: semanticIr.semanticModelHash,
        facade: validationFacadeIdentity,
      });
    persistValidatedJson(
      staging.lifecycleValidationReportPath,
      lifecycleValidationReport,
      validateRequirementsContractLifecycleValidationReport
    );
    if (!lifecycleValidationReport.ok) {
      throw new Error(
        `Validation Facade blocked Canonical Semantic IR: ${lifecycleValidationReport.issues
          .map((issue) => issue.code)
          .join(', ')}`
      );
    }

    const semanticNodes = resolvedSourceRoots.map((root, index) => ({
      order: index + 1,
      nodeId: root.sourceRootId,
      nodeHash: semanticIr.nodes[root.sourceRootId].bodyHash,
      authorityClass: root.authorityClass,
      authorityBearing: true as const,
    }));
    const manifest = createRequirementsContractSemanticConservationManifest({
      requirementSetId: input.requirementSetId,
      intakeReceiptPath: path
        .relative(input.projectRoot, input.intakeReceiptPath)
        .replace(/\\/gu, '/'),
      intakeReceiptHash: String(input.intakeReceipt.receiptHash),
      intentLineageLedgerPath: path
        .relative(input.projectRoot, input.intentLineageLedgerPath)
        .replace(/\\/gu, '/'),
      intentLineageLedgerHash: String(input.intentLineageLedger.ledgerHash),
      sourceRootClassRegistryHash: SOURCE_ROOT_CLASS_REGISTRY_HASH,
      sourceRoots: resolvedSourceRoots.map((root, index) => ({
        order: index + 1,
        sourceRootId: root.sourceRootId,
        rootClass: root.rootClass,
        sourceSpanRefs: [sourceSpanRef(index)],
        payloadHash: semanticIr.nodes[root.sourceRootId].bodyHash,
        authorityClass: root.authorityClass,
      })),
      semanticNodes,
      rootToNodeMappings: resolvedSourceRoots.map((root) => ({
        sourceRootId: root.sourceRootId,
        nodeId: root.sourceRootId,
      })),
      nodeToAuthorityMappings: resolvedSourceRoots.map((root) => ({
        nodeId: root.sourceRootId,
        authoritySource: {
          kind: 'source_root' as const,
          sourceRootId: root.sourceRootId,
        },
      })),
      decisionReceipts: interactionResult.authorized
        .map((authorized) => authorized.decisionReceipt)
        .filter(
          (
            receipt
          ): receipt is NonNullable<
            (typeof interactionResult.authorized)[number]['decisionReceipt']
          > => Boolean(receipt)
        ),
      unresolvedRootIds: [],
      semanticModelHash: semanticIr.semanticModelHash,
      canonicalRenderer: fileIdentity(
        'requirements-contract-production-semantic-pipeline',
        canonicalModulePath('requirements-contract-production-semantic-pipeline')
      ),
      parser: parserIdentity,
      ruleRegistry: fileIdentity(
        'requirements-contract-semantic-resolver',
        canonicalModulePath('requirements-contract-semantic-resolver')
      ),
      lintProfileRegistry: fileIdentity(
        'lint-requirements-contract-source-prd',
        canonicalModulePath('lint-requirements-contract-source-prd')
      ),
      validationFacade: validationFacadeIdentity,
      schemaHashes: [
        fileIdentity(CANONICAL_MODEL_SCHEMA, schemaPath(CANONICAL_MODEL_SCHEMA)),
        fileIdentity(SEMANTIC_RESOLUTION_SCHEMA, schemaPath(SEMANTIC_RESOLUTION_SCHEMA)),
        fileIdentity(SEMANTIC_CONSERVATION_SCHEMA, schemaPath(SEMANTIC_CONSERVATION_SCHEMA)),
        fileIdentity(
          input.intakeReceipt.schemaVersion === 'requirements-contract-file-intake-receipt/v1'
            ? FILE_INTAKE_SCHEMA
            : SESSION_INTAKE_SCHEMA,
          schemaPath(
            input.intakeReceipt.schemaVersion === 'requirements-contract-file-intake-receipt/v1'
              ? FILE_INTAKE_SCHEMA
              : SESSION_INTAKE_SCHEMA
          )
        ),
        ...(input.invocationAuthorityReceipt
          ? [fileIdentity(INVOCATION_AUTHORITY_SCHEMA, schemaPath(INVOCATION_AUTHORITY_SCHEMA))]
          : []),
      ],
      sourceAuthorityHash,
    });
    persistValidatedJson(
      staging.semanticConservationManifestPath,
      manifest,
      validateRequirementsContractSemanticConservationManifest
    );

    const bundleValidation = {
      semanticIr,
      lifecycleValidationReport,
      receiptFileNames: resolution.receiptFileNames,
      receipts: resolution.receipts,
      interactionResolution,
      manifest,
    };
    validateSemanticBundleReadback({
      semanticIrPath: staging.semanticIrPath,
      semanticResolutionDir: staging.semanticResolutionDir,
      interactionResolutionPath: staging.interactionResolutionPath,
      lifecycleValidationReportPath: staging.lifecycleValidationReportPath,
      semanticConservationManifestPath: staging.semanticConservationManifestPath,
      ...bundleValidation,
    });
    promoteSemanticBundle({
      stagingRoot: staging.root,
      entries: [
        {
          kind: 'directory',
          stagedPath: staging.semanticResolutionDir,
          targetPath: input.semanticResolutionDir,
        },
        {
          kind: 'file',
          stagedPath: staging.interactionResolutionPath,
          targetPath: input.interactionResolutionPath,
        },
        {
          kind: 'file',
          stagedPath: staging.lifecycleValidationReportPath,
          targetPath: lifecycleValidationReportPath,
        },
        {
          kind: 'file',
          stagedPath: staging.semanticIrPath,
          targetPath: input.semanticIrPath,
        },
        {
          kind: 'file',
          stagedPath: staging.semanticConservationManifestPath,
          targetPath: input.semanticConservationManifestPath,
        },
      ],
      validatePublished: () =>
        validateSemanticBundleReadback({
          semanticIrPath: input.semanticIrPath,
          semanticResolutionDir: input.semanticResolutionDir,
          interactionResolutionPath: input.interactionResolutionPath,
          lifecycleValidationReportPath,
          semanticConservationManifestPath: input.semanticConservationManifestPath,
          ...bundleValidation,
        }),
    });
    return {
      sourceRoots,
      semanticIr,
      lifecycleValidationReport,
      semanticResolutionReceipts: resolution.receipts,
      interactionResolution,
      semanticConservationManifest: manifest,
    };
  } finally {
    cleanupSemanticBundleStaging(staging.root);
  }
}
