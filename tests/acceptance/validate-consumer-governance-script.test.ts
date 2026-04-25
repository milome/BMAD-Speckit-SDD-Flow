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

  it('reinstalls the root package into consumer node_modules after cleanup', () => {
    expect(content).toContain("Run-Step 'restore-root-package'");
    expect(content).toContain("'install', '--no-save', '--force', \"file:$RepoRoot\"");
    expect(content).toContain("package = 'bmad-speckit-sdd-flow'");
  });

  it('uses unique validation ids instead of destructive reset', () => {
    expect(content).toContain('$ValidationRunId');
    expect(content).toContain('$ValidationRunId-$($check.name)');
    expect(content).toContain('consumer-validation-');
  });

  it('validates the accepted main-agent handoff instead of background worker queue draining', () => {
    expect(content).toContain("Run-Step 'verify-runtime-policy-main-agent-handoff'");
    expect(content).toContain('interactiveMode: main-agent');
    expect(content).toContain('fallbackAutonomousMode: false');
    expect(content).toContain('orchestration_state');
    expect(content).toContain('pending_packet');
    expect(content).not.toContain("Run-Step 'verify-post-tool-use-and-background-worker'");
    expect(content).not.toContain("Run-Step 'verify-execution-closure'");
  });

  it('requires installed party-mode helpers and does not require consumer scripts/party-mode-gate-check.ts', () => {
    expect(content).toContain("Run-Step 'verify-party-mode-helper-surfaces'");
    expect(content).toContain('.cursor/hooks/party-mode-read-current-session.cjs');
    expect(content).toContain('_bmad/runtime/hooks/party-mode-read-current-session.cjs');
    expect(content).toContain('consumerScriptsRequired = $false');
    expect(content).not.toContain("Join-Path $ConsumerRoot 'scripts/party-mode-gate-check.ts'");
  });

  it('forbids unexpected worker-era hook files on the accepted consumer surface', () => {
    expect(content).toContain("Run-Step 'verify-hook-local-main-agent-surfaces'");
    expect(content).toContain('Legacy worker hook-local files are still installed');
    expect(content).toContain('$legacyHookPatterns');
    expect(content).toContain('^run-bmad-.*\\.cjs$');
    expect(content).toContain('^governance-cursor-agent-.*\\.cjs$');
    expect(content).toContain('^governance-.*worker\\.cjs$');
    expect(content).toContain('^governance-.*runner\\.cjs$');
  });
});
