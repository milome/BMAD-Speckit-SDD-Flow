import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendTurn,
  evaluateGate,
  KNOWN_GATE_PROFILES,
  startSession,
} from '../../scripts/party-mode-runtime';

describe('party-mode closure level mapping', () => {
  it('freezes closure levels for all known gate profiles', () => {
    expect(KNOWN_GATE_PROFILES.quick_probe_20.closureLevel).toBe('none');
    expect(KNOWN_GATE_PROFILES.decision_root_cause_50.closureLevel).toBe('standard');
    expect(KNOWN_GATE_PROFILES.final_solution_task_list_100.closureLevel).toBe('high_confidence');
  });

  it('persists closure_level into session meta and gate results', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-closure-level-'));
    try {
      startSession(root, {
        sessionKey: 'pm-closure-001',
        gateProfileId: 'quick_probe_20',
        designatedChallengerId: 'critical-auditor',
      });

      for (let index = 1; index <= 20; index += 1) {
        appendTurn(root, {
          session_key: 'pm-closure-001',
          round_index: index,
          speaker_id: index <= 13 ? 'critical-auditor' : 'architect',
          designated_challenger_id: 'critical-auditor',
          counts_toward_ratio: true,
          has_new_gap: index > 17 ? false : index % 8 === 0,
        });
      }

      const metaPath = path.join(
        root,
        '_bmad-output',
        'party-mode',
        'sessions',
        'pm-closure-001.meta.json'
      );
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { closure_level: string };
      const result = evaluateGate(root, 'pm-closure-001');

      expect(meta.closure_level).toBe('none');
      expect(result.closure_level).toBe('none');
      expect(result.gate_pass).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
