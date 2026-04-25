import { readFileSync, mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

describe('architecture pre-continue gate hook', () => {
  it('declares architecture gate config', () => {
    const yaml = readFileSync(join(ROOT, '_bmad', '_config', 'architecture-gates.yaml'), 'utf8');
    const routing = readFileSync(join(ROOT, '_bmad', '_config', 'continue-gate-routing.yaml'), 'utf8');
    expect(yaml).toContain('schema: unified_gate_v1');
    expect(yaml).toContain('architecture_contract_gate');
    expect(yaml).toContain('brief_contract_gate');
    expect(yaml).toContain('prd_contract_gate');
    expect(yaml).toContain('readiness_blocker_gate');
    expect(yaml).toContain('阻止 Continue');
    expect(routing).toContain('bmad-create-architecture');
    expect(routing).toContain('bmad-create-story');
    expect(routing).toContain('speckit-workflow');
  });

  it('fails when architecture sections are empty placeholders', () => {
    const project = mkdtempSync(join(tmpdir(), 'arch-gate-fail-'));
    try {
      mkdirSync(join(project, '_bmad', '_config'), { recursive: true });
      mkdirSync(join(project, '_bmad-output', 'planning-artifacts', 'dev'), { recursive: true });
      writeFileSync(
        join(project, '_bmad', '_config', 'architecture-gates.yaml'),
        readFileSync(join(ROOT, '_bmad', '_config', 'architecture-gates.yaml'), 'utf8'),
        'utf8'
      );
      writeFileSync(
        join(project, '_bmad-output', 'planning-artifacts', 'dev', 'architecture.md'),
        [
          '## P0 Key Path Sequences',
          '{{journey_key_path_sequences}}',
          '',
          '## Business Completion State vs System Completion State',
          '{{completion_state_decisions}}',
          '',
          '## Sync / Async Boundaries',
          '{{boundary_decisions}}',
          '',
          '## Fallback And Compensation Strategy',
          '{{fallback_and_compensation_decisions}}',
          '',
          '## Minimum Observability Contract',
          '{{observability_contract}}',
          '',
          '## Testability And Smoke E2E Preconditions',
          '{{smoke_e2e_preconditions}}',
        ].join('\n'),
        'utf8'
      );

      let stdout = '';
      let stderr = '';
      let status = 0;
      try {
        stdout = execFileSync(process.execPath, [join(ROOT, '_bmad', 'runtime', 'hooks', 'pre-continue-check.cjs'), 'bmad-create-architecture', 'step-04-decisions'], {
          cwd: project,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (error: any) {
        stdout = error.stdout || '';
        stderr = error.stderr || '';
        status = error.status ?? 1;
      }

      expect(status).toBe(2);
      expect(stdout).toContain('"ok":false');
      expect(stdout).toContain('"workflow":"bmad-create-architecture"');
      expect(stderr).toContain('GateFailure');
      expect(stderr).toContain('RemediationPlan');
      const stageEventDir = join(
        project,
        '_bmad-output',
        'runtime',
        'governance',
        'queue',
        'pending-events'
      );
      expect(readdirSync(stageEventDir).some((file) => file.endsWith('.json'))).toBe(true);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('sync/install wiring includes pre-continue-check for claude and cursor', () => {
    const initScript = readFileSync(join(ROOT, 'scripts', 'init-to-root.js'), 'utf8');
    const syncService = readFileSync(join(ROOT, 'packages', 'bmad-speckit', 'src', 'services', 'sync-service.js'), 'utf8');
    const claudeSettings = readFileSync(join(ROOT, '_bmad', 'claude', 'settings.json'), 'utf8');

    expect(initScript).toContain('pre-continue-check.cjs');
    expect(syncService).toContain('pre-continue-check.cjs');
    expect(claudeSettings).toContain('pre-continue-check.cjs');
    expect(initScript).not.toContain('preToolUseCommands');
    expect(initScript).toContain('preToolUse');
    expect(claudeSettings).toContain('runtime-policy-inject.cjs --subagent-start');
    expect(syncService).toContain('deployPreContinueGateConfig');
    expect(initScript).toContain('continue-gate-routing.yaml');
    expect(syncService).toContain('continue-gate-routing.yaml');
    expect(syncService).toContain("'_bmad-output', 'runtime', 'context', 'project.json'");
    expect(syncService).not.toContain(".bmad', 'runtime-context.json");
  });

  it('consumer install produces pre-continue hook files', () => {
    const target = mkdtempSync(join(tmpdir(), 'arch-gate-install-'));
    try {
      execFileSync(process.execPath, [join(ROOT, 'scripts', 'init-to-root.js'), target, '--agent', 'claude-code'], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      execFileSync(process.execPath, [join(ROOT, 'scripts', 'init-to-root.js'), target, '--agent', 'cursor'], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      expect(existsSync(join(target, '.claude', 'hooks', 'pre-continue-check.cjs'))).toBe(true);
      expect(existsSync(join(target, '.cursor', 'hooks', 'pre-continue-check.cjs'))).toBe(true);
      const cursorHooksJson = readFileSync(join(target, '.cursor', 'hooks.json'), 'utf8');
      const claudeSettingsJson = readFileSync(join(target, '.claude', 'settings.json'), 'utf8');
      expect(cursorHooksJson).toContain('pre-continue-check.cjs');
      expect(cursorHooksJson).not.toContain('preToolUseCommands');
      expect(cursorHooksJson).toContain('subagentStop');
      expect(existsSync(join(target, '.cursor', 'hooks', 'subagent-result-summary.cjs'))).toBe(true);
      expect(claudeSettingsJson).toContain('runtime-policy-inject.cjs');
      expect(claudeSettingsJson).not.toContain('runtime-policy-inject.js');
      expect(claudeSettingsJson).toContain('WorktreeCreate');
      expect(claudeSettingsJson).toContain('SubagentStart');
      expect(claudeSettingsJson).toContain('SubagentStop');
      expect(existsSync(join(target, '_bmad', '_config', 'architecture-gates.yaml'))).toBe(true);
      expect(existsSync(join(target, '_bmad', '_config', 'continue-gate-routing.yaml'))).toBe(true);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 90_000);
});
