import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, encoding: 'utf8' });
}

function runResolveSessionHook(
  hookPath: string,
  projectRoot: string,
  userMessage: string
): string {
  const result = spawnSync(process.execPath, [hookPath], {
    cwd: projectRoot,
    input: JSON.stringify({
      projectRoot,
      userMessage,
      recentMessages: [],
      writeContext: true,
    }),
    encoding: 'utf8',
  });
  expect(result.status).toBe(0);
  return result.stdout || '';
}

describe('facilitator runtime consumer integration', () => {
  it('fresh consumer install can materialize facilitator runtime targets for both hosts', () => {
    const target = mkdtempSync(join(tmpdir(), 'facilitator-consumer-'));
    try {
      run(`node scripts/init-to-root.js --full --agent cursor "${target}"`, repoRoot);
      run(`node scripts/init-to-root.js --full --agent claude-code "${target}"`, repoRoot);

      expect(existsSync(join(target, '.cursor', 'hooks', 'resolve-for-session.cjs'))).toBe(true);
      expect(existsSync(join(target, '.claude', 'hooks', 'resolve-for-session.cjs'))).toBe(true);

      runResolveSessionHook(
        join(target, '.cursor', 'hooks', 'resolve-for-session.cjs'),
        target,
        'Please answer in English.'
      );
      runResolveSessionHook(
        join(target, '.claude', 'hooks', 'resolve-for-session.cjs'),
        target,
        'Please answer in English.'
      );

      const cursorRuntime = readFileSync(
        join(target, '.cursor', 'agents', 'party-mode-facilitator.md'),
        'utf8'
      );
      const claudeRuntime = readFileSync(
        join(target, '.claude', 'agents', 'party-mode-facilitator.md'),
        'utf8'
      );

      expect(cursorRuntime).toContain('resolvedMode=en');
      expect(claudeRuntime).toContain('resolvedMode=en');
      expect(cursorRuntime).toContain('_bmad/cursor/agents/party-mode-facilitator.en.md');
      expect(claudeRuntime).toContain('_bmad/claude/agents/party-mode-facilitator.en.md');
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 120000);

  it('re-materializes the same consumer runtime target across zh -> en -> bilingual -> zh', () => {
    const target = mkdtempSync(join(tmpdir(), 'facilitator-switch-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'consumer-app', version: '1.0.0', private: true }),
        'utf8'
      );
      const pkgPath = repoRoot.replace(/\\/g, '/');
      run(`npm install --save-dev "file:${pkgPath}"`, target);

      const hook = join(target, '.cursor', 'hooks', 'resolve-for-session.cjs');
      expect(existsSync(hook)).toBe(true);

      const runtimePath = join(target, '.cursor', 'agents', 'party-mode-facilitator.md');

      runResolveSessionHook(hook, target, '请用中文回答');
      const zhRuntime = readFileSync(runtimePath, 'utf8');
      expect(zhRuntime).toContain('resolvedMode=zh');
      expect(zhRuntime).toContain('_bmad/cursor/agents/party-mode-facilitator.zh.md');

      runResolveSessionHook(hook, target, 'Please answer in English.');
      const enRuntime = readFileSync(runtimePath, 'utf8');
      expect(enRuntime).toContain('resolvedMode=en');
      expect(enRuntime).toContain('_bmad/cursor/agents/party-mode-facilitator.en.md');
      expect(enRuntime).not.toBe(zhRuntime);

      runResolveSessionHook(hook, target, '请中英双语输出');
      const bilingualRuntime = readFileSync(runtimePath, 'utf8');
      expect(bilingualRuntime).toContain('resolvedMode=bilingual');
      expect(bilingualRuntime).toContain('_bmad/cursor/agents/party-mode-facilitator.zh.md');
      expect(bilingualRuntime).not.toBe(enRuntime);

      runResolveSessionHook(hook, target, '请用中文回答');
      const zhAgainRuntime = readFileSync(runtimePath, 'utf8');
      expect(zhAgainRuntime).toContain('resolvedMode=zh');
      expect(zhAgainRuntime).toContain('_bmad/cursor/agents/party-mode-facilitator.zh.md');
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 120000);
});
