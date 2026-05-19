import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainDecisionFieldCheck } from '../../scripts/main-agent-decision-field-check';

function writeRecord(root: string, gateChecks: unknown[]): string {
  const recordPath = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-DECISION', 'requirement-record.json');
  fs.mkdirSync(path.dirname(recordPath), { recursive: true });
  fs.writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        recordId: 'REQ-DECISION',
        requirementSetId: 'REQ-DECISION',
        gateChecks,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return recordPath;
}

describe('main-agent decision field check', () => {
  it('passes gateChecks that use decision only', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'decision-field-pass-'));
    try {
      const recordPath = writeRecord(root, [{ gate: 'delivery_closeout', decision: 'pass' }]);
      expect(mainDecisionFieldCheck(['--requirement-record', recordPath, '--json'])).toBe(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks canonical gateChecks that retain result', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'decision-field-result-'));
    try {
      const recordPath = writeRecord(root, [{ gate: 'delivery_closeout', decision: 'pass', result: 'pass' }]);
      expect(mainDecisionFieldCheck(['--requirement-record', recordPath, '--json'])).toBe(1);
      const report = JSON.parse(fs.readFileSync(path.join(path.dirname(recordPath), 'decision-field-check.json'), 'utf8'));
      expect(report.blockingReasons).toContain('gate_check_result_forbidden:delivery_closeout:0');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
