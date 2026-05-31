import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateCanonicalSchemaReducerGate } from '../../scripts/target-artifact-realization-gate';

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

function sourceWithField(root: string, field: string): string {
  const sourcePath = path.join(root, 'source.md');
  writeText(
    sourcePath,
    [
      'implementationConfirmation:',
      '  status: user_confirmed',
      '  currentTargetMap:',
      '    canonicalArtifacts:',
      `      - targetPathOrField: RequirementRecord.${field}`,
      '',
    ].join('\n')
  );
  return sourcePath;
}

describe('canonical schema reducer gate', () => {
  it('fails when a declared canonical record field is not accepted by schema and reducer', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'schema-reducer-fail-'));
    try {
      const report = evaluateCanonicalSchemaReducerGate({
        sourcePath: sourceWithField(root, 'genericMissingCanonicalField'),
        record: { recordId: 'REQ-SCHEMA', requirementSetId: 'REQ-SCHEMA' },
      });
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toContain('canonical_schema_field_missing');
      expect(report.blockingReasons).toContain('canonical_reducer_field_missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes for an existing declared canonical record field', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'schema-reducer-pass-'));
    try {
      const report = evaluateCanonicalSchemaReducerGate({
        sourcePath: sourceWithField(root, 'sourcePath'),
        record: {
          recordId: 'REQ-SCHEMA',
          requirementSetId: 'REQ-SCHEMA',
          sourcePath: 'docs/requirements/source.md',
        },
      });
      expect(report.decision).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
