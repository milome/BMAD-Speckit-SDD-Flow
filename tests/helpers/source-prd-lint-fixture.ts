import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function writePassingSourcePrdLintReport(input: {
  requirementRecordPath: string;
  sourcePath: string;
}): string {
  const sourcePath = path.resolve(input.sourcePath);
  const reportPath = path.join(
    path.dirname(path.resolve(input.requirementRecordPath)),
    'authoring',
    'source-prd-instance-lint-report.json'
  );
  const sourceHash = `sha256:${createHash('sha256')
    .update(readFileSync(sourcePath))
    .digest('hex')}`;
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        schemaVersion: 'requirements-contract-source-prd-instance-lint-report/v1',
        stage: 'test-fixture',
        entrySource: 'source_prd_draft',
        sourcePath,
        sourceHash,
        sourcePrdDraftReady: true,
        status: 'source_prd_draft_ready',
        blockedReason: null,
        ok: true,
        counts: {
          requirementRows: 0,
          traceRows: 0,
          negativeRows: 0,
          pathRows: 0,
          currentTargetRows: 0,
        },
        issues: [],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return reportPath;
}
