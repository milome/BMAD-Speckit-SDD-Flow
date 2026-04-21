import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  linkRepoNodeModulesIntoProject,
  writeMinimalRegistryAndProjectContext,
} from '../helpers/runtime-registry-fixture';
import {
  defaultRuntimeContextFile,
  readRuntimeContext,
} from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

const repoRoot = process.cwd();

/** Consumer-like root: `_bmad` + hoisted `node_modules` (workspace @bmad-speckit/runtime-emit); no project-root `scripts/`. */
function makeEmitReadyRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-hook-inject-'));
  fs.cpSync(path.join(repoRoot, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(tempRoot);
  writeMinimalRegistryAndProjectContext(tempRoot, { flow: 'story', stage: 'specify' });
  return tempRoot;
}

function makeEmitRootWithoutLanguageResolver(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-hook-inject-missing-lang-'));
  fs.cpSync(path.join(repoRoot, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, '.claude', 'hooks'), { recursive: true });
  fs.copyFileSync(
    path.join(tempRoot, '_bmad', 'claude', 'hooks', 'emit-runtime-policy-cli.cjs'),
    path.join(tempRoot, '.claude', 'hooks', 'emit-runtime-policy-cli.cjs')
  );
  fs.copyFileSync(
    path.join(
      repoRoot,
      'node_modules',
      '@bmad-speckit',
      'runtime-emit',
      'dist',
      'emit-runtime-policy.cjs'
    ),
    path.join(tempRoot, '.claude', 'hooks', 'emit-runtime-policy.cjs')
  );
  writeMinimalRegistryAndProjectContext(tempRoot, { flow: 'story', stage: 'specify' });
  return tempRoot;
}

function makeStoryScopedRootWithoutProjectContext(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-hook-inject-story-scope-'));
  fs.cpSync(path.join(repoRoot, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(tempRoot);
  fs.mkdirSync(path.join(tempRoot, '.cursor', 'agents'), { recursive: true });
  fs.copyFileSync(
    path.join(tempRoot, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
    path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md')
  );

  const storyContextRelative = path.join(
    '_bmad-output',
    'runtime',
    'context',
    'stories',
    'epic-1',
    'story-1-1.json'
  );
  const storyContextPath = path.join(tempRoot, storyContextRelative);
  fs.mkdirSync(path.dirname(storyContextPath), { recursive: true });
  fs.writeFileSync(
    storyContextPath,
    JSON.stringify(
      defaultRuntimeContextFile({
        flow: 'story',
        stage: 'specify',
        contextScope: 'story',
        epicId: 'epic-1',
        storyId: 'story-1-1',
      }),
      null,
      2
    ),
    'utf8'
  );

  const registry = defaultRuntimeContextRegistry(tempRoot);
  registry.storyContexts['story-1-1'] = {
    path: storyContextRelative.replace(/\\/g, '/'),
    epicId: 'epic-1',
    sourceMode: 'full_bmad',
  };
  registry.activeScope = {
    scopeType: 'story',
    epicId: 'epic-1',
    storyId: 'story-1-1',
    resolvedContextPath: storyContextRelative.replace(/\\/g, '/'),
    reason: 'acceptance test story scope without project context',
  };
  writeRuntimeContextRegistry(tempRoot, registry);
  return tempRoot;
}

describe('runtime-policy-inject (dual host entry)', () => {
  it('Cursor path: --cursor-host + stdin', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const r = spawnSync(process.execPath, [inject, '--cursor-host'], {
        cwd: repoRoot,
        input: '{}',
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}');
      expect(out.systemMessage).toContain('本回合 Runtime Governance（JSON）');
      expect(out.systemMessage).toContain('"flow"');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('Cursor path: agent_message 请用英文 → systemMessage 含 resolvedMode en', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      fs.mkdirSync(path.join(tempRoot, '.cursor', 'agents'), { recursive: true });
      fs.copyFileSync(
        path.join(tempRoot, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
        path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md')
      );
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({
        cwd: tempRoot,
        agent_message: '请用英文回答',
        tool_name: 'Read',
      });
      const r = spawnSync(process.execPath, [inject, '--cursor-host'], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}');
      expect(out.systemMessage).toMatch(/"resolvedMode":\s*"en"/);
      const runtime = fs.readFileSync(
        path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md'),
        'utf8'
      );
      expect(runtime).toContain('RUNTIME-MATERIALIZED facilitator resolvedMode=en');
      expect(runtime).toContain('_bmad/core/skills/bmad-party-mode/workflow.en.md');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('surfaces language resolution diagnostics in hook output when resolve-for-session bundle is unavailable', () => {
    const tempRoot = makeEmitRootWithoutLanguageResolver();
    try {
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({
        tool_name: 'Agent',
        tool_input: {
          prompt: 'Please answer in English.',
        },
      });
      const r = spawnSync(process.execPath, [inject], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}') as { systemMessage?: string };
      expect(out.systemMessage).toContain('"languagePolicyDiagnostic"');
      expect(out.systemMessage).toContain('"code": "resolve_for_session_failed"');
      expect(out.systemMessage).toContain('resolve-for-session.cjs not found');
      expect(out.systemMessage).not.toMatch(/"resolvedMode":\s*"en"/);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('resolve-for-session bundle uses temporary resolvedMode materialization when project context sync is skipped', () => {
    const tempRoot = makeStoryScopedRootWithoutProjectContext();
    try {
      const resolveSession = require.resolve('@bmad-speckit/runtime-emit/dist/resolve-for-session.cjs', {
        paths: [tempRoot],
      });
      const r = spawnSync(process.execPath, [resolveSession], {
        cwd: tempRoot,
        input: JSON.stringify({
          projectRoot: tempRoot,
          userMessage: '请用英文回答',
          recentMessages: [],
          writeContext: true,
        }),
        encoding: 'utf8',
      });

      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}') as {
        resolvedMode?: string;
        contextSync?: { status?: string; reason?: string };
        temporaryResolvedModeApplied?: {
          resolvedMode?: string;
          targets?: Array<{ host?: string; updated?: boolean }>;
        };
      };
      expect(out.resolvedMode).toBe('en');
      expect(out.contextSync?.status).toBe('skipped');
      expect(out.contextSync?.reason).toBe('project_context_missing');
      expect(out.temporaryResolvedModeApplied?.resolvedMode).toBe('en');
      expect(out.temporaryResolvedModeApplied?.targets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            host: 'cursor',
          }),
        ])
      );

      const runtime = fs.readFileSync(
        path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md'),
        'utf8'
      );
      expect(runtime).toContain('RUNTIME-MATERIALIZED facilitator resolvedMode=en');
      expect(fs.existsSync(path.join(tempRoot, '_bmad-output', 'runtime', 'context', 'project.json'))).toBe(
        false
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('Cursor path: preToolUse allows generalPurpose compatibility routing for party-mode when facilitator source is installed', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      fs.mkdirSync(path.join(tempRoot, '.cursor', 'agents'), { recursive: true });
      fs.copyFileSync(
        path.join(tempRoot, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
        path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md')
      );
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({
        cwd: tempRoot,
        tool_name: 'Task',
        tool_input: {
          executor: 'generalPurpose',
          description: 'Party Mode: Cursor subagent识别',
          prompt: [
            '## 用户选择',
            '强度: 20 (quick_probe_20)',
            '',
            '【自检完成】Cursor party-mode',
            '- 强度选项: 已展示',
            '- 用户选择: 20 (quick_probe_20)',
            '- 执行方式: generalPurpose-compatible facilitator',
            '- Session Bootstrap: 由宿主在 SubagentStart 注入',
            '可以发起。',
            '',
            '现在正式发起 party-mode-facilitator。',
          ].join('\n'),
        },
      });
      const r = spawnSync(process.execPath, [inject, '--cursor-host'], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}') as { systemMessage?: string };
      expect(out.systemMessage).toContain('本回合 Runtime Governance（JSON）');
      expect(out.systemMessage).not.toContain('routing this discussion through `mcp_task/generalPurpose` is forbidden');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('Cursor path: preToolUse allows Task executor party-mode-facilitator with a confirmed selection block', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      fs.mkdirSync(path.join(tempRoot, '.cursor', 'agents'), { recursive: true });
      fs.copyFileSync(
        path.join(tempRoot, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
        path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md')
      );
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({
        cwd: tempRoot,
        tool_name: 'Task',
        tool_input: {
          executor: 'party-mode-facilitator',
          description: 'Party Mode: Cursor subagent识别',
          prompt: [
            '## 用户选择',
            '强度: 20 (quick_probe_20)',
            '',
            '【自检完成】Cursor party-mode',
            '- 强度选项: 已展示',
            '- 用户选择: 20 (quick_probe_20)',
            '- 执行方式: generalPurpose-compatible facilitator',
            '- Session Bootstrap: 由宿主在 SubagentStart 注入',
            '可以发起。',
            '',
            '## 用户问题',
            '讨论 Cursor 自定义 subagents 识别机制。',
          ].join('\n'),
        },
      });
      const r = spawnSync(process.execPath, [inject, '--cursor-host'], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}') as { systemMessage?: string };
      expect(out.systemMessage).toContain('本回合 Runtime Governance（JSON）');
      expect(out.systemMessage).not.toContain('禁止降级到 generalPurpose');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('Cursor path: subagentStart injects inline full-run guidance for generalPurpose party-mode execution', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      fs.mkdirSync(path.join(tempRoot, '.cursor', 'agents'), { recursive: true });
      fs.copyFileSync(
        path.join(tempRoot, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
        path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md')
      );
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({
        cwd: tempRoot,
        subagent_type: 'generalPurpose',
        task: [
          '## 用户选择',
          '强度: 50 (decision_root_cause_50)',
          '',
          '【自检完成】Cursor party-mode',
          '- 强度选项: 已展示',
          '- 用户选择: 50 (decision_root_cause_50)',
          '- 执行方式: generalPurpose-compatible facilitator',
          '- Session Bootstrap: 由宿主在 SubagentStart 注入',
          '可以发起。',
          '',
          'Run party-mode-facilitator for RCA on Cursor custom subagents',
        ].join('\n'),
      });
      const r = spawnSync(process.execPath, [inject, '--cursor-host', '--subagent-start'], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}') as {
        hookSpecificOutput?: { additionalContext?: string };
      };
      const additionalContext = out.hookSpecificOutput?.additionalContext ?? '';
      expect(additionalContext).toContain('Cursor Party-Mode execution mode: generalPurpose compatibility path');
      expect(additionalContext).toContain('do not pause or hand control back to the main Agent before the final round target');
      expect(additionalContext).toContain('"target_rounds_total": 50');
      expect(additionalContext).toContain('"sidecar_final_path":');
      expect(additionalContext).toContain(
        '"agent_turn_event_source_mode": "cursor_visible_output_reconstruction"'
      );
      expect(additionalContext).toContain('Compact-mode requirements for this long run');
      expect(additionalContext).toContain('prefer one short substantive speaker line per round');
      expect(additionalContext).not.toContain('"batch_target_round": 50');
      expect(additionalContext).not.toContain('"checkpoint_window_ms"');
      expect(additionalContext).not.toMatch(/checkpoint/iu);

      const currentSessionPath = path.join(
        tempRoot,
        '_bmad-output',
        'party-mode',
        'runtime',
        'current-session.json'
      );
      const currentSession = JSON.parse(fs.readFileSync(currentSessionPath, 'utf8')) as {
        agent_turn_event_source_mode?: string;
        sidecar_started_path?: string;
        sidecar_final_path?: string;
      };
      expect(currentSession.agent_turn_event_source_mode).toBe(
        'cursor_visible_output_reconstruction'
      );
      expect(String(currentSession.sidecar_started_path || '')).toContain('/_bmad-output/party-mode/sidecar/');
      expect(String(currentSession.sidecar_final_path || '')).toContain('/_bmad-output/party-mode/sidecar/');
      expect(fs.existsSync(path.resolve(tempRoot, String(currentSession.sidecar_started_path || '')))).toBe(true);

      const sessionsDir = path.join(tempRoot, '_bmad-output', 'party-mode', 'sessions');
      const metaFiles = fs.readdirSync(sessionsDir).filter((file) => file.endsWith('.meta.json'));
      expect(metaFiles).toHaveLength(1);
      const meta = JSON.parse(
        fs.readFileSync(path.join(sessionsDir, metaFiles[0]), 'utf8')
      ) as { agent_turn_event_source_mode?: string };
      expect(meta.agent_turn_event_source_mode).toBe(
        'cursor_visible_output_reconstruction'
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('Cursor path: subagentStart fails closed when it tries to launch with a different tier than the last confirmed preToolUse selection', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      fs.mkdirSync(path.join(tempRoot, '.cursor', 'agents'), { recursive: true });
      fs.copyFileSync(
        path.join(tempRoot, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
        path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md')
      );
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');

      const pretooluse = spawnSync(process.execPath, [inject, '--cursor-host'], {
        cwd: repoRoot,
        input: JSON.stringify({
          cwd: tempRoot,
          tool_name: 'Task',
          tool_input: {
            executor: 'generalPurpose',
            description: 'Party Mode: Cursor subagent识别',
            prompt: [
              '## 用户选择',
              '强度: 20 (quick_probe_20)',
              '',
              '【自检完成】Cursor party-mode',
              '- 强度选项: 已展示',
              '- 用户选择: 20 (quick_probe_20)',
              '- 执行方式: generalPurpose-compatible facilitator',
              '- Session Bootstrap: 由宿主在 SubagentStart 注入',
              '可以发起。',
              '',
              '现在正式发起 party-mode-facilitator。',
            ].join('\n'),
          },
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(pretooluse.status).toBe(0);

      const subagentStart = spawnSync(process.execPath, [inject, '--cursor-host', '--subagent-start'], {
        cwd: repoRoot,
        input: JSON.stringify({
          cwd: tempRoot,
          subagent_type: 'generalPurpose',
          task: [
            '## 用户选择',
            '强度: 100 (final_solution_task_list_100)',
            '',
            '【自检完成】Cursor party-mode',
            '- 强度选项: 已展示',
            '- 用户选择: 100 (final_solution_task_list_100)',
            '- 执行方式: generalPurpose-compatible facilitator',
            '- Session Bootstrap: 由宿主在 SubagentStart 注入',
            '可以发起。',
            '',
            'Run party-mode-facilitator with the stale 100-tier payload',
          ].join('\n'),
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(subagentStart.status).toBe(1);
      expect(subagentStart.stderr).toContain('does not match the last confirmed preToolUse selection');
      expect(subagentStart.stderr).toContain('Confirmed preToolUse gate profile: `quick_probe_20`');
      expect(subagentStart.stderr).toContain('SubagentStart gate profile: `final_solution_task_list_100`');

      const currentSessionPath = path.join(
        tempRoot,
        '_bmad-output',
        'party-mode',
        'runtime',
        'current-session.json'
      );
      expect(fs.existsSync(currentSessionPath)).toBe(false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('Cursor path: subagentStart does not emit runtime step state regex warnings when default specs/**/*.md glob is resolved', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      fs.mkdirSync(path.join(tempRoot, '.cursor', 'agents'), { recursive: true });
      fs.copyFileSync(
        path.join(tempRoot, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
        path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md')
      );
      fs.mkdirSync(path.join(tempRoot, 'specs', 'epic-1', 'story-1-1'), { recursive: true });
      fs.writeFileSync(
        path.join(tempRoot, 'specs', 'epic-1', 'story-1-1', 'spec.md'),
        '# Consumer glob smoke\n',
        'utf8'
      );

      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({
        cwd: tempRoot,
        subagent_type: 'generalPurpose',
        task: [
          '## 用户选择',
          '强度: 100 (final_solution_task_list_100)',
          '',
          '【自检完成】Cursor party-mode',
          '- 强度选项: 已展示',
          '- 用户选择: 100 (final_solution_task_list_100)',
          '- 执行方式: generalPurpose-compatible facilitator',
          '- Session Bootstrap: 由宿主在 SubagentStart 注入',
          '可以发起。',
          '',
          'Run party-mode-facilitator for regex warning regression coverage',
        ].join('\n'),
      });
      const r = spawnSync(process.execPath, [inject, '--cursor-host', '--subagent-start'], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(r.status).toBe(0);
      expect(r.stderr || '').not.toContain('runtime step state sync skipped');
      expect(r.stderr || '').not.toContain('Nothing to repeat');

      const out = JSON.parse(r.stdout || '{}') as {
        hookSpecificOutput?: { additionalContext?: string };
      };
      const additionalContext = out.hookSpecificOutput?.additionalContext ?? '';
      expect(additionalContext).toContain('Party Mode Session Bootstrap');

      const currentSessionPath = path.join(
        tempRoot,
        '_bmad-output',
        'party-mode',
        'runtime',
        'current-session.json'
      );
      expect(fs.existsSync(currentSessionPath)).toBe(true);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('Cursor path: preToolUse blocks party-mode launch without the required self-check block', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      fs.mkdirSync(path.join(tempRoot, '.cursor', 'agents'), { recursive: true });
      fs.copyFileSync(
        path.join(tempRoot, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
        path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md')
      );
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({
        cwd: tempRoot,
        tool_name: 'Task',
        tool_input: {
          executor: 'generalPurpose',
          description: 'Party Mode: Cursor subagent识别',
          prompt: [
            '## 用户选择',
            '强度: 50 (decision_root_cause_50)',
            '',
            '现在正式发起 party-mode-facilitator。',
          ].join('\n'),
        },
      });
      const r = spawnSync(process.execPath, [inject, '--cursor-host'], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}') as {
        continue?: boolean;
        stopReason?: string;
        systemMessage?: string;
      };
      expect(out.continue).toBe(false);
      expect(out.stopReason).toContain('必须完成自检清单');
      expect(out.systemMessage).toContain('Cursor party-mode preflight');
      expect(out.systemMessage).toContain('【自检完成】Cursor party-mode');
      expect(out.systemMessage).toContain('完成以上自检后，再沿用同一档位立即重试当前 party-mode 发起');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('Cursor path: preToolUse blocks when gateProfileId is self-selected without a confirmed 用户选择 block', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      fs.mkdirSync(path.join(tempRoot, '.cursor', 'agents'), { recursive: true });
      fs.copyFileSync(
        path.join(tempRoot, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
        path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md')
      );
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({
        cwd: tempRoot,
        tool_name: 'Task',
        tool_input: {
          executor: 'generalPurpose',
          gateProfileId: 'final_solution_task_list_100',
          description: 'Party Mode: Cursor 自定义 subagents',
          prompt: [
            'PARTY MODE 激活准备',
            '议题分析',
            '核心问题：如何让 Cursor 识别并正确使用用户自定义的 subagents',
            '',
            '强度档位选择',
            '建议档位：final_solution_task_list_100',
            '',
            '自检清单',
            '已读取 party-mode workflow 和 step-02 规则',
            '已明确议题：Cursor 自定义 subagents 识别机制',
            '已确定产出目标：技术方案 + 任务列表',
            '已选择档位：final_solution_task_list_100',
            '',
            '【自检完成】Cursor party-mode',
            '- 强度选项: 已展示',
            '- 用户选择: 100 (final_solution_task_list_100)',
            '- 执行方式: generalPurpose-compatible facilitator',
            '- Session Bootstrap: 由宿主在 SubagentStart 注入',
            '可以发起。',
            '',
            '现在正式发起 party-mode-facilitator。',
          ].join('\n'),
        },
      });
      const r = spawnSync(process.execPath, [inject, '--cursor-host'], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}') as {
        continue?: boolean;
        stopReason?: string;
        systemMessage?: string;
      };
      expect(out.continue).toBe(false);
      expect(out.stopReason).toContain('先由主 Agent 询问用户选择 20/50/100 强度');
      expect(out.systemMessage).toContain('structured gate profile was present');
      expect(out.systemMessage).toContain('不能替代用户授权本身');
      expect(out.systemMessage).toContain('不要把推荐档位 / 默认档位 / 自检中的“已选择档位”当作用户回复');
      expect(out.systemMessage).toContain('本条助手消息必须停在问题处');
      expect(out.systemMessage).toContain('## 用户选择');
      expect(out.systemMessage).toContain('强度: 100 (final_solution_task_list_100)');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('Cursor path: preToolUse blocks high-confidence final outputs without a canonical document path', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      fs.mkdirSync(path.join(tempRoot, '.cursor', 'agents'), { recursive: true });
      fs.copyFileSync(
        path.join(tempRoot, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
        path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md')
      );
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({
        cwd: tempRoot,
        tool_name: 'Task',
        tool_input: {
          executor: 'party-mode-facilitator',
          description: 'Party Mode: BUGFIX final solution',
          prompt: [
            '## 用户选择',
            '强度: 100 (final_solution_task_list_100)',
            '',
            '【自检完成】Cursor party-mode',
            '- 强度选项: 已展示',
            '- 用户选择: 100 (final_solution_task_list_100)',
            '- 执行方式: generalPurpose-compatible facilitator',
            '- Session Bootstrap: 由宿主在 SubagentStart 注入',
            '可以发起。',
            '',
            '请输出 BUGFIX 最终方案与 §7 最终任务列表。',
          ].join('\n'),
        },
      });
      const r = spawnSync(process.execPath, [inject, '--cursor-host'], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}') as {
        continue?: boolean;
        stopReason?: string;
        systemMessage?: string;
      };
      expect(out.continue).toBe(false);
      expect(out.stopReason).toContain('canonical 文档路径');
      expect(out.systemMessage).toContain(
        'high-confidence final outputs require a canonical markdown document path'
      );
      expect(out.systemMessage).toContain('_bmad-output/implementation-artifacts/_orphan/BUGFIX_<slug>.md');
      expect(out.systemMessage).toContain('must write/update that document directly');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('Cursor path: preToolUse blocks when the assistant asks for tier confirmation but also tries to auto-start in the same message', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      fs.mkdirSync(path.join(tempRoot, '.cursor', 'agents'), { recursive: true });
      fs.copyFileSync(
        path.join(tempRoot, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
        path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md')
      );
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({
        cwd: tempRoot,
        tool_name: 'Task',
        tool_input: {
          executor: 'generalPurpose',
          description: 'Party Mode: Cursor 自定义 subagents',
          prompt: [
            'PARTY MODE 自检清单',
            '自检结果：✅ PASS',
            '',
            '强度档位选择',
            '请确认选择哪个档位？ 或按推荐档位 100 轮 开始？现在启动 party-mode-facilitator 子代理，开始多角色讨论。',
          ].join('\n'),
        },
      });
      const r = spawnSync(process.execPath, [inject, '--cursor-host'], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}') as {
        continue?: boolean;
        stopReason?: string;
        systemMessage?: string;
      };
      expect(out.continue).toBe(false);
      expect(out.stopReason).toContain('先由主 Agent 询问用户选择 20/50/100 强度');
      expect(out.systemMessage).toContain('必须等待用户明确回复 `20` / `50` / `100` 后再继续');
      expect(out.systemMessage).toContain('提问消息必须停在这里');
      expect(out.systemMessage).toContain('禁止在同一条助手消息中追加「或按推荐档位开始」「现在启动」');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('Claude path: PreToolUse Agent stdin', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({ tool_name: 'Agent', tool_input: { description: 'x' } });
      const r = spawnSync(process.execPath, [inject], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}');
      expect(out.systemMessage).toContain('本回合 Runtime Governance（JSON）');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('Claude path: tool_input.prompt requesting english materializes the claude facilitator runtime target', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      fs.mkdirSync(path.join(tempRoot, '.claude', 'agents'), { recursive: true });
      fs.copyFileSync(
        path.join(tempRoot, '_bmad', 'claude', 'agents', 'party-mode-facilitator.md'),
        path.join(tempRoot, '.claude', 'agents', 'party-mode-facilitator.md')
      );

      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({
        tool_name: 'Agent',
        tool_input: {
          prompt: 'Please answer in English.',
        },
      });
      const r = spawnSync(process.execPath, [inject], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout || '{}');
      expect(out.systemMessage).toMatch(/"resolvedMode":\s*"en"/);

      const runtime = fs.readFileSync(
        path.join(tempRoot, '.claude', 'agents', 'party-mode-facilitator.md'),
        'utf8'
      );
      expect(runtime).toContain('RUNTIME-MATERIALIZED facilitator resolvedMode=en');
      expect(runtime).toContain('_bmad/core/skills/bmad-party-mode/workflow.en.md');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('persists workflow/step/artifactPath into project context from runtime artifact input', () => {
    const tempRoot = makeEmitReadyRoot();
    try {
      const artifactDir = path.join(tempRoot, '_bmad-output', 'planning-artifacts', 'feature-prd');
      fs.mkdirSync(artifactDir, { recursive: true });
      const artifactPath = path.join(artifactDir, 'prd.md');
      fs.writeFileSync(
        artifactPath,
        [
          '---',
          'workflowType: prd',
          'stepsCompleted:',
          '  - step-04-journeys',
          '---',
          '',
          '# PRD',
          '',
          '## User Journeys',
          'Filled.',
        ].join('\n'),
        'utf8',
      );

      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const stdin = JSON.stringify({
        cwd: tempRoot,
        tool_name: 'Read',
        tool_input: {
          artifactPath,
        },
      });
      const r = spawnSync(process.execPath, [inject, '--cursor-host'], {
        cwd: repoRoot,
        input: stdin,
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(r.status).toBe(0);
      const ctx = readRuntimeContext(tempRoot);
      expect(ctx.workflow).toBe('bmad-create-prd');
      expect(ctx.step).toBe('step-04-journeys');
      expect(ctx.stage).toBe('prd');
      expect(ctx.artifactPath).toBe(artifactPath.replace(/\\/g, '/'));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 45000);

  it('quietly skips injection when no BMAD/Speckit context is active and emit only reports missing flow/stage', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'non-bmad-hook-'));
    try {
      const inject = path.join(repoRoot, '_bmad/claude/hooks/runtime-policy-inject.cjs');
      const r = spawnSync(process.execPath, [inject, '--cursor-host'], {
        cwd: tempRoot,
        input: JSON.stringify({ cwd: tempRoot }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CURSOR_PROJECT_ROOT: tempRoot,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });
      expect(r.status).toBe(0);
      expect((r.stderr || '').trim()).toBe('');
      const out = JSON.parse(r.stdout || '{}');
      expect(out.systemMessage || '').not.toContain('emit-runtime-policy FAILED');
      expect(out.systemMessage || '').not.toContain('missing flow/stage');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('does not fall back to root .bmad/runtime-context.json when no explicit context file is provided', () => {
    const emit = path.join(repoRoot, 'scripts', 'emit-runtime-policy.ts');
    const r = spawnSync(
      process.execPath,
      [
        path.join(repoRoot, 'node_modules', 'ts-node', 'dist', 'bin.js'),
        '--project',
        path.join(repoRoot, 'tsconfig.node.json'),
        '--transpile-only',
        emit,
        '--cwd',
        repoRoot,
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...process.env },
      }
    );

    const stderr = r.stderr ?? '';
    expect(stderr).not.toContain('.bmad/runtime-context.json');
    if (r.status !== 0) {
      expect(stderr).toMatch(/emit-runtime-policy:/);
    } else {
      expect((r.stdout ?? '').trim()).toContain('"triggerStage"');
    }
  });
});
