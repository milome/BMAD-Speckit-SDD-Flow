import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import {
  createRequirementsContractIntakeReceipt,
  type RequirementsContractIntakeReceipt,
  validateRequirementsContractIntakeReceipt,
} from './requirements-contract-intake-receipt';
import {
  createRequirementsContractFileIntakeReceipt,
  type FileIntakeEntrySource,
  type RequirementsContractFileIntakeReceipt,
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
  type RequirementsContractIntentLineageLedger,
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
  intakeReceiptPath: string;
  intakeReceipt: RequirementsContractFileIntakeReceipt;
}

export type EntryIntakeAuthority = SessionEntryIntakeAuthority | FileEntryIntakeAuthority;

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
  requirementSetId: string;
  entrySource: FileIntakeEntrySource;
  source: CanonicalUtf8SourceSnapshot;
  capturedAt: string;
  intakeReceiptPath: string;
}): FileEntryIntakeAuthority {
  const receipt = createRequirementsContractFileIntakeReceipt({
    requirementSetId: nonEmpty(input.requirementSetId, 'requirementSetId'),
    entrySource: input.entrySource,
    requestedArtifactRole: 'requirement_source_prd',
    sourcePath: normalizedRelativePath(input.projectRoot, input.source.sourcePath),
    sourceContent: input.source.sourceText,
    capturedAt: nonEmpty(input.capturedAt, 'capturedAt'),
  });
  const intakeReceipt = persistValidatedArtifact(
    input.intakeReceiptPath,
    receipt,
    validateRequirementsContractFileIntakeReceipt,
    sha256Stable(receipt)
  );
  return {
    source: input.source,
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
  const persisted = persistValidatedArtifact(
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
}): RequirementsContractIntentLineageLedger {
  const sourceRoots = input.sourceRoots ?? [];
  const sourceRootRefs = [
    ...new Set(
      [
        ...(input.sourceRootRefs ?? []),
        ...sourceRoots.map((sourceRoot) => sourceRoot.sourceRootId),
      ].map((value) => value.trim())
    ),
  ].filter(Boolean);
  const classifications =
    input.authority.intakeReceipt.schemaVersion === 'requirements-contract-file-intake-receipt/v1'
      ? input.authority.intakeReceipt.excerpts.map((excerpt) => {
          const rootRefs = sourceRoots
            .filter(
              (sourceRoot) =>
                sourceRoot.authorityClass !== 'invocation_bound' &&
                sourceRoot.sourcePath.replace(/\\/gu, '/') ===
                  excerpt.boundary.sourcePath.replace(/\\/gu, '/') &&
                sourceRoot.sourceSpan.startLine <= excerpt.boundary.startLine &&
                sourceRoot.sourceSpan.endLine >= excerpt.boundary.endLine
            )
            .map((sourceRoot) => sourceRoot.sourceRootId)
            .sort();
          if (rootRefs.length > 0) {
            return {
              spanId: excerpt.excerptId,
              disposition: 'source_root' as const,
              classificationRule: 'file-entry-source-span-mapping/v1',
              sourceRootRefs: rootRefs,
            };
          }
          const exclusionRuleRef = 'non-semantic-source-line/v1';
          const exclusionReason =
            'The source line does not materialize a canonical semantic Source Root.';
          return {
            spanId: excerpt.excerptId,
            disposition: 'excluded' as const,
            classificationRule: 'file-entry-source-span-mapping/v1',
            exclusionRuleRef,
            exclusionReason,
            decisionHash: sha256Stable({
              spanId: excerpt.excerptId,
              sourceHash: excerpt.contentHash,
              exclusionRuleRef,
              exclusionReason,
            }),
          };
        })
      : input.authority.intakeReceipt.excerpts.map((excerpt) => {
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
          const exclusionReason =
            'The session source line does not materialize a canonical semantic Source Root.';
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
  return materializeEntryLineage(input);
}
