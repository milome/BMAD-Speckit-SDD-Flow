import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendTurn,
  evaluateGate,
  writeCheckpointArtifacts,
  startSession,
} from '../../scripts/party-mode-runtime';

describe('party-mode checkpoint artifact', () => {
  it('auto-writes checkpoint JSON/Markdown and marks checkpoint_ready at the batch boundary', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-checkpoint-artifact-'));
    try {
      startSession(root, {
        sessionKey: 'pm-checkpoint-001',
        gateProfileId: 'decision_root_cause_50',
      });

      for (let index = 1; index <= 20; index += 1) {
        appendTurn(root, {
          session_key: 'pm-checkpoint-001',
          round_index: index,
          speaker_id: index <= 13 ? 'critical-auditor' : 'architect',
          designated_challenger_id: 'critical-auditor',
          counts_toward_ratio: true,
          has_new_gap: index > 17 ? false : index % 6 === 0,
        });
      }

      const checkpointJsonPath = path.join(
        root,
        '_bmad-output',
        'party-mode',
        'checkpoints',
        'pm-checkpoint-001.round-020.json'
      );
      const checkpointMarkdownPath = path.join(
        root,
        '_bmad-output',
        'party-mode',
        'checkpoints',
        'pm-checkpoint-001.round-020.md'
      );
      const receiptPath = path.join(
        root,
        '_bmad-output',
        'party-mode',
        'checkpoints',
        'pm-checkpoint-001.round-020.receipt.json'
      );
      const metaPath = path.join(
        root,
        '_bmad-output',
        'party-mode',
        'sessions',
        'pm-checkpoint-001.meta.json'
      );

      expect(fs.existsSync(checkpointJsonPath)).toBe(true);
      expect(fs.existsSync(checkpointMarkdownPath)).toBe(true);
      expect(fs.existsSync(receiptPath)).toBe(true);

      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
        current_batch_status: string;
      };
      expect(meta.current_batch_status).toBe('checkpoint_ready');

      const artifact = JSON.parse(fs.readFileSync(checkpointJsonPath, 'utf8')) as {
        version: string;
        batch_end_round: number;
        deterministic_state: {
          current_round: number;
          target_rounds_total: number;
          remaining_rounds: number;
          source_log_sha256: string;
        };
        facilitator_summary: {
          resolved_topics: string[];
          unresolved_topics: string[];
          deferred_risks: string[];
          next_focus: string[];
        };
      };
      const markdown = fs.readFileSync(checkpointMarkdownPath, 'utf8');

      expect(artifact.version).toBe('party_mode_checkpoint_v1');
      expect(artifact.batch_end_round).toBe(20);
      expect(artifact.deterministic_state.current_round).toBe(20);
      expect(artifact.deterministic_state.target_rounds_total).toBe(50);
      expect(artifact.deterministic_state.remaining_rounds).toBe(30);
      expect(artifact.deterministic_state.source_log_sha256.startsWith('sha256:')).toBe(true);
      expect(artifact.facilitator_summary.resolved_topics).toEqual([]);
      expect(artifact.facilitator_summary.unresolved_topics).toEqual([]);
      expect(artifact.facilitator_summary.deferred_risks).toEqual([]);
      expect(artifact.facilitator_summary.next_focus).toEqual([]);
      expect(markdown).toContain('# Party-Mode Checkpoint 20/50');
      expect(markdown).toContain('- Challenger Ratio:');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps deterministic_state authoritative and facilitator_summary advisory only', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-checkpoint-boundary-'));
    try {
      startSession(root, {
        sessionKey: 'pm-checkpoint-002',
        gateProfileId: 'decision_root_cause_50',
      });

      for (let index = 1; index <= 20; index += 1) {
        appendTurn(root, {
          session_key: 'pm-checkpoint-002',
          round_index: index,
          speaker_id: index <= 13 ? 'critical-auditor' : 'architect',
          designated_challenger_id: 'critical-auditor',
          counts_toward_ratio: true,
          has_new_gap: index > 17 ? false : index % 5 === 0,
        });
      }

      const before = evaluateGate(root, 'pm-checkpoint-002');
      const paths = writeCheckpointArtifacts(root, 'pm-checkpoint-002', {
        resolvedTopics: ['root cause fixed'],
        unresolvedTopics: ['need follow-up benchmark'],
        deferredRisks: ['slow path on legacy model'],
        nextFocus: ['batch 2 stress review'],
      });
      const after = evaluateGate(root, 'pm-checkpoint-002');

      const artifact = JSON.parse(fs.readFileSync(paths.checkpointJsonPath, 'utf8')) as {
        deterministic_state: Record<string, unknown>;
        facilitator_summary: Record<string, unknown>;
      };

      expect(before.challenger_ratio).toBe(after.challenger_ratio);
      expect(before.source_log_sha256).toBe(after.source_log_sha256);
      expect(artifact.deterministic_state).toMatchObject({
        current_round: 20,
        target_rounds_total: 50,
      });
      expect(artifact.facilitator_summary).toEqual({
        resolved_topics: ['root cause fixed'],
        unresolved_topics: ['need follow-up benchmark'],
        deferred_risks: ['slow path on legacy model'],
        next_focus: ['batch 2 stress review'],
      });
      expect('resolved_topics' in artifact.deterministic_state).toBe(false);
      expect('challenger_ratio' in artifact.facilitator_summary).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
