import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateCheckpointWindowInput,
  resolveCheckpointWindowTimeout,
  startSession,
} from '../../scripts/party-mode-runtime';

describe('party-mode checkpoint window input', () => {
  it('rejects S/F/C outside the checkpoint window without caching or business reinterpretation', () => {
    const decision = evaluateCheckpointWindowInput('C', false);

    expect(decision.accepted).toBe(false);
    expect(decision.resolution).toBe('reject_outside_window');
    expect(decision.treat_as_business_context).toBe(false);
    expect(decision.acknowledgement).toContain('当前不在 checkpoint 窗口');
  });

  it('auto-continues when the checkpoint window times out with no user input', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-timeout-'));
    try {
      const meta = startSession(root, {
        sessionKey: 'pm-timeout-001',
        gateProfileId: 'decision_root_cause_50',
      });
      const timeout = resolveCheckpointWindowTimeout(meta);

      expect(timeout.accepted).toBe(true);
      expect(timeout.resolution).toBe('auto_continue_after_timeout');
      expect(timeout.closes_window).toBe(true);
      expect(timeout.stop_auto_continue).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
