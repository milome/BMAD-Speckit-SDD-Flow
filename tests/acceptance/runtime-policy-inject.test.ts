import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  linkRepoNodeModulesIntoProject,
  writeMinimalRegistryAndProjectContext,
} from '../helpers/runtime-registry-fixture';
import { readRuntimeContext } from '../../scripts/runtime-context';

const repoRoot = process.cwd();

/** Consumer-like root: `_bmad` + hoisted `node_modules` (workspace @bmad-speckit/runtime-emit); no project-root `scripts/`. */
function makeEmitReadyRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-hook-inject-'));
  fs.cpSync(path.join(repoRoot, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(tempRoot);
  writeMinimalRegistryAndProjectContext(tempRoot, { flow: 'story', stage: 'specify' });
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
      expect(additionalContext).toContain('do not emit checkpoints in the Cursor branch');
      expect(additionalContext).toContain('do not hand control back to the main Agent before the final round target');
      expect(additionalContext).toContain('"batch_target_round": 50');
      expect(additionalContext).toContain('"target_rounds_total": 50');
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
