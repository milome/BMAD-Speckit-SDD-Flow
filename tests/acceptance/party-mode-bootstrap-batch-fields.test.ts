import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  linkRepoNodeModulesIntoProject,
  writeMinimalRegistryAndProjectContext,
} from '../helpers/runtime-registry-fixture';

const ROOT = process.cwd();

function makeHookReadyRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-bootstrap-fields-'));
  fs.cpSync(path.join(ROOT, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(tempRoot);
  writeMinimalRegistryAndProjectContext(tempRoot, { flow: 'story', stage: 'story_create' });
  return tempRoot;
}

describe('party-mode bootstrap batch fields', () => {
  it('injects batch fields, topic, and resolved_mode into the bootstrap block', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const task = '请继续第 2 批 party-mode-facilitator 根因分析，聚焦 deferred risks';
      const result = spawnSync(process.execPath, [inject, '--subagent-start'], {
        cwd: ROOT,
        input: JSON.stringify({
          cwd: tempRoot,
          task,
          partyModeBatch: {
            sessionKey: 'pm-bootstrap-001',
            gateProfileId: 'decision_root_cause_50',
            batchIndex: 2,
            batchStartRound: 21,
            batchTargetRound: 40,
            targetRoundsTotal: 50,
            checkpointWindowMs: 15000,
            resolvedMode: 'zh',
          },
        }),
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tempRoot,
        },
      });

      expect(result.status).toBe(0);
      const output = JSON.parse(result.stdout || '{}') as {
        hookSpecificOutput?: { additionalContext?: string };
      };
      const block = output.hookSpecificOutput?.additionalContext ?? '';
      expect(block).toContain('"session_key": "pm-bootstrap-001"');
      expect(block).toContain('"gate_profile_id": "decision_root_cause_50"');
      expect(block).toContain('"closure_level": "standard"');
      expect(block).toContain('"batch_index": 2');
      expect(block).toContain('"batch_start_round": 21');
      expect(block).toContain('"batch_target_round": 40');
      expect(block).toContain('"target_rounds_total": 50');
      expect(block).toContain('"checkpoint_window_ms": 15000');
      expect(block).toContain('"current_batch_status": "pending"');
      expect(block).toContain(
        '"topic": "请继续第 2 批 party-mode-facilitator 根因分析，聚焦 deferred risks"'
      );
      expect(block).toContain('"resolved_mode": "zh"');
      expect(block).toContain('"checkpoint_json_path":');
      expect(block).toContain('"checkpoint_receipt_path":');

      const metaPath = path.join(
        tempRoot,
        '_bmad-output',
        'party-mode',
        'sessions',
        'pm-bootstrap-001.meta.json'
      );
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
        current_batch_index: number;
        current_batch_start_round: number;
        current_batch_target_round: number;
        target_rounds_total: number;
        checkpoint_window_ms: number;
        current_batch_status: string;
        resolved_mode: string;
      };
      expect(meta.current_batch_index).toBe(2);
      expect(meta.current_batch_start_round).toBe(21);
      expect(meta.current_batch_target_round).toBe(40);
      expect(meta.target_rounds_total).toBe(50);
      expect(meta.checkpoint_window_ms).toBe(15_000);
      expect(meta.current_batch_status).toBe('pending');
      expect(meta.resolved_mode).toBe('zh');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);
});
