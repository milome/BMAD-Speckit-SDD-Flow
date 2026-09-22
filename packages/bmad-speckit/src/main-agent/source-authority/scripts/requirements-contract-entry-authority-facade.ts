import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import {
  createRequirementsContractIntakeReceipt,
  type RequirementsContractIntakeReceipt,
  validateRequirementsContractIntakeReceipt,
} from './requirements-contract-intake-receipt';
import {
  createRequirementsContractFileIntakeReceiptV2,
  type FileIntakeEntrySource,
  type RequirementsContractFileIntakeReceiptV2,
  validateRequirementsContractFileIntakeReceipt,
} from './requirements-contract-file-intake-receipt';
import {
  createRequirementsContractInvocationAuthorityReceipt,
  type InvocationAuthorityEntrySource,
  type RequirementsContractInvocationAuthorityReceipt,
  validateRequirementsContractInvocationAuthorityReceipt,
} from './requirements-contract-invocation-authority-receipt';
import {
  createRequirementsContractIntentLineageLedger,
  createRequirementsContractIntentLineageLedgerV2,
  deriveIntentLineageExcludedRanges,
  type RequirementsContractIntentLineageLedger,
  type RequirementsContractIntentLineageLedgerV2,
  validateRequirementsContractIntentLineageLedger,
} from './requirements-contract-intent-lineage';
import { writeJsonAtomic } from './requirement-record-control-store';
import { sha256Stable, sha256Text } from './requirements-contract-semantic-resolver';

export interface CanonicalUtf8SourceSnapshot {
  sourcePath: string;
  sourceText: string;
  sourceHash: string;
}

export interface SessionEntryIdentity {
  sessionId: string;
  turnId: string;
  messageId: string;
  actorIdentityClass: string;
  branch: string;
  capturedAt: string;
}

export interface SessionEntryIntakeAuthority {
  source: CanonicalUtf8SourceSnapshot;
  intakeReceiptPath: string;
  intakeReceipt: RequirementsContractIntakeReceipt;
}

export interface FileEntryIntakeAuthority {
  source: CanonicalUtf8SourceSnapshot;
  recordRoot: string;
  intakeReceiptPath: string;
  intakeReceipt: RequirementsContractFileIntakeReceiptV2;
}

export type EntryIntakeAuthority = SessionEntryIntakeAuthority | FileEntryIntakeAuthority;

function isFileEntryIntakeAuthority(
  authority: EntryIntakeAuthority
): authority is FileEntryIntakeAuthority {
  return authority.intakeReceipt.schemaVersion === 'requirements-contract-file-intake-receipt/v2';
}

export interface InvocationEntryAuthority {
  source: CanonicalUtf8SourceSnapshot;
  receiptPath: string;
  receipt: RequirementsContractInvocationAuthorityReceipt;
}

export interface EntryLineageSourceRoot {
  sourceRootId: string;
  sourcePath: string;
  sourceSpan: {
    startLine: number;
    endLine: number;
  };
  authorityClass: string;
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required for session entry authority`);
  return normalized;
}

function normalizedRelativePath(root: string, filePath: string): string {
  const relative = path.relative(root, filePath).replace(/\\/gu, '/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error('Entry authority artifact must remain inside the project root');
  }
  return relative;
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
}

function persistValidatedArtifact<T>(
  filePath: string,
  value: T,
  validate: (candidate: unknown) => boolean,
  expectedIdentityHash: string
): T {
  writeJsonAtomic(filePath, value);
  const readback = readJson(filePath);
  if (!validate(readback) || sha256Stable(readback) !== expectedIdentityHash) {
    throw new Error(`Entry authority artifact readback failed: ${filePath}`);
  }
  return readback as T;
}

function reusableCapturedAuthorityArtifact<T extends object>(
  filePath: string,
  candidate: T,
  validate: (value: unknown) => boolean
): T | null {
  let existing: unknown;
  try {
    existing = readJson(filePath);
  } catch {
    return null;
  }
  if (!validate(existing) || !existing || typeof existing !== 'object' || Array.isArray(existing)) {
    return null;
  }
  const withoutCaptureIdentity = (value: object): Record<string, unknown> => {
    const { capturedAt: _capturedAt, receiptHash: _receiptHash, ...identity } =
      value as Record<string, unknown>;
    return identity;
  };
  const existingRecord = existing as object;
  return sha256Stable(withoutCaptureIdentity(existingRecord)) ===
    sha256Stable(withoutCaptureIdentity(candidate))
    ? (existing as T)
    : null;
}

function reusableFileIntakeReceipt(
  filePath: string,
  candidate: RequirementsContractFileIntakeReceiptV2
): RequirementsContractFileIntakeReceiptV2 | null {
  let existing: unknown;
  try {
    existing = readJson(filePath);
  } catch {
    return null;
  }
  if (
    !validateRequirementsContractFileIntakeReceipt(existing) ||
    !existing ||
    typeof existing !== 'object' ||
    Array.isArray(existing) ||
    (existing as RequirementsContractFileIntakeReceiptV2).schemaVersion !==
      'requirements-contract-file-intake-receipt/v2'
  ) {
    return null;
  }
  const current = existing as RequirementsContractFileIntakeReceiptV2;
  if (
    current.requirementSetId !== candidate.requirementSetId ||
    current.entrySource !== candidate.entrySource ||
    current.requestedArtifactRole !== candidate.requestedArtifactRole ||
    current.sourcePath !== candidate.sourcePath ||
    current.sourceBytesHash !== candidate.sourceBytesHash ||
    current.sourceByteLength !== candidate.sourceByteLength ||
    current.sourceBlobRef.contentHash !== candidate.sourceBlobRef.contentHash
  ) {
    return null;
  }
  return current;
}

export function readCanonicalUtf8Source(sourcePath: string): CanonicalUtf8SourceSnapshot {
  const resolved = realpathSync.native(path.resolve(sourcePath));
  if (!statSync(resolved).isFile()) throw new Error('Session entry source must be a regular file');
  const bytes = readFileSync(resolved);
  const sourceText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (!sourceText.trim()) throw new Error('Session entry source must not be empty');
  return {
    sourcePath: resolved,
    sourceText,
    sourceHash: sha256Text(sourceText),
  };
}

interface SessionLineExcerpt {
  order: number;
  excerptId: string;
  turnId: string;
  boundary: {
    kind: 'span';
    messageId: string;
    startUtf8Byte: number;
    endUtf8ByteExclusive: number;
  };
}

function sessionLineExcerpts(input: {
  messageId: string;
  turnId: string;
  sourceText: string;
}): SessionLineExcerpt[] {
  const excerpts: SessionLineExcerpt[] = [];
  const pattern = /[^\r\n]*(?:\r\n|\n|\r|$)/gu;
  let startUtf8Byte = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input.sourceText)) !== null) {
    const content = match[0];
    if (!content) break;
    const order = excerpts.length + 1;
    const endUtf8ByteExclusive = startUtf8Byte + Buffer.byteLength(content, 'utf8');
    excerpts.push({
      order,
      excerptId: `excerpt-${sha256Stable({
        messageId: input.messageId,
        turnId: input.turnId,
        startUtf8Byte,
        endUtf8ByteExclusive,
        contentHash: sha256Text(content),
      }).slice('sha256:'.length, 'sha256:'.length + 24)}`,
      turnId: input.turnId,
      boundary: {
        kind: 'span' as const,
        messageId: input.messageId,
        startUtf8Byte,
        endUtf8ByteExclusive,
      },
    });
    startUtf8Byte = endUtf8ByteExclusive;
  }
  if (
    excerpts.length === 0 ||
    startUtf8Byte !== Buffer.byteLength(input.sourceText, 'utf8')
  ) {
    throw new Error('Session Intake excerpts do not cover the complete source bytes');
  }
  return excerpts;
}

export function materializeSessionEntryIntake(input: {
  projectRoot: string;
  requirementSetId: string;
  source: CanonicalUtf8SourceSnapshot;
  identity: SessionEntryIdentity;
  intakeReceiptPath: string;
}): SessionEntryIntakeAuthority {
  const identity = {
    sessionId: nonEmpty(input.identity.sessionId, 'sessionId'),
    turnId: nonEmpty(input.identity.turnId, 'turnId'),
    messageId: nonEmpty(input.identity.messageId, 'messageId'),
    actorIdentityClass: nonEmpty(input.identity.actorIdentityClass, 'actorIdentityClass'),
    branch: nonEmpty(input.identity.branch, 'branch'),
    capturedAt: nonEmpty(input.identity.capturedAt, 'capturedAt'),
  };
  if (Number.isNaN(Date.parse(identity.capturedAt))) {
    throw new Error('capturedAt must be an ISO-8601 timestamp');
  }
  const receipt = createRequirementsContractIntakeReceipt({
    requirementSetId: nonEmpty(input.requirementSetId, 'requirementSetId'),
    sessionId: identity.sessionId,
    branch: identity.branch,
    requestedArtifactRole: 'requirement_source_prd',
    capturedAt: identity.capturedAt,
    messages: [
      {
        messageId: identity.messageId,
        turnId: identity.turnId,
        actorIdentityClass: identity.actorIdentityClass,
        content: input.source.sourceText,
      },
    ],
    excerpts: sessionLineExcerpts({
      messageId: identity.messageId,
      turnId: identity.turnId,
      sourceText: input.source.sourceText,
    }),
  });
  const intakeReceipt = persistValidatedArtifact(
    input.intakeReceiptPath,
    receipt,
    validateRequirementsContractIntakeReceipt,
    sha256Stable(receipt)
  );
  return {
    source: input.source,
    intakeReceiptPath: normalizedRelativePath(input.projectRoot, input.intakeReceiptPath),
    intakeReceipt,
  };
}

export function materializeFileEntryIntake(input: {
  projectRoot: string;
  recordRoot: string;
  requirementSetId: string;
  entrySource: FileIntakeEntrySource;
  source: CanonicalUtf8SourceSnapshot;
  capturedAt: string;
  intakeReceiptPath: string;
}): FileEntryIntakeAuthority {
  const receipt = createRequirementsContractFileIntakeReceiptV2({
    recordRoot: input.recordRoot,
    requirementSetId: nonEmpty(input.requirementSetId, 'requirementSetId'),
    entrySource: input.entrySource,
    requestedArtifactRole: 'requirement_source_prd',
    sourcePath: normalizedRelativePath(input.projectRoot, input.source.sourcePath),
    sourceContent: input.source.sourceText,
    materialRoots: [],
    capturedAt: nonEmpty(input.capturedAt, 'capturedAt'),
  });
  const intakeReceipt =
    reusableFileIntakeReceipt(input.intakeReceiptPath, receipt) ??
    reusableCapturedAuthorityArtifact(
      input.intakeReceiptPath,
      receipt,
      validateRequirementsContractFileIntakeReceipt
    ) ??
    persistValidatedArtifact(
      input.intakeReceiptPath,
      receipt,
      validateRequirementsContractFileIntakeReceipt,
      sha256Stable(receipt)
    );
  return {
    source: input.source,
    recordRoot: input.recordRoot,
    intakeReceiptPath: normalizedRelativePath(input.projectRoot, input.intakeReceiptPath),
    intakeReceipt,
  };
}

export function materializeInvocationEntryAuthority(input: {
  projectRoot: string;
  requirementSetId: string;
  recordId: string;
  entrySource: InvocationAuthorityEntrySource;
  sourceDocumentHash: string;
  targetPaths: string[];
  requiredCommands: string[];
  capturedAt: string;
  receiptPath: string;
}): InvocationEntryAuthority {
  const receipt = createRequirementsContractInvocationAuthorityReceipt({
    requirementSetId: input.requirementSetId,
    recordId: input.recordId,
    entrySource: input.entrySource,
    sourceDocumentHash: input.sourceDocumentHash,
    targetPaths: input.targetPaths,
    requiredCommands: input.requiredCommands,
    capturedAt: input.capturedAt,
  });
  const persisted =
    reusableCapturedAuthorityArtifact(
      input.receiptPath,
      receipt,
      validateRequirementsContractInvocationAuthorityReceipt
    ) ??
    persistValidatedArtifact(
      input.receiptPath,
      receipt,
      validateRequirementsContractInvocationAuthorityReceipt,
      sha256Stable(receipt)
    );
  return {
    source: readCanonicalUtf8Source(input.receiptPath),
    receiptPath: normalizedRelativePath(input.projectRoot, input.receiptPath),
    receipt: persisted,
  };
}

export function materializeEntryLineage(input: {
  projectRoot: string;
  authority: EntryIntakeAuthority;
  sourceRootRefs?: string[];
  sourceRoots?: EntryLineageSourceRoot[];
  lineageLedgerPath: string;
}): RequirementsContractIntentLineageLedger | RequirementsContractIntentLineageLedgerV2 {
  const sourceRoots = input.sourceRoots ?? [];
  if (isFileEntryIntakeAuthority(input.authority)) {
    const initialReceipt = input.authority.intakeReceipt;
    const materialSourceRoots = sourceRoots.filter(
      (sourceRoot) => sourceRoot.authorityClass !== 'invocation_bound'
    );
    const mismatchedSourcePaths = materialSourceRoots
      .filter(
        (sourceRoot) =>
          sourceRoot.sourcePath.replace(/\\/gu, '/') !== initialReceipt.sourcePath
      )
      .map((sourceRoot) => sourceRoot.sourceRootId);
    if (mismatchedSourcePaths.length > 0) {
      throw new Error(
        `Entry lineage Source Roots reference a different source: ${mismatchedSourcePaths.join(', ')}`
      );
    }
    const intakeReceipt = createRequirementsContractFileIntakeReceiptV2({
      recordRoot: input.authority.recordRoot,
      requirementSetId: initialReceipt.requirementSetId,
      entrySource: initialReceipt.entrySource,
      requestedArtifactRole: initialReceipt.requestedArtifactRole,
      sourcePath: initialReceipt.sourcePath,
      sourceContent: input.authority.source.sourceText,
      materialRoots: materialSourceRoots.map((sourceRoot) => ({
        sourceRootId: sourceRoot.sourceRootId,
        startLine: sourceRoot.sourceSpan.startLine,
        endLine: sourceRoot.sourceSpan.endLine,
      })),
      capturedAt: initialReceipt.capturedAt,
    });
    input.authority.intakeReceipt = persistValidatedArtifact(
      path.resolve(input.projectRoot, input.authority.intakeReceiptPath),
      intakeReceipt,
      validateRequirementsContractFileIntakeReceipt,
      sha256Stable(intakeReceipt)
    );
    const sourceBytes = Buffer.from(input.authority.source.sourceText, 'utf8');
    const rangeByRootId = new Map(
      intakeReceipt.materialExcerpts.map((excerpt) => [excerpt.sourceRootId, excerpt.range])
    );
    const materialRoots = materialSourceRoots.map((sourceRoot) => ({
      sourceRootId: sourceRoot.sourceRootId,
      disposition: 'source_root' as const,
      sourceRange: rangeByRootId.get(sourceRoot.sourceRootId)!,
      semanticNodeRefs: [sourceRoot.sourceRootId],
    }));
    const excludedRanges = deriveIntentLineageExcludedRanges({
      sourceBytes,
      materialRanges: materialRoots.map((root) => root.sourceRange),
      exclusionRuleRef: 'non-semantic-source-range/v2',
      reasonCode: 'non_semantic_source_range',
    });
    const ledger = createRequirementsContractIntentLineageLedgerV2({
      receipt: intakeReceipt,
      sourceBytes,
      materialRoots,
      excludedRanges,
    });
    return persistValidatedArtifact(
      input.lineageLedgerPath,
      ledger,
      validateRequirementsContractIntentLineageLedger,
      sha256Stable(ledger)
    );
  }
  const sourceRootRefs = [
    ...new Set(
      [
        ...(input.sourceRootRefs ?? []),
        ...sourceRoots.map((sourceRoot) => sourceRoot.sourceRootId),
      ].map((value) => value.trim())
    ),
  ].filter(Boolean);
  const sessionAuthority = input.authority;
  if (isFileEntryIntakeAuthority(sessionAuthority)) {
    throw new Error('Entry file intake authority must use the v2 materialization branch');
  }
  const classifications = sessionAuthority.intakeReceipt.excerpts.map((excerpt) => {
    const rootRefs = sourceRoots
      .filter(
        (sourceRoot) =>
          sourceRoot.authorityClass !== 'invocation_bound' &&
          sourceRoot.sourceSpan.startLine <= excerpt.order &&
          sourceRoot.sourceSpan.endLine >= excerpt.order
      )
      .map((sourceRoot) => sourceRoot.sourceRootId)
      .sort();
    if (rootRefs.length > 0) {
      return {
        spanId: excerpt.excerptId,
        disposition: 'source_root' as const,
        classificationRule: 'session-entry-source-span-mapping/v1',
        sourceRootRefs: rootRefs,
      };
    }
    if (sourceRoots.length === 0 && sourceRootRefs.length > 0) {
      return {
        spanId: excerpt.excerptId,
        disposition: 'source_root' as const,
        classificationRule: 'session-entry-source-root-mapping/v1',
        sourceRootRefs,
      };
    }
    const exclusionRuleRef = 'non-semantic-source-line/v1';
    const exclusionReason = 'The session source line does not materialize a canonical semantic Source Root.';
    return {
      spanId: excerpt.excerptId,
      disposition: 'excluded' as const,
      classificationRule: 'session-entry-source-span-mapping/v1',
      exclusionRuleRef,
      exclusionReason,
      decisionHash: sha256Stable({
        spanId: excerpt.excerptId,
        sourceHash: excerpt.contentHash,
        exclusionRuleRef,
        exclusionReason,
      }),
    };
  });
  if (sourceRoots.length > 0) {
    const mappedRootRefs = new Set(
      classifications.flatMap((classification) =>
        classification.disposition === 'source_root' ? classification.sourceRootRefs : []
      )
    );
    const missingRootRefs = sourceRoots
      .filter((sourceRoot) => sourceRoot.authorityClass !== 'invocation_bound')
      .map((sourceRoot) => sourceRoot.sourceRootId)
      .filter((sourceRootId) => !mappedRootRefs.has(sourceRootId));
    if (missingRootRefs.length > 0) {
      throw new Error(
        `Entry lineage did not map Source Roots to material spans: ${missingRootRefs.join(', ')}`
      );
    }
  }
  const ledger = createRequirementsContractIntentLineageLedger({
    intakeReceiptPath: input.authority.intakeReceiptPath,
    intakeReceipt: input.authority.intakeReceipt,
    classifications,
  });
  return persistValidatedArtifact(
    input.lineageLedgerPath,
    ledger,
    validateRequirementsContractIntentLineageLedger,
    sha256Stable(ledger)
  );
}

export function materializeSessionEntryLineage(input: {
  projectRoot: string;
  authority: SessionEntryIntakeAuthority;
  sourceRootRefs: string[];
  lineageLedgerPath: string;
}): RequirementsContractIntentLineageLedger {
  const ledger = materializeEntryLineage(input);
  if (ledger.schemaVersion !== 'requirements-contract-intent-lineage-ledger/v1') {
    throw new Error('Session entry lineage must use the legacy session ledger');
  }
  return ledger;
}
