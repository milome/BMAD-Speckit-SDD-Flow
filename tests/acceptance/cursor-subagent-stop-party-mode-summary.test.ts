import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  linkRepoNodeModulesIntoProject,
  writeMinimalRegistryAndProjectContext,
} from '../helpers/runtime-registry-fixture';

const repoRoot = process.cwd();
const runtimeInject = path.join(repoRoot, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
const cursorSubagentStopHook = path.join(
  repoRoot,
  '_bmad',
  'cursor',
  'hooks',
  'subagent-result-summary.cjs'
);
const {
  readPartyModeCurrentSessionState,
} = require('../../_bmad/runtime/hooks/party-mode-current-session.cjs');

const TEMP_ROOTS: string[] = [];

function makeEmitReadyRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-subagent-stop-'));
  fs.cpSync(path.join(repoRoot, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(tempRoot);
  writeMinimalRegistryAndProjectContext(tempRoot, { flow: 'story', stage: 'specify' });
  fs.mkdirSync(path.join(tempRoot, '.cursor', 'agents'), { recursive: true });
  fs.copyFileSync(
    path.join(tempRoot, '_bmad', 'cursor', 'agents', 'party-mode-facilitator.md'),
    path.join(tempRoot, '.cursor', 'agents', 'party-mode-facilitator.md')
  );
  TEMP_ROOTS.push(tempRoot);
  return tempRoot;
}

function runCursorPartyModeSubagentStart(root: string, gateProfileId: string): void {
  const profileLabel =
    gateProfileId === 'final_solution_task_list_100'
      ? '100 (final_solution_task_list_100)'
      : gateProfileId === 'quick_probe_20'
        ? '20 (quick_probe_20)'
        : '50 (decision_root_cause_50)';
  const stdin = JSON.stringify({
    cwd: root,
    subagent_type: 'generalPurpose',
    task: [
      '## 用户选择',
      `强度: ${profileLabel}`,
      '',
      '【自检完成】Cursor party-mode',
      '- 强度选项: 已展示',
      `- 用户选择: ${profileLabel}`,
      '- 执行方式: generalPurpose-compatible facilitator',
      '- Session Bootstrap: 由宿主在 SubagentStart 注入',
      '可以发起。',
      '',
      'Run party-mode-facilitator for Cursor issue analysis',
    ].join('\n'),
  });
  const result = spawnSync(process.execPath, [runtimeInject, '--cursor-host', '--subagent-start'], {
    cwd: repoRoot,
    input: stdin,
    encoding: 'utf8',
    env: {
      ...process.env,
      CURSOR_PROJECT_ROOT: root,
      CLAUDE_PROJECT_DIR: root,
    },
  });
  expect(result.status).toBe(0);
}

function buildValidCursorFullRunMessage(totalRounds: number, gateProfileId: string): string {
  const lines: string[] = [];
  for (let round = 1; round <= totalRounds; round += 1) {
    lines.push(`### Round ${round}`);
    lines.push(`🏗️ **Winston 架构师**: 第 ${round} 轮给出架构判断。`);
    lines.push(`⚔️ **批判性审计员**: 第 ${round} 轮提出反对点与遗漏风险。`);
  }
  lines.push('## Final Gate Evidence');
  lines.push(`- Gate Profile: ${gateProfileId}`);
  lines.push(`- Total Rounds: ${totalRounds}`);
  lines.push('- Challenger Ratio Check: PASS');
  lines.push('- Tail Window No New Gap: PASS');
  lines.push('- Final Result: PASS');
  return lines.join('\n');
}

describe('cursor subagentStop party-mode summary hook', () => {
  afterEach(() => {
    while (TEMP_ROOTS.length > 0) {
      fs.rmSync(TEMP_ROOTS.pop()!, { recursive: true, force: true });
    }
  });

  it('reconstructs current-session state for party-mode facilitator on subagentStop', () => {
    const root = makeEmitReadyRoot();
    runCursorPartyModeSubagentStart(root, 'quick_probe_20');

    const result = spawnSync(process.execPath, [cursorSubagentStopHook], {
      encoding: 'utf8',
      input: JSON.stringify({
        cwd: root,
        agent_type: 'party-mode-facilitator',
        subagent_type: 'generalPurpose',
        task: 'Run party-mode-facilitator for Cursor issue analysis',
        last_assistant_message: buildValidCursorFullRunMessage(20, 'quick_probe_20'),
      }),
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('session=');
    expect(result.stderr).toContain('validation=PASS');

    const state = readPartyModeCurrentSessionState(root);
    expect(state.validation_status).toBe('PASS');
    expect(state.status).toBe('completed');
    expect(state.final_gate_result).toBe('PASS');
    expect(state.observed_visible_round_count).toBe(20);
  });
});
