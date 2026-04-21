import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { startSession } from '../../scripts/party-mode-runtime';
import {
  linkRepoNodeModulesIntoProject,
  writeMinimalRegistryAndProjectContext,
} from '../helpers/runtime-registry-fixture';

const ROOT = process.cwd();

function makeHookReadyRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-batch-reuse-'));
  fs.cpSync(path.join(ROOT, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(tempRoot);
  writeMinimalRegistryAndProjectContext(tempRoot, { flow: 'story', stage: 'story_create' });
  return tempRoot;
}

describe('party-mode batch session reuse', () => {
  it('reuses the same session_key and meta file across batches in the runtime owner', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-batch-owner-'));
    try {
      const first = startSession(root, {
        sessionKey: 'pm-batch-owner-001',
        gateProfileId: 'decision_root_cause_50',
        topic: '普通 RCA',
        resolvedMode: 'zh',
      });

      const second = startSession(root, {
        sessionKey: 'pm-batch-owner-001',
        gateProfileId: 'decision_root_cause_50',
        batchIndex: 2,
        batchStartRound: 21,
        batchTargetRound: 40,
        targetRoundsTotal: 50,
        checkpointWindowMs: 15_000,
        topic: '普通 RCA',
        resolvedMode: 'zh',
      });

      const metaPath = path.join(
        root,
        '_bmad-output',
        'party-mode',
        'sessions',
        'pm-batch-owner-001.meta.json'
      );
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
        session_key: string;
        current_batch_index: number;
        current_batch_start_round: number;
        current_batch_target_round: number;
        target_rounds_total: number;
        checkpoint_window_ms: number;
        current_batch_status: string;
        created_at: string;
      };

      expect(first.session_key).toBe(second.session_key);
      expect(meta.session_key).toBe('pm-batch-owner-001');
      expect(meta.current_batch_index).toBe(2);
      expect(meta.current_batch_start_round).toBe(21);
      expect(meta.current_batch_target_round).toBe(40);
      expect(meta.target_rounds_total).toBe(50);
      expect(meta.checkpoint_window_ms).toBe(15_000);
      expect(meta.current_batch_status).toBe('pending');
      expect(meta.created_at).toBe(first.created_at);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('hook runtime bootstrap reuses the same session_key and advances batch metadata', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const runtime = require(
        path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-session-runtime.cjs')
      ) as {
        bootstrapSession: (
          projectRoot: string,
          options: Record<string, unknown>
        ) => {
          sessionKey: string;
          meta: { created_at: string; current_batch_index: number; current_batch_target_round: number };
        };
      };

      const first = runtime.bootstrapSession(tempRoot, {
        sessionKey: 'pm-batch-hook-001',
        gateProfileId: 'final_solution_task_list_100',
        inputText: 'Run facilitator for BUGFIX final solution and §7 task list',
      });
      const second = runtime.bootstrapSession(tempRoot, {
        sessionKey: 'pm-batch-hook-001',
        gateProfileId: 'final_solution_task_list_100',
        batchIndex: 2,
        batchStartRound: 21,
        batchTargetRound: 40,
        targetRoundsTotal: 100,
        checkpointWindowMs: 15_000,
        inputText: '继续下一批高置信度最终方案讨论',
      });

      expect(first.sessionKey).toBe(second.sessionKey);
      expect(second.meta.current_batch_index).toBe(2);
      expect(second.meta.current_batch_target_round).toBe(40);
      expect(second.meta.created_at).toBe(first.meta.created_at);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
