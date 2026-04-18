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
const {
  refreshPartyModeSessionFromToolUse,
} = require('../../_bmad/runtime/hooks/post-tool-use-core.cjs');
const {
  partyModeCurrentSessionStatePath,
  readPartyModeCurrentSessionState,
  writePartyModeCurrentSessionState,
} = require('../../_bmad/runtime/hooks/party-mode-current-session.cjs');

const TEMP_ROOTS: string[] = [];

function makeEmitReadyRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-party-mode-current-'));
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

function runCursorPartyModeSubagentStartWithTask(root: string, task: string): void {
  const result = spawnSync(process.execPath, [runtimeInject, '--cursor-host', '--subagent-start'], {
    cwd: repoRoot,
    input: JSON.stringify({
      cwd: root,
      subagent_type: 'generalPurpose',
      task,
    }),
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

function buildTailOnlySuccessfulCursorRunMessage(
  startRound: number,
  totalRounds: number,
  gateProfileId: string
): string {
  const lines: string[] = [];
  for (let round = startRound; round <= totalRounds; round += 1) {
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

function buildIncompleteCursorRunMessage(currentRounds: number, totalRounds: number): string {
  const lines: string[] = [];
  for (let round = 1; round <= currentRounds; round += 1) {
    lines.push(`### Round ${round}`);
    lines.push(`🏗️ **Winston 架构师**: 第 ${round} 轮给出架构判断。`);
    lines.push(`⚔️ **批判性审计员**: 第 ${round} 轮提出反对点与遗漏风险。`);
  }
  lines.push(`当前进度：${currentRounds}/${totalRounds} 轮`);
  lines.push('继续分析中...');
  return lines.join('\n');
}

function buildLooseHeaderCursorRunMessage(currentRounds: number, totalRounds: number): string {
  const lines: string[] = [];
  for (let round = 1; round <= currentRounds; round += 1) {
    lines.push(`Round ${round}/${totalRounds}`);
    lines.push(`🏗️ **Winston 架构师**: 第 ${round} 轮给出架构判断。`);
    lines.push(`⚔️ **批判性审计员**: 第 ${round} 轮提出反对点与遗漏风险。`);
  }
  lines.push(`当前进度：${currentRounds}/${totalRounds} 轮`);
  return lines.join('\n');
}

function buildSpeakerOnlyCursorRunMessage(currentRounds: number, totalRounds: number): string {
  return [
    '⚔️ **批判性审计员**: 我先指出当前方案仍有遗漏，需要继续追问。',
    '🏗️ **Winston 架构师**: 我接受这个质疑，并继续补充架构证据。',
    `当前进度：${currentRounds}/${totalRounds} 轮`,
    '继续分析中...',
  ].join('\n');
}

function buildTranscriptWithEmbeddedPartyModeResult(resultText: string): string {
  const lines = [
    {
      type: 'system',
      subtype: 'task_notification',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `<task-notification><result>${resultText}</result></task-notification>`,
          },
        ],
      },
    },
  ];
  return lines.map((entry) => JSON.stringify(entry)).join('\n') + '\n';
}

describe('cursor party-mode current session binding', () => {
  afterEach(() => {
    while (TEMP_ROOTS.length > 0) {
      fs.rmSync(TEMP_ROOTS.pop()!, { recursive: true, force: true });
    }
  });

  it('writes a stable current-session pointer for 100-round cursor launches without relying on agent_id', () => {
    const root = makeEmitReadyRoot();
    runCursorPartyModeSubagentStart(root, 'final_solution_task_list_100');

    const statePath = partyModeCurrentSessionStatePath(root);
    expect(fs.existsSync(statePath)).toBe(true);
    const state = readPartyModeCurrentSessionState(root);
    expect(state.session_key).toMatch(/^pm-/);
    expect(state.gate_profile_id).toBe('final_solution_task_list_100');
    expect(state.target_rounds_total).toBe(100);
    expect(state.status).toBe('launched');
    expect(state.agent_turn_event_source_mode).toBe('cursor_visible_output_reconstruction');
    expect(String(state.visible_output_capture_path || '')).toContain('/_bmad-output/party-mode/captures/');
    expect(String(state.launch_payload_capture_path || '').replace(/\\/g, '/')).toContain('/_bmad-output/party-mode/captures/');
    expect(String(state.sidecar_started_path || '').replace(/\\/g, '/')).toContain('/_bmad-output/party-mode/sidecar/');
    expect(String(state.sidecar_final_path || '').replace(/\\/g, '/')).toContain('/_bmad-output/party-mode/sidecar/');
    expect(fs.existsSync(path.resolve(root, state.launch_payload_capture_path))).toBe(true);
    expect(fs.existsSync(path.resolve(root, state.sidecar_started_path))).toBe(true);
  });

  it('clears stale derived visible-output diagnostics when a new session_key is launched', () => {
    const root = makeEmitReadyRoot();
    writePartyModeCurrentSessionState(root, {
      session_key: 'stale-old-session',
      gate_profile_id: 'decision_root_cause_50',
      target_rounds_total: 50,
      status: 'needs_retry',
      validation_status: 'FAIL',
      observed_visible_round_count: 6,
      visible_output_summary: {
        observed_visible_round_count: 6,
        first_visible_round: 1,
        last_visible_round: 5,
        excerpt: 'stale summary',
      },
      visible_fragment_record_present: true,
    });

    runCursorPartyModeSubagentStart(root, 'final_solution_task_list_100');

    const state = readPartyModeCurrentSessionState(root);
    expect(state.session_key).not.toBe('stale-old-session');
    expect(state.gate_profile_id).toBe('final_solution_task_list_100');
    expect(state.status).toBe('launched');
    expect(state.validation_status ?? null).toBe(null);
    expect(state.observed_visible_round_count ?? null).toBe(null);
    expect(state.visible_output_summary ?? null).toBe(null);
    expect(state.visible_fragment_record_present ?? null).toBe(null);
  });

  it('overwrites a stale 100-round launch pointer when a new quick_probe_20 session starts', () => {
    const root = makeEmitReadyRoot();
    writePartyModeCurrentSessionState(root, {
      session_key: 'stale-100-launch',
      gate_profile_id: 'final_solution_task_list_100',
      target_rounds_total: 100,
      status: 'launched',
      session_log_path: path.join(root, '_bmad-output', 'party-mode', 'sessions', 'stale-100-launch.jsonl'),
      recorded_at: '2026-04-16T12:25:51.392Z',
    });

    runCursorPartyModeSubagentStart(root, 'quick_probe_20');

    const state = readPartyModeCurrentSessionState(root);
    expect(state.session_key).not.toBe('stale-100-launch');
    expect(state.gate_profile_id).toBe('quick_probe_20');
    expect(state.target_rounds_total).toBe(20);
    expect(state.current_batch_target_round).toBe(20);
    expect(state.status).toBe('launched');
  });

  it('records canonical markdown documents generated by the subagent into current-session state', () => {
    const root = makeEmitReadyRoot();
    runCursorPartyModeSubagentStart(root, 'final_solution_task_list_100');

    const bugfixPath = path.join(
      root,
      '_bmad-output',
      'implementation-artifacts',
      '_orphan',
      'BUGFIX_demo.md'
    );
    fs.mkdirSync(path.dirname(bugfixPath), { recursive: true });
    fs.writeFileSync(bugfixPath, '# BUGFIX demo\n', 'utf8');

    const refresh = refreshPartyModeSessionFromToolUse({
      cwd: root,
      tool_name: 'Write',
      tool_input: {
        file_path: bugfixPath,
      },
      tool_output: 'Wrote BUGFIX document',
    });

    expect(refresh.reason).toBe('party_mode_generated_document_recorded');

    const state = readPartyModeCurrentSessionState(root);
    expect(state.generated_document_count).toBe(1);
    expect(state.latest_generated_document_kind).toBe('bugfix');
    expect(String(state.latest_generated_document_path || '').replace(/\\/g, '/')).toContain(
      '/_bmad-output/implementation-artifacts/_orphan/BUGFIX_demo.md'
    );
    expect(Array.isArray(state.generated_document_paths)).toBe(true);
    expect(state.generated_document_paths).toHaveLength(1);
  });

  it('captures expected canonical document paths from the subagent launch payload', () => {
    const root = makeEmitReadyRoot();
    const bugfixPath = path
      .join(root, '_bmad-output', 'implementation-artifacts', '_orphan', 'BUGFIX_expected.md')
      .replace(/\\/g, '/');

    runCursorPartyModeSubagentStartWithTask(
      root,
      [
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
        'Run party-mode-facilitator for BUGFIX final solution',
        `请生成 BUGFIX 文档到 ${bugfixPath}`,
      ].join('\n')
    );

    const state = readPartyModeCurrentSessionState(root);
    expect(state.document_generation_required).toBe(true);
    expect(state.expected_document_count).toBe(1);
    expect(state.expected_document_paths).toEqual([bugfixPath]);
  });

  it('captures expected canonical Story document paths from a Create Story style launch payload', () => {
    const root = makeEmitReadyRoot();
    const storyPath = path
      .join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        'epic-4-demo',
        'story-1-demo',
        '4-1-demo.md'
      )
      .replace(/\\/g, '/');

    runCursorPartyModeSubagentStartWithTask(
      root,
      [
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
        'Run party-mode-facilitator for Create Story finalization',
        `输出 Story 文档到 ${storyPath}`,
      ].join('\n')
    );

    const state = readPartyModeCurrentSessionState(root);
    expect(state.document_generation_required).toBe(true);
    expect(state.expected_document_paths).toEqual([storyPath]);
  });

  it('does not allow a final PASS reconstruction when an expected canonical document was never written', () => {
    const root = makeEmitReadyRoot();
    const bugfixPath = path
      .join(root, '_bmad-output', 'implementation-artifacts', '_orphan', 'BUGFIX_expected.md')
      .replace(/\\/g, '/');

    runCursorPartyModeSubagentStartWithTask(
      root,
      [
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
        'Run party-mode-facilitator for BUGFIX final solution',
        `请生成 BUGFIX 文档到 ${bugfixPath}`,
      ].join('\n')
    );

    const refresh = refreshPartyModeSessionFromToolUse({
      cwd: root,
      tool_name: 'Task',
      tool_input: {
        executor: 'generalPurpose',
        description: 'Party Mode: BUGFIX final solution',
      },
      tool_output: buildValidCursorFullRunMessage(100, 'final_solution_task_list_100'),
    });

    expect(refresh.reason).toBe('party_mode_visible_output_incomplete');

    const state = readPartyModeCurrentSessionState(root);
    expect(state.status).toBe('needs_retry');
    expect(state.validation_status).toBe('FAIL');
    expect(state.validation_errors).toContain('missing_expected_generated_document');
  });

  it('reconstructs the current 100-round session from task output and does not fall back to a stale 50-round run', () => {
    const root = makeEmitReadyRoot();
    writePartyModeCurrentSessionState(root, {
      session_key: 'stale-50-session',
      gate_profile_id: 'decision_root_cause_50',
      target_rounds_total: 50,
      status: 'completed',
    });

    runCursorPartyModeSubagentStart(root, 'final_solution_task_list_100');
    const launched = readPartyModeCurrentSessionState(root);
    expect(launched.gate_profile_id).toBe('final_solution_task_list_100');
    expect(launched.target_rounds_total).toBe(100);

    const refresh = refreshPartyModeSessionFromToolUse({
      cwd: root,
      tool_name: 'Task',
      tool_input: {
        executor: 'generalPurpose',
        description: 'Party Mode: BUGFIX final solution',
      },
      tool_output: buildValidCursorFullRunMessage(100, 'final_solution_task_list_100'),
    });

    expect(refresh.reason).toBe('party_mode_visible_output_reconstructed');

    const state = readPartyModeCurrentSessionState(root);
    expect(state.gate_profile_id).toBe('final_solution_task_list_100');
    expect(state.target_rounds_total).toBe(100);
    expect(state.status).toBe('completed');
    expect(state.validation_status).toBe('PASS');
    expect(state.observed_visible_round_count).toBe(100);
    expect(state.visible_fragment_record_present).toBe(false);
    expect(state.visible_output_summary).toMatchObject({
      observed_visible_round_count: 100,
      first_visible_round: 1,
      last_visible_round: 100,
      final_gate_present: true,
      final_gate_profile: 'final_solution_task_list_100',
      final_gate_total_rounds: 100,
    });

    const audit = JSON.parse(fs.readFileSync(path.resolve(root, state.audit_verdict_path), 'utf8'));
    expect(audit.gate_profile_id).toBe('final_solution_task_list_100');
    expect(audit.min_rounds_check).toBe('PASS');
    expect(audit.final_result).toBe('PASS');

    const sessionLog = fs.readFileSync(path.resolve(root, state.session_log_path), 'utf8');
    const sessionLines = sessionLog.trim().split(/\r?\n/u).filter(Boolean);
    expect(sessionLines).toHaveLength(100);
    expect(sessionLog).toContain(`"session_key":"${state.session_key}"`);

    const capture = fs.readFileSync(path.resolve(root, state.visible_output_capture_path), 'utf8');
    expect(capture).toContain('### Round 100');
    expect(capture).toContain('## Final Gate Evidence');

    const finalSidecar = JSON.parse(
      fs.readFileSync(path.resolve(root, state.sidecar_final_path), 'utf8')
    );
    expect(finalSidecar.sidecar_kind).toBe('final');
    expect(finalSidecar.validation_status).toBe('PASS');
    expect(finalSidecar.final_result).toBe('PASS');
    expect(finalSidecar.observed_visible_round_count).toBe(100);
  });

  it('records incomplete 16/100 output against the current 100-round session instead of misreporting a stale 50-round gate', () => {
    const root = makeEmitReadyRoot();
    runCursorPartyModeSubagentStart(root, 'final_solution_task_list_100');

    const refresh = refreshPartyModeSessionFromToolUse({
      cwd: root,
      tool_name: 'Task',
      tool_input: {
        executor: 'generalPurpose',
        description: 'Party Mode: BUGFIX final solution',
      },
      tool_output: buildIncompleteCursorRunMessage(16, 100),
    });

    expect(refresh.reason).toBe('party_mode_visible_output_incomplete');

    const state = readPartyModeCurrentSessionState(root);
    expect(state.gate_profile_id).toBe('final_solution_task_list_100');
    expect(state.target_rounds_total).toBe(100);
    expect(state.status).toBe('needs_retry');
    expect(state.validation_status).toBe('FAIL');
    expect(state.observed_visible_round_count).toBe(16);
    expect(state.validation_errors).toContain('visible_round_count=16; expected=100');
    expect(state.validation_errors).toContain('missing_final_gate_evidence_block');
    expect(state.visible_fragment_record_present).toBe(true);
    expect(state.visible_output_summary).toMatchObject({
      observed_visible_round_count: 16,
      first_visible_round: 1,
      last_visible_round: 16,
      progress_current_round: 16,
      progress_target_round: 100,
      final_gate_present: false,
    });
    expect(String(state.visible_output_summary?.excerpt || '')).toContain('当前进度：16/100 轮');

    const audit = JSON.parse(fs.readFileSync(path.resolve(root, state.audit_verdict_path), 'utf8'));
    expect(audit.gate_profile_id).toBe('final_solution_task_list_100');
    expect(audit.min_rounds_check).toBe('FAIL');

    const sessionLog = fs.readFileSync(path.resolve(root, state.session_log_path), 'utf8');
    const sessionLines = sessionLog.trim().split(/\r?\n/u).filter(Boolean);
    expect(sessionLines).toHaveLength(17);
    expect(sessionLog).toContain(`"session_key":"${state.session_key}"`);
    expect(sessionLog).toContain(`"record_type":"visible_output_fragment"`);
  });

  it('reconstructs visible rounds from loose Round n/total headers during early exit', () => {
    const root = makeEmitReadyRoot();
    runCursorPartyModeSubagentStart(root, 'final_solution_task_list_100');

    const refresh = refreshPartyModeSessionFromToolUse({
      cwd: root,
      tool_name: 'Task',
      tool_input: {
        executor: 'generalPurpose',
        description: 'Party Mode: BUGFIX final solution',
      },
      tool_output: buildLooseHeaderCursorRunMessage(8, 100),
    });

    expect(refresh.reason).toBe('party_mode_visible_output_incomplete');

    const state = readPartyModeCurrentSessionState(root);
    expect(state.status).toBe('needs_retry');
    expect(state.validation_status).toBe('FAIL');
    expect(state.observed_visible_round_count).toBe(8);
    expect(state.visible_progress_current_round).toBe(8);
    expect(state.visible_progress_target_round).toBe(100);
    expect(state.visible_fragment_record_present).toBe(true);
    expect(state.visible_output_summary).toMatchObject({
      observed_visible_round_count: 8,
      first_visible_round: 1,
      last_visible_round: 8,
      progress_current_round: 8,
      progress_target_round: 100,
    });

    const sessionLog = fs.readFileSync(path.resolve(root, state.session_log_path), 'utf8');
    const sessionLines = sessionLog.trim().split(/\r?\n/u).filter(Boolean);
    expect(sessionLines).toHaveLength(9);
    expect(sessionLog).toContain(`"record_type":"agent_turn"`);
    expect(sessionLog).toContain(`"round_index":8`);
    expect(sessionLog).toContain(`"record_type":"visible_output_fragment"`);
    expect(sessionLog).toContain(`"progress_current_round":8`);
  });

  it('preserves early-exit visible content into a fragment record even when no round headers are parseable', () => {
    const root = makeEmitReadyRoot();
    runCursorPartyModeSubagentStart(root, 'final_solution_task_list_100');

    const refresh = refreshPartyModeSessionFromToolUse({
      cwd: root,
      tool_name: 'Task',
      tool_input: {
        executor: 'generalPurpose',
        description: 'Party Mode: BUGFIX final solution',
      },
      tool_output: buildSpeakerOnlyCursorRunMessage(7, 100),
    });

    expect(refresh.reason).toBe('party_mode_visible_output_incomplete');

    const state = readPartyModeCurrentSessionState(root);
    expect(state.status).toBe('needs_retry');
    expect(state.validation_status).toBe('FAIL');
    expect(state.observed_visible_round_count).toBe(0);
    expect(state.visible_progress_current_round).toBe(7);
    expect(state.visible_progress_target_round).toBe(100);
    expect(state.visible_fragment_record_present).toBe(true);
    expect(state.visible_output_summary).toMatchObject({
      observed_visible_round_count: 0,
      first_visible_round: null,
      last_visible_round: null,
      observed_visible_speaker_line_count: 2,
      progress_current_round: 7,
      progress_target_round: 100,
      final_gate_present: false,
    });
    expect(String(state.visible_output_summary?.excerpt || '')).toContain('继续分析中');

    const sessionLog = fs.readFileSync(path.resolve(root, state.session_log_path), 'utf8');
    const sessionLines = sessionLog.trim().split(/\r?\n/u).filter(Boolean);
    expect(sessionLines).toHaveLength(1);
    expect(sessionLog).toContain(`"record_type":"visible_output_fragment"`);
    expect(sessionLog).toContain(`"progress_current_round":7`);
    expect(sessionLog).toContain('继续分析中');
  });

  it('treats a final-gate PASS from a tail-only 91-100 capture as the successful completion of the current 100-round run', () => {
    const root = makeEmitReadyRoot();
    runCursorPartyModeSubagentStart(root, 'final_solution_task_list_100');

    refreshPartyModeSessionFromToolUse({
      cwd: root,
      tool_name: 'Task',
      tool_input: {
        executor: 'generalPurpose',
        description: 'Party Mode: BUGFIX final solution',
      },
      tool_result: {
        last_assistant_message: buildTailOnlySuccessfulCursorRunMessage(
          91,
          100,
          'final_solution_task_list_100'
        ),
      },
    });

    const state = readPartyModeCurrentSessionState(root);
    expect(state.gate_profile_id).toBe('final_solution_task_list_100');
    expect(state.target_rounds_total).toBe(100);
    expect(state.status).toBe('completed');
    expect(state.validation_status).toBe('PASS');
    expect(state.final_gate_profile).toBe('final_solution_task_list_100');
    expect(state.final_gate_total_rounds).toBe(100);
    expect(state.final_gate_result).toBe('PASS');
    expect(state.observed_visible_round_count).toBe(10);
    expect(state.validation_errors ?? []).toEqual([]);
    expect(state.validation_warnings).toContain('visible_round_count=10; expected=100');
    expect(state.visible_fragment_record_present).toBe(false);
    expect(state.visible_output_summary).toMatchObject({
      observed_visible_round_count: 10,
      first_visible_round: 91,
      last_visible_round: 100,
      final_gate_present: true,
      final_gate_profile: 'final_solution_task_list_100',
      final_gate_total_rounds: 100,
    });

    const audit = JSON.parse(fs.readFileSync(path.resolve(root, state.audit_verdict_path), 'utf8'));
    expect(audit.gate_profile_id).toBe('final_solution_task_list_100');
    expect(audit.final_result).toBe('PASS');
    expect(audit.source_mode).toBe('visible_final_gate_evidence');

    const capture = fs.readFileSync(path.resolve(root, state.visible_output_capture_path), 'utf8');
    expect(capture).toContain('### Round 91');
    expect(capture).toContain('## Final Gate Evidence');
  });

  it('reconstructs a completed PASS run from transcript_path when Task output itself only says the subagent completed', () => {
    const root = makeEmitReadyRoot();
    runCursorPartyModeSubagentStart(root, 'final_solution_task_list_100');

    const transcriptPath = path.join(root, 'tmp-party-mode-transcript.jsonl');
    fs.writeFileSync(
      transcriptPath,
      buildTranscriptWithEmbeddedPartyModeResult(
        buildValidCursorFullRunMessage(100, 'final_solution_task_list_100')
      ),
      'utf8'
    );

    const refresh = refreshPartyModeSessionFromToolUse({
      cwd: root,
      tool_name: 'Task',
      transcript_path: transcriptPath,
      tool_input: {
        executor: 'generalPurpose',
        description: 'Party Mode: BUGFIX final solution',
      },
      tool_output: 'The subagent task has completed.',
    });

    expect(refresh.reason).toBe('party_mode_visible_output_reconstructed');

    const state = readPartyModeCurrentSessionState(root);
    expect(state.status).toBe('completed');
    expect(state.validation_status).toBe('PASS');
    expect(state.final_gate_result).toBe('PASS');
    expect(state.observed_visible_round_count).toBe(100);
    expect(state.visible_output_summary).toMatchObject({
      observed_visible_round_count: 100,
      first_visible_round: 1,
      last_visible_round: 100,
      final_gate_present: true,
      final_gate_profile: 'final_solution_task_list_100',
      final_gate_total_rounds: 100,
    });
  });

  it('cursor post-tool-use wrapper reconstructs a completed PASS run from transcript_path when Task output is only a completion stub', () => {
    const root = makeEmitReadyRoot();
    runCursorPartyModeSubagentStart(root, 'final_solution_task_list_100');

    const transcriptPath = path.join(root, 'tmp-party-mode-wrapper-transcript.jsonl');
    fs.writeFileSync(
      transcriptPath,
      buildTranscriptWithEmbeddedPartyModeResult(
        buildValidCursorFullRunMessage(100, 'final_solution_task_list_100')
      ),
      'utf8'
    );

    const wrapper = path.join(repoRoot, '_bmad', 'cursor', 'hooks', 'post-tool-use.cjs');
    const result = spawnSync(process.execPath, [wrapper], {
      cwd: repoRoot,
      encoding: 'utf8',
      input: JSON.stringify({
        cwd: root,
        transcript_path: transcriptPath,
        tool_name: 'Task',
        tool_input: {
          executor: 'generalPurpose',
          description: 'Party Mode: BUGFIX final solution',
        },
        tool_output: 'The subagent task has completed.',
      }),
    });

    expect(result.status).toBe(0);

    const state = readPartyModeCurrentSessionState(root);
    expect(state.status).toBe('completed');
    expect(state.validation_status).toBe('PASS');
    expect(state.final_gate_result).toBe('PASS');
    expect(state.observed_visible_round_count).toBe(100);
    expect(state.visible_output_summary).toMatchObject({
      observed_visible_round_count: 100,
      first_visible_round: 1,
      last_visible_round: 100,
      final_gate_present: true,
      final_gate_profile: 'final_solution_task_list_100',
      final_gate_total_rounds: 100,
    });
  });

  it('writes a terminal fallback sidecar when the Cursor carrier returns without any visible output', () => {
    const root = makeEmitReadyRoot();
    runCursorPartyModeSubagentStart(root, 'final_solution_task_list_100');

    const refresh = refreshPartyModeSessionFromToolUse({
      cwd: root,
      tool_name: 'Task',
      tool_input: {
        executor: 'generalPurpose',
        description: 'Party Mode: BUGFIX final solution',
      },
    });

    expect(refresh.refreshed).toBe(false);
    expect(refresh.reason).toBe('party_mode_carrier_return_without_visible_output');

    const state = readPartyModeCurrentSessionState(root);
    expect(state.status).toBe('needs_retry');
    expect(state.validation_status).toBe('FAIL');
    expect(state.final_gate_result).toBe('FAIL');
    expect(state.agent_turn_event_source_mode).toBe('cursor_visible_output_reconstruction');
    expect(state.visible_output_summary).toMatchObject({
      diagnostic_classification: 'carrier_return_without_visible_output',
    });
    expect(state.validation_errors).toContain('missing_visible_output_after_carrier_return');

    const finalSidecarPath = path.resolve(root, state.sidecar_final_path);
    expect(fs.existsSync(finalSidecarPath)).toBe(true);
    const finalSidecar = JSON.parse(fs.readFileSync(finalSidecarPath, 'utf8'));
    expect(finalSidecar.sidecar_kind).toBe('final');
    expect(finalSidecar.status).toBe('needs_retry');
    expect(finalSidecar.validation_status).toBe('FAIL');
    expect(finalSidecar.final_result).toBe('FAIL');
    expect(finalSidecar.agent_turn_event_source_mode).toBe(
      'cursor_visible_output_reconstruction'
    );
    expect(finalSidecar.visible_output_summary).toMatchObject({
      diagnostic_classification: 'carrier_return_without_visible_output',
    });

    const helper = path.join(repoRoot, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs');
    const helperResult = spawnSync(process.execPath, [helper, '--project-root', root], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    expect(helperResult.status).toBe(0);
    const summary = JSON.parse(helperResult.stdout || '{}');
    expect(summary.execution_evidence_level).toBe('final');
    expect(summary.validation_status).toBe('FAIL');
    expect(summary.diagnostic_classification).toBe('carrier_return_without_visible_output');
    expect(summary.agent_turn_event_source_mode).toBe(
      'cursor_visible_output_reconstruction'
    );
  });

  it('does not let an unrelated post-tool-use event overwrite a successful current-session state back to FAIL', () => {
    const root = makeEmitReadyRoot();
    runCursorPartyModeSubagentStart(root, 'final_solution_task_list_100');

    refreshPartyModeSessionFromToolUse({
      cwd: root,
      tool_name: 'Task',
      tool_input: {
        executor: 'generalPurpose',
        description: 'Party Mode: BUGFIX final solution',
      },
      tool_result: {
        last_assistant_message: buildTailOnlySuccessfulCursorRunMessage(
          91,
          100,
          'final_solution_task_list_100'
        ),
      },
    });

    const before = readPartyModeCurrentSessionState(root);
    expect(before.status).toBe('completed');
    expect(before.validation_status).toBe('PASS');

    const unrelated = refreshPartyModeSessionFromToolUse({
      cwd: root,
      type: 'governance-rerun-result',
      payload: {
        projectRoot: root,
        runnerInput: {
          promptText: 'consumer validation',
        },
      },
    });
    expect(unrelated.refreshed).toBe(false);
    expect(unrelated.reason).toBe('unrelated_tool_use');

    const after = readPartyModeCurrentSessionState(root);
    expect(after.status).toBe('completed');
    expect(after.validation_status).toBe('PASS');
    expect(after.final_gate_result).toBe('PASS');

    const audit = JSON.parse(fs.readFileSync(path.resolve(root, after.audit_verdict_path), 'utf8'));
    expect(audit.final_result).toBe('PASS');
    expect(audit.source_mode).toBe('visible_final_gate_evidence');
  });

  it('does not let unrelated Bash event-writer tool uses overwrite the current cursor party-mode session', () => {
    const root = makeEmitReadyRoot();
    runCursorPartyModeSubagentStart(root, 'final_solution_task_list_100');

    const before = readPartyModeCurrentSessionState(root);
    expect(before.status).toBe('launched');

    const unrelated = refreshPartyModeSessionFromToolUse({
      cwd: root,
      tool_name: 'Bash',
      tool_input: {
        command:
          'node "D:/Dev/claw-scope/_bmad/runtime/hooks/party-mode-session-event.cjs" --project-root "D:/Dev/claw-scope" --session-key "cursor-subagent-types-50" --round-index 50 --speaker-id "adversarial-reviewer" --designated-challenger-id "adversarial-reviewer" --counts-toward-ratio true --has-new-gap false',
        description: 'Write final agent turn event',
      },
      tool_response: {
        stdout: '{\n  "refreshed": false,\n  "reason": "missing_party_mode_session_artifacts"\n}',
        stderr: '',
      },
    });

    expect(unrelated.refreshed).toBe(false);

    const after = readPartyModeCurrentSessionState(root);
    expect(after.session_key).toBe(before.session_key);
    expect(after.status).toBe('launched');
    expect(after.validation_status ?? null).toBe(null);
    expect(after.observed_visible_round_count ?? null).toBe(null);
  });

  it('consumer wrapper keeps a completed PASS party-mode session stable after an unrelated Bash post-tool-use event', () => {
    const root = makeEmitReadyRoot();
    runCursorPartyModeSubagentStart(root, 'final_solution_task_list_100');

    const wrapper = path.join(repoRoot, '_bmad', 'cursor', 'hooks', 'post-tool-use.cjs');
    const completedResult = spawnSync(process.execPath, [wrapper], {
      cwd: repoRoot,
      encoding: 'utf8',
      input: JSON.stringify({
        cwd: root,
        tool_name: 'Task',
        tool_input: {
          executor: 'generalPurpose',
          description: 'Party Mode: BUGFIX final solution',
        },
        tool_output: buildValidCursorFullRunMessage(100, 'final_solution_task_list_100'),
      }),
    });

    expect(completedResult.status).toBe(0);

    const before = readPartyModeCurrentSessionState(root);
    expect(before.status).toBe('completed');
    expect(before.validation_status).toBe('PASS');
    expect(before.final_gate_result).toBe('PASS');

    const unrelatedResult = spawnSync(process.execPath, [wrapper], {
      cwd: repoRoot,
      encoding: 'utf8',
      input: JSON.stringify({
        cwd: root,
        tool_name: 'Bash',
        tool_input: {
          command:
            'node "D:/Dev/claw-scope/_bmad/runtime/hooks/party-mode-session-event.cjs" --project-root "D:/Dev/claw-scope" --session-key "cursor-subagent-types-50" --round-index 50 --speaker-id "adversarial-reviewer" --designated-challenger-id "adversarial-reviewer" --counts-toward-ratio true --has-new-gap false',
          description: 'Write final agent turn event',
        },
        tool_response: {
          stdout: '{\n  "refreshed": false,\n  "reason": "missing_party_mode_session_artifacts"\n}',
          stderr: '',
        },
      }),
    });

    expect(unrelatedResult.status).toBe(0);

    const after = readPartyModeCurrentSessionState(root);
    expect(after.session_key).toBe(before.session_key);
    expect(after.status).toBe('completed');
    expect(after.validation_status).toBe('PASS');
    expect(after.final_gate_result).toBe('PASS');
    expect(after.observed_visible_round_count).toBe(100);
    expect(after.visible_output_summary).toMatchObject({
      observed_visible_round_count: 100,
      first_visible_round: 1,
      last_visible_round: 100,
      final_gate_present: true,
      final_gate_profile: 'final_solution_task_list_100',
      final_gate_total_rounds: 100,
    });
  });

  it('cursor post-tool-use wrapper forwards task output into runtime core reconstruction', () => {
    const root = makeEmitReadyRoot();
    runCursorPartyModeSubagentStart(root, 'final_solution_task_list_100');

    const wrapper = path.join(repoRoot, '_bmad', 'cursor', 'hooks', 'post-tool-use.cjs');
    const result = spawnSync(process.execPath, [wrapper], {
      cwd: repoRoot,
      encoding: 'utf8',
      input: JSON.stringify({
        cwd: root,
        tool_name: 'Task',
        tool_input: {
          executor: 'generalPurpose',
          description: 'Party Mode: BUGFIX final solution',
        },
        tool_output: buildIncompleteCursorRunMessage(16, 100),
      }),
    });

    expect(result.status).toBe(0);
    const state = readPartyModeCurrentSessionState(root);
    expect(state.gate_profile_id).toBe('final_solution_task_list_100');
    expect(state.target_rounds_total).toBe(100);
    expect(state.status).toBe('needs_retry');
    expect(state.observed_visible_round_count).toBe(16);
    expect(state.validation_errors).toContain('visible_round_count=16; expected=100');
  });
});
