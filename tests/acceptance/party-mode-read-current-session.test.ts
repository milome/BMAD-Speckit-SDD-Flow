import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writePartyModeCurrentSessionState } from '../../_bmad/runtime/hooks/party-mode-current-session.cjs';

const ROOT = process.cwd();
const tempRoots: string[] = [];

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-read-current-'));
  tempRoots.push(root);
  fs.mkdirSync(path.join(root, '_bmad-output', 'party-mode', 'runtime'), { recursive: true });
  return root;
}

describe('party-mode read current session helper', () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
    }
  });

  it('returns a safe summary even when current-session.json is missing', () => {
    const root = makeRoot();
    const helper = path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs');
    const result = spawnSync(process.execPath, [helper, '--project-root', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout || '{}');
    expect(output.current_session_exists).toBe(false);
    expect(output.status).toBe('missing');
    expect(output.execution_evidence_level).toBe('none');
  });

  it('reports file existence without throwing when some referenced paths are absent', () => {
    const root = makeRoot();
    const sessionDir = path.join(root, '_bmad-output', 'party-mode', 'sessions');
    const captureDir = path.join(root, '_bmad-output', 'party-mode', 'captures');
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.mkdirSync(captureDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'demo.jsonl'), '{"record_type":"agent_turn"}\n', 'utf8');
    fs.writeFileSync(path.join(captureDir, 'demo.tool-result.md'), '### Round 1\n', 'utf8');
    fs.writeFileSync(
      path.join(root, '_bmad-output', 'party-mode', 'runtime', 'current-session.json'),
      JSON.stringify(
        {
          session_key: 'demo',
          gate_profile_id: 'final_solution_task_list_100',
          status: 'needs_retry',
          validation_status: 'FAIL',
          agent_turn_event_source_mode: 'cursor_visible_output_reconstruction',
          host_native_agent_turn_supported: false,
          host_native_agent_turn_reason:
            'Cursor generalPurpose compatibility path has no native per-turn agent-turn surface; party-mode turns are reconstructed from visible subagent output after return.',
          target_rounds_total: 100,
          observed_visible_round_count: 1,
          visible_fragment_record_present: true,
          visible_output_summary: {
            observed_visible_round_count: 1,
            first_visible_round: 1,
            last_visible_round: 1,
            excerpt: '### Round 1',
          },
          session_log_path: path.join(root, '_bmad-output', 'party-mode', 'sessions', 'demo.jsonl'),
          visible_output_capture_path: path.join(
            root,
            '_bmad-output',
            'party-mode',
            'captures',
            'demo.tool-result.md'
          ),
          snapshot_path: path.join(root, '_bmad-output', 'party-mode', 'snapshots', 'demo.latest.json'),
          audit_verdict_path: path.join(root, '_bmad-output', 'party-mode', 'evidence', 'demo.audit.json'),
        },
        null,
        2
      ),
      'utf8'
    );

    const helper = path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs');
    const result = spawnSync(process.execPath, [helper, '--project-root', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout || '{}');
    expect(output.current_session_exists).toBe(true);
    expect(output.session_key).toBe('demo');
    expect(output.agent_turn_event_source_mode).toBe('cursor_visible_output_reconstruction');
    expect(output.host_native_agent_turn_supported).toBe(false);
    expect(output.files.session_log.exists).toBe(true);
    expect(output.files.visible_output_capture.exists).toBe(true);
    expect(output.files.snapshot.exists).toBe(false);
    expect(output.files.audit_verdict.exists).toBe(false);
    expect(output.execution_evidence_level).toBe('final');
  });

  it('classifies a non-empty session log without final verdict as partial evidence', () => {
    const root = makeRoot();
    const sessionDir = path.join(root, '_bmad-output', 'party-mode', 'sessions');
    fs.mkdirSync(sessionDir, { recursive: true });
    const sessionKey = 'demo-log-only';
    const sessionLogPath = path.join(sessionDir, `${sessionKey}.jsonl`);
    fs.writeFileSync(
      sessionLogPath,
      '{"record_type":"agent_turn","session_key":"demo-log-only","round_index":1}\n',
      'utf8'
    );
    writePartyModeCurrentSessionState(root, {
      session_key: sessionKey,
      gate_profile_id: 'final_solution_task_list_100',
      status: 'launched',
      target_rounds_total: 100,
      session_log_path: sessionLogPath,
    });

    const helper = path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs');
    const result = spawnSync(process.execPath, [helper, '--project-root', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout || '{}');
    expect(output.session_key).toBe(sessionKey);
    expect(output.status).toBe('launched');
    expect(output.validation_status).toBe('');
    expect(output.execution_evidence_level).toBe('partial');
    expect(output.files.session_log.exists).toBe(true);
    expect(output.visible_output_summary).toBeNull();
  });

  it('recovers a stale launched current-session pointer to a newer session meta when the old launch stub is empty', () => {
    const root = makeRoot();
    const sessionsDir = path.join(root, '_bmad-output', 'party-mode', 'sessions');
    const capturesDir = path.join(root, '_bmad-output', 'party-mode', 'captures');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(capturesDir, { recursive: true });

    const staleSessionKey = 'pm-stale-100';
    const recoveredSessionKey = 'pm-recovered-20';

    fs.writeFileSync(path.join(sessionsDir, `${staleSessionKey}.jsonl`), '', 'utf8');
    writePartyModeCurrentSessionState(root, {
      session_key: staleSessionKey,
      gate_profile_id: 'final_solution_task_list_100',
      status: 'launched',
      target_rounds_total: 100,
      session_log_path: path.join(root, '_bmad-output', 'party-mode', 'sessions', `${staleSessionKey}.jsonl`),
      snapshot_path: path.join(root, '_bmad-output', 'party-mode', 'snapshots', `${staleSessionKey}.latest.json`),
      audit_verdict_path: path.join(root, '_bmad-output', 'party-mode', 'evidence', `${staleSessionKey}.audit.json`),
      visible_output_capture_path: path.join(
        root,
        '_bmad-output',
        'party-mode',
        'captures',
        `${staleSessionKey}.tool-result.md`
      ),
      recorded_at: '2026-04-16T12:25:51.392Z',
    });

    fs.writeFileSync(
      path.join(sessionsDir, `${recoveredSessionKey}.meta.json`),
      JSON.stringify(
        {
          session_key: recoveredSessionKey,
          gate_profile_id: 'quick_probe_20',
          closure_level: 'none',
          designated_challenger_id: 'adversarial-reviewer',
          current_batch_index: 1,
          current_batch_start_round: 1,
          current_batch_target_round: 20,
          current_batch_status: 'pending',
          target_rounds_total: 20,
          batch_size: 20,
          checkpoint_window_ms: 15000,
          session_log_path: path.join(
            root,
            '_bmad-output',
            'party-mode',
            'sessions',
            `${recoveredSessionKey}.jsonl`
          ),
          snapshot_path: path.join(
            root,
            '_bmad-output',
            'party-mode',
            'snapshots',
            `${recoveredSessionKey}.latest.json`
          ),
          convergence_record_path: path.join(
            root,
            '_bmad-output',
            'party-mode',
            'evidence',
            `${recoveredSessionKey}.convergence.json`
          ),
          audit_verdict_path: path.join(
            root,
            '_bmad-output',
            'party-mode',
            'evidence',
            `${recoveredSessionKey}.audit.json`
          ),
          created_at: '2026-04-17T12:00:00.000Z',
          updated_at: '2026-04-17T12:00:00.000Z',
        },
        null,
        2
      ),
      'utf8'
    );
    fs.writeFileSync(
      path.join(capturesDir, `${recoveredSessionKey}.subagent-start.raw.json`),
      '{"task":"launch"}\n',
      'utf8'
    );

    const helper = path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs');
    const result = spawnSync(process.execPath, [helper, '--project-root', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout || '{}');
    expect(output.current_session_exists).toBe(true);
    expect(output.session_key).toBe(recoveredSessionKey);
    expect(output.gate_profile_id).toBe('quick_probe_20');
    expect(output.target_rounds_total).toBe(20);
    expect(output.status).toBe('launched');
    expect(output.recovered_from_stale_pointer).toBe(true);
    expect(output.recovered_previous_session_key).toBe(staleSessionKey);

    const currentSession = JSON.parse(
      fs.readFileSync(
        path.join(root, '_bmad-output', 'party-mode', 'runtime', 'current-session.json'),
        'utf8'
      )
    );
    expect(currentSession.session_key).toBe(recoveredSessionKey);
    expect(currentSession.gate_profile_id).toBe('quick_probe_20');
    expect(currentSession.recovered_previous_session_key).toBe(staleSessionKey);
  });

  it('prefers an evidence-backed recovery candidate over a newer hollow meta stub', () => {
    const root = makeRoot();
    const sessionsDir = path.join(root, '_bmad-output', 'party-mode', 'sessions');
    const capturesDir = path.join(root, '_bmad-output', 'party-mode', 'captures');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(capturesDir, { recursive: true });

    const staleSessionKey = 'pm-stale-current';
    const hollowSessionKey = 'pm-hollow-newer';
    const evidenceSessionKey = 'pm-evidence-backed';

    fs.writeFileSync(path.join(sessionsDir, `${staleSessionKey}.jsonl`), '', 'utf8');
    writePartyModeCurrentSessionState(root, {
      session_key: staleSessionKey,
      gate_profile_id: 'final_solution_task_list_100',
      status: 'launched',
      target_rounds_total: 100,
      session_log_path: path.join(root, '_bmad-output', 'party-mode', 'sessions', `${staleSessionKey}.jsonl`),
      recorded_at: '2026-04-16T12:00:00.000Z',
    });

    fs.writeFileSync(
      path.join(sessionsDir, `${hollowSessionKey}.meta.json`),
      JSON.stringify(
        {
          session_key: hollowSessionKey,
          gate_profile_id: 'final_solution_task_list_100',
          current_batch_target_round: 20,
          target_rounds_total: 100,
          session_log_path: path.join(root, '_bmad-output', 'party-mode', 'sessions', `${hollowSessionKey}.jsonl`),
          snapshot_path: path.join(root, '_bmad-output', 'party-mode', 'evidence', `${hollowSessionKey}.snapshot.json`),
          audit_verdict_path: path.join(root, '_bmad-output', 'party-mode', 'evidence', `${hollowSessionKey}.audit.json`),
          updated_at: '2026-04-17T13:00:00.000Z',
        },
        null,
        2
      ),
      'utf8'
    );

    fs.writeFileSync(
      path.join(sessionsDir, `${evidenceSessionKey}.meta.json`),
      JSON.stringify(
        {
          session_key: evidenceSessionKey,
          gate_profile_id: 'quick_probe_20',
          current_batch_target_round: 20,
          target_rounds_total: 20,
          session_log_path: path.join(root, '_bmad-output', 'party-mode', 'sessions', `${evidenceSessionKey}.jsonl`),
          snapshot_path: path.join(root, '_bmad-output', 'party-mode', 'snapshots', `${evidenceSessionKey}.latest.json`),
          audit_verdict_path: path.join(root, '_bmad-output', 'party-mode', 'evidence', `${evidenceSessionKey}.audit.json`),
          updated_at: '2026-04-17T12:30:00.000Z',
        },
        null,
        2
      ),
      'utf8'
    );
    fs.writeFileSync(
      path.join(capturesDir, `${evidenceSessionKey}.subagent-start.raw.json`),
      '{"task":"launch"}\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(capturesDir, `${evidenceSessionKey}.tool-result.md`),
      '### Round 1\n',
      'utf8'
    );

    const helper = path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs');
    const result = spawnSync(process.execPath, [helper, '--project-root', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout || '{}');
    expect(output.session_key).toBe(evidenceSessionKey);
    expect(output.gate_profile_id).toBe('quick_probe_20');
    expect(output.recovered_from_stale_pointer).toBe(true);
    expect(output.recovered_previous_session_key).toBe(staleSessionKey);
    expect(output.files.launch_payload_capture.exists).toBe(true);
    expect(output.files.visible_output_capture.exists).toBe(true);
  });

  it('upgrades a previously recovered pointer to a newer evidence-backed session', () => {
    const root = makeRoot();
    const sessionsDir = path.join(root, '_bmad-output', 'party-mode', 'sessions');
    const capturesDir = path.join(root, '_bmad-output', 'party-mode', 'captures');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(capturesDir, { recursive: true });

    const recoveredOldKey = 'pm-recovered-old';
    const newerKey = 'pm-recovered-newer';

    fs.writeFileSync(
      path.join(sessionsDir, `${recoveredOldKey}.meta.json`),
      JSON.stringify(
        {
          session_key: recoveredOldKey,
          gate_profile_id: 'final_solution_task_list_100',
          updated_at: '2026-04-17T10:00:00.000Z',
          session_log_path: path.join(root, '_bmad-output', 'party-mode', 'sessions', `${recoveredOldKey}.jsonl`),
        },
        null,
        2
      ),
      'utf8'
    );
    fs.writeFileSync(path.join(capturesDir, `${recoveredOldKey}.subagent-start.raw.json`), '{"task":"old"}\n', 'utf8');

    writePartyModeCurrentSessionState(root, {
      session_key: recoveredOldKey,
      gate_profile_id: 'final_solution_task_list_100',
      status: 'launched',
      recovered_from_stale_pointer: true,
      recovered_previous_session_key: 'pm-stale',
    });

    fs.writeFileSync(
      path.join(sessionsDir, `${newerKey}.meta.json`),
      JSON.stringify(
        {
          session_key: newerKey,
          gate_profile_id: 'quick_probe_20',
          updated_at: '2026-04-17T11:00:00.000Z',
          target_rounds_total: 20,
          session_log_path: path.join(root, '_bmad-output', 'party-mode', 'sessions', `${newerKey}.jsonl`),
        },
        null,
        2
      ),
      'utf8'
    );
    fs.writeFileSync(path.join(capturesDir, `${newerKey}.subagent-start.raw.json`), '{"task":"new"}\n', 'utf8');
    fs.writeFileSync(path.join(capturesDir, `${newerKey}.tool-result.md`), '### Round 1\n', 'utf8');

    const helper = path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs');
    const result = spawnSync(process.execPath, [helper, '--project-root', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout || '{}');
    expect(output.session_key).toBe(newerKey);
    expect(output.gate_profile_id).toBe('quick_probe_20');
    expect(output.recovered_from_stale_pointer).toBe(true);
    expect(output.recovered_previous_session_key).toBe(recoveredOldKey);
    expect(output.execution_evidence_level).toBe('final');
  });

  it('hydrates a zero-host-evidence session from a final sidecar written by the subagent itself', () => {
    const root = makeRoot();
    const sessionKey = 'pm-sidecar-final-only';
    const sidecarDir = path.join(root, '_bmad-output', 'party-mode', 'sidecar');
    fs.mkdirSync(sidecarDir, { recursive: true });

    writePartyModeCurrentSessionState(root, {
      session_key: sessionKey,
      gate_profile_id: 'final_solution_task_list_100',
      status: 'launched',
      target_rounds_total: 100,
      session_log_path: path.join(root, '_bmad-output', 'party-mode', 'sessions', `${sessionKey}.jsonl`),
      visible_output_capture_path: path.join(
        root,
        '_bmad-output',
        'party-mode',
        'captures',
        `${sessionKey}.tool-result.md`
      ),
      sidecar_final_path: path.join(sidecarDir, `${sessionKey}.final.json`),
    });
    fs.writeFileSync(
      path.join(sidecarDir, `${sessionKey}.final.json`),
      JSON.stringify(
        {
          schema_version: 'party_mode_sidecar_v1',
          sidecar_kind: 'final',
          session_key: sessionKey,
          gate_profile_id: 'final_solution_task_list_100',
          target_rounds_total: 100,
          observed_visible_round_count: 100,
          validation_status: 'PASS',
          final_result: 'PASS',
          status: 'completed',
          visible_output_summary: {
            observed_visible_round_count: 100,
            first_visible_round: 1,
            last_visible_round: 100,
            progress_current_round: 100,
            progress_target_round: 100,
            excerpt: '## Final Gate Evidence',
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const helper = path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs');
    const result = spawnSync(process.execPath, [helper, '--project-root', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout || '{}');
    expect(output.session_key).toBe(sessionKey);
    expect(output.validation_status).toBe('PASS');
    expect(output.final_gate_result).toBe('PASS');
    expect(output.recovered_from_sidecar).toBe(true);
    expect(output.recovered_from_sidecar_kind).toBe('final');
    expect(output.observed_visible_round_count).toBe(100);
    expect(output.files.sidecar_final.exists).toBe(true);
    expect(output.visible_output_summary?.progress_current_round).toBe(100);
    expect(output.execution_evidence_level).toBe('final');
  });

  it('prefers a newer started-only launch over an older strong-evidence session when the stale pointer would otherwise drift backward', () => {
    const root = makeRoot();
    const sessionsDir = path.join(root, '_bmad-output', 'party-mode', 'sessions');
    const sidecarDir = path.join(root, '_bmad-output', 'party-mode', 'sidecar');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(sidecarDir, { recursive: true });

    const staleSessionKey = 'pm-stale-zero-host';
    const startedOnlyKey = 'pm-started-only-newer';
    const strongEvidenceKey = 'pm-strong-evidence';

    writePartyModeCurrentSessionState(root, {
      session_key: staleSessionKey,
      gate_profile_id: 'final_solution_task_list_100',
      status: 'launched',
      target_rounds_total: 100,
      session_log_path: path.join(root, '_bmad-output', 'party-mode', 'sessions', `${staleSessionKey}.jsonl`),
    });

    fs.writeFileSync(
      path.join(sessionsDir, `${startedOnlyKey}.meta.json`),
      JSON.stringify(
        {
          session_key: startedOnlyKey,
          gate_profile_id: 'final_solution_task_list_100',
          target_rounds_total: 100,
          updated_at: '2026-04-17T13:00:00.000Z',
          session_log_path: path.join(root, '_bmad-output', 'party-mode', 'sessions', `${startedOnlyKey}.jsonl`),
        },
        null,
        2
      ),
      'utf8'
    );
    fs.writeFileSync(
      path.join(sidecarDir, `${startedOnlyKey}.started.json`),
      JSON.stringify(
        {
          schema_version: 'party_mode_sidecar_v1',
          sidecar_kind: 'started',
          session_key: startedOnlyKey,
          gate_profile_id: 'final_solution_task_list_100',
        },
        null,
        2
      ),
      'utf8'
    );

    fs.writeFileSync(
      path.join(sessionsDir, `${strongEvidenceKey}.meta.json`),
      JSON.stringify(
        {
          session_key: strongEvidenceKey,
          gate_profile_id: 'quick_probe_20',
          target_rounds_total: 20,
          updated_at: '2026-04-17T12:30:00.000Z',
          session_log_path: path.join(root, '_bmad-output', 'party-mode', 'sessions', `${strongEvidenceKey}.jsonl`),
        },
        null,
        2
      ),
      'utf8'
    );
    fs.writeFileSync(
      path.join(sessionsDir, `${strongEvidenceKey}.jsonl`),
      '{"record_type":"agent_turn","session_key":"pm-strong-evidence","round_index":20}\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(sidecarDir, `${strongEvidenceKey}.final.json`),
      JSON.stringify(
        {
          schema_version: 'party_mode_sidecar_v1',
          sidecar_kind: 'final',
          session_key: strongEvidenceKey,
          gate_profile_id: 'quick_probe_20',
          target_rounds_total: 20,
          observed_visible_round_count: 20,
          validation_status: 'PASS',
          final_result: 'PASS',
          status: 'completed',
        },
        null,
        2
      ),
      'utf8'
    );

    const helper = path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs');
    const result = spawnSync(process.execPath, [helper, '--project-root', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout || '{}');
    expect(output.session_key).toBe(startedOnlyKey);
    expect(output.gate_profile_id).toBe('final_solution_task_list_100');
    expect(output.recovered_from_stale_pointer).toBe(true);
    expect(output.recovered_previous_session_key).toBe(strongEvidenceKey);
    expect(output.recovered_from_newer_launch).toBe(true);
    expect(output.pending_launch_evidence_present).toBe(true);
    expect(output.execution_evidence_level).toBe('pending');
  });

  it('includes generated document summaries when current-session tracks subagent-written canonical docs', () => {
    const root = makeRoot();
    const bugfixPath = path.join(
      root,
      '_bmad-output',
      'implementation-artifacts',
      '_orphan',
      'BUGFIX_demo.md'
    );
    fs.mkdirSync(path.dirname(bugfixPath), { recursive: true });
    fs.writeFileSync(bugfixPath, '# BUGFIX demo\n', 'utf8');

    fs.writeFileSync(
      path.join(root, '_bmad-output', 'party-mode', 'runtime', 'current-session.json'),
      JSON.stringify(
        {
          session_key: 'demo-doc-session',
          gate_profile_id: 'final_solution_task_list_100',
          status: 'launched',
          target_rounds_total: 100,
          generated_document_count: 1,
          latest_generated_document_path: bugfixPath,
          latest_generated_document_kind: 'bugfix',
          document_generation_observed_at: '2026-04-17T12:00:00.000Z',
          document_generation_required: true,
          expected_document_count: 1,
          expected_document_paths: [bugfixPath],
          generated_document_paths: [bugfixPath],
        },
        null,
        2
      ),
      'utf8'
    );

    const helper = path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs');
    const result = spawnSync(process.execPath, [helper, '--project-root', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout || '{}');
    expect(output.document_generation_required).toBe(true);
    expect(output.expected_document_count).toBe(1);
    expect(output.expected_documents).toHaveLength(1);
    expect(output.generated_document_count).toBe(1);
    expect(output.latest_generated_document_kind).toBe('bugfix');
    expect(Array.isArray(output.generated_documents)).toBe(true);
    expect(output.generated_documents).toHaveLength(1);
    expect(output.generated_documents[0].kind).toBe('bugfix');
    expect(output.generated_documents[0].exists).toBe(true);
  });

  it('rehydrates a legacy launched session from visible tool output and classifies degenerate placeholder completion separately from early exit', () => {
    const root = makeRoot();
    const sessionKey = 'pm-legacy-placeholder-100';
    const sessionsDir = path.join(root, '_bmad-output', 'party-mode', 'sessions');
    const capturesDir = path.join(root, '_bmad-output', 'party-mode', 'captures');
    const evidenceDir = path.join(root, '_bmad-output', 'party-mode', 'evidence');
    const snapshotsDir = path.join(root, '_bmad-output', 'party-mode', 'snapshots');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(capturesDir, { recursive: true });
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.mkdirSync(snapshotsDir, { recursive: true });

    const lines: string[] = [];
    for (let round = 1; round <= 100; round += 1) {
      lines.push(`### Round ${round}`);
      lines.push(`⚔️ **批判性审计员**: 第 ${round} 轮完成挑战与验证。`);
    }
    lines.push('## Final Gate Evidence');
    lines.push('- Gate Profile: final_solution_task_list_100');
    lines.push('- Total Rounds: 100');
    lines.push('- Challenger Ratio Check: PASS');
    lines.push('- Tail Window No New Gap: PASS');
    lines.push('- Final Result: PASS');

    writePartyModeCurrentSessionState(root, {
      session_key: sessionKey,
      gate_profile_id: 'final_solution_task_list_100',
      status: 'launched',
      target_rounds_total: 100,
      session_log_path: path.join(sessionsDir, `${sessionKey}.jsonl`),
      snapshot_path: path.join(snapshotsDir, `${sessionKey}.latest.json`),
      audit_verdict_path: path.join(evidenceDir, `${sessionKey}.audit.json`),
      visible_output_capture_path: path.join(capturesDir, `${sessionKey}.tool-result.md`),
    });
    fs.writeFileSync(path.join(capturesDir, `${sessionKey}.tool-result.md`), `${lines.join('\n')}\n`, 'utf8');
    fs.writeFileSync(
      path.join(evidenceDir, `${sessionKey}.audit.json`),
      JSON.stringify(
        {
          session_key: sessionKey,
          gate_profile_id: 'final_solution_task_list_100',
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

    const helper = path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs');
    const result = spawnSync(process.execPath, [helper, '--project-root', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout || '{}');
    expect(output.validation_status).toBe('PASS');
    expect(output.final_gate_result).toBe('PASS');
    expect(output.observed_visible_round_count).toBe(100);
    expect(output.diagnostic_classification).toBe('degenerate_placeholder_completion');
    expect(output.quality_flags).toContain('single_visible_speaker');
    expect(output.quality_flags).toContain('degenerate_placeholder_completion');
    expect(output.execution_evidence_level).toBe('final');
  });

  it('classifies a completion stub as stub_only_completion instead of a valid finished discussion', () => {
    const root = makeRoot();
    const sessionKey = 'pm-stub-only-100';
    const sessionsDir = path.join(root, '_bmad-output', 'party-mode', 'sessions');
    const capturesDir = path.join(root, '_bmad-output', 'party-mode', 'captures');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(capturesDir, { recursive: true });

    writePartyModeCurrentSessionState(root, {
      session_key: sessionKey,
      gate_profile_id: 'final_solution_task_list_100',
      status: 'launched',
      target_rounds_total: 100,
      session_log_path: path.join(sessionsDir, `${sessionKey}.jsonl`),
      visible_output_capture_path: path.join(capturesDir, `${sessionKey}.tool-result.md`),
    });
    fs.writeFileSync(
      path.join(capturesDir, `${sessionKey}.tool-result.md`),
      'The subagent task has completed.\n',
      'utf8'
    );

    const helper = path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs');
    const result = spawnSync(process.execPath, [helper, '--project-root', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout || '{}');
    expect(output.validation_status).toBe('FAIL');
    expect(output.diagnostic_classification).toBe('stub_only_completion');
    expect(output.quality_flags).toContain('stub_only_completion');
    expect(output.visible_fragment_record_present).toBe(true);
    expect(output.execution_evidence_level).toBe('final');
  });

  it('keeps a zero-evidence launched session unverifiable instead of inferring completion or a stale recovered result', () => {
    const root = makeRoot();
    const sessionKey = 'pm-zero-evidence-launch';

    writePartyModeCurrentSessionState(root, {
      session_key: sessionKey,
      gate_profile_id: 'final_solution_task_list_100',
      status: 'launched',
      target_rounds_total: 100,
      session_log_path: path.join(root, '_bmad-output', 'party-mode', 'sessions', `${sessionKey}.jsonl`),
      snapshot_path: path.join(root, '_bmad-output', 'party-mode', 'snapshots', `${sessionKey}.latest.json`),
      audit_verdict_path: path.join(root, '_bmad-output', 'party-mode', 'evidence', `${sessionKey}.audit.json`),
      visible_output_capture_path: path.join(
        root,
        '_bmad-output',
        'party-mode',
        'captures',
        `${sessionKey}.tool-result.md`
      ),
    });

    const helper = path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs');
    const result = spawnSync(process.execPath, [helper, '--project-root', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout || '{}');
    expect(output.current_session_exists).toBe(true);
    expect(output.session_key).toBe(sessionKey);
    expect(output.status).toBe('launched');
    expect(output.validation_status).toBe('');
    expect(output.visible_output_summary).toBeNull();
    expect(output.visible_fragment_record_present).toBe(false);
    expect(output.diagnostic_classification).toBe('');
    expect(output.recovered_from_stale_pointer).toBe(false);
    expect(output.recovered_from_newer_launch).toBe(false);
    expect(output.pending_launch_evidence_present).toBe(false);
    expect(output.execution_evidence_level).toBe('none');
    expect(output.files.session_log.exists).toBe(false);
    expect(output.files.visible_output_capture.exists).toBe(false);
    expect(output.files.audit_verdict.exists).toBe(false);
    expect(output.files.sidecar_started.exists).toBe(false);
    expect(output.files.sidecar_progress.exists).toBe(false);
    expect(output.files.sidecar_final.exists).toBe(false);
  });

  it('prefers a newer pending launch over an older completed session so the main agent does not drift to stale results', () => {
    const root = makeRoot();
    const sessionsDir = path.join(root, '_bmad-output', 'party-mode', 'sessions');
    const capturesDir = path.join(root, '_bmad-output', 'party-mode', 'captures');
    const sidecarDir = path.join(root, '_bmad-output', 'party-mode', 'sidecar');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(capturesDir, { recursive: true });
    fs.mkdirSync(sidecarDir, { recursive: true });

    const completedKey = 'pm-old-completed';
    const pendingKey = 'pm-new-pending-launch';

    writePartyModeCurrentSessionState(root, {
      session_key: completedKey,
      gate_profile_id: 'final_solution_task_list_100',
      status: 'completed',
      validation_status: 'PASS',
      target_rounds_total: 100,
      observed_visible_round_count: 100,
      session_log_path: path.join(root, '_bmad-output', 'party-mode', 'sessions', `${completedKey}.jsonl`),
      audit_verdict_path: path.join(root, '_bmad-output', 'party-mode', 'evidence', `${completedKey}.audit.json`),
      visible_output_capture_path: path.join(root, '_bmad-output', 'party-mode', 'captures', `${completedKey}.tool-result.md`),
      recorded_at: '2026-04-17T09:00:00.000Z',
    });
    fs.writeFileSync(
      path.join(sessionsDir, `${pendingKey}.meta.json`),
      JSON.stringify(
        {
          session_key: pendingKey,
          gate_profile_id: 'final_solution_task_list_100',
          current_batch_target_round: 100,
          target_rounds_total: 100,
          current_batch_status: 'pending',
          session_log_path: path.join(root, '_bmad-output', 'party-mode', 'sessions', `${pendingKey}.jsonl`),
          updated_at: '2026-04-17T10:00:00.000Z',
        },
        null,
        2
      ),
      'utf8'
    );
    fs.writeFileSync(
      path.join(capturesDir, `${pendingKey}.subagent-start.raw.json`),
      '{"task":"new launch"}\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(sidecarDir, `${pendingKey}.started.json`),
      JSON.stringify(
        {
          schema_version: 'party_mode_sidecar_v1',
          sidecar_kind: 'started',
          session_key: pendingKey,
          gate_profile_id: 'final_solution_task_list_100',
          target_rounds_total: 100,
        },
        null,
        2
      ),
      'utf8'
    );

    const helper = path.join(ROOT, '_bmad', 'runtime', 'hooks', 'party-mode-read-current-session.cjs');
    const result = spawnSync(process.execPath, [helper, '--project-root', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout || '{}');
    expect(output.session_key).toBe(pendingKey);
    expect(output.status).toBe('launched');
    expect(output.validation_status).toBe('');
    expect(output.recovered_from_newer_launch).toBe(true);
    expect(output.recovered_previous_session_key).toBe(completedKey);
    expect(output.pending_launch_evidence_present).toBe(true);
    expect(output.execution_evidence_level).toBe('pending');
  });
});
