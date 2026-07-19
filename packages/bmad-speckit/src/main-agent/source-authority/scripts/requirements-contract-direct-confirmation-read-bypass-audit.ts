export type DirectConfirmationReadFindingCode =
  | 'direct_legacy_confirmation_field_read'
  | 'direct_v2_logical_model_read'
  | 'direct_physical_bundle_path_read';

export interface DirectConfirmationReadFinding {
  code: DirectConfirmationReadFindingCode;
  path: string;
  line: number;
}

export interface DirectConfirmationReadAuditResult {
  decision: 'pass' | 'block';
  scannedFileCount: number;
  findings: DirectConfirmationReadFinding[];
}

const ALLOWED_OWNER_SUFFIXES = [
  '/requirements-contract-read-facade.ts',
  '/requirements-contract-v1-read-adapter.ts',
  '/requirements-contract-v2-read-adapter.ts',
];

const RULES: Array<{
  code: DirectConfirmationReadFindingCode;
  pattern: RegExp;
}> = [
  {
    code: 'direct_legacy_confirmation_field_read',
    pattern:
      /(?:implementationConfirmation|confirmation)\s*(?:\.\s*(?:must|notDone|outOfScope|traceRows|failurePaths|edgeCases|currentTargetMap)|\[\s*['"](?:must|notDone|outOfScope|traceRows|failurePaths|edgeCases|currentTargetMap)['"]\s*\])/u,
  },
  {
    code: 'direct_v2_logical_model_read',
    pattern:
      /(?:logicalModel|semanticModel|requirementContract)\s*(?:\.\s*(?:semanticBodies|nodes|edges)|\[\s*['"](?:semanticBodies|nodes|edges)['"]\s*\])/u,
  },
  {
    code: 'direct_physical_bundle_path_read',
    pattern:
      /(?:authoring[\\/]revisions[\\/]|(?:semantic-ir|trace-graph|target-bindings|task-graph|red-contracts|oracle-registry|acceptance-contracts|evidence-requirements|business-behavior-delta|implementation-impact-map)\.json)/u,
  },
];

function normalizePath(filePath: string): string {
  return filePath.replaceAll('\\', '/');
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/u).length;
}

export function auditRequirementsContractDirectConfirmationReads(input: {
  files: Array<{ path: string; source: string }>;
  allowedOwnerPaths?: string[];
}): DirectConfirmationReadAuditResult {
  const allowed = new Set((input.allowedOwnerPaths ?? []).map(normalizePath));
  const findings: DirectConfirmationReadFinding[] = [];
  for (const file of input.files) {
    const filePath = normalizePath(file.path);
    if (
      allowed.has(filePath) ||
      ALLOWED_OWNER_SUFFIXES.some((suffix) => filePath.endsWith(suffix))
    ) {
      continue;
    }
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
