import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('validate-consumer-governance script safety', () => {
  const scriptPath = 'scripts/validate-consumer-governance.ps1';
  const content = readFileSync(scriptPath, 'utf8');

  it('does not delete _bmad-output during consumer reinstall', () => {
    expect(content).toContain("Run-Step 'cleanup-install-surface'");
    expect(content).not.toContain("@('_bmad', '_bmad-output'");
    expect(content).not.toContain("'_bmad-output', '.claude'");
    expect(content).not.toContain("Remove-PathWithRetry (Join-Path $ProjectRoot '_bmad-output");
    expect(content).not.toContain('Reset-GovernanceState');
  });

  it('documents _bmad-output as runtime artifacts to preserve', () => {
    expect(content).toContain('_bmad-output contains runtime artifacts');
    expect(content).toContain('cleanup-install-surface');
    expect(content).toContain('preserved');
  });

  it('uses unique validation ids instead of destructive reset', () => {
    expect(content).toContain('$ValidationRunId');
    expect(content).toContain('qa.readiness.$ValidationRunId');
    expect(content).toContain('$ValidationRunId-auto-attempt.md');
  });

  it('verifies the real launch wrapper path instead of placeholder dispatch only', () => {
    expect(content).toContain('BMAD_GOVERNANCE_CLAUDE_LAUNCH_COMMAND');
    expect(content).toContain('consumer-validation-launch');
    expect(content).toContain('Launch wrapper did not write receipt file');
    expect(content).toContain('authoritativeHost: claude');
  });
});
