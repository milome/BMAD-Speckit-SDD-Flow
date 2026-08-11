import fs from 'node:fs';
import path from 'node:path';
import {
  REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES,
  SOURCE_PRD_REQUIRED_SECTION_NAMES,
} from '../rules/requirements-contract-source-prd-rules';
import {
  parseRequirementsContractSourceText,
  type RequirementsContractSourceDocument,
} from './requirements-contract-source-parser';

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

function tableRows(document: RequirementsContractSourceDocument, section: string): TableRow[] {
  return document.tables
    .filter((table) => table.headingPath.at(-1) === section)
    .flatMap((table) =>
      table.rows.map((row) => ({
        section,
        columns: table.columns,
        cells: row.cells,
      }))
    );
}

function cell(row: TableRow, column: string): string {
  return row.cells[column] ?? '';
}

function idOf(row: TableRow): string {
  if (row.section === 'Functional Requirements') {
    return cell(row, 'ID') || cell(row, 'FR ID');
  }
  if (row.section === 'Non-Functional Requirements') {
    return cell(row, 'ID') || cell(row, 'NFR ID');
  }
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

function validateRequiredHeadings(
  document: RequirementsContractSourceDocument,
  sourcePath: string,
  issues: LintIssue[]
): void {
  for (const heading of SOURCE_PRD_REQUIRED_SECTION_NAMES) {
    const level = heading.startsWith('Requirements Contract Source PRD Template') ? 1 : 2;
    const literalHeading = `${'#'.repeat(level)} ${heading}`;
    if (
      !document.headings.some(
        (candidate) => candidate.level === level && candidate.text === heading
      )
    ) {
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

function validateTables(
  document: RequirementsContractSourceDocument,
  sourcePath: string,
  issues: LintIssue[]
): Map<string, TableRow[]> {
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
    rowsBySection.set(section, tableRows(document, section));
  }
  for (const section of Object.keys(REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.requiredTableColumns)) {
    const rows = tableRows(document, section);
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
  const parsed = parseRequirementsContractSourceText(markdown, { sourcePath: args.source });
  if (!parsed.ok) {
    for (const parserIssue of parsed.issues) {
      addIssue(
        issues,
        parserIssue.code,
        `${args.source}:${parserIssue.startLine}`,
        parserIssue.message
      );
    }
    return result(args, issues, new Map());
  }
  validateRequiredHeadings(parsed.document, args.source, issues);
  validateMetadata(markdown, args.source, issues);
  validateTemplateFragments(markdown, args.source, args.allowInlineConfirmation, issues);
  const rowsBySection = validateTables(parsed.document, args.source, issues);
  validateIdGraph(args.source, rowsBySection, issues);
  return result(args, issues, rowsBySection);
}

export interface RequirementsContractIrProjectionExpectation {
  semanticNodeId: string;
  text: string;
  logicalAuthorityRefs: string[];
}

type ProjectionBlock = RequirementsContractSourceDocument['blocks'][number];

function canonicalProjectionText(value: string): string {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

function projectionBlockOwnerId(block: ProjectionBlock): string | null {
  if (block.table) {
    for (const column of ['ID', 'FR ID', 'NFR ID', 'Semantic Node ID']) {
      const value = block.table.cells[column]?.trim();
      if (value) return value;
    }
    return null;
  }
  return refsIn(block.text)[0] ?? null;
}

function projectionBlockHasText(block: ProjectionBlock, expectedText: string): boolean {
  const expected = canonicalProjectionText(expectedText);
  return expected.length > 0 && canonicalProjectionText(block.text).includes(expected);
}

function projectionBlockHasExactToken(block: ProjectionBlock, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9_.:/-])${escaped}(?=$|[^A-Za-z0-9_.:/-])`, 'u')
    .test(block.text);
}

export function verifyRequirementsContractSourcePrdProjection(input: {
  source: string;
  frozenScopeSemanticHash: string;
  expectedNodes: RequirementsContractIrProjectionExpectation[];
}) {
  const sourcePath = path.resolve(input.source);
  const issues: LintIssue[] = [];
  if (!/^sha256:[a-f0-9]{64}$/u.test(input.frozenScopeSemanticHash)) {
    addIssue(issues, 'projection_scope_semantic_hash_invalid', sourcePath, 'Frozen IR identity is required.');
    return { ok: false, authority: 'frozen_semantic_ir' as const, issues };
  }
  if (!fs.existsSync(sourcePath)) {
    addIssue(issues, 'projection_source_missing', sourcePath, 'Projected Markdown is missing.');
    return { ok: false, authority: 'frozen_semantic_ir' as const, issues };
  }
  const markdown = readText(sourcePath);
  const parsed = parseRequirementsContractSourceText(markdown, { sourcePath });
  for (const issue of parsed.issues) {
    addIssue(issues, issue.code, `${sourcePath}:${issue.startLine}`, issue.message);
  }
  if (!parsed.ok) {
    return { ok: false, authority: 'frozen_semantic_ir' as const, issues };
  }
  const blocks = parsed.document.blocks;
  for (const expected of input.expectedNodes) {
    if (expected.logicalAuthorityRefs.length === 0) {
      addIssue(issues, 'projection_expected_authority_ref_missing', sourcePath, expected.semanticNodeId);
      continue;
    }
    const owners = blocks.filter(
      (block) => projectionBlockOwnerId(block) === expected.semanticNodeId
    );
    if (owners.length === 0) {
      addIssue(issues, 'projection_semantic_node_missing', sourcePath, expected.semanticNodeId);
      continue;
    }
    if (owners.length > 1) {
      addIssue(issues, 'projection_semantic_node_duplicate', sourcePath, expected.semanticNodeId);
      continue;
    }
    const owner = owners[0];
    if (!projectionBlockHasText(owner, expected.text)) {
      addIssue(issues, 'projection_semantic_text_drift', sourcePath, expected.semanticNodeId);
    }
    if (expected.logicalAuthorityRefs.some(
      (authorityRef) => !projectionBlockHasExactToken(owner, authorityRef)
    )) {
      addIssue(issues, 'projection_logical_authority_ref_drift', sourcePath, expected.semanticNodeId);
    }
    if (blocks.filter((block) => projectionBlockHasText(block, expected.text)).length > 1) {
      addIssue(issues, 'projection_semantic_text_duplicate', sourcePath, expected.semanticNodeId);
    }
  }
  return {
    ok: issues.length === 0,
    authority: 'frozen_semantic_ir' as const,
    frozenScopeSemanticHash: input.frozenScopeSemanticHash,
    checkedSemanticNodeIds: input.expectedNodes.map((node) => node.semanticNodeId).sort(),
    issues,
  };
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
