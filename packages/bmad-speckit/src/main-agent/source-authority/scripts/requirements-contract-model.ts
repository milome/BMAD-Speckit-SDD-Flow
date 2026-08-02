import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type AnySchemaObject } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { requirementsContractTraceEdgeTypeRegistryHash } from '../rules/requirements-contract-trace-edge-type-registry';
import { semanticModelHash as semanticModelHashForContract } from './requirements-contract-hash-domains';
import { sha256Stable } from './requirements-contract-semantic-resolver';

export type RequirementSourceInputKind =
  | 'session_prompt'
  | 'prd_draft'
  | 'existing_contract'
  | 'intake_document';

export interface RequirementSourceInput {
  kind: RequirementSourceInputKind;
  sourceText: string;
  sourcePath?: string;
  inputChannel?: 'file' | 'stdin' | 'memory';
}

export interface RequirementSourceSpan {
  startLine: number;
  endLine: number;
}

export interface RequirementSourceHeading {
  depth: number;
  text: string;
  span: RequirementSourceSpan;
}

export interface RequirementSourceBlock {
  kind: 'heading' | 'table_row' | 'list_item' | 'fenced_code' | 'paragraph';
  text: string;
  span: RequirementSourceSpan;
  headingPath: string[];
  hash: string;
}

export interface RequirementSourceFence {
  language: string | null;
  text: string;
  span: RequirementSourceSpan;
  hash: string;
}

export interface RequirementSourceIdNormalization {
  raw: string;
  canonical: string;
  span: RequirementSourceSpan;
}

export interface RequirementSourcePathExtraction {
  all: string[];
  windows: string[];
  posix: string[];
  rootFiles: string[];
  directories: string[];
  urls: string[];
  fenced: string[];
  unfenced: string[];
}

export interface RequirementSourceCommandExtraction {
  all: string[];
  fenced: string[];
  unfenced: string[];
}

export interface RequirementSourceLanguageSignals {
  primary: 'zh-CN' | 'en' | 'mixed' | 'unknown';
  containsChinese: boolean;
  containsEnglish: boolean;
}

export interface RequirementSourceAst {
  schemaVersion: 'requirement-source-ast/v1';
  inputKind: RequirementSourceInputKind;
  inputChannel: 'file' | 'stdin' | 'memory';
  sourcePath: string | null;
  sourceHash: string;
  normalizedHash: string;
  lineCount: number;
  byteLength: number;
  headings: RequirementSourceHeading[];
  blocks: RequirementSourceBlock[];
  fences: RequirementSourceFence[];
  paths: RequirementSourcePathExtraction;
  commands: RequirementSourceCommandExtraction;
  languageSignals: RequirementSourceLanguageSignals;
  canonicalIds: RequirementSourceIdNormalization[];
  staleProjectionBoundaries: Array<{
    kind: 'implementation_confirmation' | 'generated_projection' | 'current_target_projection';
    span: RequirementSourceSpan;
    hash: string;
  }>;
  recoverableShapes: string[];
}

function sourceHash(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/gu, '\n');
}

export function canonicalRequirementSourceId(raw: string): string | null {
  const trimmed = raw.trim();
  const match =
    /^(FR|NFR|REQ|AC|ACC|EVD|TRACE|CMD|TASK|NEG|OUT|PATH|EDGE|FAIL)[\s_-]*(?:ID)?[\s:#_-]*(\d{1,5})$/iu.exec(
      trimmed
    ) ??
    /\b(FR|NFR|REQ|AC|ACC|EVD|TRACE|CMD|TASK|NEG|OUT|PATH|EDGE|FAIL)[\s_-]*(?:ID)?[\s:#_-]*(\d{1,5})\b/iu.exec(
      trimmed
    );
  if (!match) return null;
  const prefix = match[1].toUpperCase();
  const width = prefix === 'FR' || prefix === 'NFR' ? 3 : 3;
  return `${prefix}-${String(Number(match[2])).padStart(width, '0')}`;
}

function classifyBlock(line: string): RequirementSourceBlock['kind'] {
  if (/^#{1,6}\s+/u.test(line)) return 'heading';
  if (/^\s*\|.*\|\s*$/u.test(line)) return 'table_row';
  if (/^\s*(?:[-*+]|\d+\.)\s+/u.test(line)) return 'list_item';
  return 'paragraph';
}

function extractFences(lines: string[]): RequirementSourceFence[] {
  const fences: RequirementSourceFence[] = [];
  let start = -1;
  let language: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = /^```([A-Za-z0-9_-]+)?\s*$/u.exec(line.trim());
    if (!fence) continue;
    if (start === -1) {
      start = index;
      language = fence[1] || null;
      continue;
    }
    const text = lines.slice(start + 1, index).join('\n');
    fences.push({
      language,
      text,
      span: { startLine: start + 1, endLine: index + 1 },
      hash: sourceHash(text),
    });
    start = -1;
    language = null;
  }
  return fences;
}

function lineInsideFence(lineNumber: number, fences: RequirementSourceFence[]): boolean {
  return fences.some(
    (fence) => lineNumber >= fence.span.startLine && lineNumber <= fence.span.endLine
  );
}

function pathLike(value: string): boolean {
  return (
    /^https?:\/\//iu.test(value) ||
    /^[A-Za-z]:\\/u.test(value) ||
    /^(?:\.{1,2}\/)?[\w.@-]+(?:\/[\w.@-]+)+(?:\/|\.[A-Za-z0-9]+)?$/u.test(value) ||
    /^[\w.@-]+\.(?:md|mdx|rst|ts|tsx|js|cjs|mjs|py|json|ya?ml|toml|ini|cfg|txt)$/iu.test(value)
  );
}

function extractPaths(
  lines: string[],
  fences: RequirementSourceFence[]
): RequirementSourcePathExtraction {
  const fenced: string[] = [];
  const unfenced: string[] = [];
  const windows: string[] = [];
  const posix: string[] = [];
  const rootFiles: string[] = [];
  const directories: string[] = [];
  const urls: string[] = [];
  const add = (value: string, lineNumber: number) => {
    const cleaned = value.replace(/[),.;]+$/u, '').trim();
    if (!pathLike(cleaned)) return;
    if (lineInsideFence(lineNumber, fences)) fenced.push(cleaned);
    else unfenced.push(cleaned);
    if (/^https?:\/\//iu.test(cleaned)) urls.push(cleaned);
    else if (/^[A-Za-z]:\\/u.test(cleaned)) windows.push(cleaned);
    else if (cleaned.endsWith('/')) directories.push(cleaned);
    else if (cleaned.includes('/')) posix.push(cleaned);
    else rootFiles.push(cleaned);
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    for (const match of line.matchAll(/`([^`]+)`/gu)) add(match[1], lineNumber);
    for (const match of line.matchAll(/https?:\/\/[^\s`|)]+/giu)) add(match[0], lineNumber);
    for (const match of line.matchAll(/[A-Za-z]:\\[^\s`|)]+/gu)) add(match[0], lineNumber);
    for (const match of line.matchAll(
      /(?:\.{1,2}\/)?[\w.@-]+(?:\/[\w.@-]+)+(?:\/|\.[A-Za-z0-9]+)?/gu
    )) {
      add(match[0], lineNumber);
    }
    for (const match of line.matchAll(
      /\b[\w.@-]+\.(?:md|mdx|rst|ts|tsx|js|cjs|mjs|py|json|ya?ml|toml|ini|cfg|txt)\b/giu
    )) {
      add(match[0], lineNumber);
    }
  });

  return {
    all: unique([...fenced, ...unfenced]),
    windows: unique(windows),
    posix: unique(posix),
    rootFiles: unique(rootFiles),
    directories: unique(directories),
    urls: unique(urls),
    fenced: unique(fenced),
    unfenced: unique(unfenced),
  };
}

function extractCommands(
  lines: string[],
  fences: RequirementSourceFence[]
): RequirementSourceCommandExtraction {
  const commandPattern =
    /\b(?:npx\s+vitest|vitest|pytest|python\s+-m\s+pytest|npm\s+run|pnpm\s+|yarn\s+|node\s+)[^\n|`]*/iu;
  const fencedCommands: string[] = [];
  const unfencedCommands: string[] = [];
  lines.forEach((line, index) => {
    const match = commandPattern.exec(line.trim());
    if (!match) return;
    const command = match[0].trim().replace(/[.;]+$/u, '');
    if (lineInsideFence(index + 1, fences)) fencedCommands.push(command);
    else unfencedCommands.push(command);
  });
  return {
    all: unique([...fencedCommands, ...unfencedCommands]),
    fenced: unique(fencedCommands),
    unfenced: unique(unfencedCommands),
  };
}

function extractCanonicalIds(lines: string[]): RequirementSourceIdNormalization[] {
  const ids: RequirementSourceIdNormalization[] = [];
  lines.forEach((line, index) => {
    for (const match of line.matchAll(
      /\b(FR|NFR|REQ|AC|ACC|EVD|TRACE|CMD|TASK|NEG|OUT|PATH|EDGE|FAIL)[\s_-]*(?:ID)?[\s:#_-]*(\d{1,5})\b/giu
    )) {
      const canonical = canonicalRequirementSourceId(match[0]);
      if (canonical) {
        ids.push({
          raw: match[0],
          canonical,
          span: { startLine: index + 1, endLine: index + 1 },
        });
      }
    }
  });
  return ids;
}

function extractStaleProjectionBoundaries(
  lines: string[]
): RequirementSourceAst['staleProjectionBoundaries'] {
  const boundaries: RequirementSourceAst['staleProjectionBoundaries'] = [];
  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    const kind = lower.includes('implementationconfirmation')
      ? 'implementation_confirmation'
      : lower.includes('generated projection')
        ? 'generated_projection'
        : lower.includes('current target state projection')
          ? 'current_target_projection'
          : null;
    if (!kind) return;
    const span = { startLine: index + 1, endLine: index + 1 };
    boundaries.push({ kind, span, hash: sourceHash(line) });
  });
  return boundaries;
}

function languageSignals(text: string): RequirementSourceLanguageSignals {
  const containsChinese = /[\u3400-\u9fff]/u.test(text);
  const containsEnglish = /[A-Za-z]/u.test(text);
  return {
    primary:
      containsChinese && containsEnglish
        ? 'mixed'
        : containsChinese
          ? 'zh-CN'
          : containsEnglish
            ? 'en'
            : 'unknown',
    containsChinese,
    containsEnglish,
  };
}

export function normalizeRequirementSourceInput(
  input: RequirementSourceInput
): RequirementSourceAst {
  const sourceText = normalizeLineEndings(input.sourceText);
  const lines = sourceText.split('\n');
  const fences = extractFences(lines);
  const headings: RequirementSourceHeading[] = [];
  const headingStack: Array<{ depth: number; text: string }> = [];
  const blocks: RequirementSourceBlock[] = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (!line.trim()) return;
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
    if (heading) {
      const depth = heading[1].length;
      const text = heading[2].trim();
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].depth >= depth) {
        headingStack.pop();
      }
      headingStack.push({ depth, text });
      headings.push({ depth, text, span: { startLine: lineNumber, endLine: lineNumber } });
    }
    const headingPath = headingStack.map((item) => item.text);
    blocks.push({
      kind: lineInsideFence(lineNumber, fences) ? 'fenced_code' : classifyBlock(line),
      text: line,
      span: { startLine: lineNumber, endLine: lineNumber },
      headingPath,
      hash: sourceHash(line),
    });
  });

  return {
    schemaVersion: 'requirement-source-ast/v1',
    inputKind: input.kind,
    inputChannel: input.inputChannel ?? 'memory',
    sourcePath: input.sourcePath ?? null,
    sourceHash: sourceHash(sourceText),
    normalizedHash: sourceHash(sourceText.trim()),
    lineCount: lines.length,
    byteLength: Buffer.byteLength(sourceText, 'utf8'),
    headings,
    blocks,
    fences,
    paths: extractPaths(lines, fences),
    commands: extractCommands(lines, fences),
    languageSignals: languageSignals(sourceText),
    canonicalIds: extractCanonicalIds(lines),
    staleProjectionBoundaries: extractStaleProjectionBoundaries(lines),
    recoverableShapes: sourceText.includes('|---') ? ['markdown_table_alignment'] : [],
  };
}

export interface RequirementContractRequirement {
  id: string;
  text: string;
  textZh?: string;
  sourceRequirementId?: string;
  sourcePath?: string;
  sourceDocumentHash?: string;
  sourceSpan?: { startLine: number; endLine: number };
  headingPath?: string[];
  authorityState?: string;
  provenance?: Record<string, unknown>;
}

export interface RequirementContractBoundary {
  id: string;
  text: string;
  authorityState?: string;
  provenance?: Record<string, unknown>;
}

export interface RequirementContractTraceRow {
  id: string;
  covers: string[];
  evidenceRefs: string[];
  acceptanceRefs: string[];
  businessViewRefs: string[];
  sequenceViewRefs: string[];
  flowViewRefs: string[];
  edgeCaseViewRefs: string[];
  boundaryViewRefs: string[];
  taskRefs?: string[];
  contractValidationCommandRefs?: string[];
  deliveryEvidenceCommandRefs?: string[];
}

export interface RequirementContractView {
  id: string;
  title: string;
  scope: 'business' | 'governance';
  covers: string[];
  mermaid?: string;
}

export interface RequirementContractClosureReport {
  appliedPasses: string[];
  remainingIssueCount: number;
  rendererBlockerPolicy: 'renderer_blocker_release_failure';
  issues: Array<{ code: string; message: string }>;
  terminalState?: 'blocked' | 'confirmable';
  measureBefore?: RequirementContractClosureMeasure;
  measureAfter?: RequirementContractClosureMeasure;
  passRegistry?: RequirementContractClosurePass[];
  roundReceipts?: RequirementContractClosurePassReceipt[];
}

export interface RequirementContractClosureMeasure {
  unresolvedInvariantCount: number;
  orphanReferenceCount: number;
  missingProjectionCount: number;
  localizationParityCount: number;
  schemaValidationCount: number;
}

export interface RequirementContractClosurePass {
  name: string;
  family: string;
  applicability: string;
  regressionTest: string;
}

export interface RequirementContractClosurePassReceipt {
  passId: string;
  executed: true;
  inputs: {
    recordId: string;
    requirementSetId: string;
  };
  outputs: {
    changedFields: string[];
  };
  findings: Array<{ code: string; message: string }>;
  measureBefore: RequirementContractClosureMeasure;
  measureAfter: RequirementContractClosureMeasure;
}

export interface RequirementContractModel {
  schemaVersion: 'requirement-contract-model/v1';
  recordId: string;
  requirementSetId: string;
  must: RequirementContractRequirement[];
  notDone: RequirementContractRequirement[];
  outOfScope: RequirementContractBoundary[];
  evidence: Array<{ id: string; covers: string[]; text: string }>;
  acceptanceCriteria: Array<{ id: string; covers: string[]; text: string }>;
  requiredCommands: Array<{ id: string; command: string; covers: string[] }>;
  traceRows: RequirementContractTraceRow[];
  businessViews: RequirementContractView[];
  sequenceViews: RequirementContractView[];
  flowViews: RequirementContractView[];
  edgeCaseViews: RequirementContractView[];
  boundaryViews: RequirementContractView[];
  targetModificationPaths: Array<{ id: string; path: string; requirementRefs: string[] }>;
  applicability: Record<string, unknown>;
  invariantClosure: RequirementContractClosureReport;
}

export interface RequirementContractCommandInput {
  id: string;
  command: string;
  requirementRefs: string[];
}

export interface RequirementContractTargetInput {
  id: string;
  path: string;
  requirementRefs: string[];
}

export interface RequirementContractCompilerInput {
  recordId: string;
  requirementSetId: string;
  must: RequirementContractRequirement[];
  notDone?: RequirementContractRequirement[];
  outOfScope?: RequirementContractBoundary[];
  requiredCommands?: Array<string | RequirementContractCommandInput>;
  targetPaths?: Array<string | RequirementContractTargetInput>;
}

export const REQUIREMENT_CONTRACT_MODEL_V2_ACTIVATION_STATE = 'inactive_schema_boundary' as const;

export type RequirementContractStageId =
  | 'STAGE-01'
  | 'STAGE-02'
  | 'STAGE-03'
  | 'STAGE-04'
  | 'STAGE-05'
  | 'STAGE-06'
  | 'STAGE-07'
  | 'STAGE-08'
  | 'STAGE-09'
  | 'STAGE-10'
  | 'STAGE-11';

export type RequirementContractTaskId =
  | 'G00'
  | 'G01'
  | 'G02'
  | 'G03'
  | 'G04'
  | 'G05'
  | 'G06'
  | 'G07'
  | 'G08'
  | 'G09'
  | 'G10'
  | 'G11'
  | 'G12'
  | 'G13'
  | 'G14'
  | 'G15';

export type RequirementContractStarDecision = 'PASS' | 'BLOCK';

export interface RequirementContractStageRegistryRow {
  stageId: RequirementContractStageId;
  stageName: string;
  primaryTaskRefs: RequirementContractTaskId[];
  predecessorStageIds: RequirementContractStageId[];
}

export const REQUIREMENTS_CONTRACT_STAR_DECISIONS = ['PASS', 'BLOCK'] as const;

export const REQUIREMENTS_CONTRACT_STAGE_REGISTRY: RequirementContractStageRegistryRow[] = [
  {
    stageId: 'STAGE-01',
    stageName: 'Main-session requirement intake',
    primaryTaskRefs: ['G10', 'G11'],
    predecessorStageIds: [],
  },
  {
    stageId: 'STAGE-02',
    stageName: 'BMAD Product PRD',
    primaryTaskRefs: ['G10', 'G11', 'G12'],
    predecessorStageIds: ['STAGE-01'],
  },
  {
    stageId: 'STAGE-03',
    stageName: 'Requirement Source PRD',
    primaryTaskRefs: ['G01', 'G02', 'G10', 'G11', 'G12'],
    predecessorStageIds: ['STAGE-01', 'STAGE-02'],
  },
  {
    stageId: 'STAGE-04',
    stageName: 'cp-00 through cp-08',
    primaryTaskRefs: ['G01', 'G02', 'G03', 'G04', 'G05', 'G10', 'G11'],
    predecessorStageIds: ['STAGE-03'],
  },
  {
    stageId: 'STAGE-05',
    stageName: 'Requirements confirmation page',
    primaryTaskRefs: ['G09', 'G10', 'G11'],
    predecessorStageIds: ['STAGE-04'],
  },
  {
    stageId: 'STAGE-06',
    stageName: 'Architecture confirmation page',
    primaryTaskRefs: ['G09', 'G10', 'G11', 'G12'],
    predecessorStageIds: ['STAGE-05'],
  },
  {
    stageId: 'STAGE-07',
    stageName: 'AI-TDD readiness',
    primaryTaskRefs: ['G05', 'G10', 'G13'],
    predecessorStageIds: ['STAGE-06'],
  },
  {
    stageId: 'STAGE-08',
    stageName: 'Dispatch and prompts',
    primaryTaskRefs: ['G08', 'G09'],
    predecessorStageIds: ['STAGE-07'],
  },
  {
    stageId: 'STAGE-09',
    stageName: 'Execution closure',
    primaryTaskRefs: ['G06', 'G07'],
    predecessorStageIds: ['STAGE-08'],
  },
  {
    stageId: 'STAGE-10',
    stageName: 'Delivery audit and evidence chain',
    primaryTaskRefs: ['G07', 'G13', 'G14', 'G15'],
    predecessorStageIds: ['STAGE-09'],
  },
  {
    stageId: 'STAGE-11',
    stageName: 'Final delivery confirmation page',
    primaryTaskRefs: ['G15'],
    predecessorStageIds: ['STAGE-10'],
  },
];

export const REQUIREMENTS_CONTRACT_TASK_OWNER_STAGE_REGISTRY: Record<
  RequirementContractTaskId,
  RequirementContractStageId
> = {
  G00: 'STAGE-01',
  G01: 'STAGE-03',
  G02: 'STAGE-03',
  G03: 'STAGE-04',
  G04: 'STAGE-04',
  G05: 'STAGE-07',
  G06: 'STAGE-09',
  G07: 'STAGE-10',
  G08: 'STAGE-08',
  G09: 'STAGE-05',
  G10: 'STAGE-06',
  G11: 'STAGE-02',
  G12: 'STAGE-10',
  G13: 'STAGE-10',
  G14: 'STAGE-10',
  G15: 'STAGE-11',
};

export interface RequirementContractStageAuditRow {
  stageId: RequirementContractStageId;
  stageName: string;
  contractRefs: string[];
  sourceObligationRefs: string[];
  acceptanceRefs: string[];
  traceRefs: string[];
  star1Decision: RequirementContractStarDecision;
  star2Decision: RequirementContractStarDecision;
  star3Decision: RequirementContractStarDecision;
  star4Decision: RequirementContractStarDecision;
  star5Decision: RequirementContractStarDecision;
  stageScore: 0 | 1 | 2 | 3 | 4 | 5;
  commandReceiptRefs: string[];
  artifactRefs: string[];
  independentEvidenceRefs: string[];
  consumerJourneyEvidenceRefs: string[];
  failedPredicateIds: string[];
  blockers: string[];
  auditAttemptId: string;
}

export type RequirementContractGapRootCauseClass =
  | 'implementation_defect'
  | 'test_or_oracle_defect'
  | 'evidence_pipeline_defect'
  | 'authority_or_semantic_gap'
  | 'environment_blocker';

export type RequirementContractGapStatus =
  | 'open'
  | 'red_dispositioned'
  | 'remediated_pending_verification'
  | 'verified_pending_reaudit'
  | 'blocked_semantic'
  | 'blocked_environment'
  | 'closed';

export interface RequirementContractGapStatusTransition {
  fromStatus: RequirementContractGapStatus | 'none';
  toStatus: RequirementContractGapStatus;
  auditAttemptId: string;
  receiptRef: string;
  transitionHash: string;
}

export interface RequirementContractStageGapRecord {
  gapId: string;
  stageId: RequirementContractStageId;
  failedStar: 'STAR-1' | 'STAR-2' | 'STAR-3' | 'STAR-4' | 'STAR-5';
  failedPredicate: string;
  contractRefs: string[];
  acceptanceRefs: string[];
  traceRefs: string[];
  observedEvidence: string[];
  missingEvidence: string[];
  counterexample: string;
  rootCauseClass: RequirementContractGapRootCauseClass;
  rootCause: string;
  affectedProductionPaths: string[];
  affectedTests: string[];
  affectedArtifacts: string[];
  downstreamInvalidationSet: string[];
  remediationSteps: string[];
  qualifiedRedRequired: boolean;
  verificationCommands: string[];
  expectedEvidence: string[];
  failureSignatureHash: string;
  status: RequirementContractGapStatus;
  statusTransitions: RequirementContractGapStatusTransition[];
}

export interface RequirementContractRealConsumerIdentity {
  normalizedRoot: 'D:\\Dev\\BMAD-Speckit-Consumer-Evidence-Closure';
  projectName: 'bmad-speckit-consumer-evidence-closure';
  repositoryRoot: string;
  baselineCommit: string;
  baselineFileIndexHash: string;
  candidatePackageHash: string;
  installedPackageHash: string;
}

export type RequirementContractConfirmationPageKind =
  | 'requirements'
  | 'architecture'
  | 'final_delivery';

export interface RequirementContractConfirmationReceiptBinding {
  pageKind: RequirementContractConfirmationPageKind;
  pagePath: string;
  pageHash: string;
  receiptPath: string;
  receiptHash: string;
  sourceHash: string;
  semanticModelHash: string;
  requirementSetId: string;
  transactionId: string;
  implementationAttemptId: string;
  auditAttemptId: string;
  stageRegistryHash: string;
  contentValidationReceiptRef: string;
  publicationReadbackReceiptRef: string;
}

export interface RequirementContractStageInvalidation {
  invalidationId: string;
  changedDependencyRef: string;
  changedDependencyHash: string;
  invalidatedStageIds: RequirementContractStageId[];
  invalidatedReceiptRefs: string[];
  reachabilityProofRef: string;
  auditAttemptId: string;
}

export interface RequirementContractStageFinalGateMetrics {
  stageScoreFabricationCount: number;
  stagePredicateDeletionCount: number;
  stageApplicabilityEscapeCount: number;
  stageStaleEvidenceReuseCount: number;
  stageCrossAttemptEvidenceCount: number;
  stageSelfReportedEvidenceAcceptCount: number;
  stageAllToAllEvidenceBindingCount: number;
  stageManualReceiptFabricationCount: number;
  stageTestWeakeningCount: number;
  stageUnauthorizedSkipCount: number;
  stageDeterministicBlockOverrideCount: number;
  stageFiveStarCoverage: 0 | 1;
  stageRegistryCoverage: 0 | 1;
  stageCommandReceiptCoverage: 0 | 1;
  stageArtifactReadbackCoverage: 0 | 1;
  realConsumerJourneyCoverage: 0 | 1;
}

export interface RequirementContractStageFinalGateReport {
  schemaVersion: 'requirements-contract-stage-final-gate-report/v1';
  contractHash: string;
  frozenUniverseHash: string;
  requirementSetId: string;
  transactionId: string;
  implementationAttemptId: string;
  auditAttemptId: string;
  consumerIdentityHash: string;
  stageFiveStarCount: number;
  stageBelowFiveStarCount: number;
  openGapCount: number;
  invalidatedStageCount: number;
  evidenceFabricationCount: number;
  metrics: RequirementContractStageFinalGateMetrics;
  deterministicAcceptanceGate: 'pass' | 'block';
  finalJudgeDecision: 'pass' | 'block' | 'inconclusive';
  realConsumerJourneyDecision: 'pass' | 'block';
  terminalReceiptPending: boolean;
  decision: 'block' | 'preterminal_pass_candidate';
}

export type RequirementContractAuthorityState =
  | 'source_grounded'
  | 'human_confirmed'
  | 'derived'
  | 'unresolved'
  | 'invalid';

export type RequirementContractRequirementKind =
  | 'functional'
  | 'nonfunctional'
  | 'negative'
  | 'out_of_scope';

export interface RequirementContractRequirementV2 {
  id: string;
  kind: RequirementContractRequirementKind;
  schemaVersion: 'requirement-contract-requirement/v2';
  text: string;
  source: {
    sourcePath: string | null;
    sourceSpan: RequirementSourceSpan | null;
    sourceHash: string | null;
    sourceRequirementId: string | null;
    headingPath: string[];
  };
  semantics: {
    actor: string | null;
    trigger: string | null;
    preconditions: string[];
    action: string | null;
    postconditions: string[];
    invariants: string[];
    thresholds: string[];
  };
  authority: {
    authorityState: RequirementContractAuthorityState;
    derivation: string;
    decisionReceiptRef: string | null;
  };
  applicability: {
    state: 'applicable' | 'not_applicable' | 'unresolved' | 'invalid';
    reasonCode: string;
  };
  unresolved: Array<{
    id: string;
    field: string;
    question: string;
    blocking: boolean;
  }>;
  verification: {
    method: string;
    oracleRef: string | null;
    commandRefs: string[];
    expectedObservationRefs: string[];
  };
  bindings: {
    targetRefs: string[];
    artifactRefs: string[];
    traceEdgeRefs: string[];
  };
}

export type RequirementContractSemanticNodeType =
  | 'requirement'
  | 'scenario'
  | 'sequence_step'
  | 'participant'
  | 'branch'
  | 'ordering'
  | 'temporal'
  | 'target'
  | 'task'
  | 'red'
  | 'oracle'
  | 'acceptance'
  | 'evidence_requirement'
  | 'proof';

export interface RequirementContractSemanticApplicabilityV2 {
  decision: 'applicable';
  reasonCode: 'source_authorized';
  proofRefs: string[];
}

export interface RequirementContractSemanticNodeV2 {
  nodeType: RequirementContractSemanticNodeType;
  bodySchemaVersion: string;
  bodyHash: string;
  applicability: RequirementContractSemanticApplicabilityV2;
  proofBindings: string[];
}

export interface RequirementContractGraphEdgeV2 {
  edgeType: string;
  fromRef: string;
  fromHash: string;
  toRef: string;
  toHash: string;
  applicability: RequirementContractSemanticApplicabilityV2;
  proofBindings: string[];
  edgeHash: string;
}

export interface RequirementContractModelV2 {
  schemaVersion: 'requirement-contract-model/v2';
  activationState: typeof REQUIREMENT_CONTRACT_MODEL_V2_ACTIVATION_STATE;
  recordId: string;
  requirementSetId: string;
  sourceAuthorityHash: string;
  semanticModelHash: string;
  edgeTypeRegistryHash: string;
  authority: 'none';
  semanticBodies: Record<string, Record<string, unknown>>;
  nodes: Record<string, RequirementContractSemanticNodeV2>;
  edges: Record<string, RequirementContractGraphEdgeV2>;
}

export interface RequirementContractModelV2Issue {
  code:
    | 'schema_validation_failed'
    | 'mixed_requirement_id_namespace'
    | 'invalid_authority_state'
    | 'invalid_source_span'
    | 'invalid_sha256'
    | 'duplicate_requirement_id'
    | 'duplicate_edge_id'
    | 'unknown_graph_endpoint'
    | 'kind_id_mismatch'
    | 'invalid_semantic_model_hash'
    | 'invalid_semantic_body_hash'
    | 'unknown_semantic_body'
    | 'node_body_id_mismatch'
    | 'edge_hash_mismatch'
    | 'edge_endpoint_hash_mismatch';
  path: string;
  message: string;
}

export interface RequirementContractModelV2ValidationResult {
  ok: boolean;
  issues: RequirementContractModelV2Issue[];
}

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const CANONICAL_REQUIREMENT_ID_PATTERN = /^(?:MUST-(?:FR|NFR)-\d{3}|NEG-\d{3}|OUT-\d{3})$/u;
const AUTHORITY_STATES = new Set<RequirementContractAuthorityState>([
  'source_grounded',
  'human_confirmed',
  'derived',
  'unresolved',
  'invalid',
]);

function requirementContractModelV2SchemaPath(): string {
  const candidates = [
    path.resolve(
      process.cwd(),
      'packages',
      'bmad-speckit',
      'src',
      'main-agent',
      'source-authority',
      'schemas',
      'requirement-contract-model-v2.schema.json'
    ),
    path.resolve(__dirname, '..', 'schemas', 'requirement-contract-model-v2.schema.json'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function compileRequirementContractModelV2Validator() {
  const schema = JSON.parse(
    readFileSync(requirementContractModelV2SchemaPath(), 'utf8')
  ) as AnySchemaObject;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return {
    model: ajv.compile(schema),
    requirementBody: ajv.compile({
      $schema: schema.$schema,
      $defs: schema.$defs,
      $ref: '#/$defs/requirement',
    }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requirementKindMatchesId(kind: unknown, id: unknown): boolean {
  if (typeof kind !== 'string' || typeof id !== 'string') return false;
  if (kind === 'functional') return /^MUST-FR-\d{3}$/u.test(id);
  if (kind === 'nonfunctional') return /^MUST-NFR-\d{3}$/u.test(id);
  if (kind === 'negative') return /^NEG-\d{3}$/u.test(id);
  if (kind === 'out_of_scope') return /^OUT-\d{3}$/u.test(id);
  return false;
}

function addIssue(
  issues: RequirementContractModelV2Issue[],
  code: RequirementContractModelV2Issue['code'],
  pathValue: string,
  message: string
): void {
  if (issues.some((issue) => issue.code === code && issue.path === pathValue)) return;
  issues.push({ code, path: pathValue, message });
}

export function validateRequirementContractModelV2(
  candidate: unknown
): RequirementContractModelV2ValidationResult {
  const issues: RequirementContractModelV2Issue[] = [];
  const validators = compileRequirementContractModelV2Validator();
  if (!validators.model(candidate)) {
    for (const error of validators.model.errors ?? []) {
      addIssue(
        issues,
        'schema_validation_failed',
        error.instancePath || '/',
        error.message ?? 'schema validation failed'
      );
    }
  }
  if (!isRecord(candidate)) return { ok: false, issues };

  const { semanticModelHash: _semanticModelHash, ...modelPreimage } = candidate;
  if (
    typeof candidate.semanticModelHash === 'string' &&
    candidate.semanticModelHash !== semanticModelHashForContract(modelPreimage)
  ) {
    addIssue(
      issues,
      'invalid_semantic_model_hash',
      '/semanticModelHash',
      'semanticModelHash does not match the canonical model preimage'
    );
  }

  const semanticBodies = isRecord(candidate.semanticBodies) ? candidate.semanticBodies : {};
  for (const [bodyHash, body] of Object.entries(semanticBodies)) {
    if (bodyHash !== sha256Stable(body)) {
      addIssue(
        issues,
        'invalid_semantic_body_hash',
        `/semanticBodies/${bodyHash}`,
        'semantic body key does not match the canonical body hash'
      );
    }
  }

  const nodes = isRecord(candidate.nodes) ? candidate.nodes : {};
  for (const [nodeId, rawNode] of Object.entries(nodes)) {
    if (!isRecord(rawNode)) continue;
    const basePath = `/nodes/${nodeId}`;
    const bodyHash = rawNode.bodyHash;
    if (typeof bodyHash !== 'string' || !isRecord(semanticBodies[bodyHash])) {
      addIssue(
        issues,
        'unknown_semantic_body',
        `${basePath}/bodyHash`,
        `node references an unknown semantic body: ${String(bodyHash)}`
      );
      continue;
    }
    const body = semanticBodies[bodyHash];
    if (typeof body.id === 'string' && body.id !== nodeId) {
      addIssue(
        issues,
        'node_body_id_mismatch',
        `${basePath}/bodyHash`,
        `node ID ${nodeId} does not match semantic body ID ${body.id}`
      );
    }
    if (rawNode.nodeType !== 'requirement') continue;

    if (!CANONICAL_REQUIREMENT_ID_PATTERN.test(nodeId)) {
      addIssue(
        issues,
        'mixed_requirement_id_namespace',
        basePath,
        `requirement node ID is outside the G01 namespace: ${nodeId}`
      );
    }
    if (typeof body.id === 'string' && !CANONICAL_REQUIREMENT_ID_PATTERN.test(body.id)) {
      addIssue(
        issues,
        'mixed_requirement_id_namespace',
        `/semanticBodies/${bodyHash}/id`,
        `requirement body ID is outside the G01 namespace: ${body.id}`
      );
    }
    if (rawNode.bodySchemaVersion !== 'requirement-contract-requirement/v2') continue;

    if (!validators.requirementBody(body)) {
      for (const error of validators.requirementBody.errors ?? []) {
        addIssue(
          issues,
          'schema_validation_failed',
          `/semanticBodies/${bodyHash}${error.instancePath || ''}`,
          error.message ?? 'requirement semantic body schema validation failed'
        );
      }
    }
    if (!requirementKindMatchesId(body.kind, body.id)) {
      addIssue(
        issues,
        'kind_id_mismatch',
        `/semanticBodies/${bodyHash}/kind`,
        'requirement kind does not match its canonical ID namespace'
      );
    }

    const source = isRecord(body.source) ? body.source : {};
    const sourceSpan = isRecord(source.sourceSpan) ? source.sourceSpan : null;
    if (
      sourceSpan &&
      typeof sourceSpan.startLine === 'number' &&
      typeof sourceSpan.endLine === 'number' &&
      sourceSpan.endLine < sourceSpan.startLine
    ) {
      addIssue(
        issues,
        'invalid_source_span',
        `/semanticBodies/${bodyHash}/source/sourceSpan`,
        'source span endLine must be greater than or equal to startLine'
      );
    }
    if (typeof source.sourceHash === 'string' && !SHA256_PATTERN.test(source.sourceHash)) {
      addIssue(
        issues,
        'invalid_sha256',
        `/semanticBodies/${bodyHash}/source/sourceHash`,
        'sourceHash must be a lowercase sha256 digest'
      );
    }

    const authority = isRecord(body.authority) ? body.authority : {};
    if (
      typeof authority.authorityState === 'string' &&
      !AUTHORITY_STATES.has(authority.authorityState as RequirementContractAuthorityState)
    ) {
      addIssue(
        issues,
        'invalid_authority_state',
        `/semanticBodies/${bodyHash}/authority/authorityState`,
        `unsupported authority state: ${authority.authorityState}`
      );
    }
  }

  const edges = isRecord(candidate.edges) ? candidate.edges : {};
  for (const [edgeId, rawEdge] of Object.entries(edges)) {
    if (!isRecord(rawEdge)) continue;
    const basePath = `/edges/${edgeId}`;
    for (const endpoint of ['fromRef', 'toRef'] as const) {
      const value = rawEdge[endpoint];
      if (typeof value === 'string' && !Object.prototype.hasOwnProperty.call(nodes, value)) {
        addIssue(
          issues,
          'unknown_graph_endpoint',
          `${basePath}/${endpoint}`,
          `unknown graph endpoint: ${value}`
        );
      }
    }
    const fromNode = typeof rawEdge.fromRef === 'string' ? nodes[rawEdge.fromRef] : null;
    const toNode = typeof rawEdge.toRef === 'string' ? nodes[rawEdge.toRef] : null;
    if (
      (isRecord(fromNode) && rawEdge.fromHash !== fromNode.bodyHash) ||
      (isRecord(toNode) && rawEdge.toHash !== toNode.bodyHash)
    ) {
      addIssue(
        issues,
        'edge_endpoint_hash_mismatch',
        basePath,
        'edge endpoint hashes do not match the referenced node body hashes'
      );
    }
    const { edgeHash: _edgeHash, ...edgePreimage } = rawEdge;
    if (typeof rawEdge.edgeHash === 'string' && rawEdge.edgeHash !== sha256Stable(edgePreimage)) {
      addIssue(
        issues,
        'edge_hash_mismatch',
        `${basePath}/edgeHash`,
        'edgeHash does not match the canonical edge preimage'
      );
    }
  }

  return { ok: issues.length === 0, issues };
}

function migratedRequirementId(rawId: string): {
  id: string;
  kind: RequirementContractRequirementKind;
} {
  const normalized = rawId.trim().toUpperCase();
  const fr = /^FR-(\d{1,3})$/u.exec(normalized);
  if (fr) return { id: `MUST-FR-${fr[1].padStart(3, '0')}`, kind: 'functional' };
  const nfr = /^NFR-(\d{1,3})$/u.exec(normalized);
  if (nfr) return { id: `MUST-NFR-${nfr[1].padStart(3, '0')}`, kind: 'nonfunctional' };
  const negative = /^NEG-(\d{1,3})$/u.exec(normalized);
  if (negative) return { id: `NEG-${negative[1].padStart(3, '0')}`, kind: 'negative' };
  const out = /^OUT-(\d{1,3})$/u.exec(normalized);
  if (out) return { id: `OUT-${out[1].padStart(3, '0')}`, kind: 'out_of_scope' };
  if (CANONICAL_REQUIREMENT_ID_PATTERN.test(normalized)) {
    const kind: RequirementContractRequirementKind = normalized.startsWith('MUST-NFR-')
      ? 'nonfunctional'
      : normalized.startsWith('MUST-FR-')
        ? 'functional'
        : normalized.startsWith('NEG-')
          ? 'negative'
          : 'out_of_scope';
    return { id: normalized, kind };
  }
  throw new Error(`v1 requirement ID cannot be migrated deterministically: ${rawId}`);
}

function unresolvedMigrationFields(
  requirementId: string
): RequirementContractRequirementV2['unresolved'] {
  return [
    'semantics.actor',
    'semantics.trigger',
    'semantics.preconditions',
    'semantics.action',
    'semantics.postconditions',
    'semantics.invariants',
    'semantics.thresholds',
    'verification.method',
    'verification.oracleRef',
    'verification.commandRefs',
    'verification.expectedObservationRefs',
    'bindings.targetRefs',
    'bindings.artifactRefs',
    'bindings.traceEdgeRefs',
  ].map((field, index) => ({
    id: `UNRESOLVED-${requirementId}-${String(index + 1).padStart(2, '0')}`,
    field,
    question: `Provide source-authorized value for ${field}.`,
    blocking: true,
  }));
}

function migrateV1Requirement(
  requirement: RequirementContractRequirement
): RequirementContractRequirementV2 {
  const identity = migratedRequirementId(requirement.id);
  const sourceHashValue =
    typeof requirement.provenance?.sourceHash === 'string'
      ? requirement.provenance.sourceHash
      : null;
  const sourceGrounded =
    Boolean(requirement.sourcePath) &&
    Boolean(requirement.sourceSpan) &&
    Boolean(sourceHashValue && SHA256_PATTERN.test(sourceHashValue));
  return {
    id: identity.id,
    kind: identity.kind,
    schemaVersion: 'requirement-contract-requirement/v2',
    text: requirement.text,
    source: {
      sourcePath: requirement.sourcePath ?? null,
      sourceSpan: requirement.sourceSpan ?? null,
      sourceHash: sourceHashValue,
      sourceRequirementId: requirement.sourceRequirementId ?? requirement.id,
      headingPath: requirement.headingPath ?? [],
    },
    semantics: {
      actor: null,
      trigger: null,
      preconditions: [],
      action: null,
      postconditions: [],
      invariants: [],
      thresholds: [],
    },
    authority: {
      authorityState: sourceGrounded ? 'source_grounded' : 'unresolved',
      derivation: sourceGrounded ? 'migrated_v1_source_binding' : 'migrated_v1_unresolved',
      decisionReceiptRef: null,
    },
    applicability: {
      state: 'unresolved',
      reasonCode: 'migration_requires_semantic_resolution',
    },
    unresolved: unresolvedMigrationFields(identity.id),
    verification: {
      method: 'unresolved',
      oracleRef: null,
      commandRefs: [],
      expectedObservationRefs: [],
    },
    bindings: {
      targetRefs: [],
      artifactRefs: [],
      traceEdgeRefs: [],
    },
  };
}

export function migrateRequirementContractV1ToV2(
  model: RequirementContractModel
): RequirementContractModelV2 {
  const migratedRequirements = [...model.must, ...model.notDone, ...model.outOfScope].map(
    (requirement) => migrateV1Requirement(requirement)
  );
  if (migratedRequirements.length === 0) {
    throw new Error('v1 requirement model cannot migrate without requirement roots');
  }
  const semanticBodies: RequirementContractModelV2['semanticBodies'] = {};
  const nodes: RequirementContractModelV2['nodes'] = {};
  migratedRequirements.forEach((requirement, index) => {
    const bodyHash = sha256Stable(requirement);
    const proofRef = `MIGRATION-SOURCE-${String(index + 1).padStart(3, '0')}`;
    semanticBodies[bodyHash] = requirement as unknown as Record<string, unknown>;
    nodes[requirement.id] = {
      nodeType: 'requirement',
      bodySchemaVersion: requirement.schemaVersion,
      bodyHash,
      applicability: {
        decision: 'applicable',
        reasonCode: 'source_authorized',
        proofRefs: [proofRef],
      },
      proofBindings: [proofRef],
    };
  });
  const preimage: Omit<RequirementContractModelV2, 'semanticModelHash'> = {
    schemaVersion: 'requirement-contract-model/v2',
    activationState: REQUIREMENT_CONTRACT_MODEL_V2_ACTIVATION_STATE,
    recordId: model.recordId,
    requirementSetId: model.requirementSetId,
    sourceAuthorityHash: sha256Stable({
      schemaVersion: model.schemaVersion,
      recordId: model.recordId,
      requirementSetId: model.requirementSetId,
      sourceBindings: migratedRequirements.map((requirement) => ({
        id: requirement.id,
        source: requirement.source,
        authority: requirement.authority,
      })),
    }),
    edgeTypeRegistryHash: requirementsContractTraceEdgeTypeRegistryHash(),
    authority: 'none',
    semanticBodies,
    nodes,
    edges: {},
  };
  return {
    ...preimage,
    semanticModelHash: semanticModelHashForContract(preimage),
  };
}
