import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import AIRegistry from '../../packages/bmad-speckit/src/services/ai-registry.js';
import { validateSelectedAITargets } from '../../packages/bmad-speckit/src/commands/check.js';

const ROOT = path.join(import.meta.dirname, '..', '..');

function listFiles(root: string, suffix: string): string[] {
  const out: string[] = [];
  function walk(current: string): void {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      if (entry.isFile() && entry.name.endsWith(suffix)) out.push(full);
    }
  }
  walk(root);
  return out.sort((a, b) => a.localeCompare(b));
}

describe('Codex agent parity with Claude branch', () => {
  it('generates one Codex TOML agent for every Claude markdown agent plus dispatch role aliases', () => {
    execSync('node scripts/generate-codex-agents-from-claude.js --check', {
      cwd: ROOT,
      stdio: 'pipe',
    });

    const claudeRoot = path.join(ROOT, '_bmad', 'claude', 'agents');
    const codexRoot = path.join(ROOT, '_bmad', 'codex', 'agents');
    const claudeAgents = listFiles(claudeRoot, '.md').map((file) =>
      path.relative(claudeRoot, file).replace(/\\/g, '/').replace(/\.md$/u, '.toml')
    );
    const codexAgents = new Set(
      listFiles(codexRoot, '.toml').map((file) => path.relative(codexRoot, file).replace(/\\/g, '/'))
    );

    for (const agent of claudeAgents) {
      expect(codexAgents.has(agent)).toBe(true);
      const content = fs.readFileSync(path.join(codexRoot, agent), 'utf8');
      expect(content).toContain('developer_instructions = """');
      expect(content).toContain('Source behavior contract:');
      expect(content).not.toContain('Source Claude agent:');
      expect(content).not.toContain('.claude/');
    }

    for (const alias of [
      'implementation-worker.toml',
      'remediation-worker.toml',
      'document-worker.toml',
      'general-purpose.toml',
      'codex-no-hooks-worker.toml',
    ]) {
      expect(codexAgents.has(alias)).toBe(true);
    }
  });

  it('installs Codex custom agents into a consumer project and tracks them in the install manifest', () => {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-agent-install-'));
    try {
      execSync(`node scripts/init-to-root.js --agent codex "${target}"`, {
        cwd: ROOT,
        stdio: 'pipe',
      });

      const runtimeAgent = path.join(target, '.codex', 'agents', 'implementation-worker.toml');
      const nestedAgent = path.join(target, '.codex', 'agents', 'layers', 'bmad-layer4-speckit-implement.toml');
      expect(fs.existsSync(runtimeAgent)).toBe(true);
      expect(fs.existsSync(nestedAgent)).toBe(true);
      expect(fs.readFileSync(runtimeAgent, 'utf8')).toContain('name = "implementation-worker"');

      const readme = fs.readFileSync(path.join(target, '.codex', 'README.md'), 'utf8');
      expect(readme).toContain('Custom Codex agents');

      const manifestPath = path.join(
        target,
        '_bmad-output',
        'config',
        'bmad-speckit-install-manifest.json'
      );
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        managed_surface: Array<{ path: string }>;
      };
      const paths = manifest.managed_surface.map((entry) => entry.path);
      expect(paths).toContain('.codex/agents/implementation-worker.toml');
      expect(paths).toContain('.codex/agents/layers');
      expect(paths).toContain('.codex/protocols/audit-result-schema.md');
      expect(paths).toContain('.codex/skills/speckit-workflow');
      expect(fs.existsSync(path.join(target, '.codex', 'protocols', 'handoff-schema.md'))).toBe(true);
      expect(fs.existsSync(path.join(target, '.codex', 'skills', 'bmad-story-assistant', 'SKILL.md'))).toBe(true);
      expect(validateSelectedAITargets(target, 'codex')).toEqual({ valid: true, missing: [] });
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }, 90_000);

  it('declares Codex as native custom-agent capable and fails check when agents are missing', () => {
    const entry = AIRegistry.getById('codex', { cwd: ROOT });
    expect(entry?.configTemplate?.agentsDir).toBe('.codex/agents');
    expect(entry?.configTemplate?.protocolsDir).toBe('.codex/protocols');
    expect(entry?.configTemplate?.subagentSupport).toBe('native');

    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-agent-check-'));
    try {
      fs.mkdirSync(path.join(target, '.codex', 'commands'), { recursive: true });
      const result = validateSelectedAITargets(target, 'codex');
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('.codex/agents');
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  });
});
