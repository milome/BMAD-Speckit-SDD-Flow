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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-runtime-hooks-'));
  fs.cpSync(path.join(ROOT, '_bmad'), path.join(tempRoot, '_bmad'), { recursive: true });
  linkRepoNodeModulesIntoProject(tempRoot);
  writeMinimalRegistryAndProjectContext(tempRoot, { flow: 'story', stage: 'story_create' });
  return tempRoot;
}

describe('party-mode runtime hooks', () => {
  it('runtime-policy-inject initializes party-mode session meta on facilitator subagent start', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const inject = path.join(ROOT, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs');
      const result = spawnSync(process.execPath, [inject, '--subagent-start'], {
        cwd: ROOT,
        input: JSON.stringify({
          cwd: tempRoot,
          task: 'Run party-mode-facilitator for BUGFIX final solution and §7 task list',
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
      expect(output.hookSpecificOutput?.additionalContext).toContain(
        'Party Mode Session Bootstrap'
      );
      expect(output.hookSpecificOutput?.additionalContext).toContain(
        '"agent_turn_event_source_mode": "explicit_event_writer_bridge"'
      );
      expect(output.hookSpecificOutput?.additionalContext).toContain(
        '"host_native_agent_turn_supported": false'
      );

      const sessionsDir = path.join(tempRoot, '_bmad-output', 'party-mode', 'sessions');
      const metaFiles = fs.readdirSync(sessionsDir).filter((file) => file.endsWith('.meta.json'));
      expect(metaFiles).toHaveLength(1);

      const meta = JSON.parse(fs.readFileSync(path.join(sessionsDir, metaFiles[0]), 'utf8')) as {
        gate_profile_id: string;
        designated_challenger_id: string;
        agent_turn_event_source_mode: string;
        host_native_agent_turn_supported: boolean;
      };
      expect(meta.gate_profile_id).toBe('final_solution_task_list_100');
      expect(meta.designated_challenger_id).toBe('adversarial-reviewer');
      expect(meta.agent_turn_event_source_mode).toBe('explicit_event_writer_bridge');
      expect(meta.host_native_agent_turn_supported).toBe(false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 60000);

  it('post-tool-use refreshes party-mode snapshot and evidence when session log changes', () => {
    const tempRoot = makeHookReadyRoot();
    try {
      const partyModeRuntime = require(
        path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-session-runtime.cjs')
      ) as {
        bootstrapSession: (
          projectRoot: string,
          options: { sessionKey: string; gateProfileId: string; designatedChallengerId: string }
        ) => { paths: { sessionLogPath: string; snapshotPath: string; auditVerdictPath: string } };
      };
      const postToolUseCore = require(
        path.join(ROOT, '_bmad', 'runtime', 'hooks', 'post-tool-use-core.cjs')
      ) as {
        refreshPartyModeSessionFromToolUse: (input: unknown) => { refreshed: boolean };
      };

      const session = partyModeRuntime.bootstrapSession(tempRoot, {
        sessionKey: 'pm-hook-001',
        gateProfileId: 'decision_root_cause_50',
        designatedChallengerId: 'adversarial-reviewer',
      });
      const turns = Array.from({ length: 50 }, (_, index) => {
        const roundIndex = index + 1;
        return {
          record_type: 'agent_turn',
          session_key: 'pm-hook-001',
          round_index: roundIndex,
          speaker_id: roundIndex <= 31 ? 'adversarial-reviewer' : 'architect',
          designated_challenger_id: 'adversarial-reviewer',
          counts_toward_ratio: true,
          has_new_gap: roundIndex > 47 ? false : roundIndex % 11 === 0,
          timestamp: `2026-04-14T00:00:${String(roundIndex).padStart(2, '0')}.000Z`,
        };
      });
      fs.writeFileSync(
        session.paths.sessionLogPath,
        `${turns.map((turn) => JSON.stringify(turn)).join('\n')}\n`,
        'utf8'
      );

      const refresh = postToolUseCore.refreshPartyModeSessionFromToolUse({
        cwd: tempRoot,
        tool_name: 'Write',
        tool_input: {
          file_path: session.paths.sessionLogPath,
        },
      });

      expect(refresh.refreshed).toBe(true);
      expect(fs.existsSync(session.paths.snapshotPath)).toBe(true);
      expect(fs.existsSync(session.paths.auditVerdictPath)).toBe(true);

      const audit = JSON.parse(fs.readFileSync(session.paths.auditVerdictPath, 'utf8')) as {
        final_result: string;
        agent_turn_event_source_mode: string;
        host_native_agent_turn_supported: boolean;
      };
      expect(audit.final_result).toBe('PASS');
      expect(audit.agent_turn_event_source_mode).toBe('explicit_event_writer_bridge');
      expect(audit.host_native_agent_turn_supported).toBe(false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
