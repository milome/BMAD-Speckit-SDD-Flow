import { execSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listUnexpectedLegacyConsumerHookFiles } from '../../packages/bmad-speckit/src/services/install-surface-manifest';

const PKG_ROOT = join(import.meta.dirname, '..', '..');

function run(cmd: string, cwd: string): string {
  return execSync(cmd, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      npm_config_loglevel: 'error',
    },
  });
}

function removeDirWithRetry(target: string, attempts = 15, intervalMs = 300): void {
  for (let index = 0; index < attempts; index += 1) {
    try {
      rmSync(target, { recursive: true, force: true });
      return;
    } catch (error) {
      if (index === attempts - 1) {
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, intervalMs);
    }
  }
}

describe('consumer governance zero-scripts install', () => {
  it('keeps consumer root free of governance scripts and runs governance via hook-local entries', () => {
    const packDir = mkdtempSync(join(tmpdir(), 'gov-zero-scripts-root-pack-'));
    run(`npm pack --pack-destination "${packDir.replace(/\\/g, '/')}"`, PKG_ROOT);
    const tgzName = readdirSync(packDir).find(
      (f) => f.startsWith('bmad-speckit-sdd-flow-') && f.endsWith('.tgz')
    );
    expect(tgzName).toBeTruthy();

    const consumer = mkdtempSync(join(tmpdir(), 'gov-zero-scripts-consumer-'));
    try {
      writeFileSync(
        join(consumer, 'package.json'),
        JSON.stringify({ name: 'gov-zero-scripts-consumer', version: '1.0.0', private: true }),
        'utf8'
      );

      run(`npm install "${join(packDir, tgzName!).replace(/\\/g, '/')}"`, consumer);
      run('npm install js-yaml', consumer);
      run('npx bmad-speckit-init --agent cursor', consumer);

      expect(existsSync(join(consumer, 'scripts', 'governance-remediation-runner.ts'))).toBe(false);
      expect(listUnexpectedLegacyConsumerHookFiles(join(consumer, '.cursor', 'hooks'))).toHaveLength(0);

      run('npx bmad-speckit-init --agent claude-code', consumer);

      writeFileSync(
        join(consumer, '_bmad', '_config', 'governance-remediation.yaml'),
        [
          'version: 2',
          'primaryHost: claude',
          'packetHosts:',
          '  - claude',
          'provider:',
          '  mode: stub',
          '  id: accept-consumer-zero-scripts',
          'execution:',
          '  enabled: true',
          '  interactiveMode: main-agent',
          '  fallbackAutonomousMode: false',
          '  authoritativeHost: claude',
          '  fallbackHosts: []',
        ].join('\n'),
        'utf8'
      );

      expect(listUnexpectedLegacyConsumerHookFiles(join(consumer, '.claude', 'hooks'))).toHaveLength(0);
      expect(existsSync(join(consumer, '.claude', 'hooks', 'post-tool-use.cjs'))).toBe(true);
      expect(existsSync(join(consumer, '.claude', 'hooks', 'deferred-gap-governance.cjs'))).toBe(true);
      expect(existsSync(join(consumer, '.claude', 'hooks', 'runtime-policy-inject.cjs'))).toBe(
        true
      );
      expect(existsSync(join(consumer, '.claude', 'hooks', 'write-runtime-context.cjs'))).toBe(
        true
      );

      const runtimeContextPath = join(
        consumer,
        '_bmad-output',
        'runtime',
        'context',
        'project.json'
      );
      const writeContext = spawnSync(
        process.execPath,
        [
          join(consumer, '.claude', 'hooks', 'write-runtime-context.cjs'),
          runtimeContextPath,
          'story',
          'implement',
          '',
          'epic-20',
          '20.1',
          'accept-consumer-zero-scripts',
          'accept-zero-scripts-run',
          '_bmad-output/implementation-artifacts/epic-20/story-20.1',
          'story',
          '',
          '',
          '_bmad-output/implementation-artifacts/epic-20/story-20.1/spec.md',
        ],
        {
          cwd: consumer,
          encoding: 'utf8',
        }
      );

      expect(writeContext.status).toBe(0);
      expect(writeContext.stdout).toContain('Wrote');

      const inject = spawnSync(
        process.execPath,
        [join(consumer, '.claude', 'hooks', 'runtime-policy-inject.cjs')],
        {
          cwd: consumer,
          env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: consumer,
          },
          input: JSON.stringify({
            tool_name: 'Agent',
            tool_input: {
              subagent_type: 'general-purpose',
              prompt: 'Execute Story implementation now.',
            },
          }),
          encoding: 'utf8',
        }
      );

      expect(inject.status).toBe(0);
      const injectOut = JSON.parse(inject.stdout || '{}') as {
        continue?: boolean;
        stopReason?: string;
        systemMessage?: string;
        decision?: string;
        hookSpecificOutput?: { additionalContext?: string };
      };
      const effectiveContinue =
        typeof injectOut.continue === 'boolean'
          ? injectOut.continue
          : injectOut.decision === 'block'
            ? false
            : undefined;
      const effectiveText = [
        injectOut.stopReason,
        injectOut.systemMessage,
        injectOut.hookSpecificOutput?.additionalContext,
        inject.stdout,
      ]
        .filter(Boolean)
        .join('\n');
      if (typeof effectiveContinue === 'boolean') {
        expect(effectiveContinue).toBe(false);
      }
      const mainAgentSurfaceShown =
        effectiveText.includes('mainAgentNextAction') &&
        effectiveText.includes('mainAgentReady');
      const blockedFlowShown =
        effectiveText.includes('Implementation Entry Gate') &&
        effectiveText.includes('Main Agent') &&
        effectiveText.includes('orchestration_state') &&
        effectiveText.includes('pending_packet');
      expect(mainAgentSurfaceShown || blockedFlowShown).toBe(true);

      expect(
        existsSync(join(consumer, '_bmad-output', 'runtime', 'governance', 'current-run.json'))
      ).toBe(false);
    } finally {
      removeDirWithRetry(consumer);
      removeDirWithRetry(packDir);
    }
  }, 180_000);
});
