import { createHash } from 'node:crypto';

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
  return fences.some((fence) => lineNumber >= fence.span.startLine && lineNumber <= fence.span.endLine);
}

function pathLike(value: string): boolean {
  return (
    /^https?:\/\//iu.test(value) ||
    /^[A-Za-z]:\\/u.test(value) ||
    /^(?:\.{1,2}\/)?[\w.@-]+(?:\/[\w.@-]+)+(?:\/|\.[A-Za-z0-9]+)?$/u.test(value) ||
    /^[\w.@-]+\.(?:md|mdx|rst|ts|tsx|js|cjs|mjs|py|json|ya?ml|toml|ini|cfg|txt)$/iu.test(value)
  );
}

function extractPaths(lines: string[], fences: RequirementSourceFence[]): RequirementSourcePathExtraction {
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
    for (const match of line.matchAll(/(?:\.{1,2}\/)?[\w.@-]+(?:\/[\w.@-]+)+(?:\/|\.[A-Za-z0-9]+)?/gu)) {
      add(match[0], lineNumber);
    }
    for (const match of line.matchAll(/\b[\w.@-]+\.(?:md|mdx|rst|ts|tsx|js|cjs|mjs|py|json|ya?ml|toml|ini|cfg|txt)\b/giu)) {
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

function extractCommands(lines: string[], fences: RequirementSourceFence[]): RequirementSourceCommandExtraction {
  const commandPattern = /\b(?:npx\s+vitest|vitest|pytest|python\s+-m\s+pytest|npm\s+run|pnpm\s+|yarn\s+|node\s+)[^\n|`]*/iu;
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

function extractStaleProjectionBoundaries(lines: string[]): RequirementSourceAst['staleProjectionBoundaries'] {
  const boundaries: RequirementSourceAst['staleProjectionBoundaries'] = [];
  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    const kind =
      lower.includes('implementationconfirmation')
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

export function normalizeRequirementSourceInput(input: RequirementSourceInput): RequirementSourceAst {
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
  measureBefore?: RequirementContractClosureMeasure;
  measureAfter?: RequirementContractClosureMeasure;
  passRegistry?: RequirementContractClosurePass[];
  roundReceipts?: Array<Record<string, unknown>>;
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

export interface RequirementContractCompilerInput {
  recordId: string;
  requirementSetId: string;
  must: RequirementContractRequirement[];
  outOfScope?: RequirementContractBoundary[];
  requiredCommands?: string[];
  targetPaths?: string[];
}
