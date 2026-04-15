import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const HOOK = path.join(ROOT, '.claude', 'hooks', 'subagent-result-summary.cjs');
const TEMP_ROOTS: string[] = [];

function writePartyModeValidationContext(root: string, agentId: string): void {
  const milestoneDir = path.join(root, '.claude', 'state', 'milestones');
  mkdirSync(milestoneDir, { recursive: true });
  const auditPath = path.join(root, '_bmad-output', 'party-mode', 'evidence', 'pm-visible-001.audit.json');
  mkdirSync(path.dirname(auditPath), { recursive: true });
  writeFileSync(
    auditPath,
    JSON.stringify(
      {
        session_key: 'pm-visible-001',
        gate_profile_id: 'final_solution_task_list_100',
        closure_level: 'high_confidence',
        min_rounds_check: 'PASS',
        challenger_ratio_check: 'PASS',
        last_tail_no_new_gap_check: 'PASS',
        final_result: 'PASS',
      },
      null,
      2
    ),
    'utf8'
  );
  writeFileSync(
    path.join(milestoneDir, `${agentId}.party-mode.json`),
    JSON.stringify(
      {
        agent_id: agentId,
        agent_type: 'party-mode-facilitator',
        session_key: 'pm-visible-001',
        gate_profile_id: 'final_solution_task_list_100',
        target_rounds_total: 20,
        batch_size: 20,
        current_batch_index: 1,
        current_batch_start_round: 1,
        current_batch_target_round: 20,
        current_batch_status: 'completed',
        checkpoint_rounds: [20],
        audit_verdict_path: auditPath,
      },
      null,
      2
    ),
    'utf8'
  );
}

function writePartyModeValidationContextWithGate(
  root: string,
  agentId: string,
  options: {
    sessionKey: string;
    gateProfileId: string;
    closureLevel: string;
    targetRoundsTotal: number;
    checkpointRounds: number[];
  }
): string {
  const milestoneDir = path.join(root, '.claude', 'state', 'milestones');
  mkdirSync(milestoneDir, { recursive: true });
  const auditPath = path.join(
    root,
    '_bmad-output',
    'party-mode',
    'evidence',
    `${options.sessionKey}.audit.json`
  );
  mkdirSync(path.dirname(auditPath), { recursive: true });
  writeFileSync(
    auditPath,
    JSON.stringify(
      {
        session_key: options.sessionKey,
        gate_profile_id: options.gateProfileId,
        closure_level: options.closureLevel,
        min_rounds_check: 'PASS',
        challenger_ratio_check: 'PASS',
        last_tail_no_new_gap_check: 'PASS',
        final_result: 'PASS',
      },
      null,
      2
    ),
    'utf8'
  );
  writeFileSync(
    path.join(milestoneDir, `${agentId}.party-mode.json`),
    JSON.stringify(
      {
        agent_id: agentId,
        agent_type: 'party-mode-facilitator',
        session_key: options.sessionKey,
        gate_profile_id: options.gateProfileId,
        target_rounds_total: options.targetRoundsTotal,
        batch_size: 20,
        current_batch_index: 1,
        current_batch_start_round: 1,
        current_batch_target_round: options.checkpointRounds[0] ?? options.targetRoundsTotal,
        current_batch_status:
          (options.checkpointRounds[0] ?? options.targetRoundsTotal) >= options.targetRoundsTotal
            ? 'completed'
            : 'checkpoint_ready',
        checkpoint_rounds: options.checkpointRounds,
        audit_verdict_path: auditPath,
      },
      null,
      2
    ),
    'utf8'
  );
  return auditPath;
}

function buildValidPartyModeMessage(totalRounds: number): string {
  const lines: string[] = [];
  for (let round = 1; round <= totalRounds; round += 1) {
    lines.push(`### Round ${round}`);
    lines.push(`🏗️ **Winston 架构师**: 第 ${round} 轮给出架构判断。`);
    lines.push(`⚔️ **批判性审计员**: 第 ${round} 轮提出反对点与遗漏风险。`);
  }
  lines.push(`## Checkpoint ${totalRounds}/${totalRounds}`);
  lines.push('- Resolved Topics: root cause confirmed');
  lines.push('- Unresolved Topics: none');
  lines.push('- Deferred Risks: monitor regressions');
  lines.push('- Challenger Ratio: 0.62');
  lines.push('- Next Focus: finalize output');
  lines.push('## Final Gate Evidence');
  lines.push('- Gate Profile: final_solution_task_list_100');
  lines.push(`- Total Rounds: ${totalRounds}`);
  lines.push('- Challenger Ratio Check: PASS');
  lines.push('- Tail Window No New Gap: PASS');
  lines.push('- Final Result: PASS');
  return lines.join('\n');
}

function buildPrematureProgressMessage(currentRound: number, totalRounds: number): string {
  const lines: string[] = [];
  for (let round = 1; round <= currentRound; round += 1) {
    lines.push(`### Round ${round}`);
    lines.push(`🏗️ **Winston 架构师**: 第 ${round} 轮给出架构判断。`);
    lines.push(`⚔️ **批判性审计员**: 第 ${round} 轮提出反对点与遗漏风险。`);
  }
  lines.push('Party Mode 进展报告');
  lines.push('');
  lines.push(`当前进度：${currentRound}/${totalRounds} 轮`);
  lines.push('当前 challenger 发言占比：10/40 = 25% (需继续提升)');
  lines.push('');
  lines.push(`进入 Round ${currentRound + 1}（11-15窗口期，挑战者需回归）...`);
  return lines.join('\n');
}

function buildBatchCheckpointMessage(
  batchStartRound: number,
  batchTargetRound: number,
  totalRounds: number
): string {
  const lines: string[] = [];
  for (let round = batchStartRound; round <= batchTargetRound; round += 1) {
    lines.push(`### Round ${round}`);
    lines.push(`🏗️ **Winston 架构师**: 第 ${round} 轮给出架构判断。`);
    lines.push(`⚔️ **批判性审计员**: 第 ${round} 轮提出反对点与遗漏风险。`);
  }
  lines.push(`## Checkpoint ${batchTargetRound}/${totalRounds}`);
  lines.push('- Resolved Topics: batch scope clarified');
  lines.push('- Unresolved Topics: final convergence pending');
  lines.push('- Deferred Risks: need later batch verification');
  lines.push('- Challenger Ratio: 0.65');
  lines.push('- Next Focus: continue next batch');
  return lines.join('\n');
}

describe('party-mode visible output validation', () => {
  afterEach(() => {
    while (TEMP_ROOTS.length > 0) {
      rmSync(TEMP_ROOTS.pop()!, { recursive: true, force: true });
    }
  });

  it('fails closed when facilitator returns only a summary instead of visible rounds/checkpoints', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'party-mode-visible-fail-'));
    TEMP_ROOTS.push(root);
    writePartyModeValidationContext(root, 'party-agent-001');

    const r = spawnSync(process.execPath, [HOOK], {
      encoding: 'utf8',
      input: JSON.stringify({
        agent_id: 'party-agent-001',
        agent_type: 'party-mode-facilitator',
        last_assistant_message: '已完成 100 轮讨论并记录 checkpoint，最终方案如下。',
        cwd: root,
      }),
    });

    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Party-Mode visible output validation failed');
    expect(r.stderr).toContain('missing_checkpoint_block=20/20');
    expect(r.stderr).toContain('missing_final_gate_evidence_block');
  });

  it('passes when facilitator returns visible rounds, checkpoint, and final gate evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'party-mode-visible-pass-'));
    TEMP_ROOTS.push(root);
    writePartyModeValidationContext(root, 'party-agent-002');
    const auditPath = path.join(root, '_bmad-output', 'party-mode', 'evidence', 'pm-visible-001.audit.json');

    const r = spawnSync(process.execPath, [HOOK], {
      encoding: 'utf8',
      input: JSON.stringify({
        agent_id: 'party-agent-002',
        agent_type: 'party-mode-facilitator',
        last_assistant_message: buildValidPartyModeMessage(20),
        cwd: root,
      }),
    });

    expect(r.status).toBe(0);
    expect(r.stderr).toContain('party-mode-facilitator');
    expect(r.stderr).toContain('结果摘要');
    expect(r.stderr).toContain('挑战者终审:');
    expect(r.stderr).toContain('批判性审计员: 第 20 轮提出反对点与遗漏风险。');
    expect(r.stderr).toContain('## Checkpoint 20/20');
    expect(r.stderr).toContain('## Final Gate Evidence');
    expect(readFileSync(auditPath, 'utf8')).toContain('"final_result": "PASS"');
  });

  it('passes when facilitator stops at an intermediate 20/50 batch boundary and surfaces the checkpoint block', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'party-mode-visible-batch-pass-'));
    TEMP_ROOTS.push(root);
    writePartyModeValidationContextWithGate(root, 'party-agent-004', {
      sessionKey: 'pm-visible-batch-050',
      gateProfileId: 'decision_root_cause_50',
      closureLevel: 'standard',
      targetRoundsTotal: 50,
      checkpointRounds: [20, 40, 50],
    });
    const statePath = path.join(root, '.claude', 'state', 'milestones', 'party-agent-004.party-mode.json');
    const state = JSON.parse(readFileSync(statePath, 'utf8')) as Record<string, unknown>;
    state.current_batch_index = 1;
    state.current_batch_start_round = 1;
    state.current_batch_target_round = 20;
    state.current_batch_status = 'checkpoint_ready';
    writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

    const r = spawnSync(process.execPath, [HOOK], {
      encoding: 'utf8',
      input: JSON.stringify({
        agent_id: 'party-agent-004',
        agent_type: 'party-mode-facilitator',
        last_assistant_message: buildBatchCheckpointMessage(1, 20, 50),
        cwd: root,
      }),
    });

    expect(r.status).toBe(0);
    expect(r.stderr).toContain('## Checkpoint 20/50');
    expect(r.stderr).toContain('- Resolved Topics: batch scope clarified');
    expect(r.stderr).not.toContain('## Final Gate Evidence');
  });

  it('fails closed when facilitator hands control back at round 10 of a 50-round batch before checkpoint 20/50', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'party-mode-visible-round10-fail-'));
    TEMP_ROOTS.push(root);
    writePartyModeValidationContextWithGate(root, 'party-agent-003', {
      sessionKey: 'pm-visible-050',
      gateProfileId: 'decision_root_cause_50',
      closureLevel: 'standard',
      targetRoundsTotal: 50,
      checkpointRounds: [20, 40, 50],
    });

    const r = spawnSync(process.execPath, [HOOK], {
      encoding: 'utf8',
      input: JSON.stringify({
        agent_id: 'party-agent-003',
        agent_type: 'party-mode-facilitator',
        last_assistant_message: buildPrematureProgressMessage(10, 50),
        cwd: root,
      }),
    });

    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Party-Mode visible output validation failed');
    expect(r.stderr).toContain('visible_round_count=10; expected=20');
    expect(r.stderr).toContain('missing_checkpoint_block=20/50');
  });
});
