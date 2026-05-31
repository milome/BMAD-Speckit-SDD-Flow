import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluatePreRerunAntiFalsePositiveGate } from '../../scripts/pre-rerun-anti-false-positive-gate';

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

describe('pre-rerun anti false positive gate', () => {
  it('fails old false-positive paths before TRACE rerun can start', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'pre-rerun-fail-'));
    try {
      const sourcePath = path.join(root, 'source.md');
      const missingTest = path
        .join(root, 'tests', 'acceptance', 'missing-target.test.ts')
        .replace(/\\/gu, '/');
      writeText(
        sourcePath,
        [
          'implementationConfirmation:',
          '  status: reconfirm_required',
          '  requiredCommands:',
          '    - id: CMD-MISSING-FILE',
          `      command: npx vitest run ${missingTest}`,
          '  artifactAutomationPlan: []',
          '  governanceEventTypeRegistry:',
          '    - eventType: generic_result_recorded',
          '      payloadKind: model_result',
          '      writesControlFields: [genericCanonicalField]',
          '      allowedWriterRefs: []',
          '      payloadContract:',
          '        allowedControlWriteMode: append_only_event_then_reduce',
          '  controlledIngestWriterRegistry: []',
          '  currentTargetMap:',
          '    canonicalArtifacts:',
          '      - targetPathOrField: RequirementRecord.genericCanonicalField',
          '    pathRegistry: []',
          '    existingArtifacts:',
          '      - currentPath: legacy_completion_event',
          '        completionProofPolicy: legacy_only',
          '    scriptConvergence:',
          '      - scriptOrConfigPath: scripts/main-agent-delivery-closeout-gate.ts',
          '  confirmationRender:',
          `    reportPath: ${path.join(root, 'confirmation-render-report.json').replace(/\\/gu, '/')}`,
          '',
        ].join('\n')
      );
      writeJson(path.join(root, 'confirmation-render-report.json'), {
        deliveryReadiness: { ready: false, status: 'delivery_not_ready' },
        blockingIssues: [],
      });
      const recordPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        'REQ-PRE',
        'requirement-record.json'
      );
      const record = {
        recordId: 'REQ-PRE',
        requirementSetId: 'REQ-PRE',
        sourcePath,
        status: 'user_confirmed',
        implementationConfirmationHash:
          'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        closeout: { currentAttemptId: 'attempt-pre' },
        artifactIndex: [],
        executionIterations: [],
      };
      writeJson(recordPath, record);
      const report = evaluatePreRerunAntiFalsePositiveGate({
        sourcePath,
        record,
        recordPath,
        attemptId: 'attempt-pre',
      });
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toContain('required_command_file_missing');
      expect(report.blockingReasons).toContain('target_record_field_missing');
      expect(report.blockingReasons).toContain('canonical_schema_field_missing');
      expect(report.blockingReasons).toContain('canonical_event_writer_registry_missing');
      expect(report.blockingReasons).toContain('reverse_audit_delivery_readiness_not_ready');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
