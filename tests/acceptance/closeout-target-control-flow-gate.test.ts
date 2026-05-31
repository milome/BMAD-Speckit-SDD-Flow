import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateCloseoutTargetControlFlowGate } from '../../scripts/target-artifact-realization-gate';

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

function sourceForScript(root: string, scriptPath: string): string {
  const sourcePath = path.join(root, 'source.md');
  writeText(
    sourcePath,
    [
      'implementationConfirmation:',
      '  status: user_confirmed',
      '  currentTargetMap:',
      '    existingArtifacts:',
      '      - currentPath: legacy_completion_event',
      '        completionProofPolicy: legacy_only',
      '    scriptConvergence:',
      `      - scriptOrConfigPath: ${scriptPath.replace(/\\/gu, '/')}`,
      '',
    ].join('\n')
  );
  return sourcePath;
}

describe('closeout target control-flow gate', () => {
  it('fails when a declared closeout script still references legacy completion proof', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'closeout-control-flow-fail-'));
    try {
      const scriptPath = path.join(root, 'scripts', 'generic-delivery-closeout.ts');
      writeText(scriptPath, "const legacy = 'legacy_completion_event';\n");
      const report = evaluateCloseoutTargetControlFlowGate({
        sourcePath: sourceForScript(root, scriptPath),
      });
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toContain(
        'closeout_target_control_flow_uses_legacy_completion_path'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes when declared closeout script does not reference legacy completion proof', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'closeout-control-flow-pass-'));
    try {
      const scriptPath = path.join(root, 'scripts', 'generic-delivery-closeout.ts');
      writeText(scriptPath, "const target = 'target_artifact_realization_gate';\n");
      const report = evaluateCloseoutTargetControlFlowGate({
        sourcePath: sourceForScript(root, scriptPath),
      });
      expect(report.decision).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
