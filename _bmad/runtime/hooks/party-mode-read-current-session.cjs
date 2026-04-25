#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  derivePartyModeFinalSidecarPath,
  derivePartyModeLaunchCapturePath,
  derivePartyModeProgressSidecarPath,
  derivePartyModeStartedSidecarPath,
  derivePartyModeVisibleOutputCapturePath,
  partyModeCurrentSessionStatePath,
  readPartyModeSidecar,
  readPartyModeCurrentSessionState,
  writePartyModeCurrentSessionState,
} = require('./party-mode-current-session.cjs');
const {
  buildVisibleOutputSummary,
  parseFinalGateEvidence,
  parseRoundSections,
  reconstructCurrentPartyModeSessionFromVisibleOutput,
} = require('./post-tool-use-core.cjs');

const PENDING_LAUNCH_FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function resolveProjectPath(projectRoot, candidate) {
  if (!candidate || typeof candidate !== 'string') {
    return null;
  }
  return path.isAbsolute(candidate) ? candidate : path.join(projectRoot, candidate);
}

function statFile(filePath) {
  if (!filePath) {
    return { exists: false, path: null, size: null };
  }
  if (!fs.existsSync(filePath)) {
    return { exists: false, path: normalizePath(filePath), size: null };
  }
  const stat = fs.statSync(filePath);
  return {
    exists: true,
    path: normalizePath(filePath),
    size: stat.size,
    last_modified: stat.mtime.toISOString(),
  };
}

function parseStatTimestamp(file) {
  return file && file.exists && file.last_modified ? Date.parse(file.last_modified) || 0 : 0;
}

function deriveSessionCapturePaths(projectRoot, sessionKey) {
  return {
    launch_payload_capture: path.join(
      projectRoot,
      '_bmad-output',
      'party-mode',
      'captures',
      `${sessionKey}.subagent-start.raw.json`
    ),
    post_tool_use_raw: path.join(
      projectRoot,
      '_bmad-output',
      'party-mode',
      'captures',
      `${sessionKey}.post-tool-use.raw.json`
    ),
    visible_output_capture: path.join(
      projectRoot,
      '_bmad-output',
      'party-mode',
      'captures',
      `${sessionKey}.tool-result.md`
    ),
    sidecar_started: derivePartyModeStartedSidecarPath(projectRoot, sessionKey),
    sidecar_progress: derivePartyModeProgressSidecarPath(projectRoot, sessionKey),
    sidecar_final: derivePartyModeFinalSidecarPath(projectRoot, sessionKey),
  };
}

function resolveVisibleSummaryFromSidecar(sidecar) {
  if (sidecar?.visible_output_summary && typeof sidecar.visible_output_summary === 'object') {
    return sidecar.visible_output_summary;
  }
  const excerpt = String(sidecar?.excerpt || '').trim();
  const observedVisibleRoundCount = Number.isFinite(Number(sidecar?.observed_visible_round_count))
    ? Number(sidecar.observed_visible_round_count)
    : Number.isFinite(Number(sidecar?.progress_current_round))
      ? Number(sidecar.progress_current_round)
      : null;
  if (!excerpt && observedVisibleRoundCount == null) {
    return null;
  }
  return {
    observed_visible_round_count: observedVisibleRoundCount,
    first_visible_round:
      observedVisibleRoundCount && observedVisibleRoundCount > 0 ? 1 : null,
    last_visible_round: observedVisibleRoundCount,
    progress_current_round: Number.isFinite(Number(sidecar?.progress_current_round))
      ? Number(sidecar.progress_current_round)
      : observedVisibleRoundCount,
    progress_target_round: Number.isFinite(Number(sidecar?.progress_target_round))
      ? Number(sidecar.progress_target_round)
      : Number.isFinite(Number(sidecar?.target_rounds_total))
        ? Number(sidecar.target_rounds_total)
        : null,
    excerpt,
  };
}

function classifyGeneratedDocumentKind(filePath) {
  const normalized = normalizePath(filePath).toLowerCase();
  if (normalized.includes('/bugfix_')) {
    return 'bugfix';
  }
  if (normalized.includes('/tasks_bugfix_') || normalized.includes('/tasks_rca_') || normalized.includes('/tasks_')) {
    return 'tasks';
  }
  if (normalized.includes('/docs/requirements/')) {
    return 'requirement';
  }
  if (normalized.includes('/docs/plans/')) {
    return 'plan';
  }
  if (normalized.includes('/specs/')) {
    return 'spec';
  }
  if (
    normalized.includes('/_bmad-output/implementation-artifacts/') &&
    /\/story-[^/]+\/[^/]+\.md$/iu.test(normalized)
  ) {
    return 'story';
  }
  if (normalized.includes('/_bmad-output/implementation-artifacts/')) {
    return 'artifact_doc';
  }
  return 'document';
}

function summarizeGeneratedDocuments(projectRoot, state) {
  const paths = Array.isArray(state?.generated_document_paths)
    ? state.generated_document_paths
    : [];
  return paths
    .map((entry) => resolveProjectPath(projectRoot, entry))
    .filter(Boolean)
    .map((filePath) => {
      const stat = statFile(filePath);
      return {
        ...stat,
        kind: classifyGeneratedDocumentKind(filePath),
      };
    });
}

function summarizeExpectedDocuments(projectRoot, state) {
  const paths = Array.isArray(state?.expected_document_paths)
    ? state.expected_document_paths
    : [];
  return paths
    .map((entry) => resolveProjectPath(projectRoot, entry))
    .filter(Boolean)
    .map((filePath) => ({
      ...statFile(filePath),
      kind: classifyGeneratedDocumentKind(filePath),
    }));
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function sessionMetaDir(projectRoot) {
  return path.join(projectRoot, '_bmad-output', 'party-mode', 'sessions');
}

function listSessionMetaCandidates(projectRoot) {
  const dirPath = sessionMetaDir(projectRoot);
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.meta.json'))
    .map((entry) => {
      const filePath = path.join(dirPath, entry.name);
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          return null;
        }
        const sessionKey = String(raw.session_key || '').trim();
        if (!sessionKey) {
          return null;
        }
        const stat = fs.statSync(filePath);
        const captures = deriveSessionCapturePaths(projectRoot, sessionKey);
        return {
          session_key: sessionKey,
          meta: raw,
          meta_path: filePath,
          capture_paths: captures,
          timestamp:
            parseTimestamp(raw.updated_at) ??
            parseTimestamp(raw.created_at) ??
            stat.mtime.getTime(),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.timestamp - left.timestamp);
}

function looksLikeStaleLaunchPointer(state, files) {
  if (!state || typeof state !== 'object') {
    return false;
  }
  return (
    String(state.status || '') === 'launched' &&
    !String(state.validation_status || '').trim() &&
    !Number.isFinite(Number(state.observed_visible_round_count)) &&
    !(state.visible_output_summary && typeof state.visible_output_summary === 'object') &&
    (!files.session_log.exists || Number(files.session_log.size || 0) === 0) &&
    !files.launch_payload_capture.exists &&
    !files.post_tool_use_raw.exists &&
    !files.sidecar_started.exists &&
    !files.sidecar_progress.exists &&
    !files.sidecar_final.exists &&
    !files.snapshot.exists &&
    !files.audit_verdict.exists &&
    !files.visible_output_capture.exists
  );
}

function deriveEvidenceGrade(files) {
  if (
    files.sidecar_final.exists ||
    files.audit_verdict.exists ||
    files.snapshot.exists ||
    (files.session_log.exists && Number(files.session_log.size || 0) > 0) ||
    files.visible_output_capture.exists
  ) {
    return 3;
  }
  if (files.sidecar_progress.exists || files.post_tool_use_raw.exists) {
    return 2;
  }
  if (files.sidecar_started.exists || files.launch_payload_capture.exists) {
    return 1;
  }
  return 0;
}

function hasPendingLaunchEvidence(files) {
  return Boolean(
    files &&
      (
        files.launch_payload_capture.exists ||
        files.sidecar_started.exists ||
        files.sidecar_progress.exists
      ) &&
      !files.sidecar_final.exists &&
      !files.audit_verdict.exists
  );
}

function deriveEvidenceTimestamp(candidate, files) {
  return Math.max(
    Number(candidate.timestamp || 0),
    parseStatTimestamp(files.sidecar_final),
    parseStatTimestamp(files.sidecar_progress),
    parseStatTimestamp(files.sidecar_started),
    parseStatTimestamp(files.visible_output_capture),
    parseStatTimestamp(files.post_tool_use_raw),
    parseStatTimestamp(files.session_log),
    parseStatTimestamp(files.snapshot),
    parseStatTimestamp(files.audit_verdict),
    parseStatTimestamp(files.convergence_record),
    parseStatTimestamp(files.launch_payload_capture)
  );
}

function deriveExecutionEvidenceLevel(state, files) {
  const status = String(state?.status || '').trim();
  const validationStatus = String(state?.validation_status || '').trim();
  const finalGateResult = String(state?.final_gate_result || '').trim();
  const hasVisibleSummary = Boolean(
    state?.visible_output_summary && typeof state.visible_output_summary === 'object'
  );
  const hasNonEmptySessionLog =
    files.session_log.exists && Number(files.session_log.size || 0) > 0;
  const hasFinalEvidence = Boolean(
    validationStatus ||
      finalGateResult ||
      status === 'completed' ||
      status === 'needs_retry' ||
      files.sidecar_final.exists ||
      files.audit_verdict.exists ||
      files.snapshot.exists ||
      files.convergence_record.exists
  );
  if (hasFinalEvidence) {
    return 'final';
  }

  const hasPendingEvidence = Boolean(
    hasPendingLaunchEvidence(files) ||
      state?.pending_launch_evidence_present ||
      state?.recovered_from_newer_launch
  );
  if (hasPendingEvidence) {
    return 'pending';
  }

  const hasPartialEvidence = Boolean(
    hasVisibleSummary ||
      state?.visible_fragment_record_present ||
      files.visible_output_capture.exists ||
      files.post_tool_use_raw.exists ||
      hasNonEmptySessionLog
  );
  if (hasPartialEvidence) {
    return 'partial';
  }

  return 'none';
}

function hydrateStateFromSidecar(projectRoot, state, files) {
  if (!state || typeof state !== 'object') {
    return { state, hydrated: false };
  }

  const finalSidecar = files.sidecar_final.exists ? readPartyModeSidecar(files.sidecar_final.path) : null;
  const progressSidecar =
    !finalSidecar && files.sidecar_progress.exists
      ? readPartyModeSidecar(files.sidecar_progress.path)
      : null;
  const sidecar = finalSidecar || progressSidecar;
  if (!sidecar || String(sidecar.session_key || '') !== String(state.session_key || '')) {
    return { state, hydrated: false };
  }

  const next = {
    ...state,
    status:
      typeof sidecar.status === 'string' && sidecar.status.trim()
        ? sidecar.status
        : finalSidecar
          ? 'completed'
          : state.status || 'launched',
    validation_status:
      typeof sidecar.validation_status === 'string' && sidecar.validation_status.trim()
        ? sidecar.validation_status
        : finalSidecar
          ? 'PASS'
          : state.validation_status || '',
    observed_visible_round_count: Number.isFinite(Number(sidecar.observed_visible_round_count))
      ? Number(sidecar.observed_visible_round_count)
      : state.observed_visible_round_count,
    target_rounds_total: Number.isFinite(Number(sidecar.target_rounds_total))
      ? Number(sidecar.target_rounds_total)
      : state.target_rounds_total,
    final_gate_result:
      typeof sidecar.final_result === 'string' && sidecar.final_result.trim()
        ? sidecar.final_result
        : state.final_gate_result || '',
    visible_fragment_record_present:
      typeof sidecar.visible_fragment_record_present === 'boolean'
        ? sidecar.visible_fragment_record_present
        : Boolean(progressSidecar || state.visible_fragment_record_present),
    visible_output_summary:
      resolveVisibleSummaryFromSidecar(sidecar) ||
      (state.visible_output_summary && typeof state.visible_output_summary === 'object'
        ? state.visible_output_summary
        : null),
    document_generation_required:
      typeof sidecar.document_generation_required === 'boolean'
        ? sidecar.document_generation_required
        : Boolean(state.document_generation_required),
    expected_document_count: Number.isFinite(Number(sidecar.expected_document_count))
      ? Number(sidecar.expected_document_count)
      : state.expected_document_count,
    expected_document_paths: Array.isArray(sidecar.expected_document_paths)
      ? sidecar.expected_document_paths
      : state.expected_document_paths,
    generated_document_count: Number.isFinite(Number(sidecar.generated_document_count))
      ? Number(sidecar.generated_document_count)
      : state.generated_document_count,
    generated_document_paths: Array.isArray(sidecar.generated_document_paths)
      ? sidecar.generated_document_paths
      : state.generated_document_paths,
    latest_generated_document_path:
      typeof sidecar.latest_generated_document_path === 'string'
        ? sidecar.latest_generated_document_path
        : state.latest_generated_document_path,
    latest_generated_document_kind:
      typeof sidecar.latest_generated_document_kind === 'string'
        ? sidecar.latest_generated_document_kind
        : state.latest_generated_document_kind,
    document_generation_observed_at:
      typeof sidecar.document_generation_observed_at === 'string'
        ? sidecar.document_generation_observed_at
        : state.document_generation_observed_at,
    agent_turn_event_source_mode:
      typeof sidecar.agent_turn_event_source_mode === 'string' && sidecar.agent_turn_event_source_mode.trim()
        ? sidecar.agent_turn_event_source_mode
        : state.agent_turn_event_source_mode,
    host_native_agent_turn_supported:
      typeof sidecar.host_native_agent_turn_supported === 'boolean'
        ? sidecar.host_native_agent_turn_supported
        : state.host_native_agent_turn_supported,
    host_native_agent_turn_reason:
      typeof sidecar.host_native_agent_turn_reason === 'string'
        ? sidecar.host_native_agent_turn_reason
        : state.host_native_agent_turn_reason,
    recovered_from_sidecar: true,
    recovered_from_sidecar_kind: finalSidecar ? 'final' : 'progress',
    recovered_from_sidecar_at: new Date().toISOString(),
  };
  writePartyModeCurrentSessionState(projectRoot, next);
  return { state: next, hydrated: true };
}

function maybeHydrateStateFromVisibleArtifacts(projectRoot, state, files) {
  if (!state || typeof state !== 'object') {
    return { state, hydrated: false };
  }
  const needsHydration =
    !String(state.validation_status || '').trim() ||
    !(state.visible_output_summary && typeof state.visible_output_summary === 'object') ||
    !Number.isFinite(Number(state.observed_visible_round_count));
  if (!needsHydration) {
    return { state, hydrated: false };
  }
  if (!files.visible_output_capture.exists || !files.visible_output_capture.path) {
    return { state, hydrated: false };
  }
  let visibleOutput = '';
  try {
    visibleOutput = fs.readFileSync(files.visible_output_capture.path, 'utf8');
  } catch {
    return { state, hydrated: false };
  }
  if (!String(visibleOutput || '').trim()) {
    return { state, hydrated: false };
  }

  let reconstruction;
  try {
    reconstruction = reconstructCurrentPartyModeSessionFromVisibleOutput(
      projectRoot,
      state,
      visibleOutput
    );
  } catch {
    const roundSections = parseRoundSections(visibleOutput);
    const finalGate = parseFinalGateEvidence(visibleOutput);
    const visibleOutputSummary = buildVisibleOutputSummary(
      files.visible_output_capture.path,
      visibleOutput,
      roundSections,
      finalGate
    );
    const expectedRounds = Number.isFinite(Number(state.current_batch_target_round))
      ? Number(state.current_batch_target_round)
      : Number.isFinite(Number(state.target_rounds_total))
        ? Number(state.target_rounds_total)
        : null;
    const errors = [];
    const warnings = [];
    if (Number.isFinite(expectedRounds) && expectedRounds > 0 && roundSections.length !== expectedRounds) {
      errors.push(`visible_round_count=${roundSections.length}; expected=${expectedRounds}`);
    }
    if (
      Number.isFinite(Number(state.target_rounds_total)) &&
      Number(state.target_rounds_total) === expectedRounds &&
      !finalGate
    ) {
      errors.push('missing_final_gate_evidence_block');
    }
    reconstruction = {
      errors,
      warnings,
      observedRoundCount: roundSections.length,
      progressMarker: visibleOutputSummary &&
        typeof visibleOutputSummary === 'object'
        ? {
            currentRound: visibleOutputSummary.progress_current_round,
            targetRoundsTotal: visibleOutputSummary.progress_target_round,
          }
        : null,
      visibleOutputSummary,
      fragmentRecordPresent: roundSections.length === 0 && String(visibleOutput || '').trim().length > 0,
      finalGate,
      visibleOutputCapturePath: files.visible_output_capture.path,
    };
  }
  const next = writePartyModeCurrentSessionState(projectRoot, {
    ...state,
    status: reconstruction.errors.length === 0 ? 'completed' : 'needs_retry',
    observed_visible_round_count: reconstruction.observedRoundCount,
    visible_progress_current_round: reconstruction.progressMarker?.currentRound ?? null,
    visible_progress_target_round: reconstruction.progressMarker?.targetRoundsTotal ?? null,
    visible_output_summary: reconstruction.visibleOutputSummary,
    visible_fragment_record_present: reconstruction.fragmentRecordPresent,
    final_gate_profile: reconstruction.finalGate?.gateProfile || '',
    final_gate_total_rounds: Number.isFinite(reconstruction.finalGate?.totalRounds)
      ? reconstruction.finalGate.totalRounds
      : null,
    final_gate_result: reconstruction.finalGate?.finalResult || '',
    validation_errors: reconstruction.errors,
    validation_warnings: reconstruction.warnings,
    validation_status: reconstruction.errors.length === 0 ? 'PASS' : 'FAIL',
    visible_output_capture_path: reconstruction.visibleOutputCapturePath,
    reconstructed_at: new Date().toISOString(),
    hydrated_from_visible_artifacts: true,
  });
  return { state: next, hydrated: true };
}

function scoreRecoveryCandidate(projectRoot, candidate) {
  const meta = candidate.meta || {};
  const sessionLogPath = resolveProjectPath(projectRoot, meta.session_log_path);
  const snapshotPath = resolveProjectPath(projectRoot, meta.snapshot_path);
  const auditPath = resolveProjectPath(projectRoot, meta.audit_verdict_path);
  const convergencePath = resolveProjectPath(projectRoot, meta.convergence_record_path);
  const captures = candidate.capture_paths || deriveSessionCapturePaths(projectRoot, candidate.session_key);

  const files = {
    session_log: statFile(sessionLogPath),
    snapshot: statFile(snapshotPath),
    audit_verdict: statFile(auditPath),
    convergence_record: statFile(convergencePath),
    launch_payload_capture: statFile(captures.launch_payload_capture),
    post_tool_use_raw: statFile(captures.post_tool_use_raw),
    visible_output_capture: statFile(captures.visible_output_capture),
    sidecar_started: statFile(captures.sidecar_started),
    sidecar_progress: statFile(captures.sidecar_progress),
    sidecar_final: statFile(captures.sidecar_final),
  };

  const score =
    (files.sidecar_final.exists ? 8 : 0) +
    (files.sidecar_progress.exists ? 6 : 0) +
    (files.sidecar_started.exists ? 2 : 0) +
    (files.launch_payload_capture.exists ? 4 : 0) +
    (files.post_tool_use_raw.exists ? 3 : 0) +
    (files.visible_output_capture.exists ? 5 : 0) +
    (files.session_log.exists && Number(files.session_log.size || 0) > 0 ? 5 : 0) +
    (files.snapshot.exists ? 2 : 0) +
    (files.audit_verdict.exists ? 3 : 0) +
    (files.convergence_record.exists ? 2 : 0);

  return {
    ...candidate,
    evidence_grade: deriveEvidenceGrade(files),
    evidence_timestamp: deriveEvidenceTimestamp(candidate, files),
    evidence_score: score,
    files,
  };
}

function currentSessionMetaTimestamp(projectRoot, state) {
  const metaPath = path.join(
    projectRoot,
    '_bmad-output',
    'party-mode',
    'sessions',
    `${String(state?.session_key || '')}.meta.json`
  );
  if (fs.existsSync(metaPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const metaTimestamp = (
        parseTimestamp(raw.updated_at) ??
        parseTimestamp(raw.created_at) ??
        fs.statSync(metaPath).mtime.getTime()
      );
      const captures = deriveSessionCapturePaths(projectRoot, String(state?.session_key || ''));
      return Math.max(
        metaTimestamp,
        parseStatTimestamp(
          statFile(resolveProjectPath(projectRoot, state?.sidecar_final_path) || captures.sidecar_final)
        ),
        parseStatTimestamp(
          statFile(
            resolveProjectPath(projectRoot, state?.sidecar_progress_path) || captures.sidecar_progress
          )
        ),
        parseStatTimestamp(
          statFile(
            resolveProjectPath(projectRoot, state?.sidecar_started_path) || captures.sidecar_started
          )
        )
      );
    } catch {
      return fs.statSync(metaPath).mtime.getTime();
    }
  }
  return (
    parseTimestamp(state && (state.updated_at || state.created_at || state.recorded_at)) ?? 0
  );
}

function currentSessionLogicalTimestamp(projectRoot, state) {
  const metaPath = path.join(
    projectRoot,
    '_bmad-output',
    'party-mode',
    'sessions',
    `${String(state?.session_key || '')}.meta.json`
  );
  if (fs.existsSync(metaPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      return (
        parseTimestamp(raw.updated_at) ??
        parseTimestamp(raw.created_at) ??
        fs.statSync(metaPath).mtime.getTime()
      );
    } catch {
      return fs.statSync(metaPath).mtime.getTime();
    }
  }
  return (
    parseTimestamp(state && (state.updated_at || state.created_at || state.recorded_at)) ?? 0
  );
}

function currentSessionLaunchOrderTimestamp(projectRoot, state) {
  const metaPath = path.join(
    projectRoot,
    '_bmad-output',
    'party-mode',
    'sessions',
    `${String(state?.session_key || '')}.meta.json`
  );
  if (fs.existsSync(metaPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      return (
        parseTimestamp(raw.updated_at) ??
        parseTimestamp(raw.created_at) ??
        fs.statSync(metaPath).mtime.getTime()
      );
    } catch {
      return fs.statSync(metaPath).mtime.getTime();
    }
  }
  if (String(state?.status || '') === 'completed' || String(state?.validation_status || '') === 'PASS') {
    return 0;
  }
  return parseTimestamp(state && state.recorded_at) ?? 0;
}

function buildRecoveredCurrentSessionState(projectRoot, previousState, candidate) {
  const meta = candidate.meta || {};
  return {
    source: 'recovered_stale_current_session_pointer',
    host_kind: previousState && previousState.host_kind ? previousState.host_kind : 'cursor',
    execution_mode:
      previousState && previousState.execution_mode
        ? previousState.execution_mode
        : 'cursor_generalPurpose_compat',
    status: 'launched',
    agent_id: previousState && previousState.agent_id ? previousState.agent_id : '',
    agent_type:
      previousState && previousState.agent_type
        ? previousState.agent_type
        : 'party-mode-facilitator',
    session_key: candidate.session_key,
    gate_profile_id: String(meta.gate_profile_id || ''),
    closure_level: String(meta.closure_level || ''),
    designated_challenger_id: String(meta.designated_challenger_id || ''),
    current_batch_index: Number.isFinite(Number(meta.current_batch_index))
      ? Number(meta.current_batch_index)
      : null,
    current_batch_start_round: Number.isFinite(Number(meta.current_batch_start_round))
      ? Number(meta.current_batch_start_round)
      : null,
    current_batch_target_round: Number.isFinite(Number(meta.current_batch_target_round))
      ? Number(meta.current_batch_target_round)
      : null,
    current_batch_status: String(meta.current_batch_status || 'pending'),
    target_rounds_total: Number.isFinite(Number(meta.target_rounds_total))
      ? Number(meta.target_rounds_total)
      : null,
    batch_size: Number.isFinite(Number(meta.batch_size)) ? Number(meta.batch_size) : null,
    checkpoint_window_ms: Number.isFinite(Number(meta.checkpoint_window_ms))
      ? Number(meta.checkpoint_window_ms)
      : null,
    agent_turn_event_source_mode: String(meta.agent_turn_event_source_mode || ''),
    host_native_agent_turn_supported:
      typeof meta.host_native_agent_turn_supported === 'boolean'
        ? meta.host_native_agent_turn_supported
        : null,
    host_native_agent_turn_reason: String(meta.host_native_agent_turn_reason || ''),
    session_log_path: String(meta.session_log_path || ''),
    snapshot_path: String(meta.snapshot_path || ''),
    convergence_record_path: String(meta.convergence_record_path || ''),
    audit_verdict_path: String(meta.audit_verdict_path || ''),
    visible_output_capture_path: derivePartyModeVisibleOutputCapturePath(
      projectRoot,
      candidate.session_key
    ),
    launch_payload_capture_path: derivePartyModeLaunchCapturePath(projectRoot, candidate.session_key),
    sidecar_started_path: derivePartyModeStartedSidecarPath(projectRoot, candidate.session_key),
    sidecar_progress_path: derivePartyModeProgressSidecarPath(projectRoot, candidate.session_key),
    sidecar_final_path: derivePartyModeFinalSidecarPath(projectRoot, candidate.session_key),
    recovered_from_stale_pointer: true,
    recovered_previous_session_key:
      previousState && previousState.session_key ? String(previousState.session_key) : '',
    recovered_at: new Date().toISOString(),
  };
}

function buildPreferredPendingLaunchState(projectRoot, previousState, candidate) {
  const meta = candidate.meta || {};
  return {
    source: 'preferred_newer_pending_launch',
    host_kind: previousState && previousState.host_kind ? previousState.host_kind : 'cursor',
    execution_mode:
      previousState && previousState.execution_mode
        ? previousState.execution_mode
        : 'cursor_generalPurpose_compat',
    status: 'launched',
    validation_status: '',
    agent_id: previousState && previousState.agent_id ? previousState.agent_id : '',
    agent_type:
      previousState && previousState.agent_type
        ? previousState.agent_type
        : 'party-mode-facilitator',
    session_key: candidate.session_key,
    gate_profile_id: String(meta.gate_profile_id || ''),
    closure_level: String(meta.closure_level || ''),
    designated_challenger_id: String(meta.designated_challenger_id || ''),
    current_batch_index: Number.isFinite(Number(meta.current_batch_index))
      ? Number(meta.current_batch_index)
      : null,
    current_batch_start_round: Number.isFinite(Number(meta.current_batch_start_round))
      ? Number(meta.current_batch_start_round)
      : null,
    current_batch_target_round: Number.isFinite(Number(meta.current_batch_target_round))
      ? Number(meta.current_batch_target_round)
      : null,
    current_batch_status: String(meta.current_batch_status || 'pending'),
    target_rounds_total: Number.isFinite(Number(meta.target_rounds_total))
      ? Number(meta.target_rounds_total)
      : null,
    batch_size: Number.isFinite(Number(meta.batch_size)) ? Number(meta.batch_size) : null,
    checkpoint_window_ms: Number.isFinite(Number(meta.checkpoint_window_ms))
      ? Number(meta.checkpoint_window_ms)
      : null,
    agent_turn_event_source_mode: String(meta.agent_turn_event_source_mode || ''),
    host_native_agent_turn_supported:
      typeof meta.host_native_agent_turn_supported === 'boolean'
        ? meta.host_native_agent_turn_supported
        : null,
    host_native_agent_turn_reason: String(meta.host_native_agent_turn_reason || ''),
    session_log_path: String(meta.session_log_path || ''),
    snapshot_path: String(meta.snapshot_path || ''),
    convergence_record_path: String(meta.convergence_record_path || ''),
    audit_verdict_path: String(meta.audit_verdict_path || ''),
    visible_output_capture_path: derivePartyModeVisibleOutputCapturePath(
      projectRoot,
      candidate.session_key
    ),
    launch_payload_capture_path: derivePartyModeLaunchCapturePath(projectRoot, candidate.session_key),
    sidecar_started_path: derivePartyModeStartedSidecarPath(projectRoot, candidate.session_key),
    sidecar_progress_path: derivePartyModeProgressSidecarPath(projectRoot, candidate.session_key),
    sidecar_final_path: derivePartyModeFinalSidecarPath(projectRoot, candidate.session_key),
    recovered_from_newer_launch: true,
    recovered_previous_session_key:
      previousState && previousState.session_key ? String(previousState.session_key) : '',
    pending_launch_evidence_present: true,
    pending_launch_detected_at: new Date().toISOString(),
  };
}

function maybeRecoverStaleCurrentSession(projectRoot, currentSessionPath, state, files) {
  if (!looksLikeStaleLaunchPointer(state, files)) {
    return { state, recovered: false };
  }

  const candidate = listSessionMetaCandidates(projectRoot)
    .filter(
      (entry) => entry.session_key !== String(state.session_key || '')
    )
    .map((entry) => scoreRecoveryCandidate(projectRoot, entry))
    .filter((entry) => entry.evidence_score > 0)
    .sort((left, right) => {
      if (right.evidence_grade !== left.evidence_grade) {
        return right.evidence_grade - left.evidence_grade;
      }
      if (right.evidence_timestamp !== left.evidence_timestamp) {
        return right.evidence_timestamp - left.evidence_timestamp;
      }
      return right.evidence_score - left.evidence_score;
    })[0];

  if (!candidate) {
    return { state, recovered: false };
  }

  const recoveredState = buildRecoveredCurrentSessionState(projectRoot, state, candidate);
  writePartyModeCurrentSessionState(projectRoot, recoveredState);
  return { state: recoveredState, recovered: true };
}

function maybeUpgradeRecoveredPointer(projectRoot, state) {
  if (!state || !state.recovered_from_stale_pointer) {
    return { state, upgraded: false };
  }
  const currentMetaTs = currentSessionMetaTimestamp(projectRoot, state);
  const currentCaptures = deriveSessionCapturePaths(projectRoot, String(state.session_key || ''));
  const currentEvidenceGrade = deriveEvidenceGrade({
    session_log: statFile(resolveProjectPath(projectRoot, state.session_log_path)),
    snapshot: statFile(resolveProjectPath(projectRoot, state.snapshot_path)),
    audit_verdict: statFile(resolveProjectPath(projectRoot, state.audit_verdict_path)),
    convergence_record: statFile(resolveProjectPath(projectRoot, state.convergence_record_path)),
    visible_output_capture: statFile(
      resolveProjectPath(projectRoot, state.visible_output_capture_path)
    ),
    launch_payload_capture: statFile(
      resolveProjectPath(projectRoot, state.launch_payload_capture_path) ||
        currentCaptures.launch_payload_capture
    ),
    post_tool_use_raw: statFile(currentCaptures.post_tool_use_raw),
    sidecar_started: statFile(
      resolveProjectPath(projectRoot, state.sidecar_started_path) || currentCaptures.sidecar_started
    ),
    sidecar_progress: statFile(
      resolveProjectPath(projectRoot, state.sidecar_progress_path) || currentCaptures.sidecar_progress
    ),
    sidecar_final: statFile(
      resolveProjectPath(projectRoot, state.sidecar_final_path) || currentCaptures.sidecar_final
    ),
  });
  const candidate = listSessionMetaCandidates(projectRoot)
    .filter((entry) => entry.session_key !== String(state.session_key || ''))
    .map((entry) => scoreRecoveryCandidate(projectRoot, entry))
    .filter(
      (entry) =>
        entry.evidence_score > 0 &&
        entry.evidence_timestamp > currentMetaTs &&
        entry.evidence_grade >= currentEvidenceGrade
    )
    .sort((left, right) => {
      if (right.evidence_grade !== left.evidence_grade) {
        return right.evidence_grade - left.evidence_grade;
      }
      if (right.evidence_timestamp !== left.evidence_timestamp) {
        return right.evidence_timestamp - left.evidence_timestamp;
      }
      return right.evidence_score - left.evidence_score;
    })[0];

  if (!candidate) {
    return { state, upgraded: false };
  }

  const upgradedState = buildRecoveredCurrentSessionState(projectRoot, state, candidate);
  writePartyModeCurrentSessionState(projectRoot, upgradedState);
  return { state: upgradedState, upgraded: true };
}

function maybePreferNewerPendingLaunch(projectRoot, state) {
  if (!state || typeof state !== 'object') {
    return { state, preferred: false };
  }
  const now = Date.now();
  const currentLaunchOrderTs = currentSessionLaunchOrderTimestamp(projectRoot, state);
  const candidate = listSessionMetaCandidates(projectRoot)
    .filter((entry) => entry.session_key !== String(state.session_key || ''))
    .map((entry) => scoreRecoveryCandidate(projectRoot, entry))
    .filter(
      (entry) =>
        hasPendingLaunchEvidence(entry.files) &&
        entry.timestamp > currentLaunchOrderTs
    )
    .sort((left, right) => {
      if (right.timestamp !== left.timestamp) {
        return right.timestamp - left.timestamp;
      }
      return right.evidence_score - left.evidence_score;
    })[0];

  if (!candidate) {
    return { state, preferred: false };
  }

  const next = buildPreferredPendingLaunchState(projectRoot, state, candidate);
  writePartyModeCurrentSessionState(projectRoot, next);
  return { state: next, preferred: true };
}

function buildSummary(projectRoot) {
  const currentSessionPath = partyModeCurrentSessionStatePath(projectRoot);
  const initialState = readPartyModeCurrentSessionState(projectRoot);
  const initialFiles =
    initialState && typeof initialState === 'object'
      ? {
          session_log: statFile(resolveProjectPath(projectRoot, initialState.session_log_path)),
          snapshot: statFile(resolveProjectPath(projectRoot, initialState.snapshot_path)),
          audit_verdict: statFile(resolveProjectPath(projectRoot, initialState.audit_verdict_path)),
          visible_output_capture: statFile(
            resolveProjectPath(projectRoot, initialState.visible_output_capture_path)
          ),
          convergence_record: statFile(
            resolveProjectPath(projectRoot, initialState.convergence_record_path)
          ),
          launch_payload_capture: statFile(
            resolveProjectPath(projectRoot, initialState.launch_payload_capture_path) ||
              deriveSessionCapturePaths(projectRoot, initialState.session_key || '').launch_payload_capture
          ),
          post_tool_use_raw: statFile(
            deriveSessionCapturePaths(projectRoot, initialState.session_key || '').post_tool_use_raw
          ),
          sidecar_started: statFile(
            resolveProjectPath(projectRoot, initialState.sidecar_started_path) ||
              deriveSessionCapturePaths(projectRoot, initialState.session_key || '').sidecar_started
          ),
          sidecar_progress: statFile(
            resolveProjectPath(projectRoot, initialState.sidecar_progress_path) ||
              deriveSessionCapturePaths(projectRoot, initialState.session_key || '').sidecar_progress
          ),
          sidecar_final: statFile(
            resolveProjectPath(projectRoot, initialState.sidecar_final_path) ||
              deriveSessionCapturePaths(projectRoot, initialState.session_key || '').sidecar_final
          ),
        }
      : null;
  const recovered = maybeRecoverStaleCurrentSession(
    projectRoot,
    currentSessionPath,
    initialState,
    initialFiles || {
      session_log: { exists: false, path: null, size: null },
      snapshot: { exists: false, path: null, size: null },
      audit_verdict: { exists: false, path: null, size: null },
      visible_output_capture: { exists: false, path: null, size: null },
      convergence_record: { exists: false, path: null, size: null },
      launch_payload_capture: { exists: false, path: null, size: null },
      post_tool_use_raw: { exists: false, path: null, size: null },
      sidecar_started: { exists: false, path: null, size: null },
      sidecar_progress: { exists: false, path: null, size: null },
      sidecar_final: { exists: false, path: null, size: null },
    }
  );
  const upgraded = maybeUpgradeRecoveredPointer(projectRoot, recovered.state);
  const preferredPendingLaunch = maybePreferNewerPendingLaunch(projectRoot, upgraded.state);
  const stateBeforeSidecar = preferredPendingLaunch.state;
  const stateAfterSidecar = stateBeforeSidecar
    ? hydrateStateFromSidecar(projectRoot, stateBeforeSidecar, {
        session_log: statFile(resolveProjectPath(projectRoot, stateBeforeSidecar.session_log_path)),
        snapshot: statFile(resolveProjectPath(projectRoot, stateBeforeSidecar.snapshot_path)),
        audit_verdict: statFile(resolveProjectPath(projectRoot, stateBeforeSidecar.audit_verdict_path)),
        visible_output_capture: statFile(
          resolveProjectPath(projectRoot, stateBeforeSidecar.visible_output_capture_path)
        ),
        convergence_record: statFile(
          resolveProjectPath(projectRoot, stateBeforeSidecar.convergence_record_path)
        ),
        launch_payload_capture: statFile(
          resolveProjectPath(projectRoot, stateBeforeSidecar.launch_payload_capture_path) ||
            deriveSessionCapturePaths(projectRoot, stateBeforeSidecar.session_key || '').launch_payload_capture
        ),
        post_tool_use_raw: statFile(
          deriveSessionCapturePaths(projectRoot, stateBeforeSidecar.session_key || '').post_tool_use_raw
        ),
        sidecar_started: statFile(
          resolveProjectPath(projectRoot, stateBeforeSidecar.sidecar_started_path) ||
            deriveSessionCapturePaths(projectRoot, stateBeforeSidecar.session_key || '').sidecar_started
        ),
        sidecar_progress: statFile(
          resolveProjectPath(projectRoot, stateBeforeSidecar.sidecar_progress_path) ||
            deriveSessionCapturePaths(projectRoot, stateBeforeSidecar.session_key || '').sidecar_progress
        ),
        sidecar_final: statFile(
          resolveProjectPath(projectRoot, stateBeforeSidecar.sidecar_final_path) ||
            deriveSessionCapturePaths(projectRoot, stateBeforeSidecar.session_key || '').sidecar_final
        ),
      }).state
    : stateBeforeSidecar;
  const state = stateAfterSidecar
    ? maybeHydrateStateFromVisibleArtifacts(projectRoot, stateAfterSidecar, {
        session_log: statFile(resolveProjectPath(projectRoot, stateAfterSidecar.session_log_path)),
        snapshot: statFile(resolveProjectPath(projectRoot, stateAfterSidecar.snapshot_path)),
        audit_verdict: statFile(resolveProjectPath(projectRoot, stateAfterSidecar.audit_verdict_path)),
        visible_output_capture: statFile(
          resolveProjectPath(projectRoot, stateAfterSidecar.visible_output_capture_path)
        ),
        convergence_record: statFile(
          resolveProjectPath(projectRoot, stateAfterSidecar.convergence_record_path)
        ),
        launch_payload_capture: statFile(
          resolveProjectPath(projectRoot, stateAfterSidecar.launch_payload_capture_path) ||
            deriveSessionCapturePaths(projectRoot, stateAfterSidecar.session_key || '').launch_payload_capture
        ),
        post_tool_use_raw: statFile(
          deriveSessionCapturePaths(projectRoot, stateAfterSidecar.session_key || '').post_tool_use_raw
        ),
        sidecar_started: statFile(
          resolveProjectPath(projectRoot, stateAfterSidecar.sidecar_started_path) ||
            deriveSessionCapturePaths(projectRoot, stateAfterSidecar.session_key || '').sidecar_started
        ),
        sidecar_progress: statFile(
          resolveProjectPath(projectRoot, stateAfterSidecar.sidecar_progress_path) ||
            deriveSessionCapturePaths(projectRoot, stateAfterSidecar.session_key || '').sidecar_progress
        ),
        sidecar_final: statFile(
          resolveProjectPath(projectRoot, stateAfterSidecar.sidecar_final_path) ||
            deriveSessionCapturePaths(projectRoot, stateAfterSidecar.session_key || '').sidecar_final
        ),
      }).state
    : stateAfterSidecar;
  if (!state) {
    return {
      current_session_exists: false,
      current_session_path: normalizePath(currentSessionPath),
      status: 'missing',
      execution_evidence_level: 'none',
    };
  }

  const sessionLogPath = resolveProjectPath(projectRoot, state.session_log_path);
  const snapshotPath = resolveProjectPath(projectRoot, state.snapshot_path);
  const auditPath = resolveProjectPath(projectRoot, state.audit_verdict_path);
  const capturePath = resolveProjectPath(projectRoot, state.visible_output_capture_path);
  const convergencePath = resolveProjectPath(projectRoot, state.convergence_record_path);
  const captures = deriveSessionCapturePaths(projectRoot, state.session_key || '');

  const files = {
    session_log: statFile(sessionLogPath),
    snapshot: statFile(snapshotPath),
    audit_verdict: statFile(auditPath),
    visible_output_capture: statFile(capturePath),
    convergence_record: statFile(convergencePath),
    launch_payload_capture: statFile(resolveProjectPath(projectRoot, state.launch_payload_capture_path) || captures.launch_payload_capture),
    post_tool_use_raw: statFile(captures.post_tool_use_raw),
    sidecar_started: statFile(resolveProjectPath(projectRoot, state.sidecar_started_path) || captures.sidecar_started),
    sidecar_progress: statFile(resolveProjectPath(projectRoot, state.sidecar_progress_path) || captures.sidecar_progress),
    sidecar_final: statFile(resolveProjectPath(projectRoot, state.sidecar_final_path) || captures.sidecar_final),
  };
  const generatedDocuments = summarizeGeneratedDocuments(projectRoot, state);
  const expectedDocuments = summarizeExpectedDocuments(projectRoot, state);
  const executionEvidenceLevel = deriveExecutionEvidenceLevel(state, files);

  return {
    current_session_exists: true,
    current_session_path: normalizePath(currentSessionPath),
    session_key: state.session_key || '',
    gate_profile_id: state.gate_profile_id || '',
    status: state.status || '',
    validation_status: state.validation_status || '',
    target_rounds_total: Number.isFinite(Number(state.target_rounds_total))
      ? Number(state.target_rounds_total)
      : null,
    observed_visible_round_count: Number.isFinite(Number(state.observed_visible_round_count))
      ? Number(state.observed_visible_round_count)
      : null,
    final_gate_result: state.final_gate_result || '',
    visible_fragment_record_present: Boolean(state.visible_fragment_record_present),
    recovered_from_stale_pointer: Boolean(
      state.recovered_from_stale_pointer || recovered.recovered || upgraded.upgraded
    ),
    recovered_from_newer_launch: Boolean(state.recovered_from_newer_launch || preferredPendingLaunch.preferred),
    recovered_previous_session_key: state.recovered_previous_session_key || '',
    recovered_from_sidecar: Boolean(state.recovered_from_sidecar),
    recovered_from_sidecar_kind: state.recovered_from_sidecar_kind || '',
    pending_launch_evidence_present: Boolean(state.pending_launch_evidence_present),
    agent_turn_event_source_mode: state.agent_turn_event_source_mode || '',
    host_native_agent_turn_supported:
      typeof state.host_native_agent_turn_supported === 'boolean'
        ? state.host_native_agent_turn_supported
        : null,
    host_native_agent_turn_reason: state.host_native_agent_turn_reason || '',
    execution_evidence_level: executionEvidenceLevel,
    document_generation_required: Boolean(state.document_generation_required),
    expected_document_count: Number.isFinite(Number(state.expected_document_count))
      ? Number(state.expected_document_count)
      : expectedDocuments.length,
    expected_documents: expectedDocuments,
    generated_document_count: Number.isFinite(Number(state.generated_document_count))
      ? Number(state.generated_document_count)
      : generatedDocuments.length,
    latest_generated_document_path: state.latest_generated_document_path || '',
    latest_generated_document_kind: state.latest_generated_document_kind || '',
    document_generation_observed_at: state.document_generation_observed_at || '',
    generated_documents: generatedDocuments,
    diagnostic_classification:
      state.visible_output_summary &&
      typeof state.visible_output_summary === 'object' &&
      typeof state.visible_output_summary.diagnostic_classification === 'string'
        ? state.visible_output_summary.diagnostic_classification
        : '',
    quality_flags:
      state.visible_output_summary &&
      typeof state.visible_output_summary === 'object' &&
      Array.isArray(state.visible_output_summary.quality_flags)
        ? state.visible_output_summary.quality_flags
        : [],
    visible_output_summary:
      state.visible_output_summary && typeof state.visible_output_summary === 'object'
        ? state.visible_output_summary
        : null,
    files,
  };
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--project-root') {
      out.projectRoot = next;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return out;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(args.projectRoot || process.cwd());
  process.stdout.write(`${JSON.stringify(buildSummary(projectRoot), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error && error.message ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
