export type DirectParserBypassFindingCode =
  | 'raw_pipe_table_parser'
  | 'direct_confirmation_parser'
  | 'local_required_heading_registry';

export interface DirectParserBypassFinding {
  code: DirectParserBypassFindingCode;
  path: string;
  line: number;
}

export interface DirectParserBypassAuditResult {
  decision: 'pass' | 'block';
  scannedFileCount: number;
  findings: DirectParserBypassFinding[];
}

const RULES: Array<{
  code: DirectParserBypassFindingCode;
  pattern: RegExp;
}> = [
  {
    code: 'raw_pipe_table_parser',
    pattern: /\.split\s*\(\s*['"]\|['"]\s*\)/u,
  },
  {
    code: 'direct_confirmation_parser',
    pattern:
      /(?:\.match\s*\(\s*\/[^/\n]*implementationConfirmation|new\s+RegExp\s*\([^)]*implementationConfirmation)/u,
  },
  {
    code: 'local_required_heading_registry',
    pattern: /\b(?:const|let|var)\s+REQUIRED_(?:HEADINGS|SECTIONS)\b/u,
  },
];

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/u).length;
}

export function auditRequirementsContractDirectParserBypass(input: {
  files: Array<{ path: string; source: string }>;
}): DirectParserBypassAuditResult {
  const findings: DirectParserBypassFinding[] = [];
  for (const file of input.files) {
    for (const rule of RULES) {
      const match = rule.pattern.exec(file.source);
      if (!match) continue;
      findings.push({
        code: rule.code,
        path: file.path,
        line: lineAt(file.source, match.index),
      });
    }
  }
  return {
    decision: findings.length === 0 ? 'pass' : 'block',
    scannedFileCount: input.files.length,
    findings,
  };
}
