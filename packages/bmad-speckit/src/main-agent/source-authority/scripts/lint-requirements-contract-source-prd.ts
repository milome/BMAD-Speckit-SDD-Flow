import fs from 'node:fs';
import path from 'node:path';
import {
  REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES,
  SOURCE_PRD_REQUIRED_SECTION_NAMES,
} from '../rules/requirements-contract-source-prd-rules';

export type EntrySource = 'bmad_prd' | 'session_requirements' | 'source_prd_draft';

interface Args {
  source: string;
  json: boolean;
  entrySource: EntrySource;
  allowInlineConfirmation: boolean;
}

export interface LintIssue {
  code: string;
  message: string;
  target: string;
}

interface TableRow {
  section: string;
  columns: string[];
  cells: Record<string, string>;
}

export interface LintResult {
  ok: boolean;
  status: 'source_prd_draft_ready' | 'source_prd_draft_blocked';
  entrySource: EntrySource;
  sourcePrdDraftReady: boolean;
  blockedReason: string | null;
  issues: LintIssue[];
  counts: {
    requirementRows: number;
    traceRows: number;
    negativeRows: number;
    pathRows: number;
    currentTargetRows: number;
  };
}

const DEFAULT_SOURCE = path.resolve(
  __dirname,
  '..',
  'templates',
  'requirements-contract-source-prd-template.md'
);

function isDirectSourcePrdLintCli(entry: string | undefined): boolean {
  return /(^|[\\/])lint-requirements-contract-source-prd(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    source: DEFAULT_SOURCE,
    json: false,
    entrySource: 'source_prd_draft',
    allowInlineConfirmation: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--source' && argv[index + 1]) {
      args.source = path.resolve(argv[++index]);
    } else if (token === '--json') {
      args.json = true;
    } else if (token === '--entry-source' && argv[index + 1]) {
      const value = argv[++index] as EntrySource;
      if (['bmad_prd', 'session_requirements', 'source_prd_draft'].includes(value)) {
        args.entrySource = value;
      }
    } else if (token === '--allow-inline-confirmation') {
      args.allowInlineConfirmation = true;
    }
  }
  return args;
}

function addIssue(issues: LintIssue[], code: string, target: string, message: string): void {
  issues.push({ code, target, message });
}

function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function headingExists(markdown: string, heading: string): boolean {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`^${escaped}\\s*$`, 'mu').test(markdown);
}

function sectionBody(markdown: string, section: string): string {
  const lines = markdown.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.trim() === `## ${section}`);
  if (start < 0) return '';
  const end = lines.findIndex((line, index) => index > start && /^##\s+/u.test(line));
  return lines.slice(start + 1, end < 0 ? lines.length : end).join('\n');
}

function parseTable(markdown: string, section: string): TableRow[] {
  const body = sectionBody(markdown, section);
  const lines = body
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^\|.+\|$/u.test(line));
  if (lines.length < 2) return [];
  const headerIndex = lines.findIndex((line, index) => index + 1 < lines.length && /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/u.test(lines[index + 1]));
  if (headerIndex < 0) return [];
  const columns = splitTableLine(lines[headerIndex]);
  return lines.slice(headerIndex + 2).map((line) => {
    const values = splitTableLine(line);
    return {
      section,
      columns,
      cells: Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ''])),
    };
  });
}

function splitTableLine(line: string): string[] {
  return line
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell, index, cells) => index > 0 && index < cells.length - 1);
}

function cell(row: TableRow, column: string): string {
  return row.cells[column] ?? '';
}

function idOf(row: TableRow): string {
  return cell(row, 'ID');
}

function isPlaceholder(value: string): boolean {
  return /<[^>]+>/u.test(value) || value.trim() === '';
}

function refsIn(value: string): string[] {
  const prefixes = REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.stableIdPrefixes.join('|');
  const projectedMust = 'MUST-FR|MUST-NFR';
  return [...value.matchAll(new RegExp(`\\b(?:${prefixes}|${projectedMust})-[0-9]{3}\\b`, 'gu'))].map(
    (match) => match[0]
  );
}

function projectedMustId(id: string): string | null {
  if (/^FR-[0-9]{3}$/u.test(id)) return `MUST-${id}`;
  if (/^NFR-[0-9]{3}$/u.test(id)) return `MUST-${id}`;
  return null;
}

function validateRequiredHeadings(markdown: string, sourcePath: string, issues: LintIssue[]): void {
  for (const heading of SOURCE_PRD_REQUIRED_SECTION_NAMES) {
    const literalHeading = heading.startsWith('Requirements Contract Source PRD Template')
      ? `# ${heading}`
      : `## ${heading}`;
    if (!headingExists(markdown, literalHeading)) {
      addIssue(issues, 'required_heading_missing', sourcePath, `Missing heading: ${literalHeading}`);
    }
  }
}

function validateMetadata(markdown: string, sourcePath: string, issues: LintIssue[]): void {
  for (const fragment of REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.sourceMetadataFields) {
    if (!markdown.includes(fragment)) {
      addIssue(issues, 'source_metadata_missing', sourcePath, `Missing source metadata fragment: ${fragment}`);
    }
  }
}

function validateTemplateFragments(
  markdown: string,
  sourcePath: string,
  allowInlineConfirmation: boolean,
  issues: LintIssue[]
): void {
  for (const fragment of REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.finalSchemaForbiddenFragments) {
    if (!allowInlineConfirmation && markdown.includes(fragment)) {
      addIssue(issues, 'inline_implementation_confirmation_forbidden', sourcePath, `Forbidden final schema fragment: ${fragment}`);
    }
  }
  for (const fragment of REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.semanticForbiddenFragments) {
    if (markdown.toLowerCase().includes(fragment.toLowerCase())) {
      const code = fragment.includes('business visual')
        ? 'generic_business_visual_forbidden'
        : fragment.includes('one row')
          ? 'trace_covers_all_must_forbidden'
          : 'weak_semantic_pattern_forbidden';
      addIssue(issues, code, sourcePath, `Forbidden weak semantic fragment: ${fragment}`);
    }
  }
}

function validateTables(markdown: string, sourcePath: string, issues: LintIssue[]): Map<string, TableRow[]> {
  const rowsBySection = new Map<string, TableRow[]>();
  const supportingSections = [
    'Success Criteria',
    'In Scope',
    'Out Of Scope',
    'User Journeys',
    'Negative Requirements And Not Done Conditions',
    'Architecture Decision Records',
    'Failure Matrix',
    'Source Current State',
    'Source Target State',
  ];
  for (const section of supportingSections) {
    rowsBySection.set(section, parseTable(markdown, section));
  }
  for (const section of Object.keys(REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.requiredTableColumns)) {
    const rows = parseTable(markdown, section);
    rowsBySection.set(section, rows);
    if (rows.length === 0) {
      addIssue(issues, 'source_table_missing', sourcePath, `Source table missing for section: ${section}`);
      continue;
    }
    const columns = rows[0]?.columns ?? [];
    for (const requiredColumn of REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.requiredTableColumns[section]) {
      if (!columns.includes(requiredColumn)) {
        addIssue(issues, 'source_table_required_column_missing', sourcePath, `${section} missing column: ${requiredColumn}`);
      }
    }
  }
  return rowsBySection;
}

function validateIdGraph(sourcePath: string, rowsBySection: Map<string, TableRow[]>, issues: LintIssue[]): Set<string> {
  const allRows = [...rowsBySection.values()].flat();
  const known = new Set<string>();
  for (const row of allRows) {
    const id = idOf(row);
    if (!id || isPlaceholder(id)) continue;
    if (known.has(id)) addIssue(issues, 'stable_id_duplicate', sourcePath, `Duplicate ID: ${id}`);
    known.add(id);
    const mustId = projectedMustId(id);
    if (mustId) known.add(mustId);
  }
  for (const row of allRows) {
    const expectedPrefix = row.section === 'Functional Requirements'
      ? 'FR'
      : row.section === 'Non-Functional Requirements'
        ? 'NFR'
        : row.section === 'Negative Requirements And Not Done Conditions'
          ? 'NEG'
          : row.section === 'Out Of Scope'
            ? 'OUT'
            : null;
    const id = idOf(row);
    if (expectedPrefix && !new RegExp(`^${expectedPrefix}-[0-9]{3}$`, 'u').test(id)) {
      addIssue(issues, 'stable_id_format_invalid', sourcePath, `${row.section} ID format invalid: ${id}`);
    }
    for (const ref of refsIn(Object.values(row.cells).join(' '))) {
      if (!known.has(ref)) {
        addIssue(issues, 'orphan_source_binding', sourcePath, `Unresolved source binding: ${ref}`);
      }
    }
  }
  return known;
}

function validateClosure(sourcePath: string, rowsBySection: Map<string, TableRow[]>, issues: LintIssue[]): void {
  const requirementRows = [
    ...(rowsBySection.get('Functional Requirements') ?? []),
    ...(rowsBySection.get('Non-Functional Requirements') ?? []),
  ];
  for (const row of requirementRows) {
    const id = idOf(row);
    for (const required of ['Per-MUST oracle', 'Assertion source', 'Responsibility mapping']) {
      if (isPlaceholder(cell(row, required))) {
        addIssue(issues, 'per_must_closure_missing', sourcePath, `${id} missing ${required}`);
      }
    }
    const assertion = `${cell(row, 'Acceptance link')} ${cell(row, 'Assertion source')}`;
    if (!/\bACC-[0-9]{3}\b/u.test(assertion) || !/\bCMD-[0-9]{3}\b/u.test(assertion) || !/\bTRACE-[0-9]{3}\b/u.test(assertion)) {
      addIssue(issues, 'per_must_closure_missing', sourcePath, `${id} missing ACC/CMD/TRACE closure refs`);
    }
    if (!/\bPATH-[0-9]{3}\b|no-code proof/iu.test(cell(row, 'Responsibility mapping'))) {
      addIssue(issues, 'target_path_or_no_code_missing', sourcePath, `${id} missing PATH or no-code proof`);
    }
  }
}

function validateTrace(sourcePath: string, rowsBySection: Map<string, TableRow[]>, known: Set<string>, issues: LintIssue[]): void {
  const traceRows = rowsBySection.get('Trace Matrix Source') ?? [];
  const mustIds = [...known].filter((id) => /^MUST-(?:FR|NFR)-[0-9]{3}$/u.test(id));
  const covered = new Set<string>();
  for (const row of traceRows) {
    const covers = refsIn(cell(row, 'Covers'));
    if (covers.some((ref) => /^OUT-/u.test(ref))) {
      addIssue(issues, 'out_of_scope_trace_cover_forbidden', sourcePath, `${idOf(row)} covers OUT refs`);
    }
    if (mustIds.length > 1 && mustIds.every((id) => covers.includes(id))) {
      addIssue(issues, 'trace_covers_all_must_forbidden', sourcePath, `${idOf(row)} covers all MUST rows`);
    }
    for (const ref of covers) covered.add(ref);
    for (const required of ['Acceptance refs', 'Per-MUST oracle', 'Per-MUST closure assertion', 'Responsibility mapping']) {
      if (isPlaceholder(cell(row, required))) {
        addIssue(issues, 'trace_closure_missing', sourcePath, `${idOf(row)} missing ${required}`);
      }
    }
  }
  for (const mustId of mustIds) {
    if (!covered.has(mustId)) addIssue(issues, 'trace_closure_missing', sourcePath, `${mustId} is not covered by TRACE`);
  }
}

function validateNegativeScopeAndPaths(sourcePath: string, rowsBySection: Map<string, TableRow[]>, issues: LintIssue[]): void {
  const negativeRows = rowsBySection.get('Negative Requirements And Not Done Conditions') ?? [];
  if (negativeRows.length === 0) addIssue(issues, 'negative_requirement_missing', sourcePath, 'At least one NEG row is required.');
  for (const row of negativeRows) {
    if (!/\bFAIL-[0-9]{3}\b/u.test(cell(row, 'Failure refs')) || !/\b(?:ACC|E2E|CMD)-[0-9]{3}\b/u.test(cell(row, 'Evidence refs'))) {
      addIssue(issues, 'negative_requirement_incomplete', sourcePath, `${idOf(row)} missing failure or evidence refs`);
    }
  }
  const pathRows = rowsBySection.get('Implementation Path Map') ?? [];
  for (const row of pathRows) {
    const repoPath = cell(row, 'Repository path').replace(/`/gu, '');
    if (!repoPath || /^[A-Za-z]:[\\/]/u.test(repoPath) || repoPath.startsWith('/') || repoPath.includes('..')) {
      addIssue(issues, 'target_path_invalid', sourcePath, `${idOf(row)} repository path must be repo-relative`);
    }
    if (isPlaceholder(cell(row, 'Required change')) || isPlaceholder(cell(row, 'Per-MUST oracle'))) {
      addIssue(issues, 'target_path_incomplete', sourcePath, `${idOf(row)} missing change or oracle`);
    }
  }
}

function validateCurrentTarget(sourcePath: string, rowsBySection: Map<string, TableRow[]>, issues: LintIssue[]): void {
  const currentRows = parseTable(readText(sourcePath), 'Source Current State');
  const targetRows = parseTable(readText(sourcePath), 'Source Target State');
  const ctmRows = rowsBySection.get('Current Target Map') ?? [];
  if (currentRows.length === 0 || targetRows.length === 0 || ctmRows.length === 0) {
    addIssue(issues, 'current_target_map_missing', sourcePath, 'Current, target, and CTM rows are required.');
  }
  for (const row of ctmRows) {
    if (!/\bCUR-[0-9]{3}\b/u.test(cell(row, 'Current refs')) || !/\bTGT-[0-9]{3}\b/u.test(cell(row, 'Target refs'))) {
      addIssue(issues, 'current_target_map_missing', sourcePath, `${idOf(row)} missing CUR/TGT refs`);
    }
  }
}

function validateRendererReadiness(markdown: string, sourcePath: string, issues: LintIssue[]): void {
  const required = [
    'Happy-path sequence view',
    'Failure-path sequence view',
    'State and flow view',
    'Edge-case view',
    'Business and governance boundary view',
    'Artifact automation plan',
    'Current-vs-target map',
  ];
  for (const fragment of required) {
    if (!markdown.includes(fragment)) {
      addIssue(issues, 'renderer_readiness_missing', sourcePath, `Missing renderer readiness seed: ${fragment}`);
    }
  }
  if (!markdown.includes('aiTddContractExecutionManifestProjection')) {
    addIssue(issues, 'ai_tdd_manifest_seed_missing', sourcePath, 'Missing AI-TDD manifest projection seed.');
  }
}

export function lintRequirementsContractSourcePrd(input: Partial<Args> = {}): LintResult {
  const args: Args = {
    source: path.resolve(input.source ?? DEFAULT_SOURCE),
    json: Boolean(input.json),
    entrySource: input.entrySource ?? 'source_prd_draft',
    allowInlineConfirmation: Boolean(input.allowInlineConfirmation),
  };
  const issues: LintIssue[] = [];
  if (!fs.existsSync(args.source)) {
    addIssue(issues, 'source_missing', args.source, 'Source PRD file is missing.');
    return result(args, issues, new Map());
  }
  const markdown = readText(args.source);
  validateRequiredHeadings(markdown, args.source, issues);
  validateMetadata(markdown, args.source, issues);
  validateTemplateFragments(markdown, args.source, args.allowInlineConfirmation, issues);
  const rowsBySection = validateTables(markdown, args.source, issues);
  const known = validateIdGraph(args.source, rowsBySection, issues);
  validateClosure(args.source, rowsBySection, issues);
  validateTrace(args.source, rowsBySection, known, issues);
  validateNegativeScopeAndPaths(args.source, rowsBySection, issues);
  validateCurrentTarget(args.source, rowsBySection, issues);
  validateRendererReadiness(markdown, args.source, issues);
  return result(args, issues, rowsBySection);
}

function result(args: Args, issues: LintIssue[], rowsBySection: Map<string, TableRow[]>): LintResult {
  const ok = issues.length === 0;
  return {
    ok,
    status: ok ? 'source_prd_draft_ready' : 'source_prd_draft_blocked',
    entrySource: args.entrySource,
    sourcePrdDraftReady: ok,
    blockedReason: ok ? null : issues[0]?.code ?? 'source_prd_instance_lint_failed',
    issues,
    counts: {
      requirementRows: (rowsBySection.get('Functional Requirements')?.length ?? 0) + (rowsBySection.get('Non-Functional Requirements')?.length ?? 0),
      traceRows: rowsBySection.get('Trace Matrix Source')?.length ?? 0,
      negativeRows: rowsBySection.get('Negative Requirements And Not Done Conditions')?.length ?? 0,
      pathRows: rowsBySection.get('Implementation Path Map')?.length ?? 0,
      currentTargetRows: rowsBySection.get('Current Target Map')?.length ?? 0,
    },
  };
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const lintResult = lintRequirementsContractSourcePrd(args);
  if (args.json) {
    process.stdout.write(`${JSON.stringify(lintResult, null, 2)}\n`);
  } else if (lintResult.ok) {
    process.stdout.write('requirements contract source PRD instance lint ok\n');
  } else {
    process.stderr.write(`${lintResult.issues.map((issue) => issue.code).join('\n')}\n`);
  }
  return lintResult.ok ? 0 : 1;
}

if (require.main === module && isDirectSourcePrdLintCli(process.argv[1])) {
  process.exitCode = main();
}
