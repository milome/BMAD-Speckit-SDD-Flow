import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCheckpointWindowState, startSession } from '../../scripts/party-mode-runtime';

describe('party-mode batch orchestrator', () => {
  it('defaults checkpoint handling to auto-continue and reserves heartbeat to the facilitator', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-orchestrator-'));
    try {
      const meta = startSession(root, {
        sessionKey: 'pm-orchestrator-001',
        gateProfileId: 'decision_root_cause_50',
      });

      const state = buildCheckpointWindowState(meta);
      expect(state.default_behavior).toBe('auto_continue_next_batch');
      expect(state.allowed_commands).toEqual(['S', 'F', 'C']);
      expect(state.checkpoint_window_ms).toBe(15_000);
      expect(state.facilitator_owns_heartbeat).toBe(true);
      expect(state.main_agent_displays_checkpoint).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
