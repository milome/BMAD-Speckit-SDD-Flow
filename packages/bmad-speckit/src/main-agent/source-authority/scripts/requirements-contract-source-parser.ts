import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES } from '../rules/requirements-contract-source-prd-rules';

export interface RequirementsContractParserIssue {
  code: string;
  message: string;
  sourcePath: string;
  startLine: number;
  endLine: number;
  refs: string[];
}

export interface RequirementsContractSourceTableRow {
  startLine: number;
  endLine: number;
  values: string[];
  cells: Record<string, string>;
  rawText: string;
}

export interface RequirementsContractSourceTable {
  headingPath: string[];
  columns: string[];
  startLine: number;
  endLine: number;
  rows: RequirementsContractSourceTableRow[];
}

export interface RequirementsContractSourceBlock {
  kind: 'paragraph' | 'list_item' | 'table_row';
  startLine: number;
  endLine: number;
  headingPath: string[];
  rawText: string;
  text: string;
  table?: {
    columns: string[];
    values: string[];
    cells: Record<string, string>;
  };
}

export interface RequirementsContractSourceDocument {
  schemaVersion: 'requirements-contract-markdown-source-ast/v1';
  parserVersion: 'requirements-contract-markdown-source-parser/v1';
  sourcePath: string;
  sourceHash: string;
  hadBom: boolean;
  lineEnding: 'crlf' | 'lf' | 'cr' | 'mixed' | 'none';
  lineCount: number;
  headings: Array<{
    level: number;
    text: string;
    startLine: number;
    endLine: number;
  }>;
  tables: RequirementsContractSourceTable[];
  yamlRootBlocks: Array<{
    key: string;
    startLine: number;
    endLine: number;
    rawText: string;
  }>;
  blocks: RequirementsContractSourceBlock[];
}

export type RequirementsContractSourceParseResult =
  | {
      ok: true;
      document: RequirementsContractSourceDocument;
      issues: [];
    }
  | {
      ok: false;
      document: null;
      issues: RequirementsContractParserIssue[];
    };

interface CanonicalParserModule {
  parseRequirementsContractMarkdown(
    source: string,
    options: { sourcePath: string; authorityRootKeys: string[] }
  ): RequirementsContractSourceParseResult;
}

const requireCommonJs = createRequire(__filename);

function canonicalParserPath(): string {
  const packageRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const repositoryRoot = path.resolve(packageRoot, '..', '..');
  const relativePath = path.join(
    '_bmad',
    'shared',
    'requirements-contract',
    'markdown-source-parser.js'
  );
  const candidates = [
    path.join(packageRoot, relativePath),
    path.join(repositoryRoot, relativePath),
  ];
  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  if (!resolved) {
    throw new Error(`Canonical requirements parser is missing: ${candidates.join(', ')}`);
  }
  return resolved;
}

function authorityRootKeys(): string[] {
  return REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.finalSchemaForbiddenFragments.flatMap(
    (fragment) => {
      const match = fragment.match(/^([A-Za-z_][A-Za-z0-9_-]*):/u);
      return match ? [match[1]] : [];
    }
  );
}

let cachedParser: CanonicalParserModule | null = null;

function canonicalParser(): CanonicalParserModule {
  if (!cachedParser) {
    cachedParser = requireCommonJs(canonicalParserPath()) as CanonicalParserModule;
  }
  return cachedParser;
}

export function parseRequirementsContractSourceText(
  source: string,
  input: { sourcePath: string }
): RequirementsContractSourceParseResult {
  return canonicalParser().parseRequirementsContractMarkdown(source, {
    sourcePath: input.sourcePath,
    authorityRootKeys: authorityRootKeys(),
  });
}

export function parseRequirementsContractSourceFile(
  sourcePath: string
): RequirementsContractSourceParseResult {
  const resolved = path.resolve(sourcePath);
  return parseRequirementsContractSourceText(fs.readFileSync(resolved, 'utf8'), {
    sourcePath: resolved,
  });
}
